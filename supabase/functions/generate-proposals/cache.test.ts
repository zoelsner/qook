import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { firstCacheHitId } from "./cache.ts";

Deno.test("firstCacheHitId returns the first matching row id", () => {
  assertEquals(firstCacheHitId([{ id: "full-1" }, { id: "full-2" }]), "full-1");
});

Deno.test("firstCacheHitId returns null on no match", () => {
  assertEquals(firstCacheHitId([]), null);
});

Deno.test("firstCacheHitId returns null on null data", () => {
  assertEquals(firstCacheHitId(null), null);
});
