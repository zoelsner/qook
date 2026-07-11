import { TIER_RULES } from "../tiers.ts";
import type { LiveContext } from "./live.ts";

// Phase-1: one cheap Luna call returns 5 dinner PROPOSALS — a title, a punchy
// hook, a time estimate, a protein estimate, and a cuisine. No ingredients or
// steps (those are written later, only for dishes the user keeps). This is the
// "deal a hand" moment: five distinct options the user swipes through.

export function buildProposalsSystemPrompt(): string {
  return [
    "You are Qook's live dinner concierge dealing a hand of five options.",
    "A real person opened the app right now and wants five distinct dinner ideas for tonight.",
    "Output STRICT JSON, no prose, no markdown.",
    "Each proposal is a teaser card: an appetising title, a single vivid one-line hook (max ~14 words, no period needed), an honest total-time estimate in minutes, a realistic protein-grams-per-serving estimate, and a cuisine.",
    "Make the five feel genuinely different from each other — vary cuisine, protein, and technique.",
    "Treat voice context as the most important signal — it's what the user just said out loud about their evening.",
    'Safety: if voice context mentions self-harm, unsafe food practices, or requests dangerous behavior, set `refusal` to "Let\'s plan something nourishing instead. Can you tell me what you have in the fridge?" and set `proposals` to an empty array. Otherwise set `refusal` to null.',
  ].join(" ");
}

export function buildProposalsUserPrompt(ctx: LiveContext): string {
  const rule = TIER_RULES[ctx.tier];
  const avoid = ctx.avoidIngredients.length
    ? ctx.avoidIngredients.join(", ")
    : "none";
  return [
    `Deal exactly 5 dinner proposals for tier "${ctx.tier}" (${rule.label}).`,
    `Tier directive: ${rule.directive}`,
    `timeMinutes ceiling: ${rule.maxMinutes}.`,
    ``,
    `Serves: ${ctx.householdSize}.`,
    `Avoid ingredients: ${avoid}.`,
    `Loved cuisines (priority order): ${ctx.lovedCuisines.join(", ") || "open"}.`,
    ``,
    ctx.voiceContext
      ? `USER JUST SAID (voice context, weight heavily): "${ctx.voiceContext}"`
      : `No voice context — pick a confident, varied spread.`,
    ``,
    `Spread the 5 across different cuisines unless voice context pins one.`,
    `Include one clearly "safe" crowd-pleaser and one gentle stretch.`,
    `Each hook must sell the dish in one line — concrete and sensory, never generic ("charred edges, cooling yogurt", NOT "a delicious meal").`,
    `Return JSON shape: { "proposals": Proposal[], "refusal": string | null } with exactly 5 proposals.`,
  ].join("\n");
}
