import { describe, expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';
import type { ISODate } from '../week/weekDates';
import { allocationWrites } from './allocation';

function r(id: string): Recipe {
  return { id, title: `Dish ${id}` } as Recipe;
}

describe('allocationWrites', () => {
  test('keeps only dated choices, drops skipped ones', () => {
    const writes = allocationWrites([
      { recipe: r('a'), date: '2026-07-11' as ISODate },
      { recipe: r('b'), date: null },
      { recipe: r('c'), date: '2026-07-12' as ISODate },
    ]);
    expect(writes.map((w) => [w.recipe.id, w.date])).toEqual([
      ['a', '2026-07-11'],
      ['c', '2026-07-12'],
    ]);
  });

  test('empty when nothing is dated', () => {
    expect(allocationWrites([{ recipe: r('a'), date: null }])).toEqual([]);
  });
});
