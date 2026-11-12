import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildLiveContext } from "./context.ts";
import { briefContext, briefDirective, dinnerBrief, ingredientConstraintErrors } from "./dinner-brief.ts";
import { buildProposalsUserPrompt } from "./prompts/proposals.ts";
import { buildFillUserPrompt } from "./prompts/fill.ts";
import { buildLiveUserPrompt } from "./prompts/live.ts";

// Exactly what onboarding saves: DIETARY_OPTIONS labels inside avoid_ingredients.
const brief = (avoid: string[], context?: string) =>
  dinnerBrief(buildLiveContext("after-work", { avoid_ingredients: avoid }, context));
const avoidLine = (prompt: string) => prompt.split("\n").find(line => line.startsWith("Avoid ingredients:"));

Deno.test("diet chip saved as avoid item becomes a diet; real ingredient stays avoided", () => {
  const b = brief(["Vegetarian", "mushrooms"]);
  assertEquals(b.diets, ["vegetarian"]);
  assertEquals(b.avoidIngredients, ["mushrooms"]);
  const ctx = briefContext(b, "after-work");
  for (const prompt of [buildProposalsUserPrompt(ctx), buildFillUserPrompt(ctx, "Dish", null), buildLiveUserPrompt(ctx)]) {
    assert(avoidLine(prompt)?.startsWith("Avoid ingredients: mushrooms."), avoidLine(prompt));
  }
  assertStringIncludes(briefDirective(b), '"diets":["vegetarian"]');
  assertEquals(ingredientConstraintErrors(["chicken thighs", "mushrooms", "tofu"], b).length, 2);
});

Deno.test("all onboarding labels map, tolerant of case and hyphen/space variants", () => {
  const b = brief(["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "No pork", "No shellfish"]);
  assertEquals(b.diets, ["vegan", "gluten-free", "dairy-free"]);
  assertEquals(b.excludedIngredients, ["pork", "shellfish"]);
  assertEquals(b.avoidIngredients, []);
  assertEquals(avoidLine(buildProposalsUserPrompt(briefContext(b, "after-work"))), "Avoid ingredients: none. This rule also applies to ingredientNames — never list an avoided ingredient there.");
  assertEquals(brief(["VEGAN", " gluten free ", "dairy free", "no-pork"]).diets, ["vegan", "gluten-free", "dairy-free"]);
  assertEquals(brief(["no-pork"]).excludedIngredients, ["pork"]);
  for (const name of ["pork belly", "shrimp", "wheat pasta", "feta", "egg", "honey"]) {
    assert(ingredientConstraintErrors([name], b).length > 0, name);
  }
});

Deno.test("vegan chip no longer flags plant-based substitutes by substring", () => {
  const b = brief(["Vegan"]);
  assertEquals(ingredientConstraintErrors(["vegan butter", "oat milk"], b), []);
  assert(ingredientConstraintErrors(["butter"], b).length > 0);
});

Deno.test("chip diets merge with free-text diets and plain avoid items are untouched", () => {
  const b = brief(["Gluten-free", "cilantro", "pork"], "Vegetarian tonight, no onions.");
  assertEquals(b.diets, ["gluten-free", "vegetarian"]);
  assertEquals(b.avoidIngredients, ["cilantro", "pork"]);
  assertEquals(b.excludedIngredients, ["onions"]);
});
