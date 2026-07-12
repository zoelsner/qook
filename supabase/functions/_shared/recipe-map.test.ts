import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildSlug,
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
  nutrition: { calories: 340, proteinG: 12, carbG: 55, fatG: 8 },
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
  const client = dbRowToClientRecipe(
    {
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
      signature: "deadbeefcafebabe",
      created_at: "2026-07-06T00:00:00Z",
      updated_at: "2026-07-06T00:00:00Z",
    },
    ["quick", "vegan", "gluten-free"],
  );
  assertEquals(client.timeMinutes, 25);
  assertEquals(client.servings, 2);
  assertEquals(client.tier, "after-work");
  assertEquals(client.heroImageUrl, "https://cdn.test/meal-images/abc.png");

  // Client-shape parsed ingredient fields (canonicalKey/name/quantityAmount/
  // quantityUnit), not the model's snake_case canonical_key/canonical_name/
  // amount/unit.
  assertEquals(client.ingredients[0].items[0].item, "gnocchi");
  assertEquals(client.ingredients[0].items[0].parsed?.canonicalKey, "gnocchi");
  assertEquals(client.ingredients[0].items[0].parsed?.name, "gnocchi");
  assertEquals(client.ingredients[0].items[0].parsed?.category, "Pantry");
  assertEquals(client.ingredients[0].items[0].parsed?.quantityAmount, 1);
  assertEquals(client.ingredients[0].items[0].parsed?.quantityUnit, "lb");

  // slug/signature/dietaryTags contract fields. tags keeps the model's
  // free-text array; dietaryTags is filtered to valid DietaryTag members.
  assertEquals(client.signature, "deadbeefcafebabe");
  assertEquals(client.slug, "pan-fried-gnocchi-deadbe");
  assertEquals(client.tags, ["quick", "vegan", "gluten-free"]);
  assertEquals(client.dietaryTags, ["vegan", "gluten-free"]);
});

Deno.test("dbRowToClientRecipe defaults tags to [] for DB-only reads", () => {
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
    source: "ai",
    signature: "deadbeefcafebabe",
    created_at: "2026-07-06T00:00:00Z",
    updated_at: "2026-07-06T00:00:00Z",
  });
  assertEquals(client.tags, []);
  assertEquals(client.dietaryTags, []);
  assertEquals(client.ownerId, undefined);
});

Deno.test("buildSlug is deterministic and collision-resistant", () => {
  const a = buildSlug("Pan-Fried Gnocchi!!", "deadbeefcafebabe");
  const b = buildSlug("Pan-Fried Gnocchi!!", "deadbeefcafebabe");
  assertEquals(a, b);
  assertEquals(a, "pan-fried-gnocchi-deadbe");

  // Same title, different signature → different slug (collision avoidance).
  const c = buildSlug("Pan-Fried Gnocchi!!", "0000001111112222");
  assert(a !== c);

  // Missing signature → plain slugified title, no trailing dash.
  assertEquals(buildSlug("Pan-Fried Gnocchi!!", ""), "pan-fried-gnocchi");
});
