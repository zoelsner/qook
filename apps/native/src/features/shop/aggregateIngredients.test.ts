import { describe, expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';

import type { ISODate } from '../week/weekDates';
import { aggregateIngredients, collectShopMeals } from './aggregateIngredients';

const TODAY = '2026-07-10' as ISODate;

function recipe(id: string, title: string, item: string): Recipe {
  return {
    id,
    title,
    ingredients: [{ title: 'main', items: [{ item, quantity: '1 bunch' }] }],
  } as Recipe;
}

describe('aggregateIngredients staged recipes', () => {
  test('includes a recipe staged directly from Add all to list', () => {
    const staged = recipe('staged', 'Staged Curry', 'spinach');

    const items = aggregateIngredients({}, TODAY, [staged]);

    expect(items.length).toBe(1);
    expect({
      name: items[0].name,
      recipeCount: items[0].recipeCount,
      recipeTitles: items[0].recipeTitles,
    }).toEqual({
      name: 'spinach',
      recipeCount: 1,
      recipeTitles: ['Staged Curry'],
    });
  });

  test('does not double-count a staged recipe already selected in the plan', () => {
    const selected = recipe('same-id', 'Tonight Curry', 'spinach');
    const plan = {
      [TODAY]: { recipes: [selected], pickIndex: 0 },
    };

    const items = aggregateIngredients(plan, TODAY, [selected]);

    expect(items.length).toBe(1);
    expect(items[0].recipeCount).toBe(1);
    expect(items[0].quantities).toEqual(['1 bunch']);
  });
});

describe('collectShopMeals', () => {
  test('picks in date order, then staged extras, deduped by id', () => {
    const mon = recipe('a', 'Monday Stir-fry', 'broccoli');
    const tue = recipe('b', 'Tuesday Tacos', 'tortillas');
    const stagedNew = recipe('c', 'Staged Curry', 'spinach');
    const plan = {
      ['2026-07-12' as ISODate]: { recipes: [tue], pickIndex: 0 },
      ['2026-07-11' as ISODate]: { recipes: [mon], pickIndex: 0 },
      // Same dish planned twice — one pill.
      ['2026-07-13' as ISODate]: { recipes: [mon], pickIndex: 0 },
      // Past day — excluded.
      ['2026-07-01' as ISODate]: { recipes: [stagedNew], pickIndex: 0 },
    };

    const meals = collectShopMeals(plan, TODAY, [stagedNew, mon]);

    expect(meals.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('aggregateIngredients excludeIds (meal filter pills)', () => {
  test('excluded pick contributes nothing; re-including restores it', () => {
    const keep = recipe('keep', 'Keeper', 'broccoli');
    const skip = recipe('skip', 'Skipped', 'tortillas');
    const plan = {
      [TODAY]: { recipes: [keep], pickIndex: 0 },
      ['2026-07-11' as ISODate]: { recipes: [skip], pickIndex: 0 },
    };

    const filtered = aggregateIngredients(plan, TODAY, [], new Set(['skip']));
    expect(filtered.map((i) => i.name)).toEqual(['broccoli']);

    const restored = aggregateIngredients(plan, TODAY, [], new Set());
    expect(restored.map((i) => i.name).sort()).toEqual(['broccoli', 'tortillas']);
  });

  test('excluding a twice-planned dish drops both nights', () => {
    const dish = recipe('dup', 'Twice Planned', 'rice');
    const plan = {
      [TODAY]: { recipes: [dish], pickIndex: 0 },
      ['2026-07-11' as ISODate]: { recipes: [dish], pickIndex: 0 },
    };

    expect(aggregateIngredients(plan, TODAY, [], new Set(['dup']))).toEqual([]);
  });

  test('excluded staged recipe is dropped too', () => {
    const staged = recipe('staged', 'Staged Curry', 'spinach');

    expect(aggregateIngredients({}, TODAY, [staged], new Set(['staged']))).toEqual([]);
  });
});
