import { beforeAll, describe, expect, mock, test } from 'bun:test';

import { aggregateIngredients } from '../features/shop/aggregateIngredients';
import { todayISO, addDaysISO } from '../features/week/weekDates';
import { mockRecipes } from '../services/fixtures/recipes';

// Real weekPlan store + real subscription; only AsyncStorage is in-memory.
const disk = new Map<string, string>();
mock.module('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => disk.get(k) ?? null,
    setItem: async (k: string, v: string) => void disk.set(k, v),
    removeItem: async (k: string) => void disk.delete(k),
  },
}));

const [recipeA, recipeB] = mockRecipes;
const today = todayISO();
const tomorrow = addDaysISO(today, 1);
const keysOf = (recipes: typeof mockRecipes, date = today) =>
  aggregateIngredients(
    { [date]: { recipes, pickIndex: 0 } },
    today,
  ).map((i) => i.key);
const keyA = keysOf([recipeA])[0];

// Persisted cold-start state, written before the store module is first imported.
disk.set(
  'qook.weekPlan.v1',
  JSON.stringify({
    state: {
      plan: { [today]: { recipes: [recipeA], pickIndex: 0 } },
      savedRecipeIds: [],
      shopStaging: [],
      shopChecked: { [keyA]: true },
    },
    version: 3,
  }),
);

let useWeekPlan: typeof import('./weekPlan').useWeekPlan;
beforeAll(async () => {
  ({ useWeekPlan } = await import('./weekPlan'));
  for (let i = 0; i < 50 && !useWeekPlan.getState().hasHydrated; i++) await new Promise((r) => setTimeout(r, 5));
});

describe('weekPlan store reconciles Shop checks', () => {
  test('cold start: persisted check survives rehydration', () => {
    const s = useWeekPlan.getState();
    expect(s.hasHydrated).toBe(true);
    expect(s.plan[today]?.recipes?.[0]?.id).toBe(recipeA.id);
    expect(s.shopChecked[keyA]).toBe(true);
  });

  test('check does not come back after the recipe leaves the plan and returns', () => {
    const { appendRecipeAndSelect, clearDay } = useWeekPlan.getState();
    expect(useWeekPlan.getState().shopChecked[keyA]).toBe(true);
    clearDay(today);
    appendRecipeAndSelect(today, recipeA);
    const s = useWeekPlan.getState();
    expect(s.shopChecked[keyA]).toBeUndefined();
    expect(s.plan[today]?.recipes?.[0]?.id).toBe(recipeA.id);
  });

  test('check stays when an unrelated change keeps the ingredient listed', () => {
    const { appendRecipeAndSelect, toggleShopChecked } = useWeekPlan.getState();
    toggleShopChecked(keyA);
    expect(useWeekPlan.getState().shopChecked[keyA]).toBe(true);
    appendRecipeAndSelect(tomorrow, recipeB);
    const s = useWeekPlan.getState();
    expect(s.shopChecked[keyA]).toBe(true);
    expect(s.plan[today]?.recipes?.[0]?.id).toBe(recipeA.id);
    expect(s.plan[tomorrow]?.recipes?.[0]?.id).toBe(recipeB.id);
  });
});
