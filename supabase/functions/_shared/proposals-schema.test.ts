import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ProposalsEnvelope } from "./schema.ts";

const five = Array.from({ length: 5 }, (_, i) => ({
  title: `Test Dish Number ${i}`,
  hook: "A quick, punchy one-liner about the dish.",
  timeMinutes: 25,
  proteinG: 32,
  cuisine: "Thai",
}));

Deno.test("ProposalsEnvelope parses exactly five well-formed proposals", () => {
  const parsed = ProposalsEnvelope.parse({ proposals: five, refusal: null });
  assertEquals(parsed.proposals.length, 5);
  assertEquals(parsed.proposals[0].proteinG, 32);
});

Deno.test("ProposalsEnvelope rejects a hand that is not length five", () => {
  const res = ProposalsEnvelope.safeParse({ proposals: five.slice(0, 4), refusal: null });
  assertEquals(res.success, false);
});

Deno.test("ProposalsEnvelope rejects a proposal missing proteinG", () => {
  const bad = [{ ...five[0], proteinG: undefined }, ...five.slice(1)];
  const res = ProposalsEnvelope.safeParse({ proposals: bad, refusal: null });
  assertEquals(res.success, false);
});
