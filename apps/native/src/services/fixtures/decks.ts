import type { CohortDeck, ISODate, Timestamp } from '@qook/shared';
import { mockRecipes } from './recipes';

// First 12 IDs spans brain-is-fried + after-work seed recipes;
// mirrors what a real cohort "after-work" deck slice would look like
// while still giving variety.
const deckIds = mockRecipes
  .filter((r) => r.tier === 'after-work' || r.tier === 'brain-is-fried')
  .slice(0, 12)
  .map((r) => r.id);

export const mockDeck: CohortDeck = {
  id: 'deck_001',
  weekNumber: 17,
  weekStartDate: '2026-04-19' as ISODate,
  tier: 'after-work',
  recipeIds: deckIds,
  assetManifest: [],
  generatedAt: Date.now() as Timestamp,
  version: 1,
};
