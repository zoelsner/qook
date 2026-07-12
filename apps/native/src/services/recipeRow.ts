import type {
  ContentStatus,
  DietaryTag,
  EnergyTier,
  GroceryCategory,
  Ingredient,
  IngredientGroup,
  IngredientRole,
  ImageStatus,
  NutritionalEstimate,
  ParsedIngredient,
  Recipe,
  RecipeDifficulty,
  RecipeSection,
  RecipeSource,
  RecipeTimelineItem,
  Timestamp,
} from '@qook/shared';

// Ports supabase/functions/_shared/recipe-map.ts (dbRowToClientRecipe +
// buildSlug) to the client. Live `recipes` rows are snake_case DB columns;
// this maps them to the client's camelCase Recipe shape. Keep in sync with
// the edge mapper — do not invent a new shape here.

type DbParsedIngredient = {
  canonical_name: string;
  canonical_key: string;
  category: GroceryCategory;
  amount: number | null;
  unit: string | null;
};

type DbIngredientItem = {
  item: string;
  quantity?: string | null;
  notes?: string | null;
  parsed: DbParsedIngredient;
};

type DbIngredientGroup = {
  title: string;
  role: IngredientRole;
  items: DbIngredientItem[];
};

type DbWorkflowStep = {
  instruction: string;
  durationMin: number;
};

type DbWorkflowSection = {
  title: string;
  objective: string;
  steps: DbWorkflowStep[];
};

// Client DietaryTag closed enum — MUST stay identical to the union in
// packages/shared/src/types/primitives.ts (DietaryTag). Duplicated (rather
// than derived) so this stays a plain runtime Set.
const DIETARY_TAG_SET = new Set<string>([
  'vegan',
  'vegetarian',
  'pescatarian',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'low-carb',
  'high-protein',
]);

// Deterministic slug: lowercase title, non-alphanumeric runs → single `-`,
// trim leading/trailing `-`, then append the first 6 hex chars of the
// recipe's dedup signature so same-title recipes don't collide. Rows with
// no signature get the plain slugified title (no trailing dash).
export function buildSlug(title: string, signature: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return signature ? `${base}-${signature.slice(0, 6)}` : base;
}

function mapParsedIngredient(p: DbParsedIngredient): ParsedIngredient {
  return {
    canonicalKey: p.canonical_key,
    name: p.canonical_name,
    category: p.category,
    ...(p.amount != null ? { quantityAmount: p.amount } : {}),
    ...(p.unit != null ? { quantityUnit: p.unit } : {}),
  };
}

function mapIngredientItem(it: DbIngredientItem): Ingredient {
  return {
    item: it.item,
    ...(it.quantity != null ? { quantity: it.quantity } : {}),
    ...(it.notes != null ? { notes: it.notes } : {}),
    parsed: mapParsedIngredient(it.parsed),
  };
}

function mapIngredientGroups(groups: DbIngredientGroup[]): IngredientGroup[] {
  return groups.map((g) => ({
    title: g.title,
    role: g.role,
    items: g.items.map(mapIngredientItem),
  }));
}

function mapWorkflowSections(sections: DbWorkflowSection[]): RecipeSection[] {
  return sections.map((s) => ({
    title: s.title,
    objective: s.objective,
    steps: s.steps.map((step) => ({
      instruction: step.instruction,
      durationMin: step.durationMin,
    })),
  }));
}

function toTimestamp(value: unknown): Timestamp {
  const parsed = value != null ? Date.parse(String(value)) : NaN;
  return (Number.isNaN(parsed) ? Date.now() : parsed) as Timestamp;
}

// Maps a raw `public.recipes` DB row (snake_case) to the client Recipe
// shape. `mealImagesBase` is the fully-qualified public storage URL prefix
// for the `meal-images` bucket (e.g. `${supabaseUrl}/storage/v1/object/public/meal-images`).
export function dbRowToRecipe(
  row: Record<string, unknown>,
  mealImagesBase: string
): Recipe {
  const path = row.image_storage_path as string | null | undefined;
  const title = String(row.title);
  const signature = String(row.signature ?? '');
  const ownerId = row.user_id != null ? String(row.user_id) : undefined;
  const tags = Array.isArray(row.tags) ? row.tags.map(String) : [];
  // DB nutrition {calories, proteinG, carbG, fatG} → client
  // NutritionalEstimate (note carbsG spelling + required source).
  const n = row.nutrition as
    | {
        calories?: number | null;
        proteinG?: number | null;
        carbG?: number | null;
        fatG?: number | null;
      }
    | null
    | undefined;
  const nutritionalEstimate: NutritionalEstimate | undefined = n
    ? {
        ...(n.calories != null ? { calories: n.calories } : {}),
        ...(n.proteinG != null ? { proteinG: n.proteinG } : {}),
        ...(n.carbG != null ? { carbsG: n.carbG } : {}),
        ...(n.fatG != null ? { fatG: n.fatG } : {}),
        source: 'ai-estimate',
      }
    : undefined;

  return {
    id: String(row.id),
    slug: buildSlug(title, signature),
    signature,
    title,
    cuisine: String(row.cuisine),
    tier: String(row.energy_tier) as EnergyTier,
    tags,
    // Model tags are free text; the client DietaryTag union is closed —
    // only pass through the values that are valid members.
    dietaryTags: tags.filter((t): t is DietaryTag => DIETARY_TAG_SET.has(t)),
    timeMinutes: Number(row.total_time_min ?? 0),
    servings: Number(row.serves ?? 0),
    difficulty: String(row.difficulty ?? 'Medium') as RecipeDifficulty,
    ingredients: mapIngredientGroups(
      (row.ingredient_groups as DbIngredientGroup[]) ?? []
    ),
    steps: mapWorkflowSections(
      (row.workflow_sections as DbWorkflowSection[]) ?? []
    ),
    timeline: (row.timeline as RecipeTimelineItem[] | null) ?? [],
    notes: (row.notes as string | undefined) ?? undefined,
    ...(nutritionalEstimate ? { nutritionalEstimate } : {}),
    // ?v= cache-buster: storage path is stable per recipe and cached for a
    // year, so regenerated art needs a new URL to actually display.
    heroImageUrl: path
      ? `${mealImagesBase}/${path}${
          row.image_updated_at ? `?v=${Date.parse(String(row.image_updated_at))}` : ''
        }`
      : undefined,
    ownerId,
    imageStatus: String(row.image_status ?? 'pending') as ImageStatus,
    contentStatus: (String(row.content_status ?? 'full')) as ContentStatus,
    ...(row.hook != null ? { hook: String(row.hook) } : {}),
    ...(Array.isArray(row.proposal_ingredients) && row.proposal_ingredients.length
      ? { proposalIngredients: row.proposal_ingredients.map(String) }
      : {}),
    ...(Array.isArray(row.proposal_steps) && row.proposal_steps.length
      ? { proposalSteps: row.proposal_steps.map(String) }
      : {}),
    source: String(row.source ?? 'ai') as RecipeSource,
    createdAt: toTimestamp(row.created_at),
    updatedAt: toTimestamp(row.updated_at),
  };
}
