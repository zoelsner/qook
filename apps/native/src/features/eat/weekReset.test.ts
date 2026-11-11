import { describe, expect, test } from 'bun:test';
import type { ISODate } from '../week/weekDates';
import { representativeTier, unfilledResetNights, type ResetNight } from './weekReset';

function night(date: string, tier: ResetNight['tier']): ResetNight {
  return { date: date as ISODate, tier };
}

describe('representativeTier', () => {
  test('empty nights default to after-work', () => {
    expect(representativeTier([])).toBe('after-work');
  });

  test('picks the modal tier', () => {
    const nights = [night('2026-07-13', 'after-work'), night('2026-07-14', 'after-work'), night('2026-07-15', 'got-energy')];
    expect(representativeTier(nights)).toBe('after-work');
  });

  test('breaks ties toward the lowest max-minutes tier', () => {
    const nights = [night('2026-07-13', 'got-energy'), night('2026-07-14', 'after-work')];
    expect(representativeTier(nights)).toBe('after-work');
  });

  test('a single night returns that night tier', () => {
    expect(representativeTier([night('2026-07-13', 'got-energy')])).toBe('got-energy');
  });
});

describe('unfilledResetNights', () => {
  test('drops filled dates and sorts ascending', () => {
    const nights = [night('2026-07-15', 'after-work'), night('2026-07-13', 'got-energy'), night('2026-07-14', 'after-work')];
    const filled = new Set(['2026-07-14']);
    expect(unfilledResetNights(nights, filled).map((n) => n.date)).toEqual(['2026-07-13', '2026-07-15']);
  });
});
