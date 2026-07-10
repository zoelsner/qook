import type { Recipe } from '@qook/shared';

type RecipeArtFields = Pick<
  Recipe,
  'heroImageUrl' | 'imageStatus' | 'localImageKey'
>;

type PollableRecipe = RecipeArtFields & { id?: string };

// Recipe ids this client has fired art generation for (via api.requestRecipeImage).
// Under spotlight-first, an un-requested recipe stays at image_status 'pending'
// forever (nobody paid for its art), so polling it would loop with no end state.
// We poll a 'pending' row only if we kicked it off; a 'generating' row is already
// in flight (possibly another session via the global cache) and polls regardless.
// Module-level so it is shared across every useRecipeArt instance in the session;
// intentionally NOT persisted — see edge case (e) below.
const requestedArtIds = new Set<string>();

export function markRecipeArtRequested(id: string): void {
  requestedArtIds.add(id);
}

export function unmarkRecipeArtRequested(id: string): void {
  requestedArtIds.delete(id);
}

export function hasRequestedRecipeArt(id: string): boolean {
  return requestedArtIds.has(id);
}

// TEST-ONLY: reset the module set between bun test cases.
export function _resetRequestedArtIds(): void {
  requestedArtIds.clear();
}

export function isRecipeArtMissing(
  recipe: RecipeArtFields | null | undefined,
): boolean {
  return !!recipe && !recipe.heroImageUrl && !recipe.localImageKey;
}

export function shouldPollRecipeArt(
  recipe: PollableRecipe | null | undefined,
): boolean {
  if (!isRecipeArtMissing(recipe)) return false;
  // 'generating' is genuinely in flight (ours or another session's) — always poll.
  if (recipe!.imageStatus === 'generating') return true;
  // 'pending' only resolves if we (this client) fired it; otherwise it is stuck.
  if (recipe!.imageStatus === 'pending') {
    return !!recipe!.id && hasRequestedRecipeArt(recipe!.id);
  }
  return false; // 'ready' handled by isRecipeArtMissing; 'failed' never polls.
}
