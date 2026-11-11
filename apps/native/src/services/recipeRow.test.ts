import { describe, expect, test } from 'bun:test';
import { dbRowToRecipe } from './recipeRow';
import type { DishContract } from '@qook/shared';

const dish: DishContract = {
  version: 1,
  components: [{ ingredientNames: ['gnocchi'], form: 'pan-fried gnocchi', appearance: 'golden crisp edges' }],
  plating: 'Gnocchi loosely piled with the browned edges visible.',
};
const row = { id: 'abc', title: 'Pan-Fried Gnocchi', cuisine: 'Italian', energy_tier: 'after-work',
  serves: 2, total_time_min: 25, ingredient_groups: [], workflow_sections: [],
  image_status: 'ready', image_storage_path: 'abc.png', image_updated_at: '2026-10-25T12:00:00Z',
  created_at: '2026-10-25T12:00:00Z', updated_at: '2026-10-25T12:00:00Z' };

describe('public dish metadata in recipe rows', () => {
  test('retains the accepted contract and existing art identity in a saved recipe snapshot', () => {
    const recipe = dbRowToRecipe({ ...row, dish_contract: dish }, 'https://cdn.test/meals');
    expect(recipe.dishContract).toEqual(dish);
    expect(JSON.parse(JSON.stringify(recipe)).dishContract).toEqual(dish);
    expect(recipe.heroImageUrl).toBe('https://cdn.test/meals/abc.png?v=1792929600000');
  });

  test('legacy and malformed metadata does not break otherwise readable recipes', () => {
    for (const value of [undefined, null, [], {}, { ...dish, version: 2 },
      { ...dish, components: [] }, { ...dish, plating: ' ' },
      { ...dish, context: 'private data does not belong here' },
      { ...dish, components: [{ ...dish.components[0], form: 'x'.repeat(121) }] },
      { ...dish, components: [{ ...dish.components[0], ingredientNames: ['x'.repeat(121)] }] }]) {
      const recipe = dbRowToRecipe({ ...row, dish_contract: value }, 'https://cdn.test/meals');
      expect(recipe.dishContract).toBeUndefined();
      expect(recipe.title).toBe(row.title);
    }
  });

  test('uses the same trimmed contract representation as the edge schema', () => {
    const recipe = dbRowToRecipe({ ...row, dish_contract: {
      ...dish, plating: ` ${dish.plating} `,
      components: [{ ingredientNames: [' gnocchi '], form: ' pan-fried gnocchi ', appearance: ' golden crisp edges ' }],
    } }, 'https://cdn.test/meals');
    expect(recipe.dishContract).toEqual(dish);
  });
});
