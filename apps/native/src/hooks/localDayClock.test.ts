import { describe, expect, test } from 'bun:test';
import { watchLocalDay } from './localDayClock';

describe('local-day refresh', () => {
  test('advances a mounted screen at midnight without a store update', () => {
    let now = new Date(2026, 8, 9, 23, 59, 59);
    let tick = () => {};
    let delay = 0;
    const days: string[] = [];
    const stop = watchLocalDay((day) => days.push(day), {
      now: () => now,
      schedule: (callback, ms) => { tick = callback; delay = ms; return 1 as unknown as ReturnType<typeof setTimeout>; },
      cancel: () => {}, onActive: () => () => {},
    });
    expect(days).toEqual(['2026-09-09']);
    expect(delay).toBe(1000);
    now = new Date(2026, 8, 10);
    tick();
    expect(days).toEqual(['2026-09-09', '2026-09-10']);
    stop();
  });

  test('rechecks after suspension and cancels all work on unmount', () => {
    let now = new Date(2026, 11, 31, 20);
    let resume = () => {};
    let tick = () => {};
    let cancelled = 0;
    let removed = false;
    const days: string[] = [];
    const stop = watchLocalDay((day) => days.push(day), {
      now: () => now,
      schedule: (callback) => { tick = callback; return 1 as unknown as ReturnType<typeof setTimeout>; },
      cancel: () => { cancelled++; },
      onActive: (callback) => { resume = callback; return () => { removed = true; }; },
    });
    now = new Date(2027, 0, 2, 8);
    resume();
    expect(days).toEqual(['2026-12-31', '2027-01-02']);
    expect(cancelled).toBe(1);
    stop(); tick(); resume();
    expect(cancelled).toBe(2);
    expect(removed).toBe(true);
    expect(days.length).toBe(2);
  });
});
