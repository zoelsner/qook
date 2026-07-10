import type { Recipe } from '@qook/shared';

type RecipeArtFields = Pick<
  Recipe,
  'heroImageUrl' | 'imageStatus' | 'localImageKey'
>;

export function isRecipeArtMissing(recipe: RecipeArtFields | null | undefined): boolean {
  return !!recipe && !recipe.heroImageUrl && !recipe.localImageKey;
}

export function shouldPollRecipeArt(
  recipe: RecipeArtFields | null | undefined,
): boolean {
  return (
    isRecipeArtMissing(recipe) &&
    (recipe?.imageStatus === 'pending' || recipe?.imageStatus === 'generating')
  );
}
