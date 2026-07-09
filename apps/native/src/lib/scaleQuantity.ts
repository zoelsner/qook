import type { Ingredient } from '@qook/shared';

// Pretty-print a scaled amount: whole numbers stay whole, common kitchen
// fractions render as glyphs, anything else gets at most 2 decimals.
const FRACTIONS: [number, string][] = [
  [0.25, '¼'],
  [0.33, '⅓'],
  [0.5, '½'],
  [0.66, '⅔'],
  [0.75, '¾'],
];

export function formatAmount(n: number): string {
  if (n <= 0) return '0';
  const whole = Math.floor(n);
  const frac = n - whole;
  if (frac < 0.05) return String(whole);
  for (const [v, glyph] of FRACTIONS) {
    if (Math.abs(frac - v) < 0.07) return whole > 0 ? `${whole}${glyph}` : glyph;
  }
  return String(Math.round(n * 100) / 100);
}

// Scale a free-form quantity string ("1 1/2 cups", "12 oz", "½ tsp") by
// multiplying its leading numeric token. Non-numeric quantities ("to taste",
// "a pinch") pass through unchanged.
const UNICODE_FRACTION: Record<string, number> = {
  '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3,
};

export function scaleQuantityString(quantity: string, factor: number): string {
  const m = quantity.match(
    /^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+|[¼½¾⅓⅔])(\s*)(.*)$/,
  );
  if (!m) return quantity;
  const [, num, gap, rest] = m;
  let value: number;
  if (UNICODE_FRACTION[num] != null) {
    value = UNICODE_FRACTION[num];
  } else if (num.includes('/')) {
    const [mixed, frac] = num.includes(' ') ? num.split(/\s+/) : [null, num];
    const [a, b] = frac.split('/').map(Number);
    value = (mixed ? Number(mixed) : 0) + a / b;
  } else {
    value = Number(num);
  }
  if (!Number.isFinite(value) || value <= 0) return quantity;
  return `${formatAmount(value * factor)}${gap || (rest ? ' ' : '')}${rest}`;
}

// Scaled display quantity for an ingredient row. Prefers the structured
// parse when present; falls back to string parsing of the display quantity.
export function scaledIngredientQuantity(
  ing: Ingredient,
  factor: number,
): string | undefined {
  if (!ing.quantity) return undefined;
  if (Math.abs(factor - 1) < 0.001) return ing.quantity;
  const parsed = ing.parsed;
  if (parsed?.quantityAmount != null && parsed.quantityAmount > 0) {
    const amt = formatAmount(parsed.quantityAmount * factor);
    return parsed.quantityUnit && parsed.quantityUnit !== 'count'
      ? `${amt} ${parsed.quantityUnit}`
      : amt;
  }
  return scaleQuantityString(ing.quantity, factor);
}
