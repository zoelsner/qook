import { logFailure } from "../_shared/diagnostics.ts";

// Supabase normally reports failures in the result instead of rejecting. Both
// forms must be inspected, and a failed delete must not prevent the session
// from being marked failed. IDs are used only in queries, never diagnostics.
export async function failProposalSession(
  // deno-lint-ignore no-explicit-any
  admin: any,
  sessionId: string,
  skeletonIds: string[] = [],
): Promise<
  {
    skeletonCleanup: "skipped" | "done" | "failed";
    sessionMarkedFailed: boolean;
  }
> {
  let skeletonCleanup: "skipped" | "done" | "failed" = "skipped";
  if (skeletonIds.length) {
    try {
      const { error } = await admin.from("recipes").delete().in(
        "id",
        skeletonIds,
      );
      if (error) throw error;
      skeletonCleanup = "done";
    } catch (error) {
      skeletonCleanup = "failed";
      logFailure("generate-proposals", "skeleton_cleanup", error, {
        count: skeletonIds.length,
      });
    }
  }
  let sessionMarkedFailed = false;
  try {
    const { error } = await admin.from("generation_sessions").update({
      status: "failed",
    }).eq("id", sessionId);
    if (error) throw error;
    sessionMarkedFailed = true;
  } catch (error) {
    logFailure("generate-proposals", "session_failure", error);
  }
  return { skeletonCleanup, sessionMarkedFailed };
}
