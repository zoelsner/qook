// Encore selection (spec §1.3): the 6th card is a proven favorite from the
// user's own history — saved OR previously cooked — minus anything already
// placed this week and minus anything already dealt this session. Only offered
// when there are at least ENCORE_THRESHOLD eligible dishes, so a nearly-empty
// history never surfaces a thin, repetitive encore. Pure — bun-testable.
export const ENCORE_THRESHOLD = 5;

export function encoreCandidateId(args: {
  savedIds: string[];
  cookedIds: string[];
  placedThisWeekIds: string[];
  dealtThisSessionIds: string[];
}): string | null {
  const { savedIds, cookedIds, placedThisWeekIds, dealtThisSessionIds } = args;
  const excluded = new Set([...placedThisWeekIds, ...dealtThisSessionIds]);
  const eligible: string[] = [];
  const seen = new Set<string>();
  for (const id of [...savedIds, ...cookedIds]) {
    if (excluded.has(id) || seen.has(id)) continue;
    seen.add(id);
    eligible.push(id);
  }
  if (eligible.length < ENCORE_THRESHOLD) return null;
  return eligible[0];
}
