import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ProposalsEnvelope } from "./schema.ts";
import { validateDishContract } from "./dish-contract.ts";

const five = Array.from({ length: 5 }, (_, i) => ({
  title: `Test Dish Number ${i}`,
  hook: "A quick, punchy one-liner about the dish.",
  timeMinutes: 25,
  proteinG: 32,
  cuisine: "Thai",
  ingredientNames: ["shrimp", "yogurt", "garlic", "lime", "cilantro"],
  stepOutline: ["marinate shrimp in yogurt and spices", "grill until charred", "serve with lime"],
  dishContract: {
    version: 1,
    components: [{ ingredientNames: ["shrimp"], form: "whole grilled shrimp", appearance: "coral shrimp with charred edges" }],
    plating: "Shrimp loosely piled with lime and herbs.",
  },
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

Deno.test("ProposalsEnvelope rejects a proposal with too few ingredientNames", () => {
  const bad = [{ ...five[0], ingredientNames: ["shrimp"] }, ...five.slice(1)];
  const res = ProposalsEnvelope.safeParse({ proposals: bad, refusal: null });
  assertEquals(res.success, false);
});

Deno.test("ProposalsEnvelope rejects a proposal missing stepOutline", () => {
  const bad = [{ ...five[0], stepOutline: undefined }, ...five.slice(1)];
  const res = ProposalsEnvelope.safeParse({ proposals: bad, refusal: null });
  assertEquals(res.success, false);
});

Deno.test("new proposals require a valid versioned dish contract", () => {
  for (const dishContract of [undefined, null, { ...five[0].dishContract, version: 2 }, { ...five[0].dishContract, components: [] }]) {
    const res = ProposalsEnvelope.safeParse({ proposals: [{ ...five[0], dishContract }, ...five.slice(1)], refusal: null });
    assertEquals(res.success, false);
  }
});

Deno.test("dish references are checked against ingredient names after their upper-bound clamp", () => {
  const ingredientNames = Array.from({ length: 13 }, (_, i) => `ingredient ${i}`);
  const dishContract = { version: 1, components: [{ ingredientNames: [ingredientNames[12]], form: "cooked morsels", appearance: "golden" }], plating: "Loosely piled." };
  const parsed = ProposalsEnvelope.parse({ proposals: [{ ...five[0], ingredientNames, dishContract }, ...five.slice(1)], refusal: null });
  assertEquals(parsed.proposals[0].ingredientNames.length, 12);
  assertEquals(validateDishContract(parsed.proposals[0].dishContract, parsed.proposals[0].ingredientNames).length, 1);
});

// Upper-bound drift clamps instead of rejecting — regression for the
// 2026-07-28 TestFlight 422 (model dealt a 6-line stepOutline).
Deno.test("ProposalsEnvelope trims a 6-line stepOutline to 5", () => {
  const chatty = [
    {
      ...five[0],
      stepOutline: ["one", "two", "three", "four", "five", "six"],
    },
    ...five.slice(1),
  ];
  const parsed = ProposalsEnvelope.parse({ proposals: chatty, refusal: null });
  assertEquals(parsed.proposals[0].stepOutline, ["one", "two", "three", "four", "five"]);
});

Deno.test("ProposalsEnvelope trims overlong ingredientNames to 12", () => {
  const many = Array.from({ length: 15 }, (_, i) => `ingredient ${i}`);
  const chatty = [{ ...five[0], ingredientNames: many }, ...five.slice(1)];
  const parsed = ProposalsEnvelope.parse({ proposals: chatty, refusal: null });
  assertEquals(parsed.proposals[0].ingredientNames.length, 12);
});

Deno.test("ProposalsEnvelope truncates an overlong hook to 140 chars", () => {
  const chatty = [{ ...five[0], hook: "x".repeat(200) }, ...five.slice(1)];
  const parsed = ProposalsEnvelope.parse({ proposals: chatty, refusal: null });
  assertEquals(parsed.proposals[0].hook.length, 140);
});

Deno.test("ProposalsEnvelope clamps out-of-range and fractional numbers", () => {
  const chatty = [
    { ...five[0], timeMinutes: 500, proteinG: 27.6 },
    ...five.slice(1),
  ];
  const parsed = ProposalsEnvelope.parse({ proposals: chatty, refusal: null });
  assertEquals(parsed.proposals[0].timeMinutes, 240);
  assertEquals(parsed.proposals[0].proteinG, 28);
});

Deno.test("ProposalsEnvelope keeps the first five of an oversized hand", () => {
  const six = [...five, { ...five[0], title: "Bonus Sixth Dish" }];
  const parsed = ProposalsEnvelope.parse({ proposals: six, refusal: null });
  assertEquals(parsed.proposals.length, 5);
  assertEquals(parsed.proposals[4].title, five[4].title);
});
