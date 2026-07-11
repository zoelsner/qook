import { create } from 'zustand';
import type { EnergyTier, Recipe } from '@qook/shared';
import {
  dealFreshHand,
  initDeck,
  keepAt as reduceKeep,
  passAt as reducePass,
  reconcileKept as reduceReconcile,
  setCookTonight as reduceSetCook,
  type DeckState,
} from '../features/eat/deckState';

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
  streamedTitles: string[];
  error: string | null;

  // Swipe deck (spec 2026-07-10).
  deck: DeckState | null;

  start: (tier: EnergyTier) => void;
  setContext: (context: string) => void;
  beginGeneration: () => void;
  setStreaming: (recipes: Recipe[]) => void;
  pushTitle: (index: number, title: string) => void;
  finish: (recipes: Recipe[]) => void;
  fail: (message: string) => void;
  reset: () => void;

  setProposals: (recipes: Recipe[]) => void;
  deckKeep: () => void;
  deckPass: () => void;
  dealHand: (recipes: Recipe[]) => void;
  setCookTonight: (id: string) => void;
  reconcileKept: (oldId: string, recipe: Recipe) => void;
}

export const useGenerationSession = create<GenerationSessionState>((set) => ({
  tier: null,
  context: '',
  state: 'idle',
  recipes: [],
  streamedTitles: [],
  error: null,
  deck: null,

  start: (tier) =>
    set({
      tier,
      context: '',
      state: 'collecting_context',
      recipes: [],
      streamedTitles: [],
      error: null,
      deck: null,
    }),
  setContext: (context) => set({ context }),
  beginGeneration: () => set({ state: 'generating_text' }),
  setStreaming: (recipes) => set({ state: 'streaming_recipes', recipes }),
  pushTitle: (index, title) =>
    set((s) => {
      const next = s.streamedTitles.slice();
      next[index] = title;
      return { streamedTitles: next };
    }),
  finish: (recipes) => set({ state: 'ready', recipes, error: null }),
  fail: (message) => set({ state: 'error', error: message }),
  reset: () =>
    set({
      tier: null,
      context: '',
      state: 'idle',
      recipes: [],
      streamedTitles: [],
      error: null,
      deck: null,
    }),

  setProposals: (recipes) =>
    set({ state: 'ready', error: null, deck: initDeck(recipes) }),
  deckKeep: () => set((s) => (s.deck ? { deck: reduceKeep(s.deck) } : s)),
  deckPass: () => set((s) => (s.deck ? { deck: reducePass(s.deck) } : s)),
  dealHand: (recipes) =>
    set((s) => (s.deck ? { deck: dealFreshHand(s.deck, recipes) } : { deck: initDeck(recipes) })),
  setCookTonight: (id) =>
    set((s) => (s.deck ? { deck: reduceSetCook(s.deck, id) } : s)),
  reconcileKept: (oldId, recipe) =>
    set((s) => (s.deck ? { deck: reduceReconcile(s.deck, oldId, recipe) } : s)),
}));
