import { describe, expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';
import type { ISODate } from '../week/weekDates';
import { allocationWrites, tierMismatch, allocateKeeps } from './allocation';

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

describe('tierMismatch', () => {
  test('a 45-min card on a 15-min night is a mismatch', () => {
    expect(tierMismatch(45, 'brain-is-fried')).toBe(true);
  });
  test('a 15-min card on a 45-min night is fine', () => {
    expect(tierMismatch(15, 'got-energy')).toBe(false);
  });
  test('a card exactly at the ceiling is fine', () => {
    expect(tierMismatch(30, 'after-work')).toBe(false);
  });
});

function rr(id: string): Recipe {
  return { id, title: `Dish ${id}` } as Recipe;
}

describe('allocateKeeps', () => {
  test('over-keep: extras with no night go to the bench', () => {
    const choices = [
      { recipe: rr('a'), date: '2026-07-13' as ISODate },
      { recipe: rr('b'), date: null },
      { recipe: rr('c'), date: null },
    ];
    const out = allocateKeeps(choices, ['2026-07-13' as ISODate]);
    expect(out.placed.map((w) => w.recipe.id)).toEqual(['a']);
    expect(out.benched.map((r) => r.id)).toEqual(['b', 'c']);
    expect(out.emptyNights).toEqual([]);
  });

  test('under-keep: unfilled nights are reported, none benched', () => {
    const choices = [{ recipe: rr('a'), date: '2026-07-13' as ISODate }];
    const out = allocateKeeps(choices, ['2026-07-13' as ISODate, '2026-07-14' as ISODate]);
    expect(out.placed.map((w) => w.recipe.id)).toEqual(['a']);
    expect(out.benched).toEqual([]);
    expect(out.emptyNights).toEqual(['2026-07-14']);
  });
});
