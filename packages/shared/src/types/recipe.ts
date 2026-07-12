import type {
  ContentStatus,
  DietaryTag,
  EnergyTier,
  GroceryCategory,
  ImageStatus,
  IngredientRole,
  RecipeDifficulty,
  RecipeSource,
  Timestamp,
} from './primitives';

export interface ParsedIngredient {
  canonicalKey: string;
  name: string;
  quantityAmount?: number;
  quantityUnit?: string;
  quantityText?: string;
  category: GroceryCategory;
  optional?: boolean;
  substitutes?: string[];
}

export interface Ingredient {
  item: string;
  quantity?: string;
  notes?: string;
  parsed?: ParsedIngredient;
}

export interface IngredientGroup {
  title: string;
  role: IngredientRole;
  items: Ingredient[];
}

export interface RecipeStep {
  instruction: string;
  durationMin: number;
  requires?: string[];
  produces?: string[];
}

export interface RecipeSection {
  title: string;
  objective: string;
  steps: RecipeStep[];
}

export interface RecipeTimelineItem {
  atMin: number;
  instruction: string;
  sectionTitle: string;
}

export interface NutritionalEstimate {
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  source: 'ai-estimate' | 'computed' | 'missing';
}

export interface Recipe {
  id: string;
  slug: string;
  signature: string;

  title: string;
  cuisine: string;
  tier: EnergyTier;
  tags: string[];
  dietaryTags: DietaryTag[];

  timeMinutes: number;
  servings: number;
  difficulty: RecipeDifficulty;

  ingredients: IngredientGroup[];
  steps: RecipeSection[];
  timeline: RecipeTimelineItem[];

  notes?: string;
  nutritionalEstimate?: NutritionalEstimate;

  // Two-phase generation (spec 2026-07-10). 'proposal' = skeleton card
  // (title + hook + protein estimate, no ingredients/steps yet); 'full' =
  // written recipe. Undefined on legacy/mock recipes is treated as 'full'.
  contentStatus?: ContentStatus;
  hook?: string;

  // Card-back teaser (feature: flippable info back, 2026-07-12). Written
  // alongside the skeleton at proposal time; superseded (not overwritten) by
  // `ingredients`/`steps` at fill time.
  proposalIngredients?: string[];
  proposalSteps?: string[];

  heroImageUrl?: string;
  localImageKey?: string;
  blurhash?: string;
  imageStatus: ImageStatus;

  source: RecipeSource;
  ownerId?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type RecipeCard = Pick<
  Recipe,
  | 'id'
  | 'slug'
  | 'title'
  | 'cuisine'
  | 'tier'
  | 'timeMinutes'
  | 'servings'
  | 'difficulty'
  | 'heroImageUrl'
  | 'localImageKey'
  | 'blurhash'
  | 'imageStatus'
  | 'dietaryTags'
> & { teaser?: string };
