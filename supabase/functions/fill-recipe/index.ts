import { DinnerBriefSchema, briefContext } from "../_shared/dinner-brief.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import {
  compatibleCachedRecipe,
  contractFromRow,
  fillSignature,
} from "../_shared/fill-contract.ts";
import { generateConsistentFill } from "./generate.ts";
import { logFailure } from "../_shared/diagnostics.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { toFillUpdate } from "../_shared/recipe-map.ts";
import { resolveFillTarget } from "./dedup.ts";
import { errorResponse, ERRORS } from "../_shared/errors.ts";

const RequestBody = z.object({
  recipeId: z.string().uuid(),
  context: z.string().max(500).optional(), // accepted for old clients, never overrides a saved brief
  generationSessionId: z.string().uuid().optional(),
});

// deno-lint-ignore no-explicit-any
type Admin = any;

// Global 'full' rows sharing a signature — used both for the normal
// post-write dedup check and the concurrent-fill retry below. Fail-safe on
// lookup error: log and treat as "no match" rather than throwing, since a
// missed cache hit just means a harmless duplicate, not a broken fill.
async function findGlobalFullRows(admin: Admin, signature: string) {
  const { data, error } = await admin
    .from("recipes")
    .select("*")
    .eq("signature", signature)
    .is("user_id", null)
    .eq("content_status", "full");
  if (error) logFailure("fill-recipe", "cache_lookup", error);
  return data ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let userId: string;
  try {
    const { user } = await requireUser(req);
    userId = user.id;
  } catch (resp) {
    return resp as Response;
  }

  const parsed = RequestBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(ERRORS.BAD_REQUEST, "recipeId required.", 400);
  }
  let { recipeId } = parsed.data;
  const { generationSessionId } = parsed.data;

  const admin = serviceClient();

  let itemQuery = admin.from("generation_items")
    .select("id,recipe_id,prompt_meta,generation_sessions!inner(user_id)")
    .eq("generation_sessions.user_id", userId);
  if (generationSessionId) itemQuery = itemQuery.eq("session_id", generationSessionId)
    .or(`recipe_id.eq.${recipeId},prompt_meta->>originalRecipeId.eq.${recipeId}`);
  else itemQuery = itemQuery.eq("recipe_id", recipeId).order("created_at", { ascending: false });
  const { data: item, error: itemError } = await itemQuery.limit(1).maybeSingle();
  const owners: unknown = item?.generation_sessions;
  const owner = (Array.isArray(owners) ? owners[0] : owners) as { user_id?: string } | null;
  const briefResult = DinnerBriefSchema.safeParse(item?.prompt_meta?.brief);
  if (itemError || !item || owner?.user_id !== userId || !briefResult.success || item.prompt_meta?.version !== 1) {
    return errorResponse(ERRORS.VALIDATION, "This older dinner card has no saved brief. Choose a new dinner idea to keep your requirements.", 422);
  }
  recipeId = item.recipe_id ?? recipeId;
  const brief = briefResult.data;

  const { data: row, error } = await admin
    .from("recipes")
    .select("*")
    .eq("id", recipeId)
    .maybeSingle();
  if (error || !row) {
    return errorResponse(ERRORS.NOT_FOUND, "Recipe not found.", 404);
  }

  let contract;
  try {
    const saved = item.prompt_meta.contract;
    if (!saved || !Array.isArray(saved.ingredients) || !Array.isArray(saved.steps)) throw new Error("Missing saved contract");
    contract = contractFromRow({ title: saved.title, energy_tier: saved.tier, serves: saved.servings, total_time_min: saved.maxMinutes, proposal_ingredients: saved.ingredients, proposal_steps: saved.steps }, brief);
  } catch {
    return errorResponse(
      ERRORS.VALIDATION,
      "This dinner card is incomplete — choose a new dinner idea.",
      422,
    );
  }

  // Idempotent: a keep + a later cook-tonight both fire fill for the same card.
  // If it's already full (or was replaced), return it as-is. Natural per-hand
  // cap: only 5 skeletons exist per hand and each fills at most once.
  if (String(row.content_status) === "full") {
    if (!compatibleCachedRecipe(row, contract)) {
      return errorResponse(
        ERRORS.VALIDATION,
        "This saved recipe does not match its dinner idea — choose a new dinner idea.",
        422,
      );
    }
    return new Response(JSON.stringify({ recipeId, status: "full" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Use the immutable private brief, never current preferences or a retry's
  // free text. Repeated requests and reopen preserve the accepted requirements.
  const liveCtx = briefContext(brief, contract.tier);
  const adoptTarget = async (targetId: string) => {
    const { error } = await admin.from("generation_items").update({ recipe_id: targetId }).eq("id", item.id);
    if (error) throw error;
  };

  try {
    const recipe = await generateConsistentFill(
      contract,
      liveCtx,
      row.hook ? String(row.hook) : null,
    );
    const signature = await fillSignature(recipe, contract);

    const existing = await findGlobalFullRows(admin, signature);
    const target = resolveFillTarget(
      recipeId,
      existing?.filter((candidate: Record<string, unknown>) =>
        compatibleCachedRecipe(candidate, contract)
      ) ?? null,
    );

    if (target.action === "cache-hit") {
      await adoptTarget(target.targetId);
      // Point at the pre-existing full row; drop the now-redundant skeleton.
      // Fail-safe: an RPC or delete error here doesn't change the response —
      // a stale use_count or a surviving redundant skeleton is harmless.
      const { error: rpcError } = await admin.rpc("increment_use_count", {
        recipe_id: target.targetId,
      });
      if (rpcError) {
        logFailure("fill-recipe", "cache_use_count", rpcError);
      }
      const { error: deleteError } = await admin.from("recipes").delete().eq(
        "id",
        recipeId,
      );
      if (deleteError) {
        logFailure("fill-recipe", "skeleton_cleanup", deleteError);
      }
      return new Response(
        JSON.stringify({ recipeId: target.targetId, status: "full" }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Fill the skeleton in place. image_status is untouched (art fired at deal).
    const { error: updateError } = await admin
      .from("recipes")
      .update(toFillUpdate(recipe, signature))
      .eq("id", recipeId);

    if (updateError) {
      // 23505 = unique violation on the global signature index: a concurrent
      // fill committed this exact signature first. Re-check for that row and
      // fall back to the cache-hit path instead of failing the request.
      if (updateError.code === "23505") {
        const winner = await findGlobalFullRows(admin, signature);
        const raceTarget = winner?.find((r: Record<string, unknown>) =>
          r.id !== recipeId && compatibleCachedRecipe(r, contract)
        );
        if (raceTarget) {
          await adoptTarget(String(raceTarget.id));
          const { error: deleteError } = await admin.from("recipes").delete()
            .eq("id", recipeId);
          if (deleteError) {
            logFailure("fill-recipe", "skeleton_cleanup", deleteError);
          }
          return new Response(
            JSON.stringify({ recipeId: raceTarget.id, status: "full" }),
            {
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }
      throw updateError;
    }

    return new Response(JSON.stringify({ recipeId, status: "full" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Leave content_status 'proposal'; record the error for the detail view's
    // retry affordance.
    logFailure("fill-recipe", "generation", err);
    try {
      const { error } = await admin
        .from("recipes")
        .update({ generation_error: "Recipe generation failed. Try again." })
        .eq("id", recipeId);
      if (error) logFailure("fill-recipe", "error_persistence", error);
    } catch (error) {
      logFailure("fill-recipe", "error_persistence", error);
    }
    return errorResponse(
      ERRORS.GENERATION_FAILED,
      "Couldn't finish that recipe — try again.",
      502,
    );
  }
});
