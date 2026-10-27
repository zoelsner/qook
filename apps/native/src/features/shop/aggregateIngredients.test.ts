import { describe, expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';

import type { ISODate } from '../week/weekDates';
import { aggregateIngredients, collectShopMeals, formatQuantity } from './aggregateIngredients';
import { recipeForServings } from '../../lib/scaleQuantity';

const TODAY = '2026-07-10' as ISODate;

describe('serving selection shopping handoff', () => {
  test('planned recipe uses staged servings without double-counting', () => {
    const base = { ...parsedRecipe('salmon', 'salmon', '10 oz', 10, 'oz'), servings: 2 };
    const staged = recipeForServings(base, 3);
    const plan = { [TODAY]: { recipes: [base], pickIndex: 0 } };
    const items = aggregateIngredients(plan, TODAY, [staged]);
    expect(formatQuantity(items[0])).toBe('15 oz');
    expect(items[0].recipeCount).toBe(1);
    expect(collectShopMeals(plan, TODAY, [staged])[0].servings).toBe(3);
    expect(base.ingredients[0].items[0].quantity).toBe('10 oz');
  });

  test('selected amounts sum with other recipes using matching units', () => {
    const base = { ...parsedRecipe('salmon', 'salmon', '10 oz', 10, 'oz'), servings: 2 };
    const other = parsedRecipe('other', 'salmon', '8 oz', 8, 'oz');
    expect(formatQuantity(aggregateIngredients({}, TODAY, [recipeForServings(base, 3), other])[0])).toBe('23 oz');
  });

  test('each planned night uses the override and exclusion drops all occurrences', () => {
    const base = { ...parsedRecipe('rice', 'rice', '1 cup', 1, 'cup'), servings: 2 };
    const staged = [recipeForServings(base, 3)];
    const plan = {
      [TODAY]: { recipes: [base], pickIndex: 0 },
      ['2026-07-11' as ISODate]: { recipes: [base], pickIndex: 0 },
    };
    expect(formatQuantity(aggregateIngredients(plan, TODAY, staged)[0])).toBe('3 cup');
    expect(aggregateIngredients(plan, TODAY, staged, new Set(['rice']))).toEqual([]);
  });

  test('replacement servings scale from the original recipe', () => {
    const base = { ...parsedRecipe('salmon', 'salmon', '10 oz', 10, 'oz'), servings: 2 };
    expect(formatQuantity(aggregateIngredients({}, TODAY, [recipeForServings(base, 4)])[0])).toBe('20 oz');
    expect(formatQuantity(aggregateIngredients({}, TODAY, [recipeForServings(base, 2)])[0])).toBe('10 oz');
  });
});

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

  test('falls back to the raw item when parsed name/key arrive blank', () => {
    const salmon = {
      id: 'salmon',
      title: 'Miso Salmon',
      ingredients: [
        {
          title: 'main',
          items: [
            {
              item: 'salmon fillets',
              quantity: '2 (6-ounce) fillets',
              parsed: {
                canonicalKey: '  ',
                name: '',
                category: 'Protein',
              },
            },
          ],
        },
      ],
    } as unknown as Recipe;

    const items = aggregateIngredients({}, TODAY, [salmon]);

    expect(items.length).toBe(1);
    expect(items[0].name).toBe('salmon fillets');
    expect(items[0].key).toBe('salmon fillets');
    expect(items[0].category).toBe('Protein');
  });
});

function parsedRecipe(
  id: string,
  item: string,
  quantity: string,
  amount: number | null,
  unit: string | null,
): Recipe {
  return {
    id,
    title: `Recipe ${id}`,
    ingredients: [
      {
        title: 'main',
        items: [
          {
            item,
            quantity,
            parsed: {
              canonicalKey: item,
              name: item,
              category: 'Other',
              quantityAmount: amount ?? undefined,
              quantityUnit: unit ?? undefined,
            },
          },
        ],
      },
    ],
  } as unknown as Recipe;
}

describe('quantity summing across recipes', () => {
  test('sums exact eighths readably without snapping unrelated decimals', () => {
    const sum = (a: number, b: number) => formatQuantity(aggregateIngredients({}, TODAY, [
      parsedRecipe('a', 'orzo', `${a} cup`, a, 'cup'),
      parsedRecipe('b', 'orzo', `${b} cup`, b, 'cup'),
    ])[0]);
    expect(sum(0.75, 0.375)).toBe('1 1/8 cup');
    expect(sum(0.1, 0.1)).toBe('0.2 cup');
    expect(sum(0.01, 0.01)).toBe('0.02 cup');
  });
  test('sums matching units: 12 oz + 8 oz → 20 oz', () => {
    const a = parsedRecipe('a', 'ground turkey', '12 oz', 12, 'oz');
    const b = parsedRecipe('b', 'ground turkey', '8 oz', 8, 'oz');

    const items = aggregateIngredients({}, TODAY, [a, b]);

    expect(formatQuantity(items[0])).toBe('20 oz');
  });

  test('treats bare amounts and explicit counts alike: 4 count + 2 → 6', () => {
    const a = parsedRecipe('a', 'garlic', '4 count', 4, 'count');
    const b = parsedRecipe('b', 'garlic', '2', 2, null);

    const items = aggregateIngredients({}, TODAY, [a, b]);

    expect(formatQuantity(items[0])).toBe('6');
  });

  test('mixed units stay joined, never converted', () => {
    const a = parsedRecipe('a', 'black beans', '1 (15 oz) can', 1, 'count');
    const b = parsedRecipe('b', 'black beans', '1 cup', 1, 'cup');

    const items = aggregateIngredients({}, TODAY, [a, b]);

    expect(formatQuantity(items[0])).toBe('1 (15 oz) can + 1 cup');
  });

  test('a missing parsed amount disables summing for that item', () => {
    const a = parsedRecipe('a', 'cilantro', '1/4 cup', 0.25, 'cup');
    const b = recipe('b', 'Recipe b', 'cilantro'); // no parsed data

    const items = aggregateIngredients({}, TODAY, [a, b]);

    expect(formatQuantity(items[0])).toBe('1/4 cup + 1 bunch');
  });

  test('fractions render kitchen-style: 1/2 + 1/4 cup → 3/4 cup', () => {
    const a = parsedRecipe('a', 'sour cream', '1/2 cup', 0.5, 'cup');
    const b = parsedRecipe('b', 'sour cream', '1/4 cup', 0.25, 'cup');

    const items = aggregateIngredients({}, TODAY, [a, b]);

    expect(formatQuantity(items[0])).toBe('3/4 cup');
  });

  test('a dish planned two nights doubles its ingredients: 1 lb ×2 → 2 lb', () => {
    const dish = parsedRecipe('dish', 'ground beef', '1 lb', 1, 'lb');
    const plan = {
      ['2026-07-11' as ISODate]: { recipes: [dish], pickIndex: 0 },
      ['2026-07-12' as ISODate]: { recipes: [dish], pickIndex: 0 },
    };

    const items = aggregateIngredients(plan, TODAY);

    expect(formatQuantity(items[0])).toBe('2 lb');
  });

  test('single occurrence keeps its raw descriptive string', () => {
    const a = parsedRecipe('a', 'canned tuna', '2 cans (5 oz each), drained', 2, 'count');

    const items = aggregateIngredients({}, TODAY, [a]);

    expect(formatQuantity(items[0])).toBe('2 cans (5 oz each), drained');
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
