import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EnergyTier, Recipe } from '@qook/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { addDaysISO, todayISO, type ISODate } from '../features/week/weekDates';

const STAGING_TTL_DAYS = 7;

export interface DayPlan {
  energy?: EnergyTier;
  recipes?: Recipe[];
  pickIndex?: number;
  selectedAt?: string;
  cookedAt?: string;
}

export interface StagedShopRecipe {
  recipe: Recipe;
  stagedAt: ISODate;
}

interface WeekPlanState {
  plan: Record<ISODate, DayPlan>;
  savedRecipeIds: string[];
  shopStaging: StagedShopRecipe[];
  hasHydrated: boolean;

  setEnergy: (date: ISODate, tier: EnergyTier) => void;
  clearEnergy: (date: ISODate) => void;
  setRecipes: (date: ISODate, recipes: Recipe[]) => void;
  setPickIndex: (date: ISODate, idx: number) => void;
  swapPick: (date: ISODate) => void;
  commitSelection: (date: ISODate) => void;
  appendRecipeAndSelect: (date: ISODate, recipe: Recipe) => void;
  stageRecipeForShop: (recipe: Recipe) => void;
  toggleSavedRecipe: (id: string) => void;
  remapSavedRecipe: (oldId: string, newId: string) => void;
  clearDay: (date: ISODate) => void;
  clearFuture: () => void;
  clearAll: () => void;

  _setHydrated: () => void;
}

export const useWeekPlan = create<WeekPlanState>()(
  persist(
    (set, get) => ({
      plan: {},
      savedRecipeIds: [],
      shopStaging: [],
      hasHydrated: false,

      setEnergy: (date, energy) =>
        set((state) => ({
          plan: {
            ...state.plan,
            [date]: { ...state.plan[date], energy },
          },
        })),

      clearEnergy: (date) =>
        set((state) => {
          const nextDay = { ...(state.plan[date] ?? {}) };
          delete nextDay.energy;
          return {
            plan: {
              ...state.plan,
              [date]: nextDay,
            },
          };
        }),

      setRecipes: (date, recipes) =>
        set((state) => ({
          plan: {
            ...state.plan,
            [date]: { ...state.plan[date], recipes, pickIndex: 0 },
          },
        })),

      setPickIndex: (date, pickIndex) =>
        set((state) => ({
          plan: {
            ...state.plan,
            [date]: { ...state.plan[date], pickIndex },
          },
        })),

      swapPick: (date) => {
        const day = get().plan[date];
        if (!day?.recipes?.length) return;
        const next = ((day.pickIndex ?? 0) + 1) % day.recipes.length;
        set((state) => ({
          plan: {
            ...state.plan,
            [date]: { ...state.plan[date], pickIndex: next },
          },
        }));
      },

      commitSelection: (date) =>
        set((state) => ({
          plan: {
            ...state.plan,
            [date]: {
              ...state.plan[date],
              selectedAt: new Date().toISOString(),
            },
          },
        })),

      appendRecipeAndSelect: (date, recipe) => {
        const existing = get().plan[date];
        const selectedAt = new Date().toISOString();

        if (!existing?.recipes?.length) {
          set((state) => ({
            plan: {
              ...state.plan,
              [date]: {
                ...state.plan[date],
                recipes: [recipe],
                pickIndex: 0,
                selectedAt,
              },
            },
          }));
          return;
        }

        const existingIndex = existing.recipes.findIndex((item) => item.id === recipe.id);
        if (existingIndex >= 0) {
          // Same id re-appended: adopt the fresh object too, not just the
          // selection — a background phase-2 fill re-appends the same id with
          // real ingredients, and keeping the stale skeleton would leave Shop
          // aggregation empty for this day.
          set((state) => ({
            plan: {
              ...state.plan,
              [date]: {
                ...state.plan[date],
                recipes: state.plan[date]!.recipes!.map((item, i) =>
                  i === existingIndex ? recipe : item
                ),
                pickIndex: existingIndex,
                selectedAt,
              },
            },
          }));
          return;
        }

        const mergedRecipes = [...existing.recipes, recipe];
        set((state) => ({
          plan: {
            ...state.plan,
            [date]: {
              ...state.plan[date],
              recipes: mergedRecipes,
              pickIndex: mergedRecipes.length - 1,
              selectedAt,
            },
          },
        }));
      },

      stageRecipeForShop: (recipe) => {
        const today = todayISO();
        const cutoff = addDaysISO(today, -STAGING_TTL_DAYS);
        set((state) => ({
          shopStaging: [
            ...state.shopStaging.filter(
              (staged) => staged.stagedAt >= cutoff && staged.recipe.id !== recipe.id,
            ),
            { recipe, stagedAt: today },
          ],
        }));
      },

      toggleSavedRecipe: (id) =>
        set((state) => ({
          savedRecipeIds: state.savedRecipeIds.includes(id)
            ? state.savedRecipeIds.filter((x) => x !== id)
            : [...state.savedRecipeIds, id],
        })),

      // A phase-2 fill can cache-hit the signature dedup and hand back a
      // different recipe id than the skeleton the user saved. Follow the swap
      // so the heart doesn't point at a dead id.
      remapSavedRecipe: (oldId, newId) =>
        set((state) => {
          if (oldId === newId || !state.savedRecipeIds.includes(oldId)) return state;
          return {
            savedRecipeIds: [
              ...state.savedRecipeIds.filter((x) => x !== oldId && x !== newId),
              newId,
            ],
          };
        }),

      clearDay: (date) =>
        set((state) => {
          const next = { ...state.plan };
          delete next[date];
          return { plan: next };
        }),

      clearFuture: () => {
        const today = todayISO();
        set((state) => {
          const next: Record<ISODate, DayPlan> = {};
          for (const [date, day] of Object.entries(state.plan)) {
            if (date <= today) next[date] = day;
          }
          return { plan: next };
        });
      },

      clearAll: () => set({ plan: {}, shopStaging: [], savedRecipeIds: [] }),

      _setHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: 'qook.weekPlan.v1',
      storage: createJSONStorage(() => AsyncStorage),
      // v3 (2026-07-06): added savedRecipeIds. Bumping discards v2 caches so
      // rehydration starts with an empty saved list rather than an undefined
      // field. Safe to bump any time the persisted shape changes.
      version: 3,
      partialize: (state) => ({
        plan: state.plan,
        savedRecipeIds: state.savedRecipeIds,
        shopStaging: state.shopStaging,
      }),
      merge: (persistedState, currentState) => {
        const persistedPlan = (persistedState as Partial<WeekPlanState> | undefined)?.plan ?? {};
        const mergedPlan: Record<ISODate, DayPlan> = { ...persistedPlan };

        for (const [date, day] of Object.entries(currentState.plan)) {
          mergedPlan[date] = { ...mergedPlan[date], ...day };
        }

        const persistedSaved =
          (persistedState as Partial<WeekPlanState> | undefined)?.savedRecipeIds ?? [];

        const persistedStaging =
          (persistedState as Partial<WeekPlanState> | undefined)?.shopStaging ?? [];

        return {
          ...currentState,
          ...(persistedState as object),
          plan: mergedPlan,
          savedRecipeIds: persistedSaved,
          shopStaging: persistedStaging,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
      },
    },
  ),
);

export function taggedFutureOrTodayDays(
  plan: Record<ISODate, DayPlan>,
  todayIso: ISODate,
): ISODate[] {
  return Object.keys(plan)
    .filter((date) => date >= todayIso && plan[date]?.energy != null)
    .sort();
}

export function recentSelectedDays(
  plan: Record<ISODate, DayPlan>,
  todayIso: ISODate,
  limit: number,
): ISODate[] {
  return Object.keys(plan)
    .filter((date) => date < todayIso && plan[date]?.selectedAt != null && plan[date]?.recipes?.length)
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, limit);
}

export function activePickFor(day: DayPlan | undefined): Recipe | null {
  if (!day?.recipes?.length) return null;
  return day.recipes[day.pickIndex ?? 0] ?? null;
}

export function activeStagedRecipes(
  staging: StagedShopRecipe[],
  todayIso: ISODate,
): Recipe[] {
  const cutoff = addDaysISO(todayIso, -STAGING_TTL_DAYS);
  return staging.filter((item) => item.stagedAt >= cutoff).map((item) => item.recipe);
}
