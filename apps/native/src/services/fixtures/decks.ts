import type { CohortDeck, ISODate, Timestamp } from '@qook/shared';
import { mockRecipes } from './recipes';

const ids = mockRecipes.map((r) => r.id);

// Pad to 12 by repeating the 3 seed recipes (enough to exercise the Swipe Night stack).
const padded: string[] = [];
for (let i = 0; i < 12; i++) {
  padded.push(ids[i % ids.length]);
}

export const mockDeck: CohortDeck = {
  id: 'deck_001',
  weekNumber: 17,
  weekStartDate: '2026-04-19' as ISODate,
  tier: 'after-work',
  recipeIds: padded,
  assetManifest: [],
  generatedAt: Date.now() as Timestamp,
  version: 1,
};
