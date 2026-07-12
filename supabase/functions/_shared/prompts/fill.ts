import { TIER_RULES } from "../tiers.ts";
import { STRUCTURED_INGREDIENT_DIRECTIVE } from "./live.ts";
import type { LiveContext } from "./live.ts";

// Phase-2: write ONE full recipe for a proposal the user kept. The title is
// fixed (it's already on the card); the model fleshes out ingredients, steps,
// tags, and nutrition to match. Same body shape as the generate-recipe envelope
// entries, so it validates against the shared Recipe schema.

export function buildFillSystemPrompt(): string {
  return [
    "You are Qook's live recipe concierge writing one full recipe on demand.",
    "The user already chose this dish by its title; write the complete recipe for it.",
    "Output STRICT JSON, no prose, no markdown — a single Recipe object.",
    "Keep the title EXACTLY as given. Do not rename the dish.",
  ].join(" ");
}

export function buildFillUserPrompt(
  ctx: LiveContext,
  title: string,
  hook: string | null,
  proposalIngredients?: string[] | null,
  proposalSteps?: string[] | null,
): string {
  const rule = TIER_RULES[ctx.tier];
  const avoid = ctx.avoidIngredients.length
    ? ctx.avoidIngredients.join(", ")
    : "none";
  const tools = ctx.kitchenTools.length
    ? ctx.kitchenTools.join(", ")
    : "stovetop, oven, skillet, pot";
  return [
    `Write the full recipe for this dish, titled EXACTLY: "${title}".`,
    hook ? `Its promise to the cook: "${hook}". Honour it.` : ``,
    proposalIngredients?.length || proposalSteps?.length
      ? `The proposal card promised these ingredients: ${
        (proposalIngredients ?? []).join(", ") || "none listed"
      }. And this plan: ${
        (proposalSteps ?? []).join("; ") || "none listed"
      }. Stay faithful to them; pantry staples may be added.`
      : ``,
    `Tier: "${ctx.tier}" (${rule.label}). ${rule.directive}`,
    `timeMinutes ceiling: ${rule.maxMinutes}. Use tier "${ctx.tier}" in the "tier" field.`,
    ``,
    `Serves: ${ctx.householdSize}.`,
    `Avoid ingredients: ${avoid}.`,
    `Available tools: ${tools}. Do not require anything outside this set.`,
    ctx.voiceContext
      ? `The user earlier said (context, weight when relevant): "${ctx.voiceContext}"`
      : ``,
    ``,
    STRUCTURED_INGREDIENT_DIRECTIVE,
    ``,
    `Every step needs a concrete durationMin > 0 and specific doneness cues ("until edges curl", NOT "until done").`,
    `Include a realistic protein-grams-per-serving estimate in nutrition.proteinG — even for a quick, simple dish. Never omit it.`,
    `Return a single JSON Recipe object (not an array, not an envelope).`,
  ].filter(Boolean).join("\n");
}
