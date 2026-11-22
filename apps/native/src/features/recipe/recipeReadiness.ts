import type { Recipe } from '@qook/shared';
import type { CompletionState } from './completionCoordinator';
import { recipeCompletionAction } from './recipeCompletionAction';

export type RecipeReadiness =
  | 'ready'
  | 'finishing'
  | 'unfinished'
  | 'retry'
  | 'fresh-idea';

export interface IncompleteShopMeal {
  recipe: Recipe;
  readiness: Exclude<RecipeReadiness, 'ready'>;
}

export function getRecipeReadiness(
  recipe: Pick<Recipe, 'contentStatus' | 'generationError'> | null | undefined,
  completion: Pick<CompletionState, 'status' | 'message'>,
): RecipeReadiness {
  if (!recipe || recipe.contentStatus !== 'proposal') return 'ready';
  if (completion.status === 'pending') return 'finishing';
  if (recipeCompletionAction(recipe, completion) === 'fresh-idea') {
    return 'fresh-idea';
  }
  if (completion.status === 'error' || Boolean(recipe.generationError?.trim())) {
    return 'retry';
  }
  return 'unfinished';
}

export function collectIncompleteShopMeals(
  meals: Recipe[],
  getCompletion: (id: string) => Pick<CompletionState, 'status' | 'message'>,
): IncompleteShopMeal[] {
  const incomplete: IncompleteShopMeal[] = [];
  for (const meal of meals) {
    const readiness = getRecipeReadiness(meal, getCompletion(meal.id));
    if (readiness !== 'ready') {
      incomplete.push({ recipe: meal, readiness });
    }
  }
  return incomplete;
}
