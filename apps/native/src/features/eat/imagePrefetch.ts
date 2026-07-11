// Which proposal indices should have their hero art requested right now. At
// deal (position 0) that's the first 3; as the user reveals card N we stay 2
// ahead (request up to index N+2). Returns only not-yet-requested indices,
// clamped to the hand size. Pure — no RN imports, bun-testable.
export function artIndicesToRequest(
  position: number,
  count: number,
  requested: readonly number[]
): number[] {
  const target = Math.min(position + 2, count - 1);
  const have = new Set(requested);
  const out: number[] = [];
  for (let i = 0; i <= target; i++) {
    if (i >= 0 && !have.has(i)) out.push(i);
  }
  return out;
}
