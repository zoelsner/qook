import type { Recipe } from '@qook/shared';

export type CompletionState = { status: 'idle' | 'pending' | 'error' | 'ready'; message?: string; recipe?: Recipe };
export const IDLE_COMPLETION: CompletionState = { status: 'idle' };

// Requests outlive a modal. Keep/bench/detail share one request per proposal,
// and an explicit retry starts only after its previous request has settled.
export function createCompletionCoordinator(deps: {
  fill: (recipe: Recipe) => Promise<{ recipeId: string }>;
  fetch: (id: string) => Promise<Recipe | null>;
  adopt: (oldId: string, recipe: Recipe) => void;
}) {
  const states = new Map<string, CompletionState>();
  const pending = new Map<string, Promise<Recipe>>();
  const listeners = new Set<() => void>();
  const set = (id: string, state: CompletionState) => { states.set(id, state); listeners.forEach(fn => fn()); };
  return {
    get: (id: string) => states.get(id) ?? IDLE_COMPLETION,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    complete(recipe: Recipe): Promise<Recipe> {
      const inflight = pending.get(recipe.id);
      if (inflight) return inflight;
      if (recipe.contentStatus !== 'proposal') return Promise.resolve(recipe);
      set(recipe.id, { status: 'pending' });
      const task = Promise.resolve().then(async () => {
        try {
          const result = await deps.fill(recipe);
          const full = await deps.fetch(result.recipeId);
          if (!full || full.contentStatus === 'proposal') throw new Error('The recipe is still unfinished. Try again.');
          const retained = { ...full, generationSessionId: recipe.generationSessionId ?? full.generationSessionId };
          deps.adopt(recipe.id, retained);
          set(recipe.id, { status: 'ready', recipe: retained });
          return retained;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Couldn’t finish this recipe. Try again.';
          set(recipe.id, { status: 'error', message });
          throw error;
        } finally { pending.delete(recipe.id); }
      });
      pending.set(recipe.id, task);
      return task;
    },
  };
}
