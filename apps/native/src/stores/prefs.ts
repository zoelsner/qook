import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EnergyTier } from '@qook/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type UnitSystem = 'us' | 'metric';
export type PlanningStartDay = 'sunday' | 'monday';

/**
 * User preferences that shape recipe generation and UX defaults.
 * Lives in a separate store from weekPlan so prefs survive `clearAll()`
 * on the plan.
 */
export interface PrefsState {
  // ---- Taste / Preferences ----
  cuisineGroups: string[]; // top-level cuisine groups user wants to see
  proteins: string[]; // preferred proteins
  avoidList: string[]; // free-form strings (allergens, dislikes)

  // ---- Household ----
  servings: number; // 1..6
  unitSystem: UnitSystem;
  partnerName: string | null;

  // ---- Generation defaults ----
  defaultTier: EnergyTier | null; // null means "ask every time"
  planningStartDay: PlanningStartDay;

  hasHydrated: boolean;

  toggleCuisineGroup: (group: string) => void;
  toggleProtein: (protein: string) => void;
  addAvoid: (term: string) => void;
  removeAvoid: (term: string) => void;
  setServings: (n: number) => void;
  setUnitSystem: (u: UnitSystem) => void;
  setPartnerName: (name: string | null) => void;
  setDefaultTier: (tier: EnergyTier | null) => void;
  setPlanningStartDay: (day: PlanningStartDay) => void;
  resetPrefs: () => void;

  _setHydrated: () => void;
}

const DEFAULT_STATE = {
  cuisineGroups: [] as string[],
  proteins: [] as string[],
  avoidList: [] as string[],
  servings: 2,
  unitSystem: 'us' as UnitSystem,
  partnerName: null as string | null,
  defaultTier: null as EnergyTier | null,
  planningStartDay: 'sunday' as PlanningStartDay,
};

const toggle = (list: string[], value: string): string[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export const usePrefs = create<PrefsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,
      hasHydrated: false,

      toggleCuisineGroup: (group) =>
        set({ cuisineGroups: toggle(get().cuisineGroups, group) }),

      toggleProtein: (protein) =>
        set({ proteins: toggle(get().proteins, protein) }),

      addAvoid: (term) => {
        const trimmed = term.trim();
        if (!trimmed) return;
        if (get().avoidList.includes(trimmed)) return;
        set({ avoidList: [...get().avoidList, trimmed] });
      },

      removeAvoid: (term) =>
        set({ avoidList: get().avoidList.filter((t) => t !== term) }),

      setServings: (n) => {
        const clamped = Math.max(1, Math.min(6, Math.round(n)));
        set({ servings: clamped });
      },

      setUnitSystem: (u) => set({ unitSystem: u }),

      setPartnerName: (name) => {
        const trimmed = name?.trim() ?? '';
        set({ partnerName: trimmed ? trimmed : null });
      },

      setDefaultTier: (tier) => set({ defaultTier: tier }),

      setPlanningStartDay: (day) => set({ planningStartDay: day }),

      resetPrefs: () => set({ ...DEFAULT_STATE }),

      _setHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: 'qook.prefs.v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({
        cuisineGroups: state.cuisineGroups,
        proteins: state.proteins,
        avoidList: state.avoidList,
        servings: state.servings,
        unitSystem: state.unitSystem,
        partnerName: state.partnerName,
        defaultTier: state.defaultTier,
        planningStartDay: state.planningStartDay,
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
      },
    },
  ),
);

// The CUISINE_TO_TOP_LEVEL_GROUP map in @qook/shared lists ~30 cuisines under
// 5 groups. For the settings UX we expose the groups as the unit of choice —
// users say "Asian food" more naturally than "Thai, Vietnamese, Korean, …".
export const CUISINE_GROUPS: readonly string[] = [
  'American & Regional',
  'Latin & Mexican',
  'European',
  'Asian',
  'Mediterranean & Middle Eastern',
] as const;

export const PROTEIN_OPTIONS: readonly string[] = [
  'Chicken',
  'Beef',
  'Pork',
  'Turkey',
  'Lamb',
  'Fish',
  'Shrimp',
  'Tofu',
  'Paneer',
  'Eggs',
  'Beans',
] as const;
