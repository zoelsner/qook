import type { Recipe } from '@qook/shared';
import type { DayPlan } from './weekPlan';
import { recipeForServings } from '../lib/scaleQuantity';

export function selectDayRecipe(
  day: DayPlan | undefined,
  recipes: Recipe[],
  pickIndex: number,
  servings?: number,
): DayPlan {
  const previous = day?.recipes?.[day.pickIndex ?? 0];
  const next = recipes[pickIndex];
  const explicit = servings != null && Number.isFinite(servings) && servings > 0;
  return {
    ...day,
    recipes,
    pickIndex,
    servings: explicit ? servings : previous?.id === next?.id ? day?.servings : undefined,
  };
}

// Persist the portion choice on the selected day; keep cached recipes at their
// original quantities so background fills and repeated selection cannot scale twice.
export function activePickFor(day: DayPlan | undefined): Recipe | null {
  const pick = day?.recipes?.[day.pickIndex ?? 0];
  return pick ? recipeForServings(pick, day?.servings ?? pick.servings) : null;
}

export function selectedDayServings(day: DayPlan | undefined, recipeId: string): number | undefined {
  const pick = day?.recipes?.[day.pickIndex ?? 0];
  return pick?.id === recipeId ? day?.servings ?? pick.servings : undefined;
}
