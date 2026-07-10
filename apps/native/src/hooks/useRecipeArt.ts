import { useQuery } from '@tanstack/react-query';
import type { Recipe } from '@qook/shared';
import { api } from '../services/api';
import { isRecipeArtMissing, shouldPollRecipeArt } from './recipeArtState';

type ArtFields = Pick<Recipe, 'heroImageUrl' | 'imageStatus' | 'blurhash' | 'localImageKey'>;

// weekPlan snapshots recipes before their save-gated image exists; this
// re-reads the recipe (shared ['recipe', id] cache with the detail modal)
// so vignettes upgrade from the letter fallback once art is ready.
// Missing art is always re-read on mount and, by default, every few seconds
// while the backend reports pending/generating. This lets persisted week-plan
// snapshots upgrade as soon as Supabase writes the generated image path.
export function useRecipeArt(
  recipe: (ArtFields & { id: string }) | undefined,
  opts?: { poll?: boolean },
): ArtFields | undefined {
  const needsFresh = isRecipeArtMissing(recipe);
  const poll = opts?.poll ?? true;
  const { data } = useQuery({
    queryKey: ['recipe', recipe?.id],
    queryFn: () => api.getRecipeById(recipe!.id),
    enabled: needsFresh,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: poll
      ? (query) =>
          shouldPollRecipeArt(query.state.data ?? recipe) ? 2500 : false
      : undefined,
  });
  return data ?? recipe;
}
