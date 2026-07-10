import { describe, expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';

import type { ISODate } from '../week/weekDates';
import { aggregateIngredients } from './aggregateIngredients';

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
