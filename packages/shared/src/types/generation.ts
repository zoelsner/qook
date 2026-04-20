import type { EnergyTier, Timestamp } from './primitives';

export type GenerationStatus =
  | 'idle'
  | 'collecting_context'
  | 'generating_text'
  | 'generating_images'
  | 'ready'
  | 'error';

export interface GenerationSession {
  id: string;
  userId: string;
  tier: EnergyTier;
  context?: string;
  requestedCount: number;
  status: GenerationStatus;
  errorMessage?: string;
  recipeIds: string[];
  startedAt: Timestamp;
  completedAt?: Timestamp;
}

export interface GenerationItem {
  id: string;
  sessionId: string;
  slotIndex: number;
  status: 'pending' | 'generating' | 'ready' | 'failed' | 'skipped';
  plannedCuisine?: string;
  plannedProtein?: string;
  recipeId?: string;
  errorMessage?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
