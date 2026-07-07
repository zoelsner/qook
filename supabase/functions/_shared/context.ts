import type { TierKey } from "./tiers.ts";
import type { LiveContext } from "./prompts/live.ts";

// Tools the recipes may assume. Matches the whitelist in section-ai.md §2.3.
const TOOL_WHITELIST = [
  "stovetop",
  "oven",
  "knife",
  "cutting board",
  "sheet pan",
  "skillet",
  "pot",
  "wok",
  "blender",
  "food processor",
];

export function buildLiveContext(
  tier: TierKey,
  prefs: Record<string, unknown> | null,
  voiceContext: string | undefined,
): LiveContext {
  const cuisines = Array.isArray(prefs?.cuisine_preferences)
    ? (prefs!.cuisine_preferences as unknown[]).map(String)
    : [];
  const avoid = Array.isArray(prefs?.avoid_ingredients)
    ? (prefs!.avoid_ingredients as unknown[]).map(String)
    : [];
  const tools = Array.isArray(prefs?.cooking_tools)
    ? (prefs!.cooking_tools as unknown[])
      .map(String)
      .filter((t) => TOOL_WHITELIST.includes(t))
    : [];
  const trimmedVoice = voiceContext?.trim();

  return {
    tier,
    householdSize: typeof prefs?.household_size === "number"
      ? (prefs!.household_size as number)
      : 2,
    avoidIngredients: avoid,
    lovedCuisines: cuisines.slice(0, 3),
    recentLikedTitles: [], // swipe history not wired this phase
    voiceContext: trimmedVoice && trimmedVoice.length ? trimmedVoice : undefined,
    kitchenTools: tools,
  };
}
