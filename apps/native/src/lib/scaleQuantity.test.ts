import { describe, expect, test } from 'bun:test';
import type { Ingredient, Recipe } from '@qook/shared';
import { formatAmount, scaledIngredientQuantity, scaleQuantityString, recipeForServings } from './scaleQuantity';

describe('readable precise scaled amounts', () => {
  test('uses exact kitchen eighths and round-trips their quantities', () => {
    expect(scaleQuantityString('¾ cup', 1.5)).toBe('1⅛ cup');
    expect(scaleQuantityString('1⅛ cup', 2)).toBe('2¼ cup');
    expect(scaleQuantityString('⅜ tsp', 2)).toBe('¾ tsp');
    expect(scaleQuantityString('⅝ cup', 2)).toBe('1¼ cup');
    expect(scaleQuantityString('⅞ cup', 2)).toBe('1¾ cup');
  });
  test('keeps arbitrary nearby amounts and small positive amounts accurate', () => {
    expect(formatAmount(0.2)).toBe('0.2');
    expect(formatAmount(0.3)).toBe('0.3');
    expect(formatAmount(0.04)).toBe('0.04');
    expect(formatAmount(1.02)).toBe('1.02');
    expect(formatAmount(0.33)).toBe('⅓');
    expect(formatAmount(2 / 3)).toBe('⅔');
  });
});

describe('scaleQuantityString', () => {
  test('scales a plain count quantity, keeping the unit word', () => {
    expect(scaleQuantityString('2 cloves', 1.5)).toBe('3 cloves');
  });

  test('scales an ounce quantity', () => {
    expect(scaleQuantityString('12 oz', 1.5)).toBe('18 oz');
  });

  test('passes through non-numeric quantities unchanged', () => {
    expect(scaleQuantityString('to taste', 1.5)).toBe('to taste');
  });

  test('scales an explicit total weight with the count (live native regression)', () => {
    expect(scaleQuantityString('2 (about 336 g total)', 1.5)).toBe('3 (about 504 g total)');
    expect(scaleQuantityString('2 (approximately 12 oz total)', 0.5)).toBe('1 (approximately 6 oz total)');
    expect(scaleQuantityString('2 (6-ounce) fillets', 1.5)).toBe('3 (6-ounce) fillets');
    expect(scaleQuantityString('2 (about 168 g each)', 1.5)).toBe('3 (about 168 g each)');
  });
});

describe('recipeForServings', () => {
  test('scales display and parsed quantities without changing units or source', () => {
    const ingredients = [{ title: 'Main', role: 'main', items: [
      { item: 'salmon', quantity: '10 oz', parsed: { canonicalKey: 'salmon', name: 'salmon', category: 'Protein', quantityAmount: 10, quantityUnit: 'oz' } },
      { item: 'rice', quantity: '1 cup' },
      { item: 'garlic', quantity: '2 cloves', parsed: { canonicalKey: 'garlic', name: 'garlic', category: 'Produce', quantityAmount: 2, quantityUnit: 'count' } },
      { item: 'salt', quantity: 'to taste' },
    ] }] as Recipe['ingredients'];
    const base = { servings: 2, ingredients } as Recipe;
    const scaled = recipeForServings(base, 3);
    expect(scaled.servings).toBe(3);
    expect(scaled.ingredients[0].items.map((i) => i.quantity)).toEqual(['15 oz', '1½ cup', '3 cloves', 'to taste']);
    expect(scaled.ingredients[0].items[0].parsed?.quantityAmount).toBe(15);
    expect(scaled.ingredients[0].items[0].parsed?.quantityUnit).toBe('oz');
    expect(scaled.ingredients[0].items[2].parsed?.quantityAmount).toBe(3);
    expect(base.ingredients).toBe(ingredients);
    expect(base.ingredients[0].items[0].parsed?.quantityAmount).toBe(10);
    expect(recipeForServings(base, 2)).toBe(base);
  });

  test('scales fractions and keeps package descriptions', () => {
    expect(scaleQuantityString('1 1/2 cups', 2)).toBe('3 cups');
    expect(scaleQuantityString('½ tsp', 2)).toBe('1 tsp');
    expect(scaleQuantityString('1½ cups', 2)).toBe('3 cups');
    expect(scaleQuantityString('2 (6-ounce) fillets', 1.5)).toBe('3 (6-ounce) fillets');
  });

  test('invalid serving counts keep the original recipe', () => {
    const base = { servings: 2, ingredients: [] } as unknown as Recipe;
    expect(recipeForServings(base, 0)).toBe(base);
    expect(recipeForServings(base, NaN)).toBe(base);
    expect(recipeForServings({ ...base, servings: 0 }, 3).servings).toBe(0);
  });
});

describe('scaledIngredientQuantity', () => {
  test('count-unit structured parse keeps the display words at factor 1.5 (regression)', () => {
    const ing: Ingredient = {
      item: 'garlic, minced',
      quantity: '2 cloves',
      parsed: {
        canonicalKey: 'garlic',
        name: 'garlic',
        quantityAmount: 2,
        quantityUnit: 'count',
        category: 'Produce',
      },
    };
    expect(scaledIngredientQuantity(ing, 1.5)).toBe('3 cloves');
  });

  test('non-count structured parse still scales via oz', () => {
    const ing: Ingredient = {
      item: 'chicken breast',
      quantity: '12 oz',
      parsed: {
        canonicalKey: 'chicken-breast',
        name: 'chicken breast',
        quantityAmount: 12,
        quantityUnit: 'oz',
        category: 'Protein',
      },
    };
    expect(scaledIngredientQuantity(ing, 1.5)).toBe('18 oz');
  });

  test('to taste passes through regardless of factor', () => {
    const ing: Ingredient = { item: 'salt', quantity: 'to taste' };
    expect(scaledIngredientQuantity(ing, 1.5)).toBe('to taste');
  });

  test('factor 1 returns the original quantity verbatim', () => {
    const ing: Ingredient = { item: 'garlic, minced', quantity: '2 cloves' };
    expect(scaledIngredientQuantity(ing, 1)).toBe('2 cloves');
  });
});
