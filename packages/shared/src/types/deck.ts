import type { EnergyTier, ISODate, Timestamp } from './primitives';

/** Shared, server-curated cohort deck. One per (weekNumber, tier). */
export interface CohortDeck {
  id: string;
  weekNumber: number;
  weekStartDate: ISODate;
  tier: EnergyTier;
  recipeIds: string[];
  assetManifest: string[];
  generatedAt: Timestamp;
  version: number;
}

/** User's weekly Swipe Night deck. */
export interface WeeklyDeck {
  id: string;
  userId: string;
  weekStartDate: ISODate;
  tier: EnergyTier;
  state: 'generating' | 'ready' | 'expired' | 'failed';
  expiresAt: Timestamp;
  origin: 'cohort' | 'live-blend' | 'live-full';
  voiceContext?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DeckItem {
  id: string;
  deckId: string;
  recipeId: string;
  order: number;
  userChoice: 'swiped-in' | 'swiped-out' | 'tbd';
  decidedAt?: Timestamp;
  planDayLabel?: number;
}
