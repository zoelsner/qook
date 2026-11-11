// Phase-2 fill-time dedup decision (spec). After the full recipe is written we
// compute its signature and look up other global 'full' rows with the same
// signature. If a DIFFERENT row already holds it, we point the card at that
// cache hit and delete the just-filled skeleton; otherwise we fill the skeleton
// in place. Net-free so it unit-tests without --allow-net.
export function resolveFillTarget(
  skeletonId: string,
  existing: { id: string }[] | null,
): { action: "cache-hit" | "fill-in-place"; targetId: string } {
  const other = (existing ?? []).find((r) => r.id !== skeletonId);
  return other
    ? { action: "cache-hit", targetId: other.id }
    : { action: "fill-in-place", targetId: skeletonId };
}
