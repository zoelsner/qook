import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { lockOutcome } from "./lock.ts";

Deno.test("lockOutcome claims when the conditional update matched a pending row", () => {
  assertEquals(lockOutcome([{ id: "r1" }]), "claimed");
});

Deno.test("lockOutcome skips when no row matched (already generating/ready/failed)", () => {
  assertEquals(lockOutcome([]), "skip");
});

Deno.test("lockOutcome skips when the update returned null data", () => {
  assertEquals(lockOutcome(null), "skip");
});
