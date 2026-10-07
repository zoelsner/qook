import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { dinnerBrief, briefContext } from "../_shared/dinner-brief.ts";
import { buildLiveContext } from "../_shared/context.ts";
import { checkQuota } from "../_shared/rate-limit.ts";
import { readPhase, type PhaseTimers } from "../_shared/read-phase.ts";
import { serviceClient, userClient } from "../_shared/supabase.ts";
import { logFailure } from "../_shared/diagnostics.ts";
import { errorResponse, ERRORS } from "../_shared/errors.ts";

const RequestBody = z.object({
  tier: z.enum(["brain-is-fried", "after-work", "got-energy", "weekend-project"]),
  context: z.string().max(500).optional(),
  energyMix: z.string().max(120).optional(),
});
export type PreflightOptions = { timeoutMs?: number; fetch?: typeof fetch; timers?: PhaseTimers };

// A generous ceiling for authentication, body parsing and DB reads only;
// it is not a whole-route latency target or a paid-attempt budget.
export async function prepareProposal(req: Request, options: PreflightOptions = {}) {
  const phase = readPhase({ ...options, timeoutMs: options.timeoutMs ?? 15_000, signal: req.signal });
  try {
    return await phase.run(async () => {
      const auth = req.headers.get("Authorization");
      if (!auth) return new Response("Unauthorized", { status: 401 });
      const { data, error } = await userClient(auth, phase.fetch).auth.getUser();
      if (error) {
        if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
          return new Response("Unauthorized", { status: 401 });
        }
        throw error;
      }
      if (!data.user) return new Response("Unauthorized", { status: 401 });
      const parsed = RequestBody.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return errorResponse(ERRORS.BAD_REQUEST, "Bad request body.", 400);
      const { tier, context, energyMix } = parsed.data;
      const admin = serviceClient(phase.fetch);
      const { data: prefs, error: prefsError } = await admin.from("user_preferences")
        .select("*").eq("user_id", data.user.id).abortSignal(phase.signal).maybeSingle();
      if (prefsError) throw prefsError;
      const brief = dinnerBrief(buildLiveContext(tier, prefs ?? null, context));
      if (brief.conflicts.length) return errorResponse(ERRORS.VALIDATION, brief.conflicts.join(" "), 422);
      const quota = await checkQuota(admin, data.user.id, phase.signal);
      if (!quota.ok) return errorResponse(ERRORS.RATE_LIMITED, quota.scope === "day"
        ? "You've hit today's recipe limit — back tomorrow."
        : "You've hit this month's recipe limit.", 429);
      return { userId: data.user.id, tier, context, energyMix, brief, liveCtx: briefContext(brief, tier) };
    });
  } catch (error) {
    const failure = phase.signal.aborted ? phase.signal.reason : error;
    logFailure("generate-proposals", "preflight", failure);
    return errorResponse(ERRORS.GENERATION_FAILED, "The kitchen is busy — try again in a minute.",
      failure instanceof DOMException && failure.name === "TimeoutError" ? 504 : 503);
  } finally {
    phase.dispose();
  }
}
