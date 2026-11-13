import { FunctionCallError, shouldRetryFunctionError } from '../../services/functionError';

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

// The deck's one silent retry (spec §1.1.5). A rate-limit or auth rejection
// answers the same way twice, so it skips the re-ask (generateProposals has
// already applied the same rule to its own retry).
export async function retryOnce<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof FunctionCallError && !shouldRetryFunctionError(error)) throw error;
    return call();
  }
}
