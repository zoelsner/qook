import type { GroceryCategory } from '@qook/shared';

import type { ISODate } from '../week/weekDates';
import type { DayPlan } from '../../stores/weekPlan';

export interface ShopItem {
  key: string;
  name: string;
  category: GroceryCategory;
  quantities: string[];   // distinct quantity strings, in insertion order
  recipeCount: number;    // how many picks referenced this ingredient
  recipeTitles: string[]; // distinct recipe titles, in insertion order
}

/**
 * Aggregate ingredient lines across weekPlan picks for today-and-future.
 *
 * Shape notes:
 * - `Recipe.ingredients` is `IngredientGroup[]` with nested `items: Ingredient[]`.
 * - An `Ingredient` may have a `parsed` ParsedIngredient with canonicalKey + category.
 * - When `parsed` is missing, we fall back to lowercased `item` as the key and
 *   `'Other'` as the category.
 *
 * We do NOT attempt unit arithmetic (2 lb + 1 lb → 3 lb) in v1. We concat
 * distinct quantity strings and surface `recipeCount` so the user can infer
 * total demand.
 */
export function aggregateIngredients(
  plan: Record<ISODate, DayPlan>,
  todayIso: ISODate,
): ShopItem[] {
  const map = new Map<string, ShopItem>();

  for (const [date, day] of Object.entries(plan)) {
    if (date < todayIso) continue;

    const pick = day.recipes?.[day.pickIndex ?? 0];
    if (!pick?.ingredients?.length) continue;

    const flatIngredients = pick.ingredients.flatMap((group) => group.items ?? []);
    for (const ingredient of flatIngredients) {
      const rawName = ingredient.item?.trim();
      if (!rawName) continue;

      const key = ingredient.parsed?.canonicalKey ?? rawName.toLowerCase();
      const displayName = ingredient.parsed?.name ?? rawName;
      const category: GroceryCategory = ingredient.parsed?.category ?? 'Other';
      const quantity = ingredient.quantity?.trim() || '';
      const existing = map.get(key);

      if (existing) {
        if (quantity && !existing.quantities.includes(quantity)) {
          existing.quantities.push(quantity);
        }
        existing.recipeCount += 1;
        if (!existing.recipeTitles.includes(pick.title)) {
          existing.recipeTitles.push(pick.title);
        }
        continue;
      }

      map.set(key, {
        key,
        name: displayName,
        category,
        quantities: quantity ? [quantity] : [],
        recipeCount: 1,
        recipeTitles: [pick.title],
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function formatQuantity(item: ShopItem): string {
  if (item.quantities.length === 0) return 'to taste';
  if (item.quantities.length === 1) return item.quantities[0];
  const distinct = Array.from(new Set(item.quantities));
  if (distinct.length === 1) return `${distinct[0]} (×${item.recipeCount})`;
  return distinct.join(' + ');
}
