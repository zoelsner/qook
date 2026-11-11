import type { EnergyTier, Recipe } from '@qook/shared';
import type { ISODate } from '../week/weekDates';
import { TIER_MAX_MINUTES } from './weekReset';

// One kept recipe's day assignment. date === null means "skipped" — the keep
// stays saved (handled by the caller) but is not placed on a day.
export interface AllocationChoice {
  recipe: Recipe;
  date: ISODate | null;
}

export interface AllocationWrite {
  recipe: Recipe;
  date: ISODate;
}

// Only dated keeps become weekPlan writes. Pure — no RN imports, bun-testable.
export function allocationWrites(choices: AllocationChoice[]): AllocationWrite[] {
  return choices
    .filter((c): c is AllocationWrite => c.date != null)
    .map((c) => ({ recipe: c.recipe, date: c.date }));
}

// A keep placed on a night whose tier ceiling is shorter than the dish's time
// is a soft mismatch: the UI warns but never blocks (spec D5).
export function tierMismatch(cardMinutes: number, nightTier: EnergyTier): boolean {
  return cardMinutes > TIER_MAX_MINUTES[nightTier];
}

// Compact meal name for a day chip — first characters of the title, lowercased,
// ellipsized. Chips can't fit full titles.
export function shortTitle(title: string, max = 12): string {
  const trimmed = title.trim();
  if (trimmed.length <= max) return trimmed.toLowerCase();
  return `${trimmed.slice(0, max).trimEnd().toLowerCase()}…`;
}

export type DayChipState =
  | { kind: 'free'; label: string }
  | { kind: 'planned'; label: string; plannedTitle: string }
  | { kind: 'claimed'; label: string; claimedIndex: number; claimedTitle: string };

// What a day chip should say for one keep's row. Another keep's in-session
// claim outranks an existing planned meal (it's the more surprising state);
// both outrank the tier-budget label, which only fits when the day is free.
export function dayChipState(args: {
  dayLabel: string;
  budget: number | null;
  over: boolean;
  plannedTitle: string | null;
  claim: { index: number; title: string } | null;
}): DayChipState {
  const { dayLabel, budget, over, plannedTitle, claim } = args;
  if (claim) {
    return {
      kind: 'claimed',
      label: `${dayLabel} · ${shortTitle(claim.title)} ↑`,
      claimedIndex: claim.index,
      claimedTitle: claim.title,
    };
  }
  if (plannedTitle) {
    return {
      kind: 'planned',
      label: `${dayLabel} · ${shortTitle(plannedTitle)}`,
      plannedTitle,
    };
  }
  return {
    kind: 'free',
    label: budget == null ? dayLabel : over ? `${dayLabel} · over ${budget}m` : `${dayLabel} · ${budget}m`,
  };
}

export interface KeepAllocation {
  placed: AllocationWrite[];
  benched: Recipe[];
  emptyNights: ISODate[];
}

// Split the user's day choices into: writes for dated keeps, over-keeps (no
// day chosen) destined for the bench, and the reset's nights left empty. The
// app NEVER fills an empty night itself (spec D6) — emptyNights is surfaced as
// a "Deal fresh ideas" affordance, not auto-drafted.
export function allocateKeeps(
  choices: AllocationChoice[],
  nights: ISODate[],
): KeepAllocation {
  const placed = allocationWrites(choices);
  const benched = choices.filter((c) => c.date == null).map((c) => c.recipe);
  const usedNights = new Set(placed.map((w) => w.date));
  const emptyNights = nights.filter((d) => !usedNights.has(d));
  return { placed, benched, emptyNights };
}
