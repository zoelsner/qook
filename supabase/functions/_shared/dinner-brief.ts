import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import type { LiveContext } from "./prompts/live.ts";

// Stored only in generation_items.prompt_meta, protected by session ownership.
export const DinnerBriefSchema = z.object({
  version: z.literal(1),
  context: z.string().max(500),
  avoidIngredients: z.array(z.string()),
  kitchenTools: z.array(z.string()),
  householdSize: z.number().int().min(1).max(12),
  lovedCuisines: z.array(z.string()),
  preferredProteins: z.array(z.string()),
  allergies: z.array(z.string()),
  diets: z.array(z.string()),
  excludedIngredients: z.array(z.string()),
  onlyMethods: z.array(z.string()),
  maxMinutes: z.number().positive().optional(),
  conflicts: z.array(z.string()).default([]),
});
export type DinnerBrief = z.infer<typeof DinnerBriefSchema>;

const allergens: Record<string, RegExp> = {
  peanut: /\b(?:peanuts?|groundnuts?|arachis)\b/i,
  sesame: /\b(?:sesame|tahini)\b/i,
  nuts: /\b(?:nuts?|almonds?|walnuts?|cashews?|pecans?|pistachios?|hazelnuts?)\b/i,
  dairy: /\b(?:dairy|milk|butter(?!\s+beans\b)|cheese|yog[uh]urt|cream|feta|parmesan|ghee)\b/i,
  eggs: /\b(?:eggs?|mayonnaise|mayo)\b/i,
  gluten: /\b(?:gluten|wheat|barley|rye|flour|bread|pasta|couscous|soy sauce)\b/i,
  soy: /\b(?:soy|soya|tofu|tempeh|edamame|tamari)\b/i,
  shellfish: /\b(?:shellfish|shrimp|prawns?|crab|lobster|clams?|mussels?|oysters?)\b/i,
  fish: /\b(?:fish|salmon|tuna|cod|anchov\w*|sardines?|fish sauce)\b/i,
};
const meat = /\b(?:chicken|beef|pork|lamb|turkey|bacon|ham|sausage|gelatin|gelatine)\b/i;
const toolNames: Record<string, string> = { microwave: "microwave", kettle: "kettle", skillet: "stovetop", stovetop: "stovetop", oven: "oven", toaster: "toaster", "air fryer": "airFryer", grill: "grill" };

export function dinnerBrief(ctx: LiveContext): DinnerBrief {
  const context = ctx.voiceContext ?? "";
  const allergies = new Set<string>();
  const excluded = new Set<string>();
  const diets = new Set<string>();
  for (const clause of context.split(/[.;!\n]|\b(?:but|however)\b/i)) {
    if (/\b(?:not|no|never)\s+(?:actually\s+)?allergic\b|\bno\s+(?:food\s+)?allergies\b/i.test(clause)) continue;
    if (/\ballerg(?:ic|y|ies)\b/i.test(clause)) {
      for (const [name, re] of Object.entries(allergens)) if (re.test(clause)) allergies.add(name);
    }
  }
  if (/(?<!not )\bvegan\b/i.test(context)) diets.add("vegan");
  else if (/(?<!not )\bvegetarian\b/i.test(context)) diets.add("vegetarian");
  if (/\bgluten[- ]free\b/i.test(context)) diets.add("gluten-free");
  if (/\bdairy[- ]free\b/i.test(context)) diets.add("dairy-free");
  // Narrow explicit ingredient exclusions. Dislikes with exceptions stay in
  // the preserved context and are not promoted into an invented allergy.
  for (const m of context.matchAll(/\b(?:no|without|avoid)\s+([a-z][a-z -]*?)(?=[,.;!]|$)/gi)) {
    if (!/\b(?:allerg|spicy|more|need|precooked|except|unless)\b/i.test(m[1])) {
      for (const name of m[1].split(/\s+(?:and|or)\s+/i)) excluded.add(name.trim());
    }
  }
  let onlyMethods: string[] = [];
  for (const clause of context.split(/[.;!\n]/)) {
    if (!/\bonly\b/i.test(clause)) continue;
    const found = Object.entries(toolNames).filter(([name]) => clause.toLowerCase().includes(name)).map(([, method]) => method);
    if (found.length) onlyMethods = [...new Set(found)];
  }
  const conflicts: string[] = [];
  if (onlyMethods.length && onlyMethods.every(m => ['microwave', 'kettle'].includes(m)) && /\b(?:roast|roasted|bake|baked|crispy)\b/i.test(context)) conflicts.push("Your requested crisp/roasted method conflicts with microwave/kettle-only equipment. Choose a different method or allow another appliance.");
  const time = /\b(\d{1,3})\s*(?:minutes?|mins?)\b/i.exec(context);
  const count = /\b(?:serves?|for)\s+(\d+|one|two|three|four|five|six)\b|\b(\d+)\s+(?:people|servings?)\b/i.exec(context);
  const counts: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  const n = count ? counts[(count[1] ?? count[2]).toLowerCase()] ?? Number(count[1] ?? count[2]) : ctx.householdSize;
  return { version: 1, context, avoidIngredients: [...ctx.avoidIngredients], kitchenTools: [...ctx.kitchenTools], householdSize: Math.min(12, Math.max(1, n)), lovedCuisines: [...ctx.lovedCuisines], preferredProteins: [...ctx.preferredProteins], allergies: [...allergies], diets: [...diets], excludedIngredients: [...excluded], onlyMethods, conflicts, ...(time ? { maxMinutes: Number(time[1]) } : {}) };
}

export function briefContext(brief: DinnerBrief, tier: LiveContext["tier"]): LiveContext {
  return { tier, householdSize: brief.householdSize, voiceContext: brief.context || undefined, avoidIngredients: brief.avoidIngredients, kitchenTools: brief.kitchenTools, lovedCuisines: brief.lovedCuisines, preferredProteins: brief.preferredProteins, recentLikedTitles: [] };
}

export function ingredientConstraintErrors(names: string[], brief: DinnerBrief): string[] {
  const errors: string[] = [];
  const forbidden = new Set([...brief.allergies, ...brief.avoidIngredients, ...brief.excludedIngredients]);
  if (brief.diets.includes("dairy-free") || brief.diets.includes("vegan")) forbidden.add("dairy");
  if (brief.diets.includes("gluten-free")) forbidden.add("gluten");
  if (brief.diets.includes("vegan")) forbidden.add("eggs");
  for (const name of names) {
    for (const avoid of forbidden) {
      const aliases: Record<string, string> = { peanuts: 'peanut', nut: 'nuts', egg: 'eggs' };
      const pattern = allergens[aliases[avoid.toLowerCase()] ?? avoid.toLowerCase()];
      // Named plant substitutes do not imply animal dairy; their own nut/soy
      // names still go through the other allergen checks.
      const checkedName = avoid === "dairy" ? name.replace(/\b(?:coconut|almond|oat|soy|soya|rice|cashew|vegan|plant[- ]based|dairy[- ]free)\s+(?:milk|cream|butter|cheese|yog[uh]urt)\b/gi, "") : name;
      const match = pattern ? pattern.test(checkedName) : checkedName.toLowerCase().split(/[^a-z]+/).join(" ").includes(avoid.toLowerCase());
      if (match && !(avoid === "gluten" && /\bgluten[- ]free\b/i.test(name))) errors.push(`Do not include ${name}; the saved dinner brief excludes ${avoid}.`);
    }
    if ((brief.diets.includes("vegan") || brief.diets.includes("vegetarian")) && (meat.test(name) || allergens.fish.test(name) || allergens.shellfish.test(name))) errors.push(`Do not include ${name}; preserve the saved ${brief.diets.join(", ")} requirement.`);
    if (brief.diets.includes("vegan") && /\bhoney\b/i.test(name)) errors.push("Do not add honey to the vegan dinner.");
  }
  return [...new Set(errors)];
}

export function briefDirective(brief: DinnerBrief): string {
  return `Binding dinner brief (allergies/diets/exclusions are requirements; tastes stay preferences): ${JSON.stringify(brief)}. Preserve all explicit requirements in the original context. Ask for clarification rather than silently relaxing a conflict. Ingredient-name checks are limited; never claim allergen safety or cross-contact verification.`;
}
