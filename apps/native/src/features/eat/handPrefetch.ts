// When to kick off a background generate-proposals for the NEXT hand. Mirrors
// imagePrefetch.ts's "stay ahead of the swiper" idea, but keyed on the hand
// rather than art: fire once the swiper is within PREFETCH_THRESHOLD cards of
// the end AND unfilled nights still justify another hand AND nothing is already
// in flight or waiting. Pure — no RN imports, bun-testable.
export const PREFETCH_THRESHOLD = 2;

export function shouldPrefetchNextHand(args: {
  position: number;
  handSize: number;
  unfilledNights: number;
  prefetchInFlight: boolean;
  nextHandReady: boolean;
}): boolean {
  const { position, handSize, unfilledNights, prefetchInFlight, nextHandReady } = args;
  if (unfilledNights <= 0) return false;
  if (prefetchInFlight || nextHandReady) return false;
  return position >= handSize - PREFETCH_THRESHOLD;
}
