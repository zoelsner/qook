import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Recipe, RecipeJsonSchema } from "./schema.ts";

const VALID = {
  title: "Miso-Butter Salmon with Sesame Rice",
  cuisine: "Japanese",
  tier: "after-work",
  tags: ["fish", "weeknight"],
  timeMinutes: 28,
  servings: 2,
  ingredientGroups: [
    {
      title: "Main",
      role: "main",
      items: [
        {
          item: "salmon fillet",
          quantity: "2 fillets",
          parsed: {
            canonical_name: "salmon",
            canonical_key: "salmon",
            category: "Protein",
            amount: 2,
            unit: "count",
          },
        },
      ],
    },
  ],
  workflowSections: [
    {
      title: "Cook",
      objective: "Sear the salmon",
      steps: [{ instruction: "Sear skin-side down until crisp", durationMin: 6 }],
    },
  ],
  nutrition: { calories: 420, proteinG: 32, carbG: 30, fatG: 18 },
};

Deno.test("Recipe parses a valid structured recipe", () => {
  const r = Recipe.parse(VALID);
  assertEquals(r.ingredientGroups[0].items[0].parsed.canonical_key, "salmon");
});

Deno.test("Recipe rejects an ingredient missing parsed", () => {
  const bad = structuredClone(VALID);
  // deno-lint-ignore no-explicit-any
  delete (bad.ingredientGroups[0].items[0] as any).parsed;
  const res = Recipe.safeParse(bad);
  assertEquals(res.success, false);
});

Deno.test("RecipeJsonSchema requires parsed on ingredient items", () => {
  const itemProps =
    RecipeJsonSchema.schema.properties.ingredientGroups.items.properties.items
      .items;
  assertEquals(itemProps.required.includes("parsed"), true);
});

// deno-lint-ignore no-explicit-any
function assertExhaustiveRequired(node: any, path: string): void {
  if (node === null || typeof node !== "object") return;
  if (node.properties && typeof node.properties === "object") {
    const propKeys = Object.keys(node.properties);
    const required = node.required ?? [];
    for (const key of propKeys) {
      assertEquals(
        required.includes(key),
        true,
        `${path}: property "${key}" missing from required`,
      );
    }
    for (const key of propKeys) {
      assertExhaustiveRequired(node.properties[key], `${path}.${key}`);
    }
  }
  if (node.items) {
    assertExhaustiveRequired(node.items, `${path}[]`);
  }
}

Deno.test("RecipeJsonSchema is exhaustively strict: every properties key is required", () => {
  assertExhaustiveRequired(RecipeJsonSchema.schema, "schema");
});

Deno.test("Recipe accepts explicit nulls for optional fields", () => {
  const withNulls = structuredClone(VALID);
  // deno-lint-ignore no-explicit-any
  (withNulls as any).nutrition.calories = null;
  // deno-lint-ignore no-explicit-any
  (withNulls as any).notes = null;
  // deno-lint-ignore no-explicit-any
  (withNulls as any).ingredientGroups[0].items[0].quantity = null;
  // deno-lint-ignore no-explicit-any
  (withNulls as any).ingredientGroups[0].items[0].notes = null;
  const r = Recipe.parse(withNulls);
  assertEquals(r.nutrition?.calories, null);
  assertEquals(r.notes, null);
  assertEquals(r.ingredientGroups[0].items[0].quantity, null);
  assertEquals(r.ingredientGroups[0].items[0].notes, null);
});

Deno.test("Recipe requires nutrition.proteinG", () => {
  const missing = structuredClone(VALID);
  // deno-lint-ignore no-explicit-any
  delete (missing as any).nutrition.proteinG;
  const res = Recipe.safeParse(missing);
  assertEquals(res.success, false);
});

Deno.test("Recipe rejects a null nutrition object", () => {
  const nullNutrition = structuredClone(VALID);
  // deno-lint-ignore no-explicit-any
  (nullNutrition as any).nutrition = null;
  const res = Recipe.safeParse(nullNutrition);
  assertEquals(res.success, false);
});
