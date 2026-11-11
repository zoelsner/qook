import { describe, expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';
import type { ISODate } from '../week/weekDates';
import { allocationWrites, tierMismatch, allocateKeeps, shortTitle, dayChipState } from './allocation';

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

describe('shortTitle', () => {
  test('passes short titles through, lowercased', () => {
    expect(shortTitle('Tacos')).toBe('tacos');
  });
  test('truncates and ellipsizes long titles', () => {
    expect(shortTitle('Thai Turkey Lettuce Wraps')).toBe('thai turkey…');
  });
  test('trims whitespace before measuring', () => {
    expect(shortTitle('  Tacos  ')).toBe('tacos');
  });
  test('respects a custom max', () => {
    expect(shortTitle('Turkey Wraps', 6)).toBe('turkey…');
  });
});

describe('dayChipState', () => {
  test('free day, no budget: plain day label', () => {
    expect(
      dayChipState({ dayLabel: 'Mon', budget: null, over: false, plannedTitle: null, claim: null }),
    ).toEqual({ kind: 'free', label: 'Mon' });
  });
  test('free day, under budget: shows the minutes', () => {
    expect(
      dayChipState({ dayLabel: 'Mon', budget: 30, over: false, plannedTitle: null, claim: null }),
    ).toEqual({ kind: 'free', label: 'Mon · 30m' });
  });
  test('free day, over budget: warns', () => {
    expect(
      dayChipState({ dayLabel: 'Mon', budget: 15, over: true, plannedTitle: null, claim: null }),
    ).toEqual({ kind: 'free', label: 'Mon · over 15m' });
  });
  test('planned day: short title of the plan pick', () => {
    expect(
      dayChipState({
        dayLabel: 'Tue',
        budget: null,
        over: false,
        plannedTitle: 'Thai Turkey Lettuce Wraps',
        claim: null,
      }),
    ).toEqual({ kind: 'planned', label: 'Tue · thai turkey…', plannedTitle: 'Thai Turkey Lettuce Wraps' });
  });
  test('claimed day outranks a planned day', () => {
    expect(
      dayChipState({
        dayLabel: 'Wed',
        budget: null,
        over: false,
        plannedTitle: 'Existing Plan Dish',
        claim: { index: 2, title: 'Skillet Tacos' },
      }),
    ).toEqual({
      kind: 'claimed',
      label: 'Wed · skillet taco… ↑',
      claimedIndex: 2,
      claimedTitle: 'Skillet Tacos',
    });
  });
  test('claimed carries the claiming index and full title', () => {
    const state = dayChipState({
      dayLabel: 'Thu',
      budget: 45,
      over: true,
      plannedTitle: null,
      claim: { index: 0, title: 'Big Batch Chili' },
    });
    expect(state.kind).toBe('claimed');
    if (state.kind === 'claimed') {
      expect(state.claimedIndex).toBe(0);
      expect(state.claimedTitle).toBe('Big Batch Chili');
    }
  });
});
