import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { failProposalSession } from "./cleanup.ts";

const session = "PRIVATE-session";

// Protocol fixtures, not a PostgreSQL/RLS test. SDK-level failure fixtures also
// assert the emitted filters and enforce them against in-memory state.
async function cleanupScenario(options: { transition?: unknown; thrownTransition?: boolean; deleteFailure?: "returned" | "thrown" }, verify: (s: {
  result: Awaited<ReturnType<typeof failProposalSession>>; calls: string[]; logs: string[];
}) => void, ids: string[] = ["PRIVATE-skeleton"]) {
  const oldError = console.error, logs: string[] = [], calls: string[] = [];
  console.error = (...args) => logs.push(args.join(" "));
  const admin = {
    from(table: string) {
      if (table === "generation_sessions") {
        const filters: Record<string, unknown> = {};
        const query = {
          eq(key: string, value: unknown) { filters[key] = value; return query; },
          select(columns: string) {
            assertEquals(columns, "id");
            assertEquals(filters, { id: session, status: "generating" });
            calls.push("mark");
            if (options.thrownTransition) throw new Error("PRIVATE transport");
            return Promise.resolve(options.transition ?? { data: [{ id: session }], error: null });
          },
        };
        return { update(value: unknown) { assertEquals(value, { status: "failed" }); return query; } };
      }
      assertEquals(table, "recipes");
      return { delete: () => ({ in(key: string, values: string[]) {
        assertEquals(key, "id"); assertEquals(values, ids);
        return { eq(column: string, value: string) {
          assertEquals(column, "content_status"); assertEquals(value, "proposal");
          calls.push("delete");
          if (options.deleteFailure === "thrown") throw new Error("PRIVATE deletion");
          return Promise.resolve({ error: options.deleteFailure === "returned" ? { code: "23503", message: "PRIVATE reference" } : null });
        } };
      } }) };
    },
  };
  try {
    verify({ result: await failProposalSession(admin, session, ids), calls, logs });
    assert(!logs.join(" ").includes("PRIVATE"));
  } finally { console.error = oldError; }
}

Deno.test("pre-association cleanup confirms one matching generating-to-failed transition before proposal-only deletion", async () => {
  await cleanupScenario({}, ({ result, calls, logs }) => {
    assertEquals(result, { skeletonCleanup: "done", sessionMarkedFailed: true });
    assertEquals(calls, ["mark", "delete"]); assertEquals(logs, []);
  });
});

Deno.test("unknown, missing, malformed, wrong-id and no-match session transitions never authorize deletion", async () => {
  for (const transition of [
    { data: [], error: null }, { data: null, error: null }, { error: null },
    { data: { id: session }, error: null }, { data: [null], error: null },
    { data: [{ id: "PRIVATE-other-session" }], error: null },
    { data: [{ id: session }, { id: session }], error: null },
    { data: [{ id: session }], error: { code: "42501", message: "PRIVATE transition" } },
  ]) await cleanupScenario({ transition }, ({ result, calls, logs }) => {
    assertEquals(result, { skeletonCleanup: "skipped", sessionMarkedFailed: false });
    assertEquals(calls, ["mark"]); assertEquals(JSON.parse(logs[0]).stage, "session_failure");
  });
  await cleanupScenario({ thrownTransition: true }, ({ result, calls }) => {
    assertEquals(result, { skeletonCleanup: "skipped", sessionMarkedFailed: false });
    assertEquals(calls, ["mark"]);
  });
});

Deno.test("returned and thrown cleanup errors retain the confirmed failed transition and sanitized diagnostics", async () => {
  for (const deleteFailure of ["returned", "thrown"] as const) await cleanupScenario({ deleteFailure }, ({ result, calls, logs }) => {
    assertEquals(result, { skeletonCleanup: "failed", sessionMarkedFailed: true });
    assertEquals(calls, ["mark", "delete"]);
    assertEquals(JSON.parse(logs[0]).stage, "skeleton_cleanup");
  });
});

Deno.test("empty pre-association cleanup still confirms session failure and skips deletion", async () => {
  await cleanupScenario({}, ({ result, calls }) => {
    assertEquals(result, { skeletonCleanup: "skipped", sessionMarkedFailed: true });
    assertEquals(calls, ["mark"]);
  }, []);
});
