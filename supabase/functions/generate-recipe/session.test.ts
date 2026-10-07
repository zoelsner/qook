import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { finishSession } from "./session.ts";

// Fake admin that records the update payload and the eq() filter used.
function fakeAdmin(updateError: unknown = null) {
  const calls: { table?: string; payload?: unknown; eqCol?: string; eqVal?: unknown } = {};
  return {
    calls,
    from(table: string) {
      calls.table = table;
      return {
        update(payload: unknown) {
          calls.payload = payload;
          return {
            eq(col: string, val: unknown) {
              calls.eqCol = col;
              calls.eqVal = val;
              return Promise.resolve({ data: null, error: updateError });
            },
          };
        },
      };
    },
    // deno-lint-ignore no-explicit-any
  } as any;
}

Deno.test("finishSession updates generation_sessions with status and id filter", async () => {
  const admin = fakeAdmin();
  await finishSession(admin, "session-1", "ready");
  assertEquals(admin.calls.table, "generation_sessions");
  assertEquals(admin.calls.payload, { status: "ready" });
  assertEquals(admin.calls.eqCol, "id");
  assertEquals(admin.calls.eqVal, "session-1");
});

Deno.test("finishSession passes the failed status through unchanged", async () => {
  const admin = fakeAdmin();
  await finishSession(admin, "session-2", "failed");
  assertEquals(admin.calls.payload, { status: "failed" });
  assertEquals(admin.calls.eqVal, "session-2");
});

Deno.test("finishSession swallows an update error without throwing", async () => {
  const admin = fakeAdmin({ message: "boom" });
  await finishSession(admin, "session-3", "failed");
  // No throw = pass. Confirm the call still happened.
  assertEquals(admin.calls.table, "generation_sessions");
});

Deno.test("finishSession swallows a thrown error without throwing", async () => {
  const admin = {
    from() {
      throw new Error("network down");
    },
    // deno-lint-ignore no-explicit-any
  } as any;
  await finishSession(admin, "session-4", "failed");
});

Deno.test("finishSession diagnostics omit private database messages and transport errors", async () => {
  const original = console.error; const logs: string[] = [];
  console.error = (...args) => logs.push(args.join(" "));
  try {
    await finishSession(fakeAdmin({ code: "42501", message: "PRIVATE identity", details: "PRIVATE recipe" }), "PRIVATE-session", "failed");
    await finishSession({ from() { throw new Error("PRIVATE URL"); } }, "PRIVATE-session", "ready");
    assertEquals(logs.some(l => l.includes("PRIVATE")), false);
    assertEquals(logs.map(l => JSON.parse(l).stage), ["session_failure", "session_completion"]);
  } finally { console.error = original; }
});
