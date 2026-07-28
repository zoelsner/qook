import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildImagePrompt, buildPlateDescriptionRequest } from "./image.ts";

Deno.test("image prompt carries the v5 composition + style directives", () => {
  const p = buildImagePrompt({ title: "Miso-Butter Salmon" });
  assert(p.includes("Miso-Butter Salmon"));
  assert(/shallow cream stoneware bowl/i.test(p));
  assert(/cut off by at least one edge/i.test(p));
  assert(/jewel-toned/i.test(p));
  assert(/match the artist's hand of the reference image/i.test(p));
});

Deno.test("image prompt names the actual ingredients and pins their form", () => {
  const p = buildImagePrompt({
    title: "Gochujang Beef Rice Bowls",
    ingredientGroups: [
      {
        title: "main",
        items: [
          { item: "ground beef", quantity: "1 lb" },
          { item: "jasmine rice", quantity: "1 cup" },
          { item: "Ground Beef", quantity: "extra" }, // dupe, different case
          { item: "  " }, // blank — skipped
        ],
      },
    ],
  });
  assert(p.includes("The dish is made of: ground beef, jasmine rice."));
  assert(/ground meat stays crumbled/i.test(p));
});

Deno.test("image prompt falls back to the skeleton ingredient names", () => {
  // Deal-time rows have '[]' ingredient_groups; proposal_ingredients is the
  // only ingredient data they carry.
  const p = buildImagePrompt({
    title: "Harissa Turkey Meatball Couscous",
    ingredientGroups: [],
    proposalIngredients: ["ground turkey", "harissa", "couscous", "  "],
  });
  assert(p.includes("The dish is made of: ground turkey, harissa, couscous."));
});

Deno.test("image prompt survives missing or malformed ingredient groups", () => {
  const bare = buildImagePrompt({ title: "Mystery Stew" });
  assert(!bare.includes("The dish is made of"));
  assert(/rules below override it/i.test(bare)); // guardrail still present

  const malformed = buildImagePrompt({
    title: "Mystery Stew",
    ingredientGroups: [{ items: "not-an-array" }, null, 42],
  });
  assert(!malformed.includes("The dish is made of"));
});

Deno.test("plate spec replaces the raw ingredient list when present", () => {
  const p = buildImagePrompt({
    title: "Miso Tuna Edamame Rice Bowl",
    ingredientGroups: [
      { title: "main", items: [{ item: "canned tuna" }] },
    ],
    plateSpec: {
      components: [
        "glazed flaked tuna, lacquered amber",
        "bright green edamame beans",
      ],
      plating:
        "Flaked tuna spills off a high mound of white rice, edamame tumbling down one side.",
    },
  });
  assert(p.includes("The finished dish, as plated: Flaked tuna spills"));
  assert(p.includes("glazed flaked tuna, lacquered amber; bright green edamame beans"));
  assert(/individually visible and painted in exactly this form/i.test(p));
  assert(!p.includes("The dish is made of")); // no double ingredient signal
});

Deno.test("plate description request carries dish, ingredients, and method", () => {
  const req = buildPlateDescriptionRequest({
    title: "Gochujang Beef Rice Bowls",
    ingredientGroups: [
      { title: "main", items: [{ item: "ground beef" }, { item: "jasmine rice" }] },
    ],
    workflowSections: [
      {
        title: "cook",
        objective: "brown the beef",
        steps: [{ instruction: "Brown the ground beef, breaking it up.", durationMin: 6 }],
      },
    ],
  });
  assert(req.includes("Dish: Gochujang Beef Rice Bowls"));
  assert(req.includes("Ingredients: ground beef, jasmine rice"));
  assert(req.includes("Method: Brown the ground beef"));
  assert(/`components`: 3 to 5 strings/i.test(req));
  assert(/Forbidden everywhere/i.test(req));
});

Deno.test("plate description request falls back to the skeleton columns", () => {
  const req = buildPlateDescriptionRequest({
    title: "Harissa Turkey Meatball Couscous",
    ingredientGroups: [],
    workflowSections: [],
    proposalIngredients: ["ground turkey", "harissa", "couscous"],
    proposalSteps: ["roll and brown the meatballs", "steam the couscous"],
  });
  assert(req.includes("Ingredients: ground turkey, harissa, couscous"));
  assert(req.includes("Method: roll and brown the meatballs steam the couscous"));
});
