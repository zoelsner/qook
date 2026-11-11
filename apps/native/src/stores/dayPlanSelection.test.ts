import { describe, expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';
import { activePickFor, selectDayRecipe, selectedDayServings } from './dayPlanSelection';
import { reconcileRecipeSnapshots } from './reconcileRecipeSnapshots';
import { aggregateIngredients, collectShopMeals } from '../features/shop/aggregateIngredients';

const TODAY = '2026-10-03';
const base = {
  id: 'dinner', title: 'Rice', servings: 2,
  ingredients: [{ title: 'Main', items: [{ item: 'rice', quantity: '2 cups' }] }],
} as Recipe;

describe('selected day portions', () => {
  test('Cook tonight portions reach stats and Shop while stored amounts remain original', () => {
    const day = selectDayRecipe(undefined, [base], 0, 3);
    expect(activePickFor(day)?.servings).toBe(3);
    expect(aggregateIngredients({ [TODAY]: day }, TODAY)[0].quantities).toEqual(['3 cups']);
    expect(collectShopMeals({ [TODAY]: day }, TODAY)[0].servings).toBe(3);
    expect(day.recipes?.[0].ingredients[0].items[0].quantity).toBe('2 cups');
  });

  test('cold restored portions survive a cache redirect and fresh recipe without compounding', () => {
    const day = JSON.parse(JSON.stringify(selectDayRecipe(undefined, [base], 0, 3)));
    const fresh = { ...base, id: 'cached', title: 'Fresh rice' };
    const state = reconcileRecipeSnapshots({ plan: { [TODAY]: day }, shopStaging: [] }, base.id, fresh);
    const again = selectDayRecipe(state.plan[TODAY], [fresh], 0);
    expect(again.servings).toBe(3);
    expect(aggregateIngredients({ [TODAY]: again }, TODAY)[0].quantities).toEqual(['3 cups']);
    expect(again.recipes?.[0]).toBe(fresh);
  });

  test('switching the pick resets its portions; reselecting the same pick preserves them', () => {
    const other = { ...base, id: 'other', servings: 4 };
    const day = selectDayRecipe(undefined, [base, other], 0, 3);
    expect(selectDayRecipe(day, [base, other], 0).servings).toBe(3);
    expect(selectDayRecipe(day, [base, other], 1).servings).toBeUndefined();
    expect(activePickFor(selectDayRecipe(day, [base, other], 1))?.servings).toBe(4);
  });

  test('each actual planned night keeps its own portions and repeated staged ids count once', () => {
    const plan = {
      [TODAY]: selectDayRecipe(undefined, [base], 0, 3),
      '2026-10-04': selectDayRecipe(undefined, [base], 0, 4),
    };
    const planned = aggregateIngredients(plan, TODAY)[0];
    expect(planned.quantities).toEqual(['3 cups', '4 cups']);
    expect(planned.recipeCount).toBe(2);
    expect(aggregateIngredients({}, TODAY, [base, base])[0].recipeCount).toBe(1);
  });
  test('returning to a prior dish shows the selected day portions instead of its old detail override', () => {
    const other = { ...base, id: 'other', servings: 4 };
    const first = selectDayRecipe(undefined, [base, other], 0, 3);
    const switched = selectDayRecipe(first, [base, other], 1);
    const returned = selectDayRecipe(switched, [base, other], 0);
    expect(selectedDayServings(returned, base.id)).toBe(2);
    expect(selectedDayServings(returned, other.id)).toBeUndefined();
    expect(activePickFor(returned)?.servings).toBe(2);
  });
});
