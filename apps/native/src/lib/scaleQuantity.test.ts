import { describe, expect, test } from 'bun:test';
import type { Ingredient } from '@qook/shared';
import { scaledIngredientQuantity, scaleQuantityString } from './scaleQuantity';

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
