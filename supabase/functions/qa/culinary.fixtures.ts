import { Recipe } from "../_shared/schema.ts";
import type { TierKey } from "../_shared/tiers.ts";

// Handwritten protocol/constraint fixtures. They are not model evaluations,
// verified nutrition estimates, or food-safety/cross-contact certification.
export function bowl(options: {
  title?: string; tier?: TierKey; time?: number; servings?: number;
  ingredients?: string[]; instructions?: { instruction: string; durationMin: number }[];
} = {}) {
  return Recipe.parse({
    title: options.title ?? "No-cook chickpea cucumber bowl", cuisine: "Mediterranean",
    tier: options.tier ?? "brain-is-fried", servings: options.servings ?? 2, timeMinutes: options.time ?? 10,
    tags: ["vegetarian"],
    ingredientGroups: [{ title: "Bowl", role: "main", items: (options.ingredients ?? ["canned chickpeas", "cucumber", "lemon", "olive oil", "feta"]).map(item => ({
      item, quantity: "to taste", notes: null,
      parsed: { canonical_name: item, canonical_key: item.toLowerCase().replace(/[^a-z]+/g, "_"), category: "Pantry", amount: null, unit: null },
    })) }],
    workflowSections: [{ title: "Assemble", objective: "Make the bowl", steps: options.instructions ?? [
      { instruction: "Drain the canned chickpeas into a bowl.", durationMin: 2 },
      { instruction: "Add chopped cucumber to the bowl.", durationMin: 2 },
      { instruction: "Stir in lemon and olive oil, crumble feta over the bowl, and serve.", durationMin: 3 },
    ] }],
    nutrition: { calories: null, proteinG: 17, carbG: null, fatG: null },
    notes: "Synthetic fixture. Portions, nutrition and practical feasibility require culinary review.",
  });
}

export function proposal(recipe: Recipe) {
  return {
    title: recipe.title, cuisine: recipe.cuisine, timeMinutes: recipe.timeMinutes,
    proteinG: recipe.nutrition.proteinG, hook: "A simple bowl for dinner",
    ingredientNames: recipe.ingredientGroups.flatMap(group => group.items.map(item => item.item)),
    stepOutline: recipe.workflowSections.flatMap(section => section.steps.map(step => step.instruction)),
  };
}
