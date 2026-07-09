import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Per-recipe cooking state that must survive closing the modal mid-cook:
 * the mise-en-place checklist and the serving override (Zach 2026-07-08:
 * "I closed out and now none of the items are selected").
 * Separate from weekPlan so plan resets never wipe an in-flight cook.
 */
interface RecipeCookState {
  checked: Record<string, boolean>;
  servings?: number;
}

export interface CookSessionState {
  byRecipe: Record<string, RecipeCookState>;
  toggleChecked: (recipeId: string, rowId: string) => void;
  setServings: (recipeId: string, servings: number) => void;
  resetRecipe: (recipeId: string) => void;
}

export const useCookSession = create<CookSessionState>()(
  persist(
    (set) => ({
      byRecipe: {},
      toggleChecked: (recipeId, rowId) =>
        set((s) => {
          const cur = s.byRecipe[recipeId] ?? { checked: {} };
          return {
            byRecipe: {
              ...s.byRecipe,
              [recipeId]: {
                ...cur,
                checked: { ...cur.checked, [rowId]: !cur.checked[rowId] },
              },
            },
          };
        }),
      setServings: (recipeId, servings) =>
        set((s) => {
          const cur = s.byRecipe[recipeId] ?? { checked: {} };
          return {
            byRecipe: { ...s.byRecipe, [recipeId]: { ...cur, servings } },
          };
        }),
      resetRecipe: (recipeId) =>
        set((s) => {
          const next = { ...s.byRecipe };
          delete next[recipeId];
          return { byRecipe: next };
        }),
    }),
    {
      name: 'qook-cook-session',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
