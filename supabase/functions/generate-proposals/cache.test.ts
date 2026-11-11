import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { firstCacheHitId } from "./cache.ts";
import { contract, mismatch, storedRecipe } from "../fill-recipe/fixtures.ts";

Deno.test("cache skips title-only and inconsistent rows for a faithful match", () => {
  assertEquals(
    firstCacheHitId([{ id: "title-only" }, storedRecipe(mismatch), {
      ...storedRecipe(),
      id: "good",
    }], contract),
    "good",
  );
});
Deno.test("cache returns null on absent or incompatible data", () => {
  assertEquals(firstCacheHitId([], contract), null);
  assertEquals(firstCacheHitId(null, contract), null);
  assertEquals(firstCacheHitId([storedRecipe(mismatch)], contract), null);
});

Deno.test("proposal cache reads overlap, preserve filters and per-title limits, and retain duplicate input order", async () => {
  const { readProposalCandidates } = await import("./cache.ts");
  const titles = ["A", "B", "C", "A", "E"];
  const queries: unknown[][] = [];
  const complete: ((value: unknown) => void)[] = [];
  const admin = { from(table: string) {
    const ops: unknown[] = [["from", table]]; queries.push(ops);
    const chain = {
      select(columns: string) { ops.push(["select", columns]); return chain; },
      eq(k: string, v: unknown) { ops.push(["eq", k, v]); return chain; },
      is(k: string, v: unknown) { ops.push(["is", k, v]); return chain; },
      order(k: string, v: unknown) { ops.push(["order", k, v]); return chain; },
      limit(n: number) { ops.push(["limit", n]); return new Promise(resolve => complete.push(resolve)); },
    };
    return chain;
  }};
  const pending = readProposalCandidates(admin, titles);
  assertEquals(complete.length, 5, "all reads begin before any completes");
  for (let i = 4; i >= 0; i--) complete[i]({ data: i === 1 ? [] : [{ id: String(i) }], error: null });
  assertEquals(await pending, [[{ id: "0" }], [], [{ id: "2" }], [{ id: "3" }], [{ id: "4" }]]);
  queries.forEach((ops, i) => assertEquals(ops, [
    ["from", "recipes"], ["select", "*"], ["eq", "title", titles[i]],
    ["is", "user_id", null], ["eq", "content_status", "full"],
    ["order", "use_count", { ascending: false }], ["limit", 5],
  ]));
});

Deno.test("failed cache read remains a failure rather than a new skeleton miss", async () => {
  const { readProposalCandidates } = await import("./cache.ts");
  const chain = { select: () => chain, eq: () => chain, is: () => chain, order: () => chain,
    limit: () => Promise.resolve({ data: null, error: { message: "private DB error" } }) };
  await assertRejects(() => readProposalCandidates({ from: () => chain }, ["A"]), Error, "Proposal cache lookup failed");
});

Deno.test("Supabase SDK recovers one transient 503 cache read; exhausted 503 is a failed lookup", async () => {
  const { readProposalCandidates } = await import("./cache.ts");
  const { serviceClient } = await import("../_shared/supabase.ts");
  Deno.env.set("SUPABASE_URL", "http://qook.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "synthetic");
  const oldFetch = globalThis.fetch;
  let calls = 0, recover = true;
  globalThis.fetch = () => {
    calls++;
    const failure = !recover || calls === 1;
    return Promise.resolve(new Response(JSON.stringify(failure ? { message: "unavailable" } : [{ id: "recovered" }]),
      { status: failure ? 503 : 200, headers: { "Content-Type": "application/json", "Retry-After": "0" } }));
  };
  try {
    assertEquals(await readProposalCandidates(serviceClient(), ["fixture"]), [[{ id: "recovered" }]]);
    assertEquals(calls, 2);
    calls = 0; recover = false;
    await assertRejects(() => readProposalCandidates(serviceClient(), ["fixture"]), Error, "Proposal cache lookup failed");
    assertEquals(calls, 4, "SDK retries are bounded in attempt count; elapsed-time cap remains separate");
  } finally { globalThis.fetch = oldFetch; }
});
