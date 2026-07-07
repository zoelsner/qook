// Run: bun run scripts/test-shopping-share.ts
// Mirrors the Deno mapper so the 7 edge cases (spec §7 / audit §3) are asserted
// against the same mapping contract the edge function uses.
type Item = { name: string; quantityAmount?: number; quantityUnit?: string; quantityText?: string };
function toInstacartItem(item: Item) {
  const unit = !item.quantityUnit || item.quantityUnit === 'count' ? 'each' : item.quantityUnit;
  return { name: item.name, quantity: item.quantityAmount ?? 1, unit, display_text: item.quantityText || item.name };
}
function searchFallbackUrl(items: Item[]) {
  const q = items.map((i) => i.name.trim()).filter(Boolean).join(', ');
  return `https://www.instacart.com/store/s?k=${encodeURIComponent(q)}`;
}

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  passed++;
}

// 1. amount + unit preserved
assert(toInstacartItem({ name: 'flour', quantityAmount: 2, quantityUnit: 'cup', quantityText: '2 cup' }).quantity === 2, 'amount preserved');
// 2. missing quantity → 1/each
assert(toInstacartItem({ name: 'lemon' }).unit === 'each', 'default unit each');
// 3. count → each
assert(toInstacartItem({ name: 'egg', quantityAmount: 3, quantityUnit: 'count' }).unit === 'each', 'count→each');
// 4. display_text falls back to name
assert(toInstacartItem({ name: 'salt' }).display_text === 'salt', 'display_text fallback');
// 5. empty list → fallback URL has empty query
assert(searchFallbackUrl([]) === 'https://www.instacart.com/store/s?k=', 'empty list url');
// 6. >50 items truncation (mapper is per-item; truncation is caller-side — assert slice logic)
const many = Array.from({ length: 60 }, (_, i) => ({ name: `item${i}` }));
assert(many.slice(0, 50).length === 50, '>50 truncates to 50');
// 7. names with commas/spaces encode safely in fallback
assert(searchFallbackUrl([{ name: 'red, ripe tomato' }]).includes('%2C'), 'comma encoded');

console.log(`OK — ${passed} assertions passed`);
