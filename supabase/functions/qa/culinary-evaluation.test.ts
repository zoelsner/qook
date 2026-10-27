import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import cases from "./culinary-cases.json" with { type: "json" };
import { bowl } from "./culinary.fixtures.ts";
import { dinnerBrief, ingredientConstraintErrors } from "../_shared/dinner-brief.ts";
import { buildLiveContext } from "../_shared/context.ts";
import { contractFromRow, validateFillContract } from "../_shared/fill-contract.ts";

for (const c of cases) Deno.test(`culinary brief fixture: ${c.id}`, () => {
  const brief = dinnerBrief(buildLiveContext("brain-is-fried", { household_size: c.household }, c.context));
  assertEquals(brief.householdSize, c.expectedServings);
  assertEquals(ingredientConstraintErrors([c.ingredient], brief).length > 0, c.blocked);
});

Deno.test("KNOWN GAP: stored appliance availability is not fully enforced without an explicit voice-only method", () => {
  const brief = dinnerBrief(buildLiveContext("brain-is-fried", { cooking_tools: ["microwave"] }, "Dinner for two."));
  const recipe = bowl({ title: "Warm chickpea bowl", instructions: [{ instruction: "Bake the chickpeas in the oven, then add the other ingredients.", durationMin: 10 }] });
  const contract = contractFromRow({ title: recipe.title, energy_tier: recipe.tier, serves: 2, total_time_min: 10, proposal_ingredients: recipe.ingredientGroups[0].items.map(item => item.item), proposal_steps: ["Warm the chickpeas and assemble the bowl."] }, brief);
  assertEquals(validateFillContract(recipe, contract), []);
  // This characterizes the current gap; it is not desired culinary behavior.
  assertEquals(brief.kitchenTools, ["microwave"]);
});

Deno.test("KNOWN GAP: misleading overlap language can conceal an impossible elapsed-time promise", () => {
  const recipe = bowl({ title: "Roasted chickpea rice bowl", tier: "got-energy", time: 35, ingredients: ["chickpeas", "rice"], instructions: [
    { instruction: "Meanwhile, roast the chickpeas for 30 minutes.", durationMin: 30 },
    { instruction: "After the chickpeas finish, cook the rice for 20 minutes and serve.", durationMin: 20 },
  ] });
  const contract = contractFromRow({ title: recipe.title, energy_tier: recipe.tier, serves: 2, total_time_min: 35, proposal_ingredients: ["chickpeas", "rice"], proposal_steps: ["Roast chickpeas, then cook rice."] });
  assertEquals(validateFillContract(recipe, contract), []);
  recipe.workflowSections[0].steps[0].instruction = "Roast the chickpeas for 30 minutes.";
  assert(validateFillContract(recipe, contract).some(error => error.includes("Sequential step durations")));
});
