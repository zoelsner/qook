import { describe, expect, test } from 'bun:test';
import { FunctionCallError } from '../../services/functionError';
import { retryOnce, shouldPrefetchNextHand } from './handPrefetch';

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

describe('retryOnce', () => {
  const failing = (error: Error) => {
    let calls = 0;
    const call = async () => { calls++; throw error; };
    return { call, error, calls: () => calls };
  };
  const rejection = (promise: Promise<unknown>) => promise.then(() => undefined, (error: unknown) => error);

  test('a rate limit is not re-asked', async () => {
    const limited = failing(new FunctionCallError('You’ve hit today’s recipe limit — back tomorrow.', { code: 'rate_limited', status: 429 }));
    expect(await rejection(retryOnce(limited.call))).toBe(limited.error);
    expect(limited.calls()).toBe(1);
  });

  test('a server or transport failure gets one re-ask', async () => {
    for (const error of [new FunctionCallError('busy', { code: 'generation_failed', status: 500 }), new Error('Failed to fetch')]) {
      const flaky = failing(error);
      expect(await rejection(retryOnce(flaky.call))).toBe(error);
      expect(flaky.calls()).toBe(2);
    }
  });

  test('returns the retry result when the re-ask succeeds', async () => {
    let calls = 0;
    expect(await retryOnce(async () => { if (calls++ === 0) throw new Error('blip'); return 'hand'; })).toBe('hand');
  });
});
