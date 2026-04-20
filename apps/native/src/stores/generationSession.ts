import { create } from 'zustand';
import type { EnergyTier, Recipe } from '@qook/shared';

export type GenerationState =
  | 'idle'
  | 'generating_text'
  | 'streaming_recipes'
  | 'ready'
  | 'error';

interface GenerationSessionState {
  tier: EnergyTier | null;
  state: GenerationState;
  recipes: Recipe[];
  error: string | null;

  start: (tier: EnergyTier) => void;
  setStreaming: (recipes: Recipe[]) => void;
  finish: (recipes: Recipe[]) => void;
  fail: (message: string) => void;
  reset: () => void;
}

export const useGenerationSession = create<GenerationSessionState>((set) => ({
  tier: null,
  state: 'idle',
  recipes: [],
  error: null,

  start: (tier) => set({ tier, state: 'generating_text', recipes: [], error: null }),
  setStreaming: (recipes) => set({ state: 'streaming_recipes', recipes }),
  finish: (recipes) => set({ state: 'ready', recipes, error: null }),
  fail: (message) => set({ state: 'error', error: message }),
  reset: () => set({ tier: null, state: 'idle', recipes: [], error: null }),
}));
