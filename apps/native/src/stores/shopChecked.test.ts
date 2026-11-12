import { describe, expect, test } from 'bun:test';
import { pruneShopChecks, toggleShopCheck } from './shopChecked';

describe('persisted Shop check-offs', () => {
  test('toggle checks and unchecks an item key', () => {
    let checked = toggleShopCheck({}, 'garlic');
    checked = toggleShopCheck(checked, 'lemon');
    expect(Object.keys(checked).sort()).toEqual(['garlic', 'lemon']);
    checked = toggleShopCheck(checked, 'garlic');
    expect(Object.keys(checked)).toEqual(['lemon']);
  });

  test('prune drops keys that left the list and keeps the rest', () => {
    expect(pruneShopChecks({ garlic: true, lemon: true }, ['lemon', 'onion'])).toEqual({ lemon: true });
    expect(pruneShopChecks({ garlic: true }, [])).toEqual({});
  });

  test('prune returns the same object when every check is still live', () => {
    const checked = { garlic: true as const };
    expect(pruneShopChecks(checked, ['garlic', 'onion'])).toBe(checked);
  });
});
