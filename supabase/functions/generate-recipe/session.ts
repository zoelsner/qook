// deno-lint-ignore no-explicit-any
type Admin = any;

/**
 * Move a generation_sessions row to a terminal status ('ready' | 'failed').
 * Never throws — a failed status update degrades to a console.error so it
 * can't turn into a client-facing error from within the SSE stream path.
 */
export async function finishSession(
  admin: Admin,
  sessionId: string,
  status: "ready" | "failed",
): Promise<void> {
  try {
    const { error } = await admin
      .from("generation_sessions")
      .update({ status })
      .eq("id", sessionId);
    if (error) {
      console.error("finishSession update failed", String(error));
    }
  } catch (err) {
    console.error("finishSession threw", String(err));
  }
}
