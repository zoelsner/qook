// deno-lint-ignore no-explicit-any
type Admin = any;

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;
// Friend-TestFlight limits: enough room to explore without leaving paid
// generation effectively unbounded.
const DAILY_MAX = 10;
const MONTHLY_MAX = 30;

async function countSince(admin: Admin, userId: string, sinceMs: number, signal?: AbortSignal) {
  const since = new Date(Date.now() - sinceMs).toISOString();
  // Failed generations don't count against the user's quota (Zach
  // 2026-07-07). In-flight ("generating") sessions still count until they
  // are marked failed. The count
  // and reservation are separate; concurrent requests can still race.
  let query = admin
    .from("generation_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "failed")
    .gte("created_at", since);
  if (signal) query = query.abortSignal(signal);
  const { count, error } = await query;
  if (error) throw error;
  if (!Number.isInteger(count) || count < 0) throw new Error("Quota count unavailable");
  return count ?? 0;
}

export async function checkQuota(
  admin: Admin,
  userId: string,
  signal?: AbortSignal,
): Promise<{ ok: true } | { ok: false; scope: "day" | "month" }> {
  const daily = await countSince(admin, userId, DAY_MS, signal);
  if (daily >= DAILY_MAX) return { ok: false, scope: "day" };
  const monthly = await countSince(admin, userId, MONTH_MS, signal);
  if (monthly >= MONTHLY_MAX) return { ok: false, scope: "month" };
  return { ok: true };
}
