// Pure Shop check-off transitions (kept out of weekPlan.ts so they test
// without AsyncStorage). Only checked keys are stored.
export type ShopChecked = Record<string, true>;

export function toggleShopCheck(checked: ShopChecked, key: string): ShopChecked {
  const next = { ...checked };
  if (next[key]) delete next[key];
  else next[key] = true;
  return next;
}

// Drop checks whose item left the list, so the map can't grow forever or
// resurrect a stale check when the ingredient comes back later. Returns the
// same object when nothing drops so the store skips a write.
export function pruneShopChecks(checked: ShopChecked, liveKeys: readonly string[]): ShopChecked {
  const live = new Set(liveKeys);
  const kept = Object.keys(checked).filter((key) => live.has(key));
  if (kept.length === Object.keys(checked).length) return checked;
  return Object.fromEntries(kept.map((key) => [key, true as const]));
}

// A check survives a plan or staging change only if its item was on the list
// both before and after (both read with today's date). Pruning against the new
// list alone misses a check whose item left while Shop was closed, or whose
// day passed, and lets it come back when the ingredient is planned again.
export function reconcileShopChecks(
  checked: ShopChecked,
  keysBefore: readonly string[],
  keysAfter: readonly string[],
): ShopChecked {
  return pruneShopChecks(pruneShopChecks(checked, keysBefore), keysAfter);
}
