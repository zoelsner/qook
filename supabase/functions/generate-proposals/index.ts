import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { chat } from "../_shared/openrouter.ts";
import { MODELS } from "../_shared/openrouter.ts";
import {
  buildProposalsSystemPrompt,
  buildProposalsUserPrompt,
} from "../_shared/prompts/proposals.ts";
import { ProposalsEnvelope, ProposalsEnvelopeJsonSchema } from "../_shared/schema.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { buildLiveContext } from "../_shared/context.ts";
import { checkQuota } from "../_shared/rate-limit.ts";
import { stripCodeFences } from "../_shared/partial-parser.ts";
import { dbRowToClientRecipe, toSkeletonInsert } from "../_shared/recipe-map.ts";
import { firstCacheHitId } from "./cache.ts";
import { ERRORS, errorResponse } from "../_shared/errors.ts";

const RequestBody = z.object({
  tier: z.enum(["brain-is-fried", "after-work", "got-energy", "weekend-project"]),
  context: z.string().max(500).optional(),
});

function clampServes(n: number): number {
  if (!Number.isFinite(n)) return 2;
  return Math.min(16, Math.max(1, Math.round(n)));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let userId: string;
  try {
    const { user } = await requireUser(req);
    userId = user.id;
  } catch (resp) {
    return resp as Response;
  }

  const admin = serviceClient();

  // A hand counts as one generation against the 10/day quota — check first.
  const quota = await checkQuota(admin, userId);
  if (!quota.ok) {
    return errorResponse(
      ERRORS.RATE_LIMITED,
      quota.scope === "day"
        ? "You've hit today's recipe limit — back tomorrow."
        : "You've hit this month's recipe limit.",
      429,
    );
  }

  const parsed = RequestBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(ERRORS.BAD_REQUEST, "Bad request body.", 400);
  }
  const { tier, context } = parsed.data;

  // The session row is the quota-counting record — check its insert.
  const { data: session, error: sessionError } = await admin
    .from("generation_sessions")
    .insert({
      user_id: userId,
      flavor_mode: "comfort",
      effort_mode: "standard",
      energy_tier: tier,
      recipe_count: 5,
      voice_context: context ?? null,
      status: "generating",
    })
    .select("id")
    .single();
  if (sessionError) {
    console.error("generate-proposals session insert failed", String(sessionError));
    return errorResponse(ERRORS.GENERATION_FAILED, "The kitchen is busy — try again in a minute.", 500);
  }
  const sessionId: string = session.id;

  const { data: prefs } = await admin
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const liveCtx = buildLiveContext(tier, prefs ?? null, context);
  const serves = clampServes(liveCtx.householdSize);

  // Populated as skeleton rows are inserted below; the catch block uses this
  // to best-effort delete only THIS request's skeletons on a mid-loop
  // failure (never cache-hit rows) so a broken generation doesn't leave
  // orphaned 'proposal' rows behind.
  const skeletonIds: string[] = [];

  try {
    const content = await chat({
      model: MODELS.textDraft(),
      messages: [
        { role: "system", content: buildProposalsSystemPrompt() },
        { role: "user", content: buildProposalsUserPrompt(liveCtx) },
      ],
      jsonSchema: ProposalsEnvelopeJsonSchema,
      temperature: 0.85,
      timeoutMs: 30_000,
      costLabel: "proposals",
    });

    const raw = JSON.parse(stripCodeFences(content));
    if (raw && typeof raw === "object" && typeof raw.refusal === "string" && raw.refusal) {
      await admin.from("generation_sessions").update({ status: "failed" }).eq("id", sessionId);
      return errorResponse(ERRORS.VALIDATION, raw.refusal, 422);
    }
    const result = ProposalsEnvelope.safeParse(raw);
    if (!result.success) {
      console.error(
        "generate-proposals validation failed",
        JSON.stringify(result.error.issues.slice(0, 5)),
        "raw:",
        content.slice(0, 300),
      );
      await admin.from("generation_sessions").update({ status: "failed" }).eq("id", sessionId);
      return errorResponse(ERRORS.VALIDATION, "The kitchen produced something odd — try again.", 422);
    }

    // For each proposal: reuse an exact-title global 'full' row if one exists
    // (Resolved Q1), else insert a skeleton. Keep the 5 ids in proposal order.
    // hookById carries Luna's per-proposal hook through to the response so a
    // cache-hit row missing a hook (pre-existing full rows never had one)
    // still renders one. skeletonIds tracks only rows this request inserted
    // — never cache hits — so a mid-loop failure can clean up just those.
    const ids: string[] = [];
    const hookById = new Map<string, string>();
    for (const p of result.data.proposals) {
      const { data: hits } = await admin
        .from("recipes")
        .select("id, hook")
        .eq("title", p.title)
        .is("user_id", null)
        .eq("content_status", "full")
        .order("use_count", { ascending: false })
        .limit(1);
      const hitId = firstCacheHitId(hits ?? null);
      if (hitId) {
        ids.push(hitId);
        hookById.set(hitId, p.hook);
        await admin.rpc("increment_use_count", { recipe_id: hitId });
        if (!hits?.[0]?.hook) {
          const { error: hookError } = await admin
            .from("recipes")
            .update({ hook: p.hook })
            .eq("id", hitId)
            .is("hook", null);
          if (hookError) {
            console.error("generate-proposals cache-hit hook backfill failed", String(hookError));
          }
        }
        continue;
      }
      const { data: inserted, error } = await admin
        .from("recipes")
        .insert(toSkeletonInsert(p, tier, serves))
        .select("id")
        .single();
      if (error) throw error;
      ids.push(inserted.id);
      skeletonIds.push(inserted.id);
      hookById.set(inserted.id, p.hook);
    }

    const { data: rows } = await admin.from("recipes").select("*").in("id", ids);
    const byId = new Map((rows ?? []).map((r: Record<string, unknown>) => [r.id, r]));
    const proposals = ids
      .map((id) => byId.get(id))
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((row) => ({
        ...dbRowToClientRecipe(row, []),
        hook: (row.hook as string | null | undefined) ?? hookById.get(String(row.id)),
      }));

    await admin.from("generation_sessions").update({ status: "ready" }).eq("id", sessionId);
    return new Response(JSON.stringify({ proposals }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (skeletonIds.length) {
      try {
        await admin.from("recipes").delete().in("id", skeletonIds);
      } catch (cleanupErr) {
        console.error("generate-proposals skeleton cleanup failed", String(cleanupErr));
      }
    }
    await admin.from("generation_sessions").update({ status: "failed" }).eq("id", sessionId);
    console.error("generate-proposals error", String(err));
    return errorResponse(ERRORS.GENERATION_FAILED, "The kitchen is busy — try again in a minute.", 500);
  }
});
