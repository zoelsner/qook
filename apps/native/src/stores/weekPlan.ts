import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EnergyTier, Recipe } from '@qook/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { todayISO, type ISODate } from '../features/week/weekDates';

export interface DayPlan {
  energy?: EnergyTier;
  recipes?: Recipe[];
  pickIndex?: number;
  selectedAt?: string;
  cookedAt?: string;
}

interface WeekPlanState {
  plan: Record<ISODate, DayPlan>;
  savedRecipeIds: string[];
  hasHydrated: boolean;

  setEnergy: (date: ISODate, tier: EnergyTier) => void;
  clearEnergy: (date: ISODate) => void;
  setRecipes: (date: ISODate, recipes: Recipe[]) => void;
  setPickIndex: (date: ISODate, idx: number) => void;
  swapPick: (date: ISODate) => void;
  commitSelection: (date: ISODate) => void;
  appendRecipeAndSelect: (date: ISODate, recipe: Recipe) => void;
  toggleSavedRecipe: (id: string) => void;
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
          set((state) => ({
            plan: {
              ...state.plan,
              [date]: {
                ...state.plan[date],
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

      toggleSavedRecipe: (id) =>
        set((state) => ({
          savedRecipeIds: state.savedRecipeIds.includes(id)
            ? state.savedRecipeIds.filter((x) => x !== id)
            : [...state.savedRecipeIds, id],
        })),

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

      clearAll: () => set({ plan: {} }),

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
      }),
      merge: (persistedState, currentState) => {
        const persistedPlan = (persistedState as Partial<WeekPlanState> | undefined)?.plan ?? {};
        const mergedPlan: Record<ISODate, DayPlan> = { ...persistedPlan };

        for (const [date, day] of Object.entries(currentState.plan)) {
          mergedPlan[date] = { ...mergedPlan[date], ...day };
        }

        const persistedSaved =
          (persistedState as Partial<WeekPlanState> | undefined)?.savedRecipeIds ?? [];

        return {
          ...currentState,
          ...(persistedState as object),
          plan: mergedPlan,
          savedRecipeIds: persistedSaved,
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
