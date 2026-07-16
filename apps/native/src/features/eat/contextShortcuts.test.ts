import { describe, expect, test } from 'bun:test';

import { contextShortcuts, SHORTCUT_POOLS } from './contextShortcuts';

const ALL_LINES: Set<string> = new Set(
  Object.values(SHORTCUT_POOLS).flatMap((pool) => [...pool]),
);

describe('contextShortcuts', () => {
  test('returns 4 distinct chips from the pools, stable for a given day', () => {
    const a = contextShortcuts('2026-07-14', 'after-work');
    const b = contextShortcuts('2026-07-14', 'after-work');

    expect(a).toEqual(b);
    expect(a.length).toBe(4);
    expect(new Set(a).size).toBe(4);
    for (const chip of a) expect(ALL_LINES.has(chip)).toBe(true);
  });

  test('rotates across days', () => {
    const days = ['2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17'];
    const sets = days.map((d) => contextShortcuts(d, 'after-work').join('|'));
    expect(new Set(sets).size > 1).toBe(true);
  });

  test('fried nights lead with a low-effort chip; weekends lead with a project', () => {
    const reality: readonly string[] = SHORTCUT_POOLS.reality;
    const project: readonly string[] = SHORTCUT_POOLS.project;

    const fried = contextShortcuts('2026-07-14', 'brain-is-fried');
    expect(reality.includes(fried[0])).toBe(true);

    const weekend = contextShortcuts('2026-07-14', 'weekend-project');
    expect(project.includes(weekend[0])).toBe(true);
  });

  test('null tier still produces a full set', () => {
    expect(contextShortcuts('2026-07-14', null).length).toBe(4);
  });
});
