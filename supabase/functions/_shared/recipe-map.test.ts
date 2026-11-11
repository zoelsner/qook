import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildSlug,
  computeSignature,
  dbRowToClientRecipe,
  toFillUpdate,
  toRecipeInsert,
  toSkeletonInsert,
} from "./recipe-map.ts";
import type { DishContract } from "./dish-contract.ts";

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

const dish: DishContract = {
  version: 1,
  components: [{ ingredientNames: ["gnocchi"], form: "pan-fried gnocchi", appearance: "golden crisp edges" }],
  plating: "Gnocchi loosely piled with the browned edges visible.",
};

Deno.test("skeleton persists public dish identity before painting and fill preserves its identity/art", () => {
  const proposal = { title: R.title, cuisine: R.cuisine, timeMinutes: R.timeMinutes,
    proteinG: 12, hook: "Golden edges", ingredientNames: ["gnocchi"],
    stepOutline: ["Pan-fry the gnocchi"], dishContract: dish };
  const row = toSkeletonInsert(proposal, R.tier, R.servings);
  assertEquals(row.dish_contract, dish);
  assertEquals(row.image_status, "pending");
  assertEquals(toSkeletonInsert({ ...proposal, dishContract: undefined }, R.tier, R.servings).dish_contract, null);
  const update = toFillUpdate(R, "filled-signature");
  assertEquals("dish_contract" in update, false);
  assertEquals("image_status" in update, false);
  assertEquals("image_storage_path" in update, false);
  assertEquals({ ...row, ...update }.dish_contract, dish);
});

Deno.test("edge mapper retains the same trimmed public dish metadata as the client mapper", () => {
  const row = { id: "abc", title: R.title, cuisine: R.cuisine, energy_tier: R.tier,
    ingredient_groups: [], workflow_sections: [], dish_contract: {
      ...dish, plating: ` ${dish.plating} `,
      components: [{ ingredientNames: [" gnocchi "], form: " pan-fried gnocchi ", appearance: " golden crisp edges " }],
    } };
  assertEquals(dbRowToClientRecipe(row).dishContract, dish);
  assertEquals(JSON.parse(JSON.stringify(dbRowToClientRecipe(row))).dishContract, dish);
});

Deno.test("edge mapper keeps old recipes readable but omits invalid or private dish metadata", () => {
  for (const value of [undefined, null, [], {}, { ...dish, version: 2 },
    { ...dish, components: [] }, { ...dish, plating: " " },
    { ...dish, context: "private data does not belong here" },
    { ...dish, components: [{ ...dish.components[0], form: "x".repeat(121) }] },
    { ...dish, components: [{ ...dish.components[0], ingredientNames: ["x".repeat(121)] }] }]) {
    const client = dbRowToClientRecipe({ id: "abc", title: R.title, dish_contract: value });
    assertEquals(client.dishContract, undefined);
    assertEquals(client.title, R.title);
  }
});
