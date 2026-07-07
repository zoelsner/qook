import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeSignature,
  dbRowToClientRecipe,
  toRecipeInsert,
} from "./recipe-map.ts";

const R = {
  title: "Pan-Fried Gnocchi",
  cuisine: "Italian",
  tier: "after-work" as const,
  tags: [],
  timeMinutes: 25,
  servings: 2,
  ingredientGroups: [
    {
      title: "Main",
      role: "main" as const,
      items: [
        {
          item: "gnocchi",
          parsed: {
            canonical_name: "gnocchi",
            canonical_key: "gnocchi",
            category: "Pantry" as const,
            amount: 1,
            unit: "lb" as const,
          },
        },
      ],
    },
  ],
  workflowSections: [
    {
      title: "Crisp",
      objective: "Brown the gnocchi",
      steps: [{ instruction: "Fry until golden", durationMin: 8 }],
    },
  ],
};

Deno.test("computeSignature is deterministic hex", async () => {
  const a = await computeSignature(R);
  const b = await computeSignature(R);
  assertEquals(a, b);
  assert(/^[0-9a-f]{64}$/.test(a));
});

Deno.test("toRecipeInsert uses snake_case DB columns", () => {
  const ins = toRecipeInsert(R, "sig123");
  assertEquals(ins.energy_tier, "after-work");
  assertEquals(ins.total_time_min, 25);
  assertEquals(ins.serves, 2);
  assert(Array.isArray(ins.ingredient_groups));
  assertEquals(ins.user_id, null);
  assertEquals(ins.image_status, "pending");
});

Deno.test("dbRowToClientRecipe maps to camelCase and builds heroImageUrl", () => {
  Deno.env.set("SUPABASE_MEAL_IMAGES_BASE", "https://cdn.test/meal-images");
  const client = dbRowToClientRecipe({
    id: "abc",
    title: "Pan-Fried Gnocchi",
    cuisine: "Italian",
    energy_tier: "after-work",
    serves: 2,
    total_time_min: 25,
    difficulty: "Medium",
    ingredient_groups: R.ingredientGroups,
    workflow_sections: R.workflowSections,
    timeline: [],
    image_status: "ready",
    image_storage_path: "abc.png",
    source: "ai",
    created_at: "2026-07-06T00:00:00Z",
    updated_at: "2026-07-06T00:00:00Z",
  });
  assertEquals(client.timeMinutes, 25);
  assertEquals(client.servings, 2);
  assertEquals(client.tier, "after-work");
  assertEquals(client.heroImageUrl, "https://cdn.test/meal-images/abc.png");
  assertEquals(client.ingredients[0].items[0].item, "gnocchi");
});
