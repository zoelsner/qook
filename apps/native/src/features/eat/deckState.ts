import type { Recipe } from '@qook/shared';

// Pure deck reducer. No RN/expo imports so it unit-tests under bun.
// kept accumulates ACROSS fresh hands (deal-a-fresh-hand keeps prior keeps),
// so allocation at the end covers everything the user liked this session.
// passed + dealt accumulate the whole session: passed feeds the bench (Phase C)
// and the swipe summary; dealt is the exclude set fed to re-deals (Phase B).
export interface DeckState {
  proposals: Recipe[];
  position: number;
  kept: Recipe[];
  passed: Recipe[];
  dealt: { id: string; title: string }[];
  nextHand: Recipe[] | null;
  bench: Recipe[];
  cookTonightId: string | null;
}

function dealtEntries(recipes: Recipe[]): { id: string; title: string }[] {
  return recipes.map((r) => ({ id: r.id, title: r.title }));
}

export function initDeck(proposals: Recipe[]): DeckState {
  return {
    proposals,
    position: 0,
    kept: [],
    passed: [],
    dealt: dealtEntries(proposals),
    nextHand: null,
    bench: [],
    cookTonightId: null,
  };
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
  const focused = focusedRecipe(state);
  if (!focused) return state;
  return {
    ...state,
    passed: dedupePush(state.passed, focused),
    position: state.position + 1,
  };
}

// Deal a fresh hand: keep prior keeps/passes, append the new hand to the dealt
// exclude set, reset position, and clear any prefetched hand (it's now live).
export function dealFreshHand(state: DeckState, proposals: Recipe[]): DeckState {
  const newIds = new Set(state.dealt.map((d) => d.id));
  const appended = dealtEntries(proposals).filter((d) => !newIds.has(d.id));
  return {
    ...state,
    proposals,
    position: 0,
    dealt: [...state.dealt, ...appended],
    nextHand: null,
  };
}

// Stash a background-prefetched hand without revealing it yet (Phase B).
export function stageNextHand(state: DeckState, recipes: Recipe[]): DeckState {
  return { ...state, nextHand: recipes };
}

export function setCookTonight(state: DeckState, id: string): DeckState {
  return { ...state, cookTonightId: id };
}

// After fill-recipe resolves, the kept card may have a NEW id (cache-hit
// redirect) and now carries the full body — swap it in so allocation writes the
// full recipe and points at the surviving row. Also repoints cookTonightId.
export function reconcileKept(state: DeckState, oldId: string, recipe: Recipe): DeckState {
  return {
    ...state,
    kept: state.kept.map((r) => (r.id === oldId ? recipe : r)),
    cookTonightId: state.cookTonightId === oldId ? recipe.id : state.cookTonightId,
  };
}

// Compact record of this session's swipes for steering the next hand (Phase B).
export function swipeSummary(state: DeckState): {
  keptTitles: string[];
  keptCuisines: string[];
  passedCuisines: string[];
} {
  return {
    keptTitles: state.kept.map((r) => r.title),
    keptCuisines: [...new Set(state.kept.map((r) => r.cuisine))],
    passedCuisines: [...new Set(state.passed.map((r) => r.cuisine))],
  };
}

// Every title dealt this session — the dedup exclude set sent to re-deals.
export function sessionExcludeTitles(state: DeckState): string[] {
  return state.dealt.map((d) => d.title);
}

// Over-keeps land on the bench (spec §1.1.7). Dedup-append. Benched cards
// leave `kept` — AllocationScreen benches straight OUT of the keeps, and
// benchCards() excludes kept ids, so a card left in both would silently
// vanish from the day sheet.
export function addToBench(state: DeckState, recipes: Recipe[]): DeckState {
  let bench = state.bench;
  for (const r of recipes) bench = dedupePush(bench, r);
  const benchedIds = new Set(recipes.map((r) => r.id));
  return { ...state, bench, kept: state.kept.filter((r) => !benchedIds.has(r.id)) };
}

// The bench the day sheet shows: everything passed or over-kept this session,
// minus anything currently kept (a kept card isn't "leftovers"). Deduped by id.
export function benchCards(state: DeckState): Recipe[] {
  const keptIds = new Set(state.kept.map((r) => r.id));
  const out: Recipe[] = [];
  const seen = new Set<string>();
  for (const r of [...state.passed, ...state.bench]) {
    if (keptIds.has(r.id) || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}
