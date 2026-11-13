import { describe, expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';

import { aggregateIngredients } from '../features/shop/aggregateIngredients';
import type { ISODate } from '../features/week/weekDates';
import { pruneShopChecks, reconcileShopChecks, toggleShopCheck } from './shopChecked';

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

describe('reconcileShopChecks on plan changes', () => {
  const MON = '2026-07-13' as ISODate;
  const TUE = '2026-07-14' as ISODate;
  const WED = '2026-07-15' as ISODate;
  const meal = (id: string, item: string) =>
    ({ id, title: id, ingredients: [{ title: 'main', items: [{ item, quantity: '1' }] }] }) as Recipe;
  const keys = (plan: Record<ISODate, { recipes: Recipe[]; pickIndex: number }>, today: ISODate) =>
    aggregateIngredients(plan, today).map((i) => i.key);

  test('a check does not come back when its ingredient is planned again before Shop opens', () => {
    const planned = { [TUE]: { recipes: [meal('a', 'garlic')], pickIndex: 0 } };
    let checked = toggleShopCheck({}, keys(planned, MON)[0]);
    // Meal removed, then a different garlic meal planned; Shop never opened.
    checked = reconcileShopChecks(checked, keys(planned, MON), keys({}, MON));
    const replanned = { [WED]: { recipes: [meal('b', 'garlic')], pickIndex: 0 } };
    checked = reconcileShopChecks(checked, keys({}, MON), keys(replanned, MON));
    expect(checked).toEqual({});
  });

  test('a check does not come back after its day passes and the ingredient is planned again', () => {
    const planned = { [MON]: { recipes: [meal('a', 'garlic')], pickIndex: 0 } };
    const checked = toggleShopCheck({}, keys(planned, MON)[0]);
    // Next day: Monday is past, so garlic is off the list before the new plan.
    const replanned = { ...planned, [WED]: { recipes: [meal('b', 'garlic')], pickIndex: 0 } };
    expect(reconcileShopChecks(checked, keys(planned, TUE), keys(replanned, TUE))).toEqual({});
  });

  test('a check on an item still listed survives an unrelated plan change', () => {
    const planned = { [TUE]: { recipes: [meal('a', 'garlic')], pickIndex: 0 } };
    const checked = toggleShopCheck({}, keys(planned, MON)[0]);
    const more = { ...planned, [WED]: { recipes: [meal('b', 'lemon')], pickIndex: 0 } };
    expect(reconcileShopChecks(checked, keys(planned, MON), keys(more, MON))).toBe(checked);
  });
});
