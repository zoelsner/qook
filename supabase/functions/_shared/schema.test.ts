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
