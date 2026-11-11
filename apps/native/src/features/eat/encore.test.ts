import { describe, expect, test } from 'bun:test';
import { encoreCandidateId, ENCORE_THRESHOLD } from './encore';

const base = { savedIds: [] as string[], cookedIds: [] as string[], placedThisWeekIds: [] as string[], dealtThisSessionIds: [] as string[] };

describe('encoreCandidateId', () => {
  test('returns a candidate at exactly the threshold', () => {
    const saved = ['a', 'b', 'c', 'd', 'e'];
    expect(encoreCandidateId({ ...base, savedIds: saved })).toBe('a');
  });

  test('returns null one below the threshold', () => {
    const saved = ['a', 'b', 'c', 'd'];
    expect(encoreCandidateId({ ...base, savedIds: saved })).toBe(null);
  });

  test('unions saved and cooked without double-counting', () => {
    const out = encoreCandidateId({ ...base, savedIds: ['a', 'b', 'c'], cookedIds: ['c', 'd', 'e'] });
    expect(out).toBe('a'); // 5 distinct: a,b,c,d,e
  });

  test('excludes already-placed and already-dealt ids from eligibility', () => {
    const out = encoreCandidateId({
      savedIds: ['a', 'b', 'c', 'd', 'e', 'f'],
      cookedIds: [],
      placedThisWeekIds: ['a'],
      dealtThisSessionIds: ['b'],
    });
    // eligible = c,d,e,f → 4 < 5 → null
    expect(out).toBe(null);
  });

  test('threshold constant is 5', () => {
    expect(ENCORE_THRESHOLD).toBe(5);
  });
});
