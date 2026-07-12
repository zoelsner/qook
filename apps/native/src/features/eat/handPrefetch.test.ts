import { describe, expect, test } from 'bun:test';
import { shouldPrefetchNextHand } from './handPrefetch';

const base = { position: 3, handSize: 5, unfilledNights: 2, prefetchInFlight: false, nextHandReady: false };

describe('shouldPrefetchNextHand', () => {
  test('fires at exactly two cards from the end', () => {
    expect(shouldPrefetchNextHand({ ...base, position: 3 })).toBe(true);
  });
  test('does not fire three cards from the end', () => {
    expect(shouldPrefetchNextHand({ ...base, position: 2 })).toBe(false);
  });
  test('does not fire when no unfilled nights remain', () => {
    expect(shouldPrefetchNextHand({ ...base, unfilledNights: 0 })).toBe(false);
  });
  test('does not double-fire while a prefetch is in flight', () => {
    expect(shouldPrefetchNextHand({ ...base, prefetchInFlight: true })).toBe(false);
  });
  test('does not fire when the next hand is already ready', () => {
    expect(shouldPrefetchNextHand({ ...base, nextHandReady: true })).toBe(false);
  });
});
