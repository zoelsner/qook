import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { dinnerBrief, briefContext, ingredientConstraintErrors, DinnerBriefSchema } from "./dinner-brief.ts";
import { buildLiveContext } from "./context.ts";
Deno.test("private brief retains requirements after mutable preferences and context change", () => {
  const prefs = { avoid_ingredients: ['peanuts'], household_size: 4, cooking_tools: ['microwave'] };
  const brief = dinnerBrief(buildLiveContext('brain-is-fried', prefs, 'For two: vegan, peanut and sesame allergies. Microwave and kettle only, 15 minutes.'));
  prefs.avoid_ingredients.length = 0;
  assertEquals(brief.householdSize, 2);
  assertEquals(brief.allergies, ['peanut', 'sesame']);
  assertEquals(brief.diets, ['vegan']);
  assertEquals(brief.onlyMethods, ['microwave', 'kettle']);
  assertEquals(briefContext(DinnerBriefSchema.parse(JSON.parse(JSON.stringify(brief))), 'brain-is-fried').avoidIngredients, ['peanuts']);
  assert(ingredientConstraintErrors(['peanut oil', 'tahini', 'feta'], brief).length >= 3);
});
Deno.test("negated allergy and mushroom exception are not promoted into hard exclusions", () => {
  const brief = dinnerBrief(buildLiveContext('after-work', null, 'Four people, one pot, 30 minutes. I dislike mushrooms except finely chopped in sauce. I am not allergic to nuts. Use spinach.'));
  assertEquals(brief.allergies, []);
  assertEquals(brief.excludedIngredients, []);
  assertEquals(ingredientConstraintErrors(['mushrooms', 'walnuts'], brief), []);
});
Deno.test("explicit no-onions and gluten/dairy-free requirements guard named ingredients", () => {
  const brief = dinnerBrief(buildLiveContext('after-work', null, 'Gluten-free and dairy-free. No onions.'));
  assertEquals(brief.excludedIngredients, ['onions']);
  assertEquals(ingredientConstraintErrors(['olive oil', 'gluten-free flour'], brief), []);
  assertEquals(ingredientConstraintErrors(['butter', 'wheat bread', 'onions'], brief).length, 3);
});
Deno.test("butter beans are legumes while actual butter still violates dairy avoidance", () => {
  const brief = dinnerBrief(buildLiveContext('brain-is-fried', null, 'Vegan.'));
  assertEquals(ingredientConstraintErrors(['canned butter beans', 'butter beans with olive oil'], brief), []);
  assertEquals(ingredientConstraintErrors(['butter', 'butter beans with butter'], brief).length, 2);
});

Deno.test("explicit equipment/method conflict is retained and requires clarification", () => {
  const brief = dinnerBrief(buildLiveContext('brain-is-fried', null, 'For two, 10 minutes, microwave only. Roast raw chicken thighs until crispy.'));
  assertEquals(brief.onlyMethods, ['microwave']);
  assert(brief.conflicts.length > 0);
});

Deno.test("compound exclusions guard each named allergen", () => {
  const brief = dinnerBrief(buildLiveContext('after-work', null, 'No peanuts and sesame.'));
  assertEquals(brief.excludedIngredients, ['peanuts', 'sesame']);
  assertEquals(ingredientConstraintErrors(['peanut oil', 'tahini'], brief).length, 2);
});
Deno.test("a negated allergy does not erase a positive allergy after but", () => {
  const brief = dinnerBrief(buildLiveContext('after-work', null, 'I am not allergic to dairy, but I am allergic to peanuts.'));
  assertEquals(brief.allergies, ['peanut']);
  assertEquals(ingredientConstraintErrors(['peanut oil', 'milk'], brief).length, 1);
});
Deno.test("plant milk is allowed for vegan dinners while its actual allergens remain checked", () => {
  const brief = dinnerBrief(buildLiveContext('after-work', null, 'Vegan. Soy allergy.'));
  assertEquals(ingredientConstraintErrors(['coconut milk', 'oat milk', 'vegan butter'], brief), []);
  assertEquals(ingredientConstraintErrors(['soy milk', 'dairy milk'], brief).length, 2);
  assertEquals(ingredientConstraintErrors(['coconut milk and dairy milk'], brief).length, 1);
});
