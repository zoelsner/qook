import { TIER_RULES, type TierKey } from "../tiers.ts";

export type LiveContext = {
  tier: TierKey;
  householdSize: number;
  avoidIngredients: string[];
  lovedCuisines: string[]; // top by pref score
  recentLikedTitles: string[]; // last 5 swipe-liked
  voiceContext?: string; // iOS transcript, 10s max
  kitchenTools: string[]; // intersection of user tools + whitelist
};

export function buildLiveSystemPrompt(): string {
  return [
    "You are Qook's live recipe concierge.",
    "A real person opened the app right now and wants 3 dinner ideas for tonight.",
    "Output STRICT JSON, no prose, no markdown.",
    "Treat voice context as the most important signal — it's what the user just said out loud about their evening.",
    "Draw inspiration from their loved cuisines and recent likes, but don't repeat them verbatim.",
    'Safety: if voice context mentions self-harm, unsafe food practices, or requests dangerous behavior, set `refusal` to "Let\'s plan something nourishing instead. Can you tell me what you have in the fridge?" and set `recipes` to an empty array. Otherwise set `refusal` to null.',
  ].join(" ");
}

export const STRUCTURED_INGREDIENT_DIRECTIVE = [
  "For EVERY ingredient, populate `parsed` with:",
  "- `parsed.category` using EXACTLY this grammar:",
  "  Produce: fresh vegetables, fruits, fresh herbs.",
  "  Protein: meat, poultry, fish, eggs, tofu, tempeh, dry legumes.",
  "  Dairy: milk, butter, cheese, yogurt, cream, mayo.",
  "  Pantry: oils, vinegars, dry goods, canned goods, spices, sauces, dry herbs.",
  "  Frozen: anything labeled frozen, frozen vegetables.",
  "  Bakery: breads, tortillas, pita.",
  "  Other: use sparingly, only if none of the above fit.",
  "- `parsed.canonical_name`: the shortest unambiguous grocery-store name. \"extra-virgin olive oil\" → \"olive oil\"; \"english cucumber\" → \"cucumber\"; \"red bell pepper\" → \"bell pepper\". Drop intensifiers, sizes, and ripeness qualifiers unless load-bearing (\"baby potatoes\" stays \"baby potatoes\").",
  "- `parsed.canonical_key`: `canonical_name` lowercased with spaces replaced by underscores; only [a-z0-9_].",
  "- `parsed.amount`: numeric quantity or null if not measurable.",
  "- `parsed.unit`: one of g, kg, oz, lb, tsp, tbsp, cup, count, ml, l, or null. Use \"count\" for whole countable items.",
].join("\n");

export function buildLiveUserPrompt(ctx: LiveContext): string {
  const rule = TIER_RULES[ctx.tier];
  const avoid = ctx.avoidIngredients.length
    ? ctx.avoidIngredients.join(", ")
    : "none";
  const tools = ctx.kitchenTools.length
    ? ctx.kitchenTools.join(", ")
    : "stovetop, oven, skillet, pot";

  return [
    `Generate exactly 3 dinner recipes for tier "${ctx.tier}" (${rule.label}).`,
    `Tier directive: ${rule.directive}`,
    `timeMinutes ceiling: ${rule.maxMinutes}.`,
    ``,
    `Serves: ${ctx.householdSize}.`,
    `Avoid ingredients: ${avoid}.`,
    `Available tools: ${tools}. Do not require anything outside this set.`,
    `Loved cuisines (priority order): ${
      ctx.lovedCuisines.join(", ") || "open"
    }.`,
    ctx.recentLikedTitles.length
      ? `Recently liked (match the energy, don't duplicate):\n${
        ctx.recentLikedTitles.map((t, i) => `  ${i + 1}. ${t}`).join("\n")
      }`
      : "No recent swipe data — give a confident mix.",
    ``,
    ctx.voiceContext
      ? `USER JUST SAID (voice context, weight heavily): "${ctx.voiceContext}"`
      : `No voice context — pick confidently based on the above.`,
    ``,
    `Spread the 3 across different cuisines unless voice context pins one.`,
    `One of the 3 should be the "safe" play (most aligned with recent likes).`,
    `One should be a gentle stretch — a cuisine or technique they haven't had in the last 5.`,
    `One should feel like today's mood (match voice tone if given).`,
    ``,
    STRUCTURED_INGREDIENT_DIRECTIVE,
    ``,
    `Every step needs a concrete durationMin > 0 and specific doneness cues ("until edges curl", NOT "until done").`,
    `Return JSON shape: { "recipes": Recipe[] } with exactly 3 recipes.`,
  ].join("\n");
}
