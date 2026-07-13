import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildImagePrompt, buildPlateDescriptionRequest } from "./image.ts";

Deno.test("image prompt carries the v3 composition + style directives", () => {
  const p = buildImagePrompt({ title: "Miso-Butter Salmon" });
  assert(p.includes("Miso-Butter Salmon"));
  assert(/single plate/i.test(p));
  assert(/touching the edges/i.test(p));
  assert(/jewel-toned/i.test(p));
  assert(/match this artist'?s hand/i.test(p));
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

Deno.test("image prompt survives missing or malformed ingredient groups", () => {
  const bare = buildImagePrompt({ title: "Mystery Stew" });
  assert(!bare.includes("The dish is made of"));
  assert(/actual prepared form/i.test(bare)); // guardrail still present

  const malformed = buildImagePrompt({
    title: "Mystery Stew",
    ingredientGroups: [{ items: "not-an-array" }, null, 42],
  });
  assert(!malformed.includes("The dish is made of"));
});

Deno.test("plate description replaces the raw ingredient list when present", () => {
  const p = buildImagePrompt({
    title: "Miso Tuna Edamame Rice Bowl",
    ingredientGroups: [
      { title: "main", items: [{ item: "canned tuna" }] },
    ],
    plateDescription:
      "Glazed flaked tuna piled over white rice, scattered with bright green edamame.",
  });
  assert(p.includes("The finished dish, as plated: Glazed flaked tuna"));
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
  assert(/two sentences/i.test(req));
  assert(/never mention cookware, packaging, cans/i.test(req));
});
