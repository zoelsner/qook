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

export type ClientRecipe = {
  id: string;
  title: string;
  cuisine: string;
  tier: string;
  tags: string[];
  timeMinutes: number;
  servings: number;
  difficulty: string;
  ingredients: IngredientGroupShape; // ingredientGroups shape (client calls it `ingredients`)
  steps: WorkflowSectionShape; // workflowSections shape (client calls it `steps`)
  timeline: unknown[];
  notes?: string;
  heroImageUrl?: string;
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

export function dbRowToClientRecipe(
  row: Record<string, unknown>,
): ClientRecipe {
  const path = row.image_storage_path as string | null | undefined;
  return {
    id: String(row.id),
    title: String(row.title),
    cuisine: String(row.cuisine),
    tier: String(row.energy_tier),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    timeMinutes: Number(row.total_time_min ?? 0),
    servings: Number(row.serves ?? 0),
    difficulty: String(row.difficulty ?? "Medium"),
    ingredients: (row.ingredient_groups as IngredientGroupShape) ?? [],
    steps: (row.workflow_sections as WorkflowSectionShape) ?? [],
    timeline: (row.timeline as unknown[]) ?? [],
    notes: (row.notes as string | undefined) ?? undefined,
    heroImageUrl: path ? `${mealImagesBase()}/${path}` : undefined,
    imageStatus: String(row.image_status ?? "pending"),
    source: String(row.source ?? "ai"),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}
