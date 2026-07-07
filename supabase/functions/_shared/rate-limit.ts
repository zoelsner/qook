// deno-lint-ignore no-explicit-any
type Admin = any;

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;
const DAILY_MAX = 10;
const MONTHLY_MAX = 30;

async function countSince(admin: Admin, userId: string, sinceMs: number) {
  const since = new Date(Date.now() - sinceMs).toISOString();
  // Failed generations don't count against the user's quota (Zach
  // 2026-07-07). In-flight ("generating") sessions still count, so a
  // parallel blast can't outrun the limit; they stop counting only once
  // finishSession marks them failed.
  const { count, error } = await admin
    .from("generation_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "failed")
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

export async function checkQuota(
  admin: Admin,
  userId: string,
): Promise<{ ok: true } | { ok: false; scope: "day" | "month" }> {
  const daily = await countSince(admin, userId, DAY_MS);
  if (daily >= DAILY_MAX) return { ok: false, scope: "day" };
  const monthly = await countSince(admin, userId, MONTH_MS);
  if (monthly >= MONTHLY_MAX) return { ok: false, scope: "month" };
  return { ok: true };
}
