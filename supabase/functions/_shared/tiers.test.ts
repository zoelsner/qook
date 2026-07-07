import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { TIER_RULES, tierFromActiveMinutes } from "./tiers.ts";

Deno.test("tier ceilings", () => {
  assertEquals(TIER_RULES["brain-is-fried"].maxMinutes, 15);
  assertEquals(TIER_RULES["weekend-project"].maxMinutes, 180);
});

Deno.test("tierFromActiveMinutes boundaries", () => {
  assertEquals(tierFromActiveMinutes(15), "brain-is-fried");
  assertEquals(tierFromActiveMinutes(16), "after-work");
  assertEquals(tierFromActiveMinutes(45), "got-energy");
  assertEquals(tierFromActiveMinutes(46), "weekend-project");
});
