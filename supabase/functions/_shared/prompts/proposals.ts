import { TIER_RULES } from "../tiers.ts";
import type { LiveContext } from "./live.ts";
import { kitchenToolsDirective } from "../kitchen-tools.ts";

// Phase-1: one cheap Luna call returns 5 dinner PROPOSALS — a title, a punchy
// hook, a time estimate, a protein estimate, a cuisine, and now a card-back
// teaser: main ingredient names and a high-level step outline. Detailed
// amounts and step-by-step instructions are still written later, only for
// dishes the user keeps. This is the "deal a hand" moment: five distinct
// options the user swipes through.

export function buildProposalsSystemPrompt(): string {
  return [
    "You are Qook's live dinner concierge dealing a hand of five options.",
    "A real person opened the app right now and wants five distinct dinner ideas for tonight.",
    "Output STRICT JSON, no prose, no markdown.",
    "TITLE: name the dish the way a good restaurant menu would — 3 to 6 words, the dish itself, not praise for it.",
    "Where a real dish name exists, use it (Avgolemono, Larb, Saganaki, Tinga, Bibimbap, Picadillo) rather than stringing ingredients together.",
    'If the protein\'s SHAPE is the first thing a diner would notice — meatballs, patties, skewers, wraps, a whole fillet, wings, a ragu of mince — the title must say so ("Harissa Turkey Meatball Couscous", never "Harissa Turkey Couscous"). If the shape is unremarkable, leave it out; never bolt "strips" or "fillet" onto a title that reads fine without it.',
    'Never start a title with the cuisine\'s name ("Korean ...", "Mexican ...") — the cuisine is already on the card.',
    "BANNED in titles: crowd-pleasing, easy, quick, simple, fast, delicious, perfect, ultimate, best, weeknight, cozy, hearty, amazing. Never describe the hand's role (safe, stretch, crowd-pleaser) in a title or hook.",
    'HOOK: one line, max ~14 words, no period. Concrete and sensory — what it looks, smells and sounds like ("charred edges, cooling yogurt"), never "a delicious meal". Do not just restate the title.',
    "Also give an honest total-time estimate in minutes, a realistic protein-grams-per-serving estimate, and a cuisine.",
    'Each proposal also carries a card back: `ingredientNames` — 4 to 10 main ingredients, at most 6 for the 15-minute tier, lowercase names only, NO quantities (those are written at fill time) — and `stepOutline` — 3 to 5 imperative lines, each at most 8 words, sketching the cook ("marinate shrimp in yogurt and spices"), not detailed instructions.',
    "COHERENCE: title, hook, ingredientNames and stepOutline must describe the same plate. Every component named in the title appears in ingredientNames, and stepOutline actually produces the form the title claims.",
    "Make the five feel genuinely different — vary cuisine, protein, technique AND form. Never deal five soups, five bowls or five stir-fries.",
    "Treat voice context as the most important signal — it's what the user just said out loud about their evening. Preserve explicit allergies, diets, ingredients, servings, time and equipment as requirements. Treat mood and tastes as preferences; never silently relax a conflict.",
    'Safety: if voice context mentions self-harm, unsafe food practices, or requests dangerous behavior, set `refusal` to "Let\'s plan something nourishing instead. Can you tell me what you have in the fridge?" and set `proposals` to an empty array. Otherwise set `refusal` to null.',
  ].join(" ");
}

export function buildProposalsUserPrompt(
  ctx: LiveContext,
  energyMix?: string,
): string {
  const rule = TIER_RULES[ctx.tier];
  const avoid = ctx.avoidIngredients.length
    ? ctx.avoidIngredients.join(", ")
    : "none";
  return [
    `Deal exactly 5 dinner proposals for tier "${ctx.tier}" (${rule.label}).`,
    `Tier directive: ${rule.directive}`,
    `timeMinutes ceiling: ${rule.maxMinutes}.`,
    // Conditional spread, not a ''-yielding ternary: when energyMix is absent
    // the array — and so the prompt — must be byte-identical to pre-hint
    // builds (deployed clients don't send energyMix).
    ...(energyMix && energyMix.trim()
      ? [
        `Aim for a spread of times matching the week's energy: ${energyMix.trim()}. This is a soft target for variety — never exceed the timeMinutes ceiling above.`,
      ]
      : []),
    ``,
    `Serves: ${ctx.householdSize}.`,
    kitchenToolsDirective(ctx.kitchenTools),
    `Treat the card as a commitment: the full recipe must keep its ingredients, cooking method, appliances and effort. Include the main appliance in stepOutline when it matters. Include preparation and resting in the total-time estimate.`,
    ...(ctx.tier === "brain-is-fried"
      ? [`The six-ingredient limit includes oil, spices, sauces and garnishes needed to cook the dish. Include these in ingredientNames or leave room for them; pantry staples are not free additions.`]
      : []),
    `Avoid ingredients: ${avoid}. This rule also applies to ingredientNames — never list an avoided ingredient there.`,
    `Loved cuisines (priority order): ${
      ctx.lovedCuisines.join(", ") || "open"
    }.`,
    `Preferred proteins (soft preference, vary across the hand): ${
      ctx.preferredProteins.join(", ") || "open"
    }.`,
    ``,
    ctx.voiceContext
      ? `USER JUST SAID (voice context, weight heavily): "${ctx.voiceContext}"`
      : `No voice context — pick a confident, varied spread.`,
    ``,
    `Spread the 5 across different cuisines unless voice context pins one.`,
    // This line leaked verbatim into output — it is what produced the title
    // "Crowd-Pleasing Pepper Beef and Broccoli".
    `One of the five should be familiar and low-risk; one should be a gentle stretch. This is a planning note for you — it must never surface in a title or hook.`,
    `Return JSON shape: { "proposals": Proposal[], "refusal": string | null } with exactly 5 proposals.`,
  ].join("\n");
}
