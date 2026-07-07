import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildLiveContext } from "./context.ts";

Deno.test("buildLiveContext maps a prefs row", () => {
  const ctx = buildLiveContext(
    "after-work",
    {
      household_size: 3,
      cuisine_preferences: ["Thai", "Italian", "Mexican", "Greek"],
      avoid_ingredients: ["cilantro"],
      cooking_tools: ["skillet", "wok", "blowtorch"],
    },
    "  something warm  ",
  );
  assertEquals(ctx.householdSize, 3);
  assertEquals(ctx.lovedCuisines, ["Thai", "Italian", "Mexican"]);
  assertEquals(ctx.avoidIngredients, ["cilantro"]);
  assertEquals(ctx.voiceContext, "something warm");
  // blowtorch is not on the whitelist → dropped
  assertEquals(ctx.kitchenTools.includes("blowtorch"), false);
  assertEquals(ctx.kitchenTools.includes("skillet"), true);
});

Deno.test("buildLiveContext tolerates null prefs", () => {
  const ctx = buildLiveContext("brain-is-fried", null, undefined);
  assertEquals(ctx.householdSize, 2);
  assertEquals(ctx.lovedCuisines, []);
  assertEquals(ctx.voiceContext, undefined);
});
