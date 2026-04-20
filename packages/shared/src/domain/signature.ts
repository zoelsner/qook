// Produces the canonical string used for SHA-256 recipe deduplication.
// Callers hash the returned string with their platform's crypto (Web Crypto
// on edge runtimes; expo-crypto on the client).

import type { EnergyTier } from '../types/primitives';
import type { IngredientGroup } from '../types/recipe';

export interface RecipeSignatureInput {
  title: string;
  cuisine: string;
  tier: EnergyTier;
  ingredients: IngredientGroup[];
}

export function canonicalizeRecipeForSignature(
  input: RecipeSignatureInput
): string {
  const ingredientKeys = input.ingredients
    .flatMap((group) => group.items.map((item) => item.item.toLowerCase().trim()))
    .filter(Boolean)
    .sort();

  return JSON.stringify({
    title: input.title.toLowerCase().trim(),
    cuisine: input.cuisine.toLowerCase().trim(),
    tier: input.tier,
    ingredients: ingredientKeys,
  });
}
