import type { Recipe } from '@qook/shared';

// Polling may finish the artwork after fill. Prefer the fresh full row when
// it represents the same dish; retain completion while a redirect catches up.
export function currentDetailRecipe(completed: Recipe | undefined, fetched: Recipe | null | undefined): Recipe | null | undefined {
  if (!completed) return fetched;
  return fetched?.contentStatus === 'full' && fetched.id === completed.id
    ? { ...completed, ...fetched, generationSessionId: fetched.generationSessionId ?? completed.generationSessionId }
    : completed;
}
