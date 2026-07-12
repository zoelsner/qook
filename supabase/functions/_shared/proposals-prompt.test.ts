import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildProposalsUserPrompt } from "./prompts/proposals.ts";
import { ProposalsEnvelopeJsonSchema } from "./schema.ts";

const ctx = {
  tier: "after-work" as const,
  householdSize: 2,
  avoidIngredients: [] as string[],
  lovedCuisines: [] as string[],
  recentLikedTitles: [] as string[],
  voiceContext: "",
  kitchenTools: [] as string[],
};

Deno.test("hand-mix hint appears when energyMix is provided", () => {
  const prompt = buildProposalsUserPrompt(ctx, "about 3 quick, 2 medium");
  assertStringIncludes(prompt, "about 3 quick, 2 medium");
});

Deno.test("no hand-mix line when energyMix is omitted", () => {
  const prompt = buildProposalsUserPrompt(ctx);
  assertEquals(prompt.includes("Aim for a spread of"), false);
  // Byte-identity guard for deployed clients: the omitted-hint prompt must not
  // grow a stray blank line where the hint would sit.
  assertEquals(prompt.includes("\n\n\n"), false);
  assertStringIncludes(prompt, "timeMinutes ceiling: 30.\n\nServes: 2.");
});

Deno.test("per-card timeMinutes ceiling stays an integer with no min/max relaxation", () => {
  const props = ProposalsEnvelopeJsonSchema.schema.properties.proposals as {
    items: { properties: { timeMinutes: { type: string } } };
  };
  assertEquals(props.items.properties.timeMinutes.type, "integer");
});
