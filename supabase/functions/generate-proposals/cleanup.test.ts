import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { failProposalSession } from "./cleanup.ts";

Deno.test("proposal failure inspects returned cleanup errors and still marks session failed", async () => {
  const original = console.error;
  const logs: string[] = [];
  const calls: string[] = [];
  console.error = (...args) => logs.push(args.join(" "));
  const admin = {
    from(table: string) {
      return table === "recipes"
        ? {
          delete: () => ({
            in: (key: string, ids: string[]) => {
              assertEquals(key, "id");
              assertEquals(ids, ["PRIVATE-skeleton"]);
              calls.push("delete");
              return Promise.resolve({
                error: { code: "23503", message: "PRIVATE context" },
              });
            },
          }),
        }
        : {
          update: (value: unknown) => ({
            eq: (key: string, id: string) => {
              assertEquals(value, { status: "failed" });
              assertEquals(key, "id");
              assertEquals(id, "PRIVATE-session");
              calls.push("mark");
              return Promise.resolve({ error: null });
            },
          }),
        };
    },
  };
  try {
    assertEquals(
      await failProposalSession(admin, "PRIVATE-session", ["PRIVATE-skeleton"]),
      { skeletonCleanup: "failed", sessionMarkedFailed: true },
    );
    assertEquals(calls, ["delete", "mark"]);
    assertEquals(JSON.parse(logs[0]).stage, "skeleton_cleanup");
    assert(!logs.join(" ").includes("PRIVATE"));
  } finally {
    console.error = original;
  }
});

Deno.test("thrown delete and returned failed-session error are both observed without masking the original response", async () => {
  const original = console.error;
  const logs: string[] = [];
  console.error = (...args) => logs.push(args.join(" "));
  const admin = {
    from(table: string) {
      if (table === "recipes") throw new Error("PRIVATE transport failure");
      return {
        update: () => ({
          eq: () =>
            Promise.resolve({
              error: { code: "42501", details: "PRIVATE user" },
            }),
        }),
      };
    },
  };
  try {
    assertEquals(
      await failProposalSession(admin, "PRIVATE-session", ["PRIVATE-skeleton"]),
      { skeletonCleanup: "failed", sessionMarkedFailed: false },
    );
    assertEquals(logs.map((l) => JSON.parse(l).stage), [
      "skeleton_cleanup",
      "session_failure",
    ]);
    assert(!logs.join(" ").includes("PRIVATE"));
  } finally {
    console.error = original;
  }
});

Deno.test("empty cleanup skips deletes and observes thrown session failure", async () => {
  const original = console.error;
  console.error = () => {};
  let calls = 0;
  try {
    assertEquals(
      await failProposalSession({
        from(table: string) {
          calls++;
          assertEquals(table, "generation_sessions");
          throw new Error("unavailable");
        },
      }, "session"),
      { skeletonCleanup: "skipped", sessionMarkedFailed: false },
    );
    assertEquals(calls, 1);
  } finally {
    console.error = original;
  }
});
