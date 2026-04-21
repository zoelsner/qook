import { create } from 'zustand';
import type { EnergyTier, Recipe } from '@qook/shared';

export type GenerationState =
  | 'idle'
  | 'collecting_context'
  | 'generating_text'
  | 'streaming_recipes'
  | 'ready'
  | 'error';

interface GenerationSessionState {
  tier: EnergyTier | null;
  context: string;
  state: GenerationState;
  recipes: Recipe[];
  error: string | null;

  start: (tier: EnergyTier) => void;
  setContext: (context: string) => void;
  beginGeneration: () => void;
  setStreaming: (recipes: Recipe[]) => void;
  finish: (recipes: Recipe[]) => void;
  fail: (message: string) => void;
  reset: () => void;
}

export const useGenerationSession = create<GenerationSessionState>((set) => ({
  tier: null,
  context: '',
  state: 'idle',
  recipes: [],
  error: null,

  start: (tier) =>
    set({
      tier,
      context: '',
      state: 'collecting_context',
      recipes: [],
      error: null,
    }),
  setContext: (context) => set({ context }),
  beginGeneration: () => set({ state: 'generating_text' }),
  setStreaming: (recipes) => set({ state: 'streaming_recipes', recipes }),
  finish: (recipes) => set({ state: 'ready', recipes, error: null }),
  fail: (message) => set({ state: 'error', error: message }),
  reset: () =>
    set({
      tier: null,
      context: '',
      state: 'idle',
      recipes: [],
      error: null,
    }),
}));
