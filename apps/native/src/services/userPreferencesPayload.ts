import type { EnergyTier } from '@qook/shared';

export interface PreferenceSnapshot {
  cuisineGroups: string[];
  proteins: string[];
  avoidList: string[];
  servings: number;
  unitSystem: 'us' | 'metric';
  defaultTier: EnergyTier | null;
}

export interface UserPreferencesRow {
  household_size: number;
  unit_system: 'imperial' | 'metric';
  cuisine_preferences: string[];
  protein_preferences: string[];
  avoid_ingredients: string[];
  weekly_deck_effort_mode: 'quick' | 'standard' | 'elevated' | null;
}

function effortModeForTier(
  tier: EnergyTier | null
): UserPreferencesRow['weekly_deck_effort_mode'] {
  if (tier === 'brain-is-fried') return 'quick';
  if (tier === 'got-energy' || tier === 'weekend-project') return 'elevated';
  if (tier === 'after-work') return 'standard';
  return null;
}

export function userPreferencesRow(snapshot: PreferenceSnapshot): UserPreferencesRow {
  return {
    household_size: Math.max(1, Math.min(6, Math.round(snapshot.servings))),
    unit_system: snapshot.unitSystem === 'metric' ? 'metric' : 'imperial',
    cuisine_preferences: [...snapshot.cuisineGroups],
    protein_preferences: [...snapshot.proteins],
    avoid_ingredients: [...snapshot.avoidList],
    weekly_deck_effort_mode: effortModeForTier(snapshot.defaultTier),
  };
}
