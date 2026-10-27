import { api } from './api';
import { createCompletionCoordinator } from '../features/recipe/completionCoordinator';
import { useWeekPlan } from '../stores/weekPlan';
import { useCookSession } from '../stores/cookSession';
import { useGenerationSession } from '../stores/generationSession';

export function adoptCompletedRecipe(oldId: string, full: import('@qook/shared').Recipe) {
  useWeekPlan.getState().reconcileRecipe(oldId, full);
  useGenerationSession.getState().reconcileKept(oldId, full);
  if (full.id !== oldId) {
    useWeekPlan.getState().remapSavedRecipe(oldId, full.id);
    useCookSession.getState().remapRecipe(oldId, full.id);
  }
}

export const recipeCompletion = createCompletionCoordinator({
  fill: recipe => api.fillRecipe(recipe.id, undefined, recipe.generationSessionId),
  fetch: id => api.getRecipeById(id),
  adopt: adoptCompletedRecipe,
});
