import { describe, expect, test } from 'bun:test';

import { userPreferencesRow } from './userPreferencesPayload';

describe('userPreferencesRow', () => {
  test('maps local settings to the Supabase contract', () => {
    expect(
      userPreferencesRow({
        cuisineGroups: ['Asian'],
        proteins: ['Chicken'],
        avoidList: ['shellfish'],
        servings: 4,
        unitSystem: 'metric',
        defaultTier: 'brain-is-fried',
      })
    ).toEqual({
      household_size: 4,
      unit_system: 'metric',
      cuisine_preferences: ['Asian'],
      protein_preferences: ['Chicken'],
      avoid_ingredients: ['shellfish'],
      weekly_deck_effort_mode: 'quick',
    });
  });

  test('clamps servings and preserves ask-every-time as no effort default', () => {
    expect(
      userPreferencesRow({
        cuisineGroups: [],
        proteins: [],
        avoidList: [],
        servings: 99,
        unitSystem: 'us',
        defaultTier: null,
      })
    ).toEqual({
      household_size: 6,
      unit_system: 'imperial',
      cuisine_preferences: [],
      protein_preferences: [],
      avoid_ingredients: [],
      weekly_deck_effort_mode: null,
    });
  });
});
