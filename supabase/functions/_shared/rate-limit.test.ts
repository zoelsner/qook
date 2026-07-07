import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkQuota } from "./rate-limit.ts";

// Fake supabase client: returns a canned count per call, in order.
function fakeClient(counts: number[]) {
  let i = 0;
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                neq() {
                  return {
                    gte: () =>
                      Promise.resolve({ count: counts[i++], error: null }),
                  };
                },
              };
            },
          };
        },
      };
    },
    // deno-lint-ignore no-explicit-any
  } as any;
}

Deno.test("under both limits → ok", async () => {
  // first call = daily count, second = monthly count
  const res = await checkQuota(fakeClient([3, 12]), "u1");
  assertEquals(res, { ok: true });
});

Deno.test("over daily limit → day scope", async () => {
  const res = await checkQuota(fakeClient([10, 12]), "u1");
  assertEquals(res, { ok: false, scope: "day" });
});

Deno.test("over monthly limit → month scope", async () => {
  const res = await checkQuota(fakeClient([2, 30]), "u1");
  assertEquals(res, { ok: false, scope: "month" });
});
