import type { Recipe } from '@qook/shared';
import type { DayPlan, StagedShopRecipe } from './weekPlan';
import type { ISODate } from '../features/week/weekDates';

interface Snapshots {
  plan: Record<ISODate, DayPlan>;
  shopStaging: StagedShopRecipe[];
}

// A fill can finish after allocation has already saved the proposal. Replace
// matching snapshots without selecting a meal again or disturbing another pick.
export function reconcileRecipeSnapshots<T extends Snapshots>(
  state: T,
  oldId: string,
  full: Recipe,
): T {
  const replace = (recipe: Recipe) =>
    recipe.id === oldId || recipe.id === full.id ? full : recipe;
  let plan = state.plan;
  for (const [date, day] of Object.entries(state.plan)) {
    if (!day.recipes) continue;
    const recipes = day.recipes.map(replace);
    if (recipes.every((recipe, index) => recipe === day.recipes![index])) continue;
    if (plan === state.plan) plan = { ...plan };
    plan[date] = { ...day, recipes };
  }
  let shopStaging = state.shopStaging;
  if (shopStaging.some((entry) => replace(entry.recipe) !== entry.recipe)) {
    shopStaging = shopStaging.map((entry) => {
      const recipe = replace(entry.recipe);
      return recipe === entry.recipe ? entry : { ...entry, recipe };
    });
  }
  // A signature-cache redirect can join two explicitly staged cards. Staging
  // appends each latest portion choice, so retain the last entry for each id.
  const uniqueStaging = new Map<string, StagedShopRecipe>();
  for (const entry of shopStaging) {
    uniqueStaging.delete(entry.recipe.id);
    uniqueStaging.set(entry.recipe.id, entry);
  }
  if (uniqueStaging.size !== shopStaging.length) shopStaging = [...uniqueStaging.values()];
  return plan === state.plan && shopStaging === state.shopStaging
    ? state
    : { ...state, plan, shopStaging };
}
