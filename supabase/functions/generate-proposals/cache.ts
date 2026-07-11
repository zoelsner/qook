// Phase-1 exact-title cache shortcut (spec Resolved Q1). If a global 'full'
// recipe already exists with the proposal's exact title, the card points at
// that finished row (art + full body already present) instead of a fresh
// skeleton — $0, instant. Kept net-free so it unit-tests without --allow-net.
export function firstCacheHitId(
  rows: { id: string }[] | null,
): string | null {
  return rows && rows.length > 0 ? rows[0].id : null;
}
