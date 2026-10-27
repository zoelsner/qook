import { logFailure } from "../_shared/diagnostics.ts";

// Only call before attempting the private item association. First confirm this
// generating session became failed; an unknown/no-match transition must never
// authorize deletion. IDs are used in queries/checks, never diagnostics.
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
  try {
    const { data, error } = await admin.from("generation_sessions").update({
      status: "failed",
    }).eq("id", sessionId).eq("status", "generating").select("id");
    if (error) throw error;
    if (!Array.isArray(data) || data.length !== 1 || data[0]?.id !== sessionId) {
      throw new Error("Session failure transition was not confirmed");
    }
  } catch (error) {
    logFailure("generate-proposals", "session_failure", error);
    return { skeletonCleanup: "skipped", sessionMarkedFailed: false };
  }
  let skeletonCleanup: "skipped" | "done" | "failed" = "skipped";
  if (skeletonIds.length) {
    try {
      const { error } = await admin.from("recipes").delete().in(
        "id",
        skeletonIds,
      ).eq("content_status", "proposal");
      if (error) throw error;
      skeletonCleanup = "done";
    } catch (error) {
      skeletonCleanup = "failed";
      logFailure("generate-proposals", "skeleton_cleanup", error, {
        count: skeletonIds.length,
      });
    }
  }
  return { skeletonCleanup, sessionMarkedFailed: true };
}
