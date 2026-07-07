// supabase/functions/_shared/prompts/live.test.ts
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildLiveSystemPrompt, buildLiveUserPrompt } from "./live.ts";

Deno.test("system prompt has safety refusal clause", () => {
  const s = buildLiveSystemPrompt();
  assert(s.includes("refusal"));
});

Deno.test("user prompt carries tier ceiling and structured-ingredient directive", () => {
  const p = buildLiveUserPrompt({
    tier: "after-work",
    householdSize: 2,
    avoidIngredients: ["cilantro"],
    lovedCuisines: ["Thai", "Italian"],
    recentLikedTitles: ["Miso Salmon"],
    kitchenTools: ["skillet", "pot"],
  });
  assert(p.includes("30")); // after-work ceiling
  assert(p.includes("parsed.category"));
  assert(p.includes("canonical_key"));
  assert(p.includes("cilantro"));
  assert(p.includes('"recipes"'));
});
