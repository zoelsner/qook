import type { Recipe } from "./schema.ts";

// The DB `ingredient_groups`/`workflow_sections` jsonb columns store the edge
// Recipe schema's shapes verbatim (toRecipeInsert does not transform them),
// so ClientRecipe reuses those inferred shapes rather than `unknown[]` —
// this keeps indexed field access type-safe without committing to the
// client package's own IngredientGroup/RecipeSection types, whose nested
// ParsedIngredient field names (canonicalKey/name/quantityAmount) diverge
// from what the model emits (canonical_key/canonical_name/amount/unit).
type IngredientGroupShape = Recipe["ingredientGroups"];
type WorkflowSectionShape = Recipe["workflowSections"];
type EdgeParsedIngredient = IngredientGroupShape[number]["items"][number]["parsed"];
type EdgeIngredientItem = IngredientGroupShape[number]["items"][number];

// Client shape for packages/shared/src/types/recipe.ts `ParsedIngredient`.
// Field names diverge from the model's snake_case output (canonical_key/
// canonical_name/amount/unit) — this is the one place that reconciles them.
type ClientParsedIngredient = {
  canonicalKey: string;
  name: string;
  category: string;
  quantityAmount?: number;
  quantityUnit?: string;
};

type ClientIngredient = {
  item: string;
  quantity?: string;
  notes?: string;
  parsed?: ClientParsedIngredient;
};

type ClientIngredientGroup = {
  title: string;
  role: string;
  items: ClientIngredient[];
};

export type ClientRecipe = {
  id: string;
  slug: string;
  signature: string;
  title: string;
  cuisine: string;
  tier: string;
  tags: string[];
  dietaryTags: string[];
  timeMinutes: number;
  servings: number;
  difficulty: string;
  ingredients: ClientIngredientGroup[]; // ingredientGroups, client parsed shape
  steps: WorkflowSectionShape; // workflowSections shape (client calls it `steps`)
  timeline: unknown[];
  notes?: string;
  heroImageUrl?: string;
  ownerId?: string;
  imageStatus: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

// Canonical string for SHA-256 dedup. MUST match the client's
// canonicalizeRecipeForSignature (packages/shared/src/domain/signature.ts):
// title/cuisine lowercased+trimmed, tier, sorted lowercased ingredient names.
function canonicalize(r: Recipe): string {
  const ingredientKeys = r.ingredientGroups
    .flatMap((g) => g.items.map((it) => it.item.toLowerCase().trim()))
    .filter(Boolean)
    .sort();
  return JSON.stringify({
    title: r.title.toLowerCase().trim(),
    cuisine: r.cuisine.toLowerCase().trim(),
    tier: r.tier,
    ingredients: ingredientKeys,
  });
}

export async function computeSignature(r: Recipe): Promise<string> {
  const data = new TextEncoder().encode(canonicalize(r));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Maps model output → snake_case columns for `public.recipes` insert.
// Difficulty is derived from tier if the model didn't emit one.
function difficultyForTier(tier: string): string {
  if (tier === "brain-is-fried" || tier === "after-work") return "Easy";
  if (tier === "got-energy") return "Medium";
  return "Advanced";
}

export function toRecipeInsert(r: Recipe, signature: string) {
  return {
    user_id: null as string | null,
    signature,
    title: r.title,
    cuisine: r.cuisine,
    serves: r.servings,
    total_time_min: r.timeMinutes,
    difficulty: difficultyForTier(r.tier),
    energy_tier: r.tier,
    ingredient_groups: r.ingredientGroups,
    workflow_sections: r.workflowSections,
    timeline: [] as unknown[],
    notes: r.notes ?? null,
    source: "ai" as const,
    image_status: "pending" as const,
  };
}

function mealImagesBase(): string {
  const explicit = Deno.env.get("SUPABASE_MEAL_IMAGES_BASE");
  if (explicit) return explicit.replace(/\/$/, "");
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/meal-images`;
}

function mapParsedIngredient(
  p: EdgeParsedIngredient,
): ClientParsedIngredient {
  return {
    canonicalKey: p.canonical_key,
    name: p.canonical_name,
    category: p.category,
    ...(p.amount != null ? { quantityAmount: p.amount } : {}),
    ...(p.unit != null ? { quantityUnit: p.unit } : {}),
  };
}

function mapIngredientItem(it: EdgeIngredientItem): ClientIngredient {
  return {
    item: it.item,
    ...(it.quantity != null ? { quantity: it.quantity } : {}),
    ...(it.notes != null ? { notes: it.notes } : {}),
    parsed: mapParsedIngredient(it.parsed),
  };
}

function mapIngredientGroups(
  groups: IngredientGroupShape,
): ClientIngredientGroup[] {
  return groups.map((g) => ({
    title: g.title,
    role: g.role,
    items: g.items.map(mapIngredientItem),
  }));
}

// Deterministic slug: lowercase title, non-alphanumeric runs → single `-`,
// trim leading/trailing `-`, then append the first 6 hex chars of the
// recipe's dedup signature so same-title recipes don't collide.
export function buildSlug(title: string, signature: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${signature.slice(0, 6)}`;
}

// `modelTags` is the in-memory model Recipe's `tags` (see schema.ts) for the
// generation that just produced/matched this row. The `recipes` table has no
// tags column, so there is nothing to persist — callers pass the tags they
// already have on hand at generation time. DB-only reads (no in-memory
// recipe available) omit the param and get `[]` for both tag fields.
export function dbRowToClientRecipe(
  row: Record<string, unknown>,
  modelTags: string[] = [],
): ClientRecipe {
  const path = row.image_storage_path as string | null | undefined;
  const title = String(row.title);
  const signature = String(row.signature ?? "");
  const ownerId = row.user_id != null ? String(row.user_id) : undefined;
  return {
    id: String(row.id),
    slug: buildSlug(title, signature),
    signature,
    title,
    cuisine: String(row.cuisine),
    tier: String(row.energy_tier),
    tags: modelTags,
    dietaryTags: modelTags,
    timeMinutes: Number(row.total_time_min ?? 0),
    servings: Number(row.serves ?? 0),
    difficulty: String(row.difficulty ?? "Medium"),
    ingredients: mapIngredientGroups(
      (row.ingredient_groups as IngredientGroupShape) ?? [],
    ),
    steps: (row.workflow_sections as WorkflowSectionShape) ?? [],
    timeline: (row.timeline as unknown[]) ?? [],
    notes: (row.notes as string | undefined) ?? undefined,
    heroImageUrl: path ? `${mealImagesBase()}/${path}` : undefined,
    ownerId,
    imageStatus: String(row.image_status ?? "pending"),
    source: String(row.source ?? "ai"),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}
