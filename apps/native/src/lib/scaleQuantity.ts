import type { Ingredient, Recipe } from '@qook/shared';

// Pretty-print a scaled amount: whole numbers stay whole, common kitchen
// fractions render as glyphs, anything else gets at most 2 decimals.
const FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'],
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [0.5, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
  [7 / 8, '⅞'],
];

export function formatAmount(n: number): string {
  if (n <= 0) return '0';
  const whole = Math.floor(n);
  const frac = n - whole;
  if (frac < 0.000001) return String(whole);
  for (const [v, glyph] of FRACTIONS) {
    // Accept model-rounded thirds, but never snap an arbitrary nearby amount.
    if (Math.abs(frac - v) <= 0.005) return whole > 0 ? `${whole}${glyph}` : glyph;
  }
  return String(Math.round(n * 100) / 100);
}

// Scale a free-form quantity string ("1 1/2 cups", "12 oz", "½ tsp") by
// multiplying its leading numeric token. Non-numeric quantities ("to taste",
// "a pinch") pass through unchanged.
const UNICODE_FRACTION: Record<string, number> = {
  '⅛': 1 / 8, '¼': 0.25, '⅓': 1 / 3, '⅜': 3 / 8,
  '½': 0.5, '⅝': 5 / 8, '⅔': 2 / 3, '¾': 0.75, '⅞': 7 / 8,
};

export function scaleQuantityString(quantity: string, factor: number): string {
  const m = quantity.match(
    /^\s*(\d+\s*[⅛¼⅓⅜½⅝⅔¾⅞]|\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+|[⅛¼⅓⅜½⅝⅔¾⅞])(\s*)(.*)$/,
  );
  if (!m) return quantity;
  const [, num, gap, rest] = m;
  let value: number;
  if (UNICODE_FRACTION[num] != null) {
    value = UNICODE_FRACTION[num];
  } else if (UNICODE_FRACTION[num.slice(-1)] != null) {
    value = Number(num.slice(0, -1).trim()) + UNICODE_FRACTION[num.slice(-1)];
  } else if (num.includes('/')) {
    const [mixed, frac] = num.includes(' ') ? num.split(/\s+/) : [null, num];
    const [a, b] = frac.split('/').map(Number);
    value = (mixed ? Number(mixed) : 0) + a / b;
  } else {
    value = Number(num);
  }
  if (!Number.isFinite(value) || value <= 0) return quantity;
  // A total weight describes the whole scaled quantity. Per-piece weights
  // and package sizes have no "total" suffix and stay unchanged.
  const scaledRest = rest.replace(
    /\(((?:(?:about|approximately|approx\.?)\s+)?)(\d+(?:\.\d+)?)(\s*)(g|kg|grams?|kilograms?|oz|ounces?|lbs?|pounds?)(\s+total)\)/gi,
    (match, prefix: string, amount: string, space: string, unit: string, suffix: string) => {
      const total = Number(amount);
      return total > 0
        ? `(${prefix}${formatAmount(total * factor)}${space}${unit}${suffix})`
        : match;
    },
  );
  return `${formatAmount(value * factor)}${gap || (scaledRest ? ' ' : '')}${scaledRest}`;
}

// Shop snapshots keep the recipe's original amounts and persist the chosen
// servings separately. Scale a copy at the aggregation boundary so refills,
// reopening detail, and repeated adds cannot compound the multiplier.
export function recipeForServings(recipe: Recipe, servings: number): Recipe {
  if (!Number.isFinite(servings) || servings <= 0 ||
      !Number.isFinite(recipe.servings) || recipe.servings <= 0 ||
      servings === recipe.servings) return recipe;
  const factor = servings / recipe.servings;
  return {
    ...recipe,
    servings,
    ingredients: recipe.ingredients.map((group) => ({
      ...group,
      items: group.items.map((ingredient) => ({
        ...ingredient,
        quantity: scaledIngredientQuantity(ingredient, factor),
        parsed: ingredient.parsed ? {
          ...ingredient.parsed,
          quantityAmount: ingredient.parsed.quantityAmount == null
            ? undefined : ingredient.parsed.quantityAmount * factor,
        } : undefined,
      })),
    })),
  };
}

// Scaled display quantity for an ingredient row. Prefers the structured
// parse when present; falls back to string parsing of the display quantity.
export function scaledIngredientQuantity(
  ing: Ingredient,
  factor: number,
): string | undefined {
  if (!ing.quantity) return undefined;
  if (Math.abs(factor - 1) < 0.001) return ing.quantity;
  // scaleQuantityString preserves the trailing unit text verbatim, so prefer
  // it whenever the display quantity has a leading numeric token — the
  // structured parse drops the unit wording when quantityUnit is 'count'.
  if (/^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+|[⅛¼⅓⅜½⅝⅔¾⅞])/.test(ing.quantity)) {
    return scaleQuantityString(ing.quantity, factor);
  }
  const parsed = ing.parsed;
  if (parsed?.quantityAmount != null && parsed.quantityAmount > 0) {
    const amt = formatAmount(parsed.quantityAmount * factor);
    return parsed.quantityUnit && parsed.quantityUnit !== 'count'
      ? `${amt} ${parsed.quantityUnit}`
      : amt;
  }
  return scaleQuantityString(ing.quantity, factor);
}
