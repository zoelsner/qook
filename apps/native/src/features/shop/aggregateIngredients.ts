import {
  categorizeIngredient,
  type GroceryCategory,
  type Recipe,
} from '@qook/shared';

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
 *
 * Recipes staged by "Add all to list" are included without changing the
 * user's selected Tonight/Week meals. A staged recipe already present as an
 * active pick is deduplicated by recipe id.
 */
/**
 * The distinct meals feeding the shopping list — the source list for the
 * Shop filter pills (spec 2026-07-13-shop-meal-pills-design.md). Planned
 * picks first in date order (deduplicated by id: a dish planned twice gets
 * one pill), then staged recipes not already present as a pick.
 */
export function collectShopMeals(
  plan: Record<ISODate, DayPlan>,
  todayIso: ISODate,
  staged: Recipe[] = [],
): Recipe[] {
  const meals: Recipe[] = [];
  const seen = new Set<string>();
  const dates = Object.keys(plan).sort() as ISODate[];
  for (const date of dates) {
    if (date < todayIso) continue;
    const day = plan[date];
    const pick = day.recipes?.[day.pickIndex ?? 0];
    if (pick && !seen.has(pick.id)) {
      seen.add(pick.id);
      meals.push(pick);
    }
  }
  for (const recipe of staged) {
    if (!seen.has(recipe.id)) {
      seen.add(recipe.id);
      meals.push(recipe);
    }
  }
  return meals;
}

export function aggregateIngredients(
  plan: Record<ISODate, DayPlan>,
  todayIso: ISODate,
  staged: Recipe[] = [],
  excludeIds?: ReadonlySet<string>,
): ShopItem[] {
  const map = new Map<string, ShopItem>();

  const picks: Recipe[] = [];
  for (const [date, day] of Object.entries(plan)) {
    if (date < todayIso) continue;
    const pick = day.recipes?.[day.pickIndex ?? 0];
    if (pick) picks.push(pick);
  }

  const pickedIds = new Set(picks.map((pick) => pick.id));
  for (const recipe of staged) {
    if (!pickedIds.has(recipe.id)) picks.push(recipe);
  }

  for (const pick of picks) {
    // Pill-toggled meals contribute nothing; both nights of a twice-planned
    // dish drop together (pills are per-dish, not per-night — spec).
    if (excludeIds?.has(pick.id)) continue;
    if (!pick.ingredients?.length) continue;

    const flatIngredients = pick.ingredients.flatMap((group) => group.items ?? []);
    for (const ingredient of flatIngredients) {
      const rawName = ingredient.item?.trim();
      if (!rawName) continue;

      const key = ingredient.parsed?.canonicalKey ?? rawName.toLowerCase();
      const displayName = ingredient.parsed?.name ?? rawName;
      const category: GroceryCategory =
        ingredient.parsed?.category ?? categorizeIngredient(displayName);
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
