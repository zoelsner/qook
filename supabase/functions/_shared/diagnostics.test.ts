import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { logFailure } from "./diagnostics.ts";

Deno.test("failure diagnostics only log allowlisted codes/counters and never private error or validation text", () => {
  const original = console.error;
  const logs: string[] = [];
  console.error = (...args) => logs.push(args.join(" "));
  try {
    const issues = [{ code: "invalid_type", message: "PRIVATE recipe" }, {
      code: "PRIVATE",
      message: "PRIVATE ingredient",
    }];
    logFailure("generate-proposals", "invalid_schema", {
      code: "PRIVATE",
      message: "PRIVATE voice",
      details: "PRIVATE email",
    }, { attempt: 2, issues });
    logFailure("generate-proposals", "skeleton_cleanup", {
      code: "23503",
      details: "PRIVATE recipe id",
    }, { count: 5 });
    assert(!logs.join(" ").includes("PRIVATE"));
    const schema = JSON.parse(logs[0]);
    assertEquals(schema.issueCount, 2);
    assertEquals(schema.issueCodes, ["invalid_type", "unknown"]);
    assertEquals(schema.databaseCode, null);
    assertEquals(schema.attempt, 2);
    const cleanup = JSON.parse(logs[1]);
    assertEquals(cleanup.databaseCode, "23503");
    assertEquals(cleanup.count, 5);
  } finally {
    console.error = original;
  }
});
