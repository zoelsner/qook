import observed from "./fixtures/observed-microwave-mismatch.json" with {
  type: "json",
};
import type { FillContract } from "../_shared/fill-contract.ts";
import type { Recipe } from "../_shared/schema.ts";
export const contract = observed.contract as FillContract;
export const mismatch = observed.recipe as Recipe;

// Hand-written test response, not a generated result or a cooking endorsement.
export function validRecipe(): Recipe {
  return {
    ...structuredClone(mismatch),
    timeMinutes: 12,
    workflowSections: [
      {
        title: "Prepare",
        objective: "Warm the sauce",
        steps: [
          {
            instruction:
              "Stir the paprika into the tomato sauce in a microwave-safe dish. Microwave until bubbling.",
            durationMin: 4,
          },
        ],
      },
      {
        title: "Finish",
        objective: "Cook and serve",
        steps: [
          {
            instruction:
              "Add eggs, pierce the yolks and whites, cover loosely and microwave in short intervals until the eggs are fully set. Let stand before uncovering carefully.",
            durationMin: 6,
          },
          {
            instruction:
              "Scatter crumbled feta over the eggs and serve with flatbread.",
            durationMin: 2,
          },
        ],
      },
    ],
    notes: null,
  };
}

export function storedRecipe(recipe = validRecipe()): Record<string, unknown> {
  return {
    id: "cached",
    title: recipe.title,
    cuisine: recipe.cuisine,
    energy_tier: recipe.tier,
    serves: recipe.servings,
    total_time_min: recipe.timeMinutes,
    ingredient_groups: recipe.ingredientGroups,
    workflow_sections: recipe.workflowSections,
    nutrition: recipe.nutrition,
    tags: recipe.tags,
    notes: recipe.notes,
    content_status: "full",
    proposal_ingredients: contract.ingredients,
    proposal_steps: contract.steps,
  };
}
