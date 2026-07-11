import type { Recipe } from '@qook/shared';

// Pure "hand of 5" deck reducer. No RN/expo imports so it unit-tests under bun.
// kept accumulates ACROSS fresh hands (deal-a-fresh-hand keeps prior keeps),
// so allocation at the end covers everything the user liked this session.
export interface DeckState {
  proposals: Recipe[];
  position: number;
  kept: Recipe[];
  cookTonightId: string | null;
}

export function initDeck(proposals: Recipe[]): DeckState {
  return { proposals, position: 0, kept: [], cookTonightId: null };
}

export function focusedRecipe(state: DeckState): Recipe | null {
  return state.proposals[state.position] ?? null;
}

export function isExhausted(state: DeckState): boolean {
  return state.position >= state.proposals.length;
}

function dedupePush(kept: Recipe[], recipe: Recipe): Recipe[] {
  return kept.some((r) => r.id === recipe.id) ? kept : [...kept, recipe];
}

export function keepAt(state: DeckState): DeckState {
  const focused = focusedRecipe(state);
  if (!focused) return state;
  return {
    ...state,
    kept: dedupePush(state.kept, focused),
    position: state.position + 1,
  };
}

export function passAt(state: DeckState): DeckState {
  if (isExhausted(state)) return state;
  return { ...state, position: state.position + 1 };
}

export function dealFreshHand(state: DeckState, proposals: Recipe[]): DeckState {
  return { ...state, proposals, position: 0 };
}

export function setCookTonight(state: DeckState, id: string): DeckState {
  return { ...state, cookTonightId: id };
}

// After fill-recipe resolves, the kept card may have a NEW id (cache-hit
// redirect) and now carries the full body — swap it in so allocation writes the
// full recipe and points at the surviving row. Also repoints cookTonightId.
export function reconcileKept(
  state: DeckState,
  oldId: string,
  recipe: Recipe
): DeckState {
  return {
    ...state,
    kept: state.kept.map((r) => (r.id === oldId ? recipe : r)),
    cookTonightId: state.cookTonightId === oldId ? recipe.id : state.cookTonightId,
  };
}
