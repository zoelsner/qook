import { useQuery } from '@tanstack/react-query';
import type { Recipe } from '@qook/shared';
import { api } from '../services/api';

type ArtFields = Pick<Recipe, 'heroImageUrl' | 'imageStatus' | 'blurhash' | 'localImageKey'>;

// weekPlan snapshots recipes before their save-gated image exists; this
// re-reads the recipe (shared ['recipe', id] cache with the detail modal)
// so vignettes upgrade from the letter fallback once art is ready.
export function useRecipeArt(recipe: (ArtFields & { id: string }) | undefined): ArtFields | undefined {
  const needsFresh = !!recipe && !recipe.heroImageUrl && !recipe.localImageKey;
  const { data } = useQuery({
    queryKey: ['recipe', recipe?.id],
    queryFn: () => api.getRecipeById(recipe!.id),
    enabled: needsFresh,
    staleTime: 5 * 60_000,
  });
  return data ?? recipe;
}
