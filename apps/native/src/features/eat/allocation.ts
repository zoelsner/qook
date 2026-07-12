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
