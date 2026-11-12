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
