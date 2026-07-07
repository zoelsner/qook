export type EnergyTier =
  | 'brain-is-fried' // ≤ 15 min active
  | 'after-work' // ≤ 30 min active
  | 'got-energy' // ≤ 45 min active
  | 'weekend-project'; // > 45 min active

export const ENERGY_TIERS: EnergyTier[] = [
  'brain-is-fried',
  'after-work',
  'got-energy',
  'weekend-project',
];

export type RecipeDifficulty = 'Easy' | 'Medium' | 'Advanced';
export type IngredientRole = 'main' | 'side' | 'sauce' | 'garnish' | 'other';
export type GroceryCategory =
  | 'Produce'
  | 'Dairy'
  | 'Pantry'
  | 'Protein'
  | 'Frozen'
  | 'Bakery'
  | 'Other';
export type RecipeSource = 'cohort' | 'live' | 'user' | 'fallback' | 'ai';
export type ImageStatus = 'pending' | 'generating' | 'ready' | 'failed';
export type UnitSystem = 'imperial' | 'metric';
export type DietaryTag =
  | 'vegan'
  | 'vegetarian'
  | 'pescatarian'
  | 'gluten-free'
  | 'dairy-free'
  | 'nut-free'
  | 'low-carb'
  | 'high-protein';
export type PreferenceState = 'like' | 'love' | 'exclude';

export type ISODate = string & { readonly __iso: unique symbol };
export type Timestamp = number & { readonly __ts: unique symbol };
