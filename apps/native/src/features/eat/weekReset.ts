import type { EnergyTier } from '@qook/shared';
import type { ISODate } from '../week/weekDates';

// One tagged night the weekly reset will try to fill: its date + the tier the
// user set on the Plan tab chip. Pure — no RN imports, bun-testable.
export interface ResetNight {
  date: ISODate;
  tier: EnergyTier;
}

// Per-tier active-time ceiling, mirroring supabase _shared/tiers.ts TIER_RULES.
// Kept client-side (that module is Deno-only) so allocation + tier selection
// stay bun-pure. Single source of truth for both weekReset and allocation.
export const TIER_MAX_MINUTES: Record<EnergyTier, number> = {
  'brain-is-fried': 15,
  'after-work': 30,
  'got-energy': 45,
  'weekend-project': 180,
};

// Phase A only sends ONE tier to the (unmodified) generate-proposals endpoint.
// Pick the tier the most nights asked for; on a tie choose the lowest ceiling,
// since a quick dish on a high-energy night only warns, never over-caps.
export function representativeTier(nights: ResetNight[]): EnergyTier {
  if (nights.length === 0) return 'after-work';
  const counts = new Map<EnergyTier, number>();
  for (const n of nights) counts.set(n.tier, (counts.get(n.tier) ?? 0) + 1);
  let best: EnergyTier = 'after-work';
  let bestCount = -1;
  for (const [tier, count] of counts) {
    if (
      count > bestCount ||
      (count === bestCount && TIER_MAX_MINUTES[tier] < TIER_MAX_MINUTES[best])
    ) {
      best = tier;
      bestCount = count;
    }
  }
  return best;
}

// The nights the reset should still offer as allocation targets: those not yet
// carrying a committed recipe, sorted chronologically.
export function unfilledResetNights(
  nights: ResetNight[],
  filledDates: ReadonlySet<string>,
): ResetNight[] {
  return nights
    .filter((n) => !filledDates.has(n.date))
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
