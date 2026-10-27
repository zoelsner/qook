import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildImagePrompt } from "./image.ts";

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
  assert(/cooking method to determine its final form/i.test(p));
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

Deno.test("saved dish components pin exact prepared forms and colors", () => {
  const p = buildImagePrompt({
    title: "Turkey Meatball Black Rice",
    proposalIngredients: ["ground turkey", "black rice", "feta"],
    dishContract: {
      version: 1,
      components: [
        { ingredientNames: ["ground turkey"], form: "round turkey meatballs", appearance: "deep amber browned crust" },
        { ingredientNames: ["black rice"], form: "cooked black rice grains", appearance: "glossy purple-black grains" },
        { ingredientNames: ["feta"], form: "crumbled feta", appearance: "small white crumbles" },
      ],
      plating: "Meatballs lean over a loose mound of rice with feta scattered off-centre.",
    },
  });
  assert(p.includes("round turkey meatballs: deep amber browned crust (made from ground turkey)"));
  assert(p.includes("glossy purple-black grains"));
  assert(p.includes("small white crumbles"));
  assert(/individually visible and painted in exactly this form/i.test(p));
  assert(/component identities, forms and colors above are authoritative/i.test(p));
  assert(!p.includes("Grains and starches are bright warm white"));
  assert(p.includes("Sauces retain their actual color, including white yogurt"));
  assert(!p.includes("NEVER muted, dusty, grey, beige"));
  assert(!p.includes("ground meat stays crumbled"));
  assert(!p.includes("The dish is made of"));
});

Deno.test("legacy full recipe image includes actual method with no text-model description", () => {
  const p = buildImagePrompt({
    title: "Gochujang Beef Rice Bowls",
    ingredientGroups: [{ items: [{ item: "ground beef" }, { item: "jasmine rice" }] }],
    workflowSections: [{ steps: [{ instruction: "Brown the beef, breaking it into crumbles." }] }],
  });
  assert(p.includes("The dish is made of: ground beef, jasmine rice"));
  assert(p.includes("Cooking method (use this to determine finished forms): Brown the beef"));
});

Deno.test("legacy proposal fallback preserves its cooked transformation", () => {
  const p = buildImagePrompt({
    title: "Harissa Turkey Meatball Couscous",
    ingredientGroups: [], workflowSections: [],
    proposalIngredients: ["ground turkey", "harissa", "couscous"],
    proposalSteps: ["Roll turkey into meatballs", "Brown meatballs", "Steam couscous"],
  });
  assert(p.includes("Roll turkey into meatballs Brown meatballs Steam couscous"));
  assert(!p.includes("ground meat stays crumbled"));
});
