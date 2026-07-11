import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveFillTarget } from "./dedup.ts";

Deno.test("fills in place when no other full row shares the signature", () => {
  assertEquals(resolveFillTarget("sk-1", []), {
    action: "fill-in-place",
    targetId: "sk-1",
  });
});

Deno.test("fills in place when the only signature match is the skeleton itself", () => {
  assertEquals(resolveFillTarget("sk-1", [{ id: "sk-1" }]), {
    action: "fill-in-place",
    targetId: "sk-1",
  });
});

Deno.test("uses the cache hit when a different full row shares the signature", () => {
  assertEquals(resolveFillTarget("sk-1", [{ id: "full-9" }]), {
    action: "cache-hit",
    targetId: "full-9",
  });
});
