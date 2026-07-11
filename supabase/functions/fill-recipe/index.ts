import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { chat } from "../_shared/openrouter.ts";
import { MODELS } from "../_shared/openrouter.ts";
import { buildFillSystemPrompt, buildFillUserPrompt } from "../_shared/prompts/fill.ts";
import { Recipe, RecipeJsonSchema } from "../_shared/schema.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { buildLiveContext } from "../_shared/context.ts";
import { stripCodeFences } from "../_shared/partial-parser.ts";
import { computeSignature, dbRowToClientRecipe, toFillUpdate } from "../_shared/recipe-map.ts";
import { resolveFillTarget } from "./dedup.ts";
import { ERRORS, errorResponse } from "../_shared/errors.ts";

const RequestBody = z.object({
  recipeId: z.string().uuid(),
  context: z.string().max(500).optional(),
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let userId: string;
  try {
    const { user } = await requireUser(req);
    userId = user.id;
  } catch (resp) {
    return resp as Response;
  }

  const parsed = RequestBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse(ERRORS.BAD_REQUEST, "recipeId required.", 400);
  const { recipeId, context } = parsed.data;

  const admin = serviceClient();

  const { data: row, error } = await admin
    .from("recipes")
    .select("*")
    .eq("id", recipeId)
    .maybeSingle();
  if (error || !row) return errorResponse(ERRORS.NOT_FOUND, "Recipe not found.", 404);

  // Idempotent: a keep + a later cook-tonight both fire fill for the same card.
  // If it's already full (or was replaced), return it as-is. Natural per-hand
  // cap: only 5 skeletons exist per hand and each fills at most once.
  if (String(row.content_status) === "full") {
    return new Response(JSON.stringify({ recipeId, status: "full" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Phase-2 is quota-free (the hand already paid). Build context for THIS user;
  // tier comes from the skeleton row.
  const { data: prefs } = await admin
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const tier = String(row.energy_tier);
  const liveCtx = buildLiveContext(
    tier as Parameters<typeof buildLiveContext>[0],
    prefs ?? null,
    context,
  );

  try {
    const content = await chat({
      model: MODELS.textDraft(),
      messages: [
        { role: "system", content: buildFillSystemPrompt() },
        {
          role: "user",
          content: buildFillUserPrompt(liveCtx, String(row.title), row.hook ? String(row.hook) : null),
        },
      ],
      jsonSchema: RecipeJsonSchema,
      temperature: 0.7,
      timeoutMs: 60_000,
      costLabel: "fill",
    });

    const result = Recipe.safeParse(JSON.parse(stripCodeFences(content)));
    if (!result.success) {
      throw new Error(`fill validation failed: ${JSON.stringify(result.error.issues.slice(0, 3))}`);
    }
    const recipe = result.data;
    const signature = await computeSignature(recipe);

    const { data: existing } = await admin
      .from("recipes")
      .select("id")
      .eq("signature", signature)
      .is("user_id", null)
      .eq("content_status", "full");
    const target = resolveFillTarget(recipeId, existing ?? null);

    if (target.action === "cache-hit") {
      // Point at the pre-existing full row; drop the now-redundant skeleton.
      await admin.rpc("increment_use_count", { recipe_id: target.targetId });
      await admin.from("recipes").delete().eq("id", recipeId);
      return new Response(JSON.stringify({ recipeId: target.targetId, status: "full" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fill the skeleton in place. image_status is untouched (art fired at deal).
    await admin.from("recipes").update(toFillUpdate(recipe, signature)).eq("id", recipeId);
    return new Response(JSON.stringify({ recipeId, status: "full" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Leave content_status 'proposal'; record the error for the detail view's
    // retry affordance.
    await admin
      .from("recipes")
      .update({ generation_error: String(err).slice(0, 400) })
      .eq("id", recipeId);
    console.error("fill-recipe error", String(err));
    return errorResponse(ERRORS.GENERATION_FAILED, "Couldn't finish that recipe — try again.", 502);
  }
});
