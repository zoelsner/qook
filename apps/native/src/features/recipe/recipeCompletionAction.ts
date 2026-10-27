import type { Recipe } from '@qook/shared';
import type { CompletionState } from './completionCoordinator';

// A server refusal to reuse a card is terminal for that idea, unlike a
// connection failure. Do not infer this merely from a missing session hint:
// older clients can still complete cards with an owned server association.
export function recipeCompletionAction(
  recipe: Pick<Recipe, 'contentStatus' | 'generationError'> | undefined,
  completion: Pick<CompletionState, 'status' | 'message'>,
): 'fresh-idea' | 'retry' | null {
  if (recipe?.contentStatus !== 'proposal' || completion.status === 'pending') return null;
  const message = completion.message ?? recipe.generationError ?? '';
  return message.toLowerCase().includes('choose a new dinner idea') ? 'fresh-idea' : 'retry';
}
