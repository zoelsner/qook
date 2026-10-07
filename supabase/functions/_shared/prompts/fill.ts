import { briefDirective } from "../dinner-brief.ts";
import { TIER_RULES } from "../tiers.ts";
import { STRUCTURED_INGREDIENT_DIRECTIVE } from "./live.ts";
import type { LiveContext } from "./live.ts";
import { kitchenToolsDirective } from "../kitchen-tools.ts";
import type { FillContract } from "../fill-contract.ts";

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
    "The title is a promise about the actual preparation. Make the method agree with it using the accepted equipment; do not claim a preparation in the title and explicitly skip it in the instructions.",
  ].join(" ");
}

export function buildFillUserPrompt(
  ctx: LiveContext,
  title: string,
  hook: string | null,
  proposalIngredients?: string[] | null,
  proposalSteps?: string[] | null,
  contract?: FillContract,
): string {
  const rule = TIER_RULES[ctx.tier];
  const avoid = ctx.avoidIngredients.length
    ? ctx.avoidIngredients.join(", ")
    : "none";
  return [
    `Write the full recipe for this dish, titled EXACTLY: "${title}".`,
    hook ? `Its promise to the cook: "${hook}". Honour it.` : ``,
    proposalIngredients?.length || proposalSteps?.length
      ? `The proposal card promised these ingredients: ${
        (proposalIngredients ?? []).join(", ") || "none listed"
      }. And this plan: ${
        (proposalSteps ?? []).join("; ") || "none listed"
      }. Stay faithful to them; pantry staples may be added only within the tier's ingredient limit.`
      : ``,
    `Tier: "${ctx.tier}" (${rule.label}). ${rule.directive}`,
    `timeMinutes ceiling: ${rule.maxMinutes}. Use tier "${ctx.tier}" in the "tier" field.`,
    `The accepted card is a binding cooking plan. Expand its steps; do not substitute a different technique or appliance, introduce another pan for a side, or turn ready-cooked ingredients into from-scratch preparation. Microwave means microwave in the actual cooking steps, not a skillet with the same title.`,
    `Use no more than ${rule.sectionsMax} sections with ${rule.stepsPerSectionMax} steps each. All components, sides and garnishes count toward the tier's ingredient and vessel limits.`,
    `Total time includes ingredient preparation, heating, cooking and resting. Account for these honestly; do not shorten stated times just to fit the ceiling. Explicitly describe any concurrent work in the cooking steps. durationMin must include the full elapsed time stated in that step, including boiling, simmering and resting; do not assign two minutes to a step that says cook for eight to ten minutes.`,
    ...(contract
      ? [
        `Keep the original card's ${contract.servings} servings and finish within its ${contract.maxMinutes}-minute total-time estimate. Do not use changed household preferences to alter this accepted card.`,
      ]
      : []),
    ``,
    `Serves: ${ctx.householdSize}.`,
    `Avoid ingredients: ${avoid}.`,
    kitchenToolsDirective(ctx.kitchenTools),
    ctx.voiceContext
      ? `The user earlier said (original dinner brief, preserve explicit requirements): "${ctx.voiceContext}"`
      : ``,
    ``,
    contract?.brief ? briefDirective(contract.brief) : "",
    STRUCTURED_INGREDIENT_DIRECTIVE,
    ``,
    `Keep the optional recipe notes at most 300 characters; cooking instructions and overlap belong in the steps. Every step needs a concrete durationMin > 0 and specific doneness cues ("until edges curl", NOT "until done").`,
    `Every ingredient must be used in the method. Put required cutting, draining, beating and other preparation in ingredient notes or an explicit step, and include its time. Prefer references to the listed amounts over repeating fixed quantities in prose.`,
    `For microwave eggs: never heat eggs in their shells. Whisk first, or explicitly pierce both yolks and whites before heating. Use a microwave-safe vessel, a vented cover, short checked intervals and standing time; do not promise an intact yolk without that preparation.`,
    `Include a realistic protein-grams-per-serving estimate in nutrition.proteinG — even for a quick, simple dish. Never omit it.`,
    `Return a single JSON Recipe object (not an array, not an envelope).`,
  ].filter(Boolean).join("\n");
}
