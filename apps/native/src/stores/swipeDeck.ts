import { create } from 'zustand';
import type { Recipe } from '@qook/shared';

interface SwipeDeckState {
  recipes: Recipe[];
  index: number;
  likedIds: string[];
  passedIds: string[];

  load: (recipes: Recipe[]) => void;
  like: () => void;
  pass: () => void;
  reset: () => void;
}

export const useSwipeDeck = create<SwipeDeckState>((set, get) => ({
  recipes: [],
  index: 0,
  likedIds: [],
  passedIds: [],

  load: (recipes) => {
    const { recipes: existing } = get();
    if (existing.length === recipes.length) {
      const sameIds = existing.every((r, i) => r.id === recipes[i]?.id);
      if (sameIds) return;
    }
    set({ recipes, index: 0, likedIds: [], passedIds: [] });
  },

  like: () => {
    const { recipes, index, likedIds } = get();
    const current = recipes[index];
    if (!current) return;
    set({
      index: index + 1,
      likedIds: [...likedIds, current.id],
    });
  },

  pass: () => {
    const { recipes, index, passedIds } = get();
    const current = recipes[index];
    if (!current) return;
    set({
      index: index + 1,
      passedIds: [...passedIds, current.id],
    });
  },

  reset: () => {
    set({ index: 0, likedIds: [], passedIds: [] });
  },
}));

export function selectCurrent(state: SwipeDeckState): Recipe | null {
  return state.recipes[state.index] ?? null;
}

export function selectNext(state: SwipeDeckState): Recipe | null {
  return state.recipes[state.index + 1] ?? null;
}

export function selectRemaining(state: SwipeDeckState): number {
  return Math.max(0, state.recipes.length - state.index);
}
