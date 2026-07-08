import { useQuery } from '@tanstack/react-query';
import type { Recipe } from '@qook/shared';
import { api } from '../services/api';

type ArtFields = Pick<Recipe, 'heroImageUrl' | 'imageStatus' | 'blurhash' | 'localImageKey'>;

// weekPlan snapshots recipes before their save-gated image exists; this
// re-reads the recipe (shared ['recipe', id] cache with the detail modal)
// so vignettes upgrade from the letter fallback once art is ready.
// `poll` keeps re-reading every few seconds until the image lands — used on
// the review screen where art is generating while the user is looking.
export function useRecipeArt(
  recipe: (ArtFields & { id: string }) | undefined,
  opts?: { poll?: boolean },
): ArtFields | undefined {
  const needsFresh = !!recipe && !recipe.heroImageUrl && !recipe.localImageKey;
  const { data } = useQuery({
    queryKey: ['recipe', recipe?.id],
    queryFn: () => api.getRecipeById(recipe!.id),
    enabled: needsFresh,
    staleTime: 5 * 60_000,
    refetchInterval: opts?.poll
      ? (query) => (query.state.data?.heroImageUrl ? false : 2500)
      : undefined,
  });
  return data ?? recipe;
}
