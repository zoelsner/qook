import { dinnerBrief, briefContext, briefDirective } from "../_shared/dinner-brief.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { chat } from "../_shared/openrouter.ts";
import { MODELS } from "../_shared/openrouter.ts";
import {
  buildProposalsSystemPrompt,
  buildProposalsUserPrompt,
} from "../_shared/prompts/proposals.ts";
import {
  ProposalsEnvelope,
  ProposalsEnvelopeJsonSchema,
} from "../_shared/schema.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { buildLiveContext } from "../_shared/context.ts";
import { checkQuota } from "../_shared/rate-limit.ts";
import { stripCodeFences } from "../_shared/partial-parser.ts";
import {
  dbRowToClientRecipe,
  toSkeletonInsert,
} from "../_shared/recipe-map.ts";
import { contractFromRow, validateProposalBrief } from "../_shared/fill-contract.ts";
import { firstCacheHitId, readProposalCandidates } from "./cache.ts";
import { failProposalSession } from "./cleanup.ts";
import { logFailure } from "../_shared/diagnostics.ts";
import { errorResponse, ERRORS } from "../_shared/errors.ts";

const RequestBody = z.object({
  tier: z.enum([
    "brain-is-fried",
    "after-work",
    "got-energy",
    "weekend-project",
  ]),
  context: z.string().max(500).optional(),
  energyMix: z.string().max(120).optional(),
});

function clampServes(n: number): number {
  if (!Number.isFinite(n)) return 2;
  return Math.min(16, Math.max(1, Math.round(n)));
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
  const { tier, context, energyMix } = parsed.data;

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
    logFailure("generate-proposals", "session_insert", sessionError);
    return errorResponse(
      ERRORS.GENERATION_FAILED,
      "The kitchen is busy — try again in a minute.",
      500,
    );
  }
  const sessionId: string = session.id;

  const { data: prefs } = await admin
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const brief = dinnerBrief(buildLiveContext(tier, prefs ?? null, context));
  if (brief.conflicts.length) {
    await failProposalSession(admin, sessionId);
    return errorResponse(ERRORS.VALIDATION, brief.conflicts.join(" "), 422);
  }
  const liveCtx = briefContext(brief, tier);
  const serves = clampServes(liveCtx.householdSize);

  // Populated as skeleton rows are inserted below; the catch block uses this
  // to best-effort delete only THIS request's skeletons on a mid-loop
  // failure (never cache-hit rows) so a broken generation doesn't leave
  // orphaned 'proposal' rows behind.
  const skeletonIds: string[] = [];

  try {
    // The schema clamps most model drift; if output is still unusable
    // (unparseable JSON, too-few items) re-roll once before surfacing an
    // error — chat() already retries HTTP-level failures internally, so this
    // covers only the 200-but-bad-content case.
    let envelope: z.infer<typeof ProposalsEnvelope> | null = null;
    for (let attempt = 1; attempt <= 2 && !envelope; attempt++) {
      const content = await chat({
        model: MODELS.textDraft(),
        messages: [
          { role: "system", content: buildProposalsSystemPrompt() },
          {
            role: "user",
            content: buildProposalsUserPrompt(liveCtx, energyMix) + "\n" + briefDirective(brief),
          },
        ],
        jsonSchema: ProposalsEnvelopeJsonSchema,
        temperature: 0.85,
        timeoutMs: 30_000,
        costLabel: "proposals",
        // gpt-5.6-* reason by default and burn 355-1622 reasoning tokens, putting
        // the p95 of this call at ~43s. "low" caps it at ~13s with no measured
        // quality loss (2026-07-28 eval, n=6 per arm).
        reasoning: { effort: "low" },
      });

      let raw: unknown;
      try {
        raw = JSON.parse(stripCodeFences(content));
      } catch {
        logFailure("generate-proposals", "invalid_json", undefined, { attempt });
        continue;
      }
      // A genuine safety refusal stands — never re-roll past it.
      const refusal = (raw as { refusal?: unknown } | null)?.refusal;
      if (typeof refusal === "string" && refusal) {
        await failProposalSession(admin, sessionId);
        return errorResponse(ERRORS.VALIDATION, refusal, 422);
      }
      const result = ProposalsEnvelope.safeParse(raw);
      if (!result.success) {
        logFailure("generate-proposals", "invalid_schema", undefined, { attempt, issues: result.error.issues });
        continue;
      }
      const constraintErrors = result.data.proposals.flatMap(p => {
        const contract = contractFromRow(toSkeletonInsert(p, tier, serves), brief);
        return [
          ...validateProposalBrief(contract),
          // Check the original estimate before contractFromRow clamps it to
          // the tier/brief ceiling. A clamped contract cannot validate the card.
          ...(p.timeMinutes > contract.maxMinutes ? ["Keep the dinner time limit."] : []),
        ];
      });
      if (constraintErrors.length) continue;
      envelope = result.data;
    }
    if (!envelope) {
      await failProposalSession(admin, sessionId);
      return errorResponse(
        ERRORS.VALIDATION,
        "The kitchen produced something odd — try again.",
        422,
      );
    }

    // Reuse a full row only when its proposal and cooking contract match,
    // otherwise insert a skeleton. Keep the 5 ids in proposal order.
    // hookById carries Luna's per-proposal hook through to the response so a
    // cache-hit row missing a hook (pre-existing full rows never had one)
    // still renders one. skeletonIds tracks only rows this request inserted
    // — never cache hits — so a mid-loop failure can clean up just those.
    const ids: string[] = [];
    const hookById = new Map<string, string>();
    const candidates = await readProposalCandidates(admin, envelope.proposals.map(p => p.title));
    for (const [index, p] of envelope.proposals.entries()) {
      const hits = candidates[index];
      const hitId = firstCacheHitId(
        hits ?? null,
        contractFromRow(toSkeletonInsert(p, tier, serves), brief),
      );
      if (hitId) {
        ids.push(hitId);
        hookById.set(hitId, p.hook);
        await admin.rpc("increment_use_count", { recipe_id: hitId });
        if (!hits.find(hit => hit.id === hitId)?.hook) {
          const { error: hookError } = await admin
            .from("recipes")
            .update({ hook: p.hook })
            .eq("id", hitId)
            .is("hook", null);
          if (hookError) {
            logFailure("generate-proposals", "hook_backfill", hookError);
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

    // The association and brief stay private to this user's session. A shared
    // cache row never receives their context or allergy/preferences snapshot.
    const { error: itemError } = await admin.from("generation_items").insert(ids.map((id, index) => ({
      session_id: sessionId, slot_index: index, recipe_id: id, status: "ready",
      prompt_meta: { version: 1, originalRecipeId: id, brief, contract: contractFromRow(toSkeletonInsert(envelope!.proposals[index], tier, serves), brief) },
    })));
    if (itemError) throw itemError;

    const { data: rows, error: rowsError } = await admin.from("recipes").select("*").in(
      "id",
      ids,
    );
    const byId = new Map(
      (rows ?? []).map((r: Record<string, unknown>) => [r.id, r]),
    );
    if (rowsError || ids.some(id => !byId.has(id))) throw new Error("Could not read all dinner cards");
    const proposals = ids
      .map((id) => byId.get(id))
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((row) => ({
        ...dbRowToClientRecipe(row, []),
        generationSessionId: sessionId,
        hook: (row.hook as string | null | undefined) ??
          hookById.get(String(row.id)),
      }));

    const { error: readyError } = await admin.from("generation_sessions").update({ status: "ready" }).eq(
      "id",
      sessionId,
    );
    if (readyError) throw new Error("Could not finish dinner session");
    return new Response(JSON.stringify({ proposals }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    await failProposalSession(admin, sessionId, skeletonIds);
    logFailure("generate-proposals", "generation", err);
    return errorResponse(
      ERRORS.GENERATION_FAILED,
      "The kitchen is busy — try again in a minute.",
      500,
    );
  }
});
