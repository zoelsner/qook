import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { EnergyTier, Recipe } from '@qook/shared';
import {
  addToBench as reduceAddBench,
  appendEncore as reduceAppendEncore,
  dealFreshHand,
  initDeck,
  keepAt as reduceKeep,
  passAt as reducePass,
  reconcileKept as reduceReconcile,
  setCookTonight as reduceSetCook,
  stageNextHand as reduceStageNext,
  type DeckState,
} from '../features/eat/deckState';
import { representativeTier, type ResetNight } from '../features/eat/weekReset';

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

  // Weekly reset (spec 2026-07-12). 'week' = entered from the Plan tab against
  // a set of tagged nights; 'tonight' = the single-night Tonight-tab flow.
  mode: 'tonight' | 'week';
  resetNights: ResetNight[];

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
  startWeekReset: (nights: ResetNight[]) => void;
  stageNextHand: (recipes: Recipe[]) => void;
  promoteNextHand: () => void;
  addToBench: (recipes: Recipe[]) => void;
  placeFromBench: (recipe: Recipe) => void;
  attachEncore: (recipe: Recipe) => void;
}

export const useGenerationSession = create<GenerationSessionState>()(
  persist(
    (set, get) => ({
      tier: null,
      context: '',
      state: 'idle',
      recipes: [],
      streamedTitles: [],
      error: null,
      deck: null,
      mode: 'tonight',
      resetNights: [],

      start: (tier) =>
        set({
          tier,
          context: '',
          state: 'collecting_context',
          recipes: [],
          streamedTitles: [],
          error: null,
          deck: null,
          mode: 'tonight',
          resetNights: [],
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
          mode: 'tonight',
          resetNights: [],
        }),

      setProposals: (recipes) =>
        set({ state: 'ready', error: null, deck: initDeck(recipes) }),
      deckKeep: () => set((s) => (s.deck ? { deck: reduceKeep(s.deck) } : s)),
      deckPass: () => set((s) => (s.deck ? { deck: reducePass(s.deck) } : s)),
      dealHand: (recipes) =>
        set((s) =>
          s.deck ? { deck: dealFreshHand(s.deck, recipes) } : { deck: initDeck(recipes) },
        ),
      setCookTonight: (id) =>
        set((s) => (s.deck ? { deck: reduceSetCook(s.deck, id) } : s)),
      reconcileKept: (oldId, recipe) =>
        set((s) => (s.deck ? { deck: reduceReconcile(s.deck, oldId, recipe) } : s)),

      // Enter the deck flow from the Plan tab: the tier chips already set energy, so
      // we skip the energy picker and drive one shared tier into generate-proposals.
      startWeekReset: (nights) =>
        set({
          mode: 'week',
          resetNights: nights,
          tier: representativeTier(nights),
          context: '',
          state: 'collecting_context',
          recipes: [],
          streamedTitles: [],
          error: null,
          deck: null,
        }),

      // Background prefetch stashed a hand — hold it until the swiper exhausts the
      // current one, then promote it into place (dealFreshHand keeps prior keeps).
      stageNextHand: (recipes) =>
        set((s) => (s.deck ? { deck: reduceStageNext(s.deck, recipes) } : s)),
      promoteNextHand: () =>
        set((s) =>
          s.deck && s.deck.nextHand ? { deck: dealFreshHand(s.deck, s.deck.nextHand) } : s,
        ),

      addToBench: (recipes) =>
        set((s) => (s.deck ? { deck: reduceAddBench(s.deck, recipes) } : s)),

      // Placing a bench card is free: push it into `kept` so the existing
      // allocation write path (appendRecipeAndSelect) handles the actual day write.
      placeFromBench: (recipe) =>
        set((s) => {
          if (!s.deck) return s;
          const kept = s.deck.kept.some((r) => r.id === recipe.id)
            ? s.deck.kept
            : [...s.deck.kept, recipe];
          return { deck: { ...s.deck, kept } };
        }),

      attachEncore: (recipe) =>
        set((s) => (s.deck ? { deck: reduceAppendEncore(s.deck, recipe) } : s)),
    }),
    {
      name: 'qook.generationSession.v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Only the reset-session slice survives a background/relaunch (spec
      // §1.1.10). The transient tonight-flow fields (state machine, streamed
      // titles, in-flight recipes, error) are intentionally NOT persisted.
      partialize: (state) => ({
        deck: state.deck,
        tier: state.tier,
        context: state.context,
        mode: state.mode,
        resetNights: state.resetNights,
      }),
    },
  ),
);
