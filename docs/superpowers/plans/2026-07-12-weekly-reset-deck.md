# Weekly Reset Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the swipe deck THE weekly-planning flow — the Plan tab's "Plan my week" deals a hand the user swipes to fill the week's tagged nights — and retire the old silent per-night auto-draft loop.

**Architecture:** Reuse 100% of the shipped deck infrastructure (`DeckScreen`, `AllocationScreen`, `generate-proposals`, `fill-recipe`, `DealingHandLoader`, voice `ContextStep`, energy chips). The Plan tab routes into the existing `(eat)` deck flow, skipping the energy picker (energy is already set via per-night chips) and scoping allocation to the tagged nights. Four independently-shippable phases layer on top: (A) deck-as-reset + retire the loop, (B) progressive dealing + swipe-informed re-deal, (C) the bench (persisted passes/over-keeps + a per-day sheet), (D) encore cards. New decision logic (representative tier, prefetch trigger, re-deal context, over/under-keep allocation, encore eligibility) is extracted into pure, bun-testable modules per the shipped `deckState.ts` / `allocation.ts` / `imagePrefetch.ts` precedent.

**Tech Stack:** React Native / Expo 54 + Expo Router v6 (TypeScript, zustand + `persist`, TanStack Query, react-native-reanimated, react-native-gesture-handler — all already installed) in `apps/native`; Supabase Edge Functions on Deno in `supabase/functions`; OpenRouter text model via the `OR_TEXT_MODEL` secret. **No new dependencies** (YAGNI ladder stops at rung 2 — everything needed is already in the codebase).

## Global Constraints

Every task's requirements implicitly include this section.

**Binding product requirements (copied verbatim from the spec `docs/superpowers/specs/2026-07-12-weekly-reset-deck-design.md`):**
- **Hand size:** "Deal a hand of SIX cards: 5 fresh proposals from ONE `generate-proposals` call (1 quota unit) + 1 encore card." (§1.1.3) The encore is the 6th card and lands in Phase D; Phases A–C ship a plain hand of 5.
- **Encore threshold:** "Only appears when the user has **≥5 eligible history dishes**"; "At most **1 encore per hand** (hands are 5 fresh + 1 encore = 6 total)." (§1.3) "Below the 5-dish threshold, hands are **5 fresh cards only** — no degraded/placeholder encore slot, no error state." (§1.3)
- **Quota:** "Quota is charged at generation, server-side, exactly as today's deck (`generate-proposals` counts as 1 unit regardless of how many cards are later kept)." (§1.1.8)
- **Never auto-fill:** "The app never auto-fills a dish the user didn't choose." (§1.1.7, D6)
- **Bench lifetime:** "The bench clears when the next weekly reset begins (a fresh reset starts a fresh session store, discarding the prior week's bench)." (§1.2, D7) "Hearting a bench card saves it permanently via the existing saved-recipes system." (§1.2)
- **Price/cost badges are cut from v1:** "considered in the design exploration and cut by Zach." (§1.4, D8) Do NOT add any price/cost UI.
- **Chips are the tier source of truth:** "Per-night chips remain the structured source of truth (tier per night); voice only steers cuisine/mood within those tiers, never overrides a chip's tier." (§1.1.2, D4)
- **Allocation mismatches warn, never block:** "a tier mismatch **warns, never blocks** (the user can still place a 45-min card on a 15-min night)." (§1.1.7, D5)

**Operational constraints (carried from the 2026-07-10 swipe-deck plan — still in force):**
- **Client gates must stay green:** `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`. Run from `apps/native` (repo root has no scripts).
- **Client unit tests run under `bun test`** and MUST be pure-logic modules with **zero React Native / Expo imports** (bun's transpiler cannot parse RN's Flow entry point). Only these matchers are typed in `apps/native/bun-test.d.ts`: `toBe`, `toEqual`, `toBeUndefined`, and `.not`. Do not use `toContain`/`toBeNull`/`toBeTruthy` etc. Run one file with `cd apps/native && bun test src/path/to/file.test.ts`.
- **Edge-fn tests run under `deno test`** targeting the specific file. New edge pure helpers must be net-free (no `Deno.serve`, no `npm:` imports) so they test without `--allow-net`.
- **Never print or echo secrets.** Load DB/CLI secrets with `set -a; source ~/Projects/qook/.env.local; set +a` — never `cat`/`echo`/`print` them.
- **Supabase project ref is `eehjclffugngogbvctib` only.** Do NOT touch the old FTP project.
- **Edge deploys are Zach-gated.** Any task that changes an Edge Function's prompt or schema ENDS at "tests pass + `deno check` clean." Do NOT run `supabase functions deploy` — flag it in the commit body and stop; Zach deploys with his explicit consent.
- **No pushes to `origin`.** Commit locally only.
- **Do NOT commit** the plan file itself.
- **Stage commits by explicit path only** — never `git add -A`. The working tree may hold other sessions' edits (`apps/native/src/features/eat/ReviewRecipesScreen.tsx` is modified at plan time). Re-baseline against current file contents before editing.
- **DB row ↔ client mapping sync rule:** `supabase/functions/_shared/recipe-map.ts` and `apps/native/src/services/recipeRow.ts` change together in the same task. Never cast a raw snake_case row `as Recipe`. **This spec introduces no new DB columns and no new mapper fields** — every field it needs (`contentStatus`, `hook`, `proposalIngredients`, `proposalSteps`) already exists.
- **No emojis in UI** — color, typography, iconography only.
- **YAGNI ladder** (apply before writing any code): (1) does it need to exist? (2) already in the codebase? (3) stdlib? (4) existing dependency? (5) a one-liner? (6) only then, minimal new code.

## What already exists (do not rebuild)

- `generate-proposals` (1 quota unit, hand of 5, title cache + skeleton insert, hook backfill) and `fill-recipe` (quota-free, signature dedup) — **reused unmodified in Phases A & C; Phase B adds one additive prompt param.**
- `apps/native/src/features/eat/deckState.ts` — pure deck reducer (`initDeck`, `keepAt`, `passAt`, `dealFreshHand`, `reconcileKept`, `focusedRecipe`, `isExhausted`). This plan **extends** it (adds `passed`, `dealt`, `nextHand`, `encoreId`).
- `apps/native/src/features/eat/allocation.ts` — pure `allocationWrites`. Extended in Phase C.
- `apps/native/src/features/eat/imagePrefetch.ts` — pure `artIndicesToRequest` (the pattern Phase B's hand-prefetch trigger mirrors). Not changed.
- `apps/native/src/stores/generationSession.ts` — holds `deck: DeckState | null` + deck actions. Extended in every phase; persistence added in Phase C.
- `DeckScreen`, `AllocationScreen`, `ContextStep`, `EnergyPickerScreen`, `GenerationLoadingScreen`, `DealingHandLoader` — reused; copy/wiring edits only.
- `Recipe` already carries `contentStatus?`, `hook?`, `proposalIngredients?`, `proposalSteps?` (confirmed in `packages/shared/src/types/recipe.ts`). No shared-type change is needed by this spec.

## File Structure

**Phase A — new:**
- `apps/native/src/features/eat/weekReset.ts` + `weekReset.test.ts` — `ResetNight` type, `representativeTier`, `unfilledResetNights`, `TIER_MAX_MINUTES`.

**Phase A — modified:**
- `apps/native/src/stores/generationSession.ts` — add `mode`, `resetNights`, `startWeekReset`; `reset`/`start` clear them.
- `apps/native/src/features/eat/ContextStep.tsx` — copy branches on `mode`.
- `apps/native/src/features/eat/AllocationScreen.tsx` — week-mode day options (tagged nights), tier-mismatch warn, finish routes to Plan tab.
- `apps/native/src/features/week/WeekScreen.tsx` — "Plan my week" CTA into the reset flow; drop batch UI.
- `apps/native/src/features/week/DayRow.tsx` — drop `useBatchSession` `drafting` guard.

**Phase A — deleted:**
- `apps/native/src/features/week/batchDraft.ts`
- `apps/native/src/stores/batchSession.ts`

**Phase B — new:**
- `apps/native/src/features/eat/handPrefetch.ts` + `handPrefetch.test.ts` — `shouldPrefetchNextHand` trigger.
- `apps/native/src/features/eat/redealContext.ts` + `redealContext.test.ts` — `buildRedealContext` (swipe summary + exclude titles, ≤500 chars).

**Phase B — modified:**
- `apps/native/src/features/eat/deckState.ts` (+ `deckState.test.ts`) — record `passed`, accumulate `dealt`, stage `nextHand`; add `swipeSummary`/`sessionExcludeTitles` selectors.
- `apps/native/src/stores/generationSession.ts` — `stageNextHand`, `promoteNextHand` actions + prefetch flags.
- `apps/native/src/features/eat/DeckScreen.tsx` — background prefetch, silent retry, card-shaped "Deal again" state.
- `supabase/functions/_shared/prompts/proposals.ts` (+ `supabase/functions/_shared/proposals-schema.test.ts` or a new prompt test) — optional `energyMix` hint. **Deploy Zach-gated.**
- `supabase/functions/generate-proposals/index.ts` — accept optional `energyMix` in the request body, thread to prompt. **Deploy Zach-gated.**
- `apps/native/src/services/api.ts` — `generateProposals` accepts optional `energyMix`.

**Phase C — new:**
- `apps/native/src/features/week/DaySheet.tsx` — the bench bottom sheet.

**Phase C — modified:**
- `apps/native/src/features/eat/allocation.ts` (+ `allocation.test.ts`) — `allocateKeeps` over/under-keep mapping.
- `apps/native/src/features/eat/deckState.ts` (+ `deckState.test.ts`) — `bench` state + `addToBench`; JSON round-trip test.
- `apps/native/src/stores/generationSession.ts` — `persist` middleware (`qook.generationSession.v1`), `addToBench`, `placeFromBench`.
- `apps/native/src/features/eat/AllocationScreen.tsx` — route over-keeps to the bench.
- `apps/native/src/features/week/WeekScreen.tsx` + `DayRow.tsx` — day-tap opens `DaySheet`.

**Phase D — new:**
- `apps/native/src/features/eat/encore.ts` + `encore.test.ts` — `encoreCandidateId`, `ENCORE_THRESHOLD`.

**Phase D — modified:**
- `apps/native/src/stores/generationSession.ts` — attach an encore card as the 6th slot when eligible.
- `apps/native/src/features/eat/DeckScreen.tsx` — "FROM YOUR KITCHEN" kicker on the encore card.

---

# PHASE A — Deck as weekly reset

Independently shippable: today's deck UX, entered from the Plan tab instead of Tonight, feeding the week's tagged nights via one `AllocationScreen` pass. The old auto-draft loop is deleted.

## Task A1: `representativeTier` + reset-night helpers (pure)

**Files:**
- Create: `apps/native/src/features/eat/weekReset.ts`
- Test: `apps/native/src/features/eat/weekReset.test.ts`

**Interfaces:**
- Produces: `ResetNight { date: ISODate; tier: EnergyTier }`; `TIER_MAX_MINUTES: Record<EnergyTier, number>`; `representativeTier(nights: ResetNight[]): EnergyTier` (modal tier, tie → lowest max-minutes, empty → `'after-work'`); `unfilledResetNights(nights: ResetNight[], filledDates: ReadonlySet<string>): ResetNight[]` (drops filled dates, sorted ascending by date).
- Consumes: `ISODate` type from `../week/weekDates` (type-only, RN-free), `EnergyTier` from `@qook/shared` (type-only).

**Why a single representative tier:** the spec (§6) requires `generate-proposals` to be reused **unmodified** in Phase A, and that endpoint takes one `tier`. The hand-mix hint (§1.1.6) is Phase B. Tie-break to the lowest max-minutes because a quick dish placed on a high-energy night only "warns" gracefully, whereas the reverse over-caps low-energy nights.

- [ ] **Step 1: Write the failing test**

Create `apps/native/src/features/eat/weekReset.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import type { ISODate } from '../week/weekDates';
import { representativeTier, unfilledResetNights, type ResetNight } from './weekReset';

function night(date: string, tier: ResetNight['tier']): ResetNight {
  return { date: date as ISODate, tier };
}

describe('representativeTier', () => {
  test('empty nights default to after-work', () => {
    expect(representativeTier([])).toBe('after-work');
  });

  test('picks the modal tier', () => {
    const nights = [night('2026-07-13', 'after-work'), night('2026-07-14', 'after-work'), night('2026-07-15', 'got-energy')];
    expect(representativeTier(nights)).toBe('after-work');
  });

  test('breaks ties toward the lowest max-minutes tier', () => {
    const nights = [night('2026-07-13', 'got-energy'), night('2026-07-14', 'after-work')];
    expect(representativeTier(nights)).toBe('after-work');
  });

  test('a single night returns that night tier', () => {
    expect(representativeTier([night('2026-07-13', 'got-energy')])).toBe('got-energy');
  });
});

describe('unfilledResetNights', () => {
  test('drops filled dates and sorts ascending', () => {
    const nights = [night('2026-07-15', 'after-work'), night('2026-07-13', 'got-energy'), night('2026-07-14', 'after-work')];
    const filled = new Set(['2026-07-14']);
    expect(unfilledResetNights(nights, filled).map((n) => n.date)).toEqual(['2026-07-13', '2026-07-15']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/weekReset.test.ts`
Expected: FAIL — module `./weekReset` not found.

- [ ] **Step 3: Write the module**

Create `apps/native/src/features/eat/weekReset.ts`:

```ts
import type { EnergyTier } from '@qook/shared';
import type { ISODate } from '../week/weekDates';

// One tagged night the weekly reset will try to fill: its date + the tier the
// user set on the Plan tab chip. Pure — no RN imports, bun-testable.
export interface ResetNight {
  date: ISODate;
  tier: EnergyTier;
}

// Per-tier active-time ceiling, mirroring supabase _shared/tiers.ts TIER_RULES.
// Kept client-side (that module is Deno-only) so allocation + tier selection
// stay bun-pure. Single source of truth for both weekReset and allocation.
export const TIER_MAX_MINUTES: Record<EnergyTier, number> = {
  'brain-is-fried': 15,
  'after-work': 30,
  'got-energy': 45,
  'weekend-project': 180,
};

// Phase A only sends ONE tier to the (unmodified) generate-proposals endpoint.
// Pick the tier the most nights asked for; on a tie choose the lowest ceiling,
// since a quick dish on a high-energy night only warns, never over-caps.
export function representativeTier(nights: ResetNight[]): EnergyTier {
  if (nights.length === 0) return 'after-work';
  const counts = new Map<EnergyTier, number>();
  for (const n of nights) counts.set(n.tier, (counts.get(n.tier) ?? 0) + 1);
  let best: EnergyTier = 'after-work';
  let bestCount = -1;
  for (const [tier, count] of counts) {
    if (
      count > bestCount ||
      (count === bestCount && TIER_MAX_MINUTES[tier] < TIER_MAX_MINUTES[best])
    ) {
      best = tier;
      bestCount = count;
    }
  }
  return best;
}

// The nights the reset should still offer as allocation targets: those not yet
// carrying a committed recipe, sorted chronologically.
export function unfilledResetNights(
  nights: ResetNight[],
  filledDates: ReadonlySet<string>,
): ResetNight[] {
  return nights
    .filter((n) => !filledDates.has(n.date))
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/weekReset.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/weekReset.ts apps/native/src/features/eat/weekReset.test.ts && git commit -m "feat(week-reset): representative-tier + unfilled-night helpers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task A2: `generationSession` gains week-reset mode

**Files:**
- Modify: `apps/native/src/stores/generationSession.ts`

**Interfaces:**
- Consumes: `ResetNight`, `representativeTier` (Task A1).
- Produces: `useGenerationSession` gains `mode: 'tonight' | 'week'`, `resetNights: ResetNight[]`, `startWeekReset(nights: ResetNight[]): void`. `start` and `reset` set `mode: 'tonight'` + `resetNights: []`.

- [ ] **Step 1: Add imports + the two new state fields**

In `apps/native/src/stores/generationSession.ts`, extend the existing `deckState` import to also pull the reset helpers, and add the two fields + action to the interface. Change the import block near the top:

```ts
import {
  dealFreshHand,
  initDeck,
  keepAt as reduceKeep,
  passAt as reducePass,
  reconcileKept as reduceReconcile,
  setCookTonight as reduceSetCook,
  type DeckState,
} from '../features/eat/deckState';
import { representativeTier, type ResetNight } from '../features/eat/weekReset';
```

Then in `interface GenerationSessionState`, add these fields immediately after `deck: DeckState | null;`:

```ts
  // Swipe deck (spec 2026-07-10).
  deck: DeckState | null;

  // Weekly reset (spec 2026-07-12). 'week' = entered from the Plan tab against
  // a set of tagged nights; 'tonight' = the single-night Tonight-tab flow.
  mode: 'tonight' | 'week';
  resetNights: ResetNight[];
```

And add the action to the interface's action list, immediately after `reconcileKept: ...`:

```ts
  reconcileKept: (oldId: string, recipe: Recipe) => void;
  startWeekReset: (nights: ResetNight[]) => void;
```

- [ ] **Step 2: Seed the new fields + implement the action**

In the `create(...)` initializer object, add the initial values after `deck: null,`:

```ts
  deck: null,
  mode: 'tonight',
  resetNights: [],
```

In `start`, add the two fields to the `set({...})` payload (so a Tonight run always resets week context):

```ts
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
```

In `reset`, add the same two fields to its `set({...})` payload:

```ts
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
```

Add the `startWeekReset` implementation immediately after the `reconcileKept` action implementation (before the closing `}));`):

```ts
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
```

- [ ] **Step 3: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/stores/generationSession.ts && git commit -m "feat(week-reset): generationSession week mode + startWeekReset

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task A3: `ContextStep` copy branches on mode

**Files:**
- Modify: `apps/native/src/features/eat/ContextStep.tsx`

**Interfaces:**
- Consumes: `mode` from `useGenerationSession` (Task A2).
- Produces: no new exports — same route, reworded for the weekly framing when `mode === 'week'` (asks about the week's energy alongside cravings, per §1.1.2).

**Note on the char cap:** the spec (§1.1.2) refers to a "500-char cap via `MAX_CHARS`", but this file's `MAX_CHARS` is currently `240` (the server caps `context` at 500 independently). This task does NOT change `MAX_CHARS` — only copy. See the report's open-questions note.

- [ ] **Step 1: Read `mode` in the component**

In `apps/native/src/features/eat/ContextStep.tsx`, add a `mode` selector alongside the existing store reads (immediately after the `const tier = useGenerationSession((s) => s.tier);` line):

```ts
  const tier = useGenerationSession((s) => s.tier);
  const mode = useGenerationSession((s) => s.mode);
```

- [ ] **Step 2: Branch the on-screen copy**

Still in `ContextStep.tsx`, replace the kicker `Mono`, the headline `DisplayText`, and the intro `BodyText` (the block currently rendering `step 2 of 2 · optional`, `Anything specific?`, and the "Tell us what you're in the mood for…" paragraph) with mode-aware copy. Change:

```tsx
              <Mono size={10} bold color={palette.accentDeep}>
                step 2 of 2 · optional
              </Mono>
              <View style={{ height: 6 }} />
              <DisplayText
                size={34}
                color={palette.primary}
                style={styles.headline}
              >
                Anything <RNText style={styles.titleItalic}>specific?</RNText>
              </DisplayText>

              <View style={{ height: spacing.md }} />
              <BodyText
                size={typeScale.bodyLG}
                color={palette.textSecondary}
                weight="medium"
              >
                Tell us what you&rsquo;re in the mood for, what&rsquo;s already
                in the fridge, or nothing at all. We&rsquo;ll tune the drafts.
              </BodyText>
```

to:

```tsx
              <Mono size={10} bold color={palette.accentDeep}>
                {mode === 'week' ? 'weekly reset · optional' : 'step 2 of 2 · optional'}
              </Mono>
              <View style={{ height: 6 }} />
              <DisplayText
                size={34}
                color={palette.primary}
                style={styles.headline}
              >
                {mode === 'week' ? (
                  <>
                    How&rsquo;s your <RNText style={styles.titleItalic}>week?</RNText>
                  </>
                ) : (
                  <>
                    Anything <RNText style={styles.titleItalic}>specific?</RNText>
                  </>
                )}
              </DisplayText>

              <View style={{ height: spacing.md }} />
              <BodyText
                size={typeScale.bodyLG}
                color={palette.textSecondary}
                weight="medium"
              >
                {mode === 'week'
                  ? "Tired nights, busy stretches, anything you're craving — tell us and we'll steer the hand. Or skip it."
                  : "Tell us what you're in the mood for, what's already in the fridge, or nothing at all. We'll tune the drafts."}
              </BodyText>
```

- [ ] **Step 3: Branch the primary CTA label**

Still in `ContextStep.tsx`, the primary `PolishedButton` label currently reads `trimmed.length > 0 ? 'Use this, find dinner' : "Find tonight's dinner"`. Replace that `label` expression with:

```tsx
                label={
                  mode === 'week'
                    ? trimmed.length > 0
                      ? 'Use this, plan my week'
                      : 'Plan my week'
                    : trimmed.length > 0
                      ? 'Use this, find dinner'
                      : "Find tonight's dinner"
                }
```

- [ ] **Step 4: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/ContextStep.tsx && git commit -m "feat(week-reset): weekly voice-context framing on the context step

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task A4: `AllocationScreen` scopes to the tagged nights + warns on tier mismatch

**Files:**
- Modify: `apps/native/src/features/eat/allocation.ts`
- Modify: `apps/native/src/features/eat/allocation.test.ts`
- Modify: `apps/native/src/features/eat/AllocationScreen.tsx`

**Interfaces:**
- Produces (pure): `tierMismatch(cardMinutes: number, nightTier: EnergyTier): boolean` — true when the card's time exceeds the night's ceiling.
- Consumes: `TIER_MAX_MINUTES` (Task A1), `mode` + `resetNights` (Task A2).
- Behavior: in `mode === 'week'` the day chips are the reset's unfilled tagged nights (labeled with weekday + tier); a chip whose tier ceiling is shorter than the card's time renders a subtle "over" warning but stays selectable; `finish()` routes back to `/(tabs)/week`. In `mode === 'tonight'` the screen is unchanged.

- [ ] **Step 1: Write the failing pure test**

In `apps/native/src/features/eat/allocation.test.ts`, add these cases (append inside the existing top-level `describe` or as a new one; import `tierMismatch`):

```ts
import { tierMismatch } from './allocation';

describe('tierMismatch', () => {
  test('a 45-min card on a 15-min night is a mismatch', () => {
    expect(tierMismatch(45, 'brain-is-fried')).toBe(true);
  });
  test('a 15-min card on a 45-min night is fine', () => {
    expect(tierMismatch(15, 'got-energy')).toBe(false);
  });
  test('a card exactly at the ceiling is fine', () => {
    expect(tierMismatch(30, 'after-work')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/allocation.test.ts`
Expected: FAIL — `tierMismatch` is not exported.

- [ ] **Step 3: Add `tierMismatch` to `allocation.ts`**

In `apps/native/src/features/eat/allocation.ts`, add the import and the helper (append after the existing `allocationWrites` function):

```ts
import type { EnergyTier, Recipe } from '@qook/shared';
import type { ISODate } from '../week/weekDates';
import { TIER_MAX_MINUTES } from './weekReset';
```

(Only add `EnergyTier` + the `TIER_MAX_MINUTES` import to the existing import lines — `Recipe` and `ISODate` are already imported.)

```ts
// A keep placed on a night whose tier ceiling is shorter than the dish's time
// is a soft mismatch: the UI warns but never blocks (spec D5).
export function tierMismatch(cardMinutes: number, nightTier: EnergyTier): boolean {
  return cardMinutes > TIER_MAX_MINUTES[nightTier];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/allocation.test.ts`
Expected: PASS — new + existing cases green.

- [ ] **Step 5: Make the allocation day chips reflect week mode**

In `apps/native/src/features/eat/AllocationScreen.tsx`:

Add the imports (extend the existing lines):

```ts
import { allocationWrites, tierMismatch } from './allocation';
import { unfilledResetNights } from './weekReset';
import { activePickFor, useWeekPlan } from '../../stores/weekPlan';
```

(`allocationWrites` and `useWeekPlan` are already imported — add `tierMismatch`, `unfilledResetNights`, and `activePickFor`.)

Read `mode`, `resetNights`, and the plan inside the component (after the existing `const deck = useGenerationSession((s) => s.deck);` line):

```ts
  const deck = useGenerationSession((s) => s.deck);
  const mode = useGenerationSession((s) => s.mode);
  const resetNights = useGenerationSession((s) => s.resetNights);
  const plan = useWeekPlan((s) => s.plan);
```

Replace the `const days = useMemo(dayOptions, []);` line with a mode-aware day list. In week mode the chips are the unfilled tagged nights (weekday label + tier carried through for the mismatch warning); in tonight mode it's the existing 7-day list:

```ts
  const days = useMemo(() => {
    if (mode !== 'week') {
      return dayOptions().map((d) => ({ ...d, tier: undefined as EnergyTier | undefined }));
    }
    const filled = new Set(
      Object.keys(plan).filter((date) => activePickFor(plan[date as ISODate]) != null),
    );
    return unfilledResetNights(resetNights, filled).map((n) => ({
      date: n.date,
      label: n.date === todayISO() ? 'Tonight' : WEEKDAY[new Date(`${n.date}T00:00:00`).getDay()],
      tier: n.tier as EnergyTier | undefined,
    }));
  }, [mode, resetNights, plan]);
```

Add the `EnergyTier` type import to the `@qook/shared` import line at the top:

```ts
import type { EnergyTier, Recipe } from '@qook/shared';
```

- [ ] **Step 6: Pass the tier down + warn on mismatch, and route home by mode**

Still in `AllocationScreen.tsx`:

Widen the `days` prop type on `AllocationRow` and pass the card's minutes down. Change the `AllocationRow` invocation inside the `kept.map(...)`:

```tsx
        {kept.map((r, i) => (
          <AllocationRow
            key={`${r.id}-${i}`}
            recipe={r}
            days={days}
            selected={choices[i] ?? null}
            onSelect={(d) => setDay(i, d)}
          />
        ))}
```

Update the `AllocationRow` signature + chip rendering to accept the tier and show an "over" marker when the card's time exceeds the chip's tier ceiling:

```tsx
function AllocationRow({
  recipe,
  days,
  selected,
  onSelect,
}: {
  recipe: Recipe;
  days: { date: ISODate; label: string; tier?: EnergyTier }[];
  selected: ISODate | null;
  onSelect: (date: ISODate) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Vignette
          size={44}
          localKey={recipe.localImageKey as SeedMealKey | undefined}
          remoteUrl={recipe.heroImageUrl}
          imageStatus={recipe.imageStatus}
          title={recipe.title}
        />
        <DisplayText size={16} color={palette.ink} numberOfLines={2} style={styles.rowTitle}>
          {recipe.title}
        </DisplayText>
      </View>
      <View style={styles.chipRow}>
        {days.map((d) => {
          const active = selected === d.date;
          const over = d.tier ? tierMismatch(recipe.timeMinutes, d.tier) : false;
          return (
            <Pressable
              key={d.date}
              onPress={() => onSelect(d.date)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active ? styles.chipActive : null, over && !active ? styles.chipOver : null]}
            >
              <Mono size={10} bold color={active ? palette.surface : over ? palette.utility : palette.textSecondary}>
                {over ? `${d.label} · over` : d.label}
              </Mono>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```

Add the `chipOver` style to the `StyleSheet.create({...})` block (after `chipActive`):

```ts
  chipOver: {
    borderColor: palette.utility,
  },
```

In `finish()`, replace the trailing `router.replace('/(tabs)/tonight')` (the one in the `else` branch after `if (cooked)`) so a weekly reset returns to the Plan tab:

```ts
    reset();
    if (cooked) {
      router.replace({ pathname: '/(modals)/recipe/[id]', params: { id: cooked } });
    } else {
      router.replace(mode === 'week' ? '/(tabs)/week' : '/(tabs)/tonight');
    }
```

And in `skipAll()`, likewise route by mode:

```ts
  const skipAll = () => {
    press();
    reset();
    router.replace(mode === 'week' ? '/(tabs)/week' : '/(tabs)/tonight');
  };
```

- [ ] **Step 7: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/allocation.ts apps/native/src/features/eat/allocation.test.ts apps/native/src/features/eat/AllocationScreen.tsx && git commit -m "feat(week-reset): allocate keeps onto tagged nights, warn on tier mismatch

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task A5: "Plan my week" CTA + retire the auto-draft loop

**Files:**
- Modify: `apps/native/src/features/week/WeekScreen.tsx`
- Modify: `apps/native/src/features/week/DayRow.tsx`
- Delete: `apps/native/src/features/week/batchDraft.ts`
- Delete: `apps/native/src/stores/batchSession.ts`

**Interfaces:**
- Consumes: `startWeekReset` (Task A2), `taggedFutureOrTodayDays` (existing), `plan[date].energy` for each tagged night.
- Behavior: the Plan-tab CTA gathers `{ date, tier }` for every tagged night and enters the reset flow (`startWeekReset` → push `/(eat)/context`). All `batchDraft`/`useBatchSession` state and UI are removed.

**Retirement note:** `api.generateRecipesForEnergy` (the client binding to the still-deployed `generate-recipe` endpoint) becomes unreferenced after this task. Per spec §1.5 the endpoint is intentionally left deployed; leave the client binding in place too (do NOT delete it) — confirm-zero-callers-then-remove is a separate future change.

- [ ] **Step 1: Rewrite `WeekScreen` to enter the deck flow**

Replace `apps/native/src/features/week/WeekScreen.tsx` entirely with:

```tsx
import { ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PolishedButton } from '../../components/PolishedButton';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { ScreenShell } from '../../components/ScreenShell';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { palette, screen, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { useGenerationSession } from '../../stores/generationSession';
import { taggedFutureOrTodayDays, useWeekPlan } from '../../stores/weekPlan';
import type { ResetNight } from '../eat/weekReset';
import { DayRow } from './DayRow';
import { formatDayShort, upcomingDays, todayISO } from './weekDates';

export function WeekScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { press, tap } = useHaptics();
  const plan = useWeekPlan((state) => state.plan);
  const hasHydrated = useWeekPlan((state) => state.hasHydrated);
  const clearFuture = useWeekPlan((state) => state.clearFuture);
  const startWeekReset = useGenerationSession((state) => state.startWeekReset);

  const today = todayISO();
  const days = upcomingDays(7, today);
  const tagged = taggedFutureOrTodayDays(plan, today);

  const first = formatDayShort(days[0]);
  const last = formatDayShort(days[days.length - 1]);
  const rangeKicker = `${first.month} ${first.day} — ${last.month} ${last.day}`;

  const onPlanWeek = () => {
    if (!hasHydrated || tagged.length === 0) return;
    press();
    const nights: ResetNight[] = tagged
      .map((date) => {
        const tier = plan[date]?.energy;
        return tier ? { date, tier } : null;
      })
      .filter((n): n is ResetNight => n !== null);
    if (nights.length === 0) return;
    startWeekReset(nights);
    router.push('/(eat)/context');
  };

  const onOpenRecipe = (recipeId: string) => {
    press();
    router.push({ pathname: '/(modals)/recipe/[id]', params: { id: recipeId } });
  };

  const onClearFuture = () => {
    tap();
    clearFuture();
  };

  return (
    <ScreenShell horizontalPadding={24} scrollable={false}>
      <View style={styles.header}>
        <View style={styles.kickerRow}>
          <Mono size={10} bold color={palette.accentDeep}>
            PLAN
          </Mono>
          <View style={styles.kickerDot} />
          <Mono size={10} color={palette.textSecondary}>
            {rangeKicker}
          </Mono>
        </View>
        <View style={styles.titleWrap}>
          <DisplayText size={38} color={palette.primary} style={styles.title}>
            This week.
          </DisplayText>
          <BrushstrokeUnderline
            width={200}
            color={palette.accent}
            strokeWidth={2.4}
            style={styles.displayUnderline}
          />
        </View>
      </View>

      <View style={{ height: spacing.md }} />
      <BodyText size={15} color={palette.textSecondary} weight="medium">
        Tap a time on the nights you&apos;ll cook. Scroll for the rest.
      </BodyText>

      <View style={{ height: spacing.lg }} />

      <View style={styles.pinnedToday}>
        <DayRow date={days[0]} onOpenRecipe={onOpenRecipe} />
      </View>

      <View style={styles.card}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 4 }}
        >
          {days.slice(1).map((date) => (
            <DayRow key={date} date={date} onOpenRecipe={onOpenRecipe} />
          ))}
        </ScrollView>
      </View>

      <View style={{ height: spacing.sm }} />

      <View style={styles.summary}>
        <View style={styles.summaryLeft}>
          <Mono size={10} bold color={palette.primary}>
            {tagged.length} {tagged.length === 1 ? 'NIGHT' : 'NIGHTS'} SET
          </Mono>
          <View style={styles.kickerDot} />
          <Mono size={10} color={palette.textSecondary}>
            scroll for more
          </Mono>
        </View>
        <Pressable hitSlop={6} onPress={onClearFuture}>
          <BodyText size={12} weight="medium" color={palette.accentDeep}>
            Clear upcoming
          </BodyText>
        </Pressable>
      </View>

      <View style={{ height: spacing.sm }} />

      {!hasHydrated ? (
        <PolishedButton label="Loading..." tone="forest" onPress={() => undefined} disabled />
      ) : (
        <PolishedButton
          label={tagged.length === 0 ? 'Tag a night to start' : 'Plan my week'}
          tone="forest"
          onPress={onPlanWeek}
          disabled={tagged.length === 0}
          trailingIcon={
            tagged.length > 0 ? <ArrowRight size={14} color={palette.surface} /> : undefined
          }
        />
      )}

      <View style={{ height: spacing.xs + 2 }} />
      <BodyText
        size={11}
        weight="medium"
        color={palette.textTertiary}
        style={{ textAlign: 'center' }}
      >
        Swipe a hand of ideas, place your keeps
      </BodyText>

      <View style={{ height: insets.bottom + screen.tabBarHeight + spacing.sm }} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 6,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kickerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.textSecondary,
  },
  titleWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  title: {
    letterSpacing: -1.2,
    lineHeight: 42,
  },
  displayUnderline: {
    position: 'absolute',
    left: -6,
    bottom: -8,
  },
  pinnedToday: {
    paddingHorizontal: 18,
  },
  card: {
    flex: 1,
    borderRadius: 22,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
```

- [ ] **Step 2: Drop the batch guard from `DayRow`**

In `apps/native/src/features/week/DayRow.tsx`, remove the `useBatchSession` import line:

```ts
import { useBatchSession } from '../../stores/batchSession';
```

Remove the `drafting` selector + its comment block:

```ts
  // Guard: while a batch draft is in flight, ignore chip mutations — otherwise
  // an in-flight response can repopulate a day the user just cleared or
  // retarget a tier the user just changed (Codex adversarial finding #2).
  const drafting = useBatchSession((s) => s.status === 'drafting');
```

And in `onChipPress`, remove the guard line `if (drafting) return;` (the first line of that function). The chip logic now runs unconditionally.

- [ ] **Step 3: Delete the retired modules**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git rm apps/native/src/features/week/batchDraft.ts apps/native/src/stores/batchSession.ts
```

Expected: git stages both deletions.

- [ ] **Step 4: Confirm no dangling references**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && grep -rn "batchDraft\|batchSession\|useBatchSession" src app`
Expected: NO output (zero matches). If anything prints, remove that reference before proceeding.

- [ ] **Step 5: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/week/WeekScreen.tsx apps/native/src/features/week/DayRow.tsx apps/native/src/features/week/batchDraft.ts apps/native/src/stores/batchSession.ts && git commit -m "feat(week-reset): Plan my week enters the deck flow; retire the auto-draft loop

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

**Phase A ships here.** The Plan tab now: tag nights → "Plan my week" → voice context → dealt hand → swipe → place keeps on the tagged nights → back to Plan. One quota unit for the hand. The old 5-unit silent loop is gone.

---

# PHASE B — Progressive dealing + swipe-informed re-deal

Background-prefetch the next hand at 2-cards-remaining while unfilled nights remain; steer re-deals away from what the user passed; silent retry + a card-shaped "Deal again" error state.

## Task B1: `shouldPrefetchNextHand` trigger (pure)

**Files:**
- Create: `apps/native/src/features/eat/handPrefetch.ts`
- Test: `apps/native/src/features/eat/handPrefetch.test.ts`

**Interfaces:**
- Produces: `PREFETCH_THRESHOLD = 2`; `shouldPrefetchNextHand(args: { position: number; handSize: number; unfilledNights: number; prefetchInFlight: boolean; nextHandReady: boolean }): boolean`.

- [ ] **Step 1: Write the failing test**

Create `apps/native/src/features/eat/handPrefetch.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { shouldPrefetchNextHand } from './handPrefetch';

const base = { position: 3, handSize: 5, unfilledNights: 2, prefetchInFlight: false, nextHandReady: false };

describe('shouldPrefetchNextHand', () => {
  test('fires at exactly two cards from the end', () => {
    expect(shouldPrefetchNextHand({ ...base, position: 3 })).toBe(true);
  });
  test('does not fire three cards from the end', () => {
    expect(shouldPrefetchNextHand({ ...base, position: 2 })).toBe(false);
  });
  test('does not fire when no unfilled nights remain', () => {
    expect(shouldPrefetchNextHand({ ...base, unfilledNights: 0 })).toBe(false);
  });
  test('does not double-fire while a prefetch is in flight', () => {
    expect(shouldPrefetchNextHand({ ...base, prefetchInFlight: true })).toBe(false);
  });
  test('does not fire when the next hand is already ready', () => {
    expect(shouldPrefetchNextHand({ ...base, nextHandReady: true })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/handPrefetch.test.ts`
Expected: FAIL — module `./handPrefetch` not found.

- [ ] **Step 3: Write the module**

Create `apps/native/src/features/eat/handPrefetch.ts`:

```ts
// When to kick off a background generate-proposals for the NEXT hand. Mirrors
// imagePrefetch.ts's "stay ahead of the swiper" idea, but keyed on the hand
// rather than art: fire once the swiper is within PREFETCH_THRESHOLD cards of
// the end AND unfilled nights still justify another hand AND nothing is already
// in flight or waiting. Pure — no RN imports, bun-testable.
export const PREFETCH_THRESHOLD = 2;

export function shouldPrefetchNextHand(args: {
  position: number;
  handSize: number;
  unfilledNights: number;
  prefetchInFlight: boolean;
  nextHandReady: boolean;
}): boolean {
  const { position, handSize, unfilledNights, prefetchInFlight, nextHandReady } = args;
  if (unfilledNights <= 0) return false;
  if (prefetchInFlight || nextHandReady) return false;
  return position >= handSize - PREFETCH_THRESHOLD;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/handPrefetch.test.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/handPrefetch.ts apps/native/src/features/eat/handPrefetch.test.ts && git commit -m "feat(deck): pure next-hand prefetch trigger

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task B2: `deckState` records passes + accumulates the session set

**Files:**
- Modify: `apps/native/src/features/eat/deckState.ts`
- Modify: `apps/native/src/features/eat/deckState.test.ts`

**Interfaces:**
- Produces: `DeckState` gains `passed: Recipe[]`, `dealt: { id: string; title: string }[]`, `nextHand: Recipe[] | null`; `passAt` records the passed recipe; `initDeck`/`dealFreshHand` accumulate `dealt`; new `stageNextHand(state, recipes)`, `swipeSummary(state): { keptTitles; keptCuisines; passedCuisines }`, `sessionExcludeTitles(state): string[]`.
- **Backward-compat:** existing callers of `initDeck`/`keepAt`/`passAt`/`dealFreshHand`/`reconcileKept` keep working; new fields are additive.

- [ ] **Step 1: Extend the failing test**

In `apps/native/src/features/eat/deckState.test.ts`, add these cases (import the new symbols; keep the existing `r`/`HAND` helpers):

```ts
import {
  dealFreshHand,
  focusedRecipe,
  initDeck,
  isExhausted,
  keepAt,
  passAt,
  reconcileKept,
  sessionExcludeTitles,
  stageNextHand,
  swipeSummary,
} from './deckState';

function rc(id: string, cuisine: string): Recipe {
  return { id, title: `Dish ${id}`, cuisine } as Recipe;
}

describe('deckState session tracking', () => {
  test('passAt records the passed recipe', () => {
    const s = passAt(initDeck(HAND));
    expect(s.passed.map((x) => x.id)).toEqual(['a']);
  });

  test('initDeck seeds the dealt set from the hand', () => {
    const s = initDeck([rc('a', 'Thai'), rc('b', 'Italian')]);
    expect(s.dealt.map((d) => d.id)).toEqual(['a', 'b']);
  });

  test('dealFreshHand appends the new hand to the dealt set', () => {
    let s = initDeck([rc('a', 'Thai')]);
    s = dealFreshHand(s, [rc('b', 'Italian')]);
    expect(s.dealt.map((d) => d.id)).toEqual(['a', 'b']);
  });

  test('swipeSummary reports kept + passed cuisines', () => {
    let s = initDeck([rc('a', 'Thai'), rc('b', 'Italian')]);
    s = keepAt(s); // keep a (Thai)
    s = passAt(s); // pass b (Italian)
    const sum = swipeSummary(s);
    expect(sum.keptCuisines).toEqual(['Thai']);
    expect(sum.passedCuisines).toEqual(['Italian']);
  });

  test('sessionExcludeTitles lists every dealt title', () => {
    const s = initDeck([rc('a', 'Thai'), rc('b', 'Italian')]);
    expect(sessionExcludeTitles(s)).toEqual(['Dish a', 'Dish b']);
  });

  test('stageNextHand stashes the prefetched hand', () => {
    const s = stageNextHand(initDeck(HAND), [rc('z', 'Thai')]);
    expect(s.nextHand?.map((x) => x.id)).toEqual(['z']);
  });

  test('dealFreshHand clears any staged next hand', () => {
    let s = stageNextHand(initDeck(HAND), [rc('z', 'Thai')]);
    s = dealFreshHand(s, [rc('z', 'Thai')]);
    expect(s.nextHand).toBe(null);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/deckState.test.ts`
Expected: FAIL — `sessionExcludeTitles`/`stageNextHand`/`swipeSummary` not exported and `passed`/`dealt`/`nextHand` missing.

- [ ] **Step 3: Extend `deckState.ts`**

Rewrite `apps/native/src/features/eat/deckState.ts` to add the fields + selectors (keeps every existing function name + signature):

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/deckState.test.ts`
Expected: PASS — new + existing cases green.

- [ ] **Step 5: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/deckState.ts apps/native/src/features/eat/deckState.test.ts && git commit -m "feat(deck): record passes + accumulate the session exclude set

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task B3: `buildRedealContext` (pure)

**Files:**
- Create: `apps/native/src/features/eat/redealContext.ts`
- Test: `apps/native/src/features/eat/redealContext.test.ts`

**Interfaces:**
- Produces: `REDEAL_CONTEXT_MAX = 500`; `buildRedealContext(input: { voiceContext: string; summary: { keptTitles: string[]; keptCuisines: string[]; passedCuisines: string[] }; excludeTitles: string[] }): string`. Titles-only, voice context first, total ≤ 500 chars (the server's `context` ceiling).

- [ ] **Step 1: Write the failing test**

Create `apps/native/src/features/eat/redealContext.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { buildRedealContext, REDEAL_CONTEXT_MAX } from './redealContext';

describe('buildRedealContext', () => {
  test('leads with the voice context and appends swipe steering', () => {
    const out = buildRedealContext({
      voiceContext: 'tired, craving spicy',
      summary: { keptTitles: ['Larb'], keptCuisines: ['Thai'], passedCuisines: ['Italian'] },
      excludeTitles: ['Larb', 'Cacio e Pepe'],
    });
    expect(out.startsWith('tired, craving spicy')).toBe(true);
    expect(out.length <= REDEAL_CONTEXT_MAX).toBe(true);
  });

  test('empty voice context still produces steering under the cap', () => {
    const out = buildRedealContext({
      voiceContext: '',
      summary: { keptTitles: [], keptCuisines: [], passedCuisines: ['Italian'] },
      excludeTitles: ['Cacio e Pepe'],
    });
    expect(out.length <= REDEAL_CONTEXT_MAX).toBe(true);
    expect(out.length > 0).toBe(true);
  });

  test('caps at 500 chars, preserving the voice context', () => {
    const voice = 'a'.repeat(200);
    const out = buildRedealContext({
      voiceContext: voice,
      summary: { keptTitles: [], keptCuisines: [], passedCuisines: [] },
      excludeTitles: Array.from({ length: 100 }, (_, i) => `Very Long Dish Title Number ${i}`),
    });
    expect(out.length <= REDEAL_CONTEXT_MAX).toBe(true);
    expect(out.startsWith(voice)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/redealContext.test.ts`
Expected: FAIL — module `./redealContext` not found.

- [ ] **Step 3: Write the module**

Create `apps/native/src/features/eat/redealContext.ts`:

```ts
// Build the context string for a re-dealt hand: the user's voice context, a
// compact swipe summary (kept/passed by cuisine — steers toward keeps, away
// from passes), and an exclusion list of titles already dealt this session.
// TITLES ONLY, never full recipes (token-cheap, spec §1.1.5/§1.1.9). Voice
// context leads and is never truncated; steering + exclusions are trimmed to
// fit the server's 500-char `context` ceiling. Pure — bun-testable.
export const REDEAL_CONTEXT_MAX = 500;

export function buildRedealContext(input: {
  voiceContext: string;
  summary: { keptTitles: string[]; keptCuisines: string[]; passedCuisines: string[] };
  excludeTitles: string[];
}): string {
  const { voiceContext, summary, excludeTitles } = input;
  const head = voiceContext.trim();

  const steer: string[] = [];
  if (summary.keptCuisines.length) steer.push(`More like: ${summary.keptCuisines.join(', ')}.`);
  if (summary.passedCuisines.length) steer.push(`Avoid more: ${summary.passedCuisines.join(', ')}.`);

  const parts: string[] = [];
  if (head) parts.push(head);
  if (steer.length) parts.push(steer.join(' '));

  // Add exclusion titles greedily until we'd exceed the cap.
  const prefix = parts.join('\n\n');
  const excludeLead = "Don't repeat these dishes: ";
  const kept: string[] = [];
  let running = prefix.length + (prefix ? 2 : 0) + excludeLead.length; // +2 for the joining "\n\n"
  for (const title of excludeTitles) {
    const add = (kept.length ? 2 : 0) + title.length; // ", " separator
    if (running + add + 1 > REDEAL_CONTEXT_MAX) break; // +1 for trailing "."
    kept.push(title);
    running += add;
  }
  if (kept.length) parts.push(`${excludeLead}${kept.join(', ')}.`);

  return parts.join('\n\n').slice(0, REDEAL_CONTEXT_MAX);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/redealContext.test.ts`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/redealContext.ts apps/native/src/features/eat/redealContext.test.ts && git commit -m "feat(deck): compact swipe-summary + exclude-title re-deal context

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task B4: Edge — optional `energyMix` hand-mix hint (Zach-gated deploy)

**Files:**
- Modify: `supabase/functions/_shared/prompts/proposals.ts`
- Create: `supabase/functions/_shared/proposals-prompt.test.ts`
- Modify: `supabase/functions/generate-proposals/index.ts`

**Interfaces:**
- Produces: `buildProposalsUserPrompt(ctx, energyMix?)` — when `energyMix` is a non-empty string, the user prompt includes a prose tier-mix hint; the `ProposalsEnvelopeJsonSchema` (per-card `timeMinutes`/`proteinG` ceilings) is unchanged.
- Consumes (endpoint): optional `energyMix: string` in the request body, forwarded to the prompt builder.

**DEPLOY IS ZACH-GATED.** This task ends at `deno test` + `deno check` passing. Do NOT run `supabase functions deploy`.

- [ ] **Step 1: Write the failing prompt-builder test**

Create `supabase/functions/_shared/proposals-prompt.test.ts`:

```ts
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildProposalsUserPrompt } from "./prompts/proposals.ts";
import { ProposalsEnvelopeJsonSchema } from "./schema.ts";

const ctx = {
  tier: "after-work" as const,
  householdSize: 2,
  avoidIngredients: [] as string[],
  lovedCuisines: [] as string[],
  voiceContext: "",
  kitchenTools: [] as string[],
};

Deno.test("hand-mix hint appears when energyMix is provided", () => {
  const prompt = buildProposalsUserPrompt(ctx, "about 3 quick, 2 medium");
  assertStringIncludes(prompt, "about 3 quick, 2 medium");
});

Deno.test("no hand-mix line when energyMix is omitted", () => {
  const prompt = buildProposalsUserPrompt(ctx);
  assertEquals(prompt.includes("Aim for a spread of"), false);
});

Deno.test("per-card timeMinutes ceiling stays an integer with no min/max relaxation", () => {
  const props = ProposalsEnvelopeJsonSchema.schema.properties.proposals as {
    items: { properties: { timeMinutes: { type: string } } };
  };
  assertEquals(props.items.properties.timeMinutes.type, "integer");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test supabase/functions/_shared/proposals-prompt.test.ts`
Expected: FAIL — `buildProposalsUserPrompt` currently takes one argument; the `energyMix` string won't appear.

- [ ] **Step 3: Add the optional param to the prompt builder**

In `supabase/functions/_shared/prompts/proposals.ts`, change the `buildProposalsUserPrompt` signature and insert the hint line. Replace the function signature and the closing return array so it reads:

```ts
export function buildProposalsUserPrompt(ctx: LiveContext, energyMix?: string): string {
  const rule = TIER_RULES[ctx.tier];
  const avoid = ctx.avoidIngredients.length
    ? ctx.avoidIngredients.join(", ")
    : "none";
  return [
    `Deal exactly 5 dinner proposals for tier "${ctx.tier}" (${rule.label}).`,
    `Tier directive: ${rule.directive}`,
    `timeMinutes ceiling: ${rule.maxMinutes}.`,
    energyMix && energyMix.trim()
      ? `Aim for a spread of times matching the week's energy: ${energyMix.trim()}. This is a soft target for variety — never exceed the timeMinutes ceiling above.`
      : ``,
    ``,
    `Serves: ${ctx.householdSize}.`,
    `Avoid ingredients: ${avoid}. This rule also applies to ingredientNames — never list an avoided ingredient there.`,
    `Loved cuisines (priority order): ${ctx.lovedCuisines.join(", ") || "open"}.`,
    ``,
    ctx.voiceContext
      ? `USER JUST SAID (voice context, weight heavily): "${ctx.voiceContext}"`
      : `No voice context — pick a confident, varied spread.`,
    ``,
    `Spread the 5 across different cuisines unless voice context pins one.`,
    `Include one clearly "safe" crowd-pleaser and one gentle stretch.`,
    `Each hook must sell the dish in one line — concrete and sensory, never generic ("charred edges, cooling yogurt", NOT "a delicious meal").`,
    `Return JSON shape: { "proposals": Proposal[], "refusal": string | null } with exactly 5 proposals.`,
  ].filter(Boolean).join("\n");
}
```

(The `.filter(Boolean)` drops the empty hint line when `energyMix` is absent, matching the existing pattern in `fill.ts`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test supabase/functions/_shared/proposals-prompt.test.ts`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Thread `energyMix` through the endpoint**

In `supabase/functions/generate-proposals/index.ts`, add the optional field to `RequestBody`:

```ts
const RequestBody = z.object({
  tier: z.enum(["brain-is-fried", "after-work", "got-energy", "weekend-project"]),
  context: z.string().max(500).optional(),
  energyMix: z.string().max(120).optional(),
});
```

Destructure it where `tier`/`context` are pulled:

```ts
  const { tier, context, energyMix } = parsed.data;
```

And pass it to the prompt builder in the `chat({...})` call:

```ts
        { role: "user", content: buildProposalsUserPrompt(liveCtx, energyMix) },
```

- [ ] **Step 6: Type-check the endpoint**

Run: `deno check supabase/functions/generate-proposals/index.ts`
Expected: no errors.

- [ ] **Step 7: Commit (DO NOT DEPLOY)**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add supabase/functions/_shared/prompts/proposals.ts supabase/functions/_shared/proposals-prompt.test.ts supabase/functions/generate-proposals/index.ts && git commit -m "feat(generate-proposals): optional energyMix hand-mix hint (deploy pending Zach)

Deploy separately with Zach's consent: supabase functions deploy generate-proposals --no-verify-jwt

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task B5: Client — `generateProposals` accepts `energyMix`; store prefetch actions

**Files:**
- Modify: `apps/native/src/services/api.ts`
- Modify: `apps/native/src/stores/generationSession.ts`

**Interfaces:**
- Produces (api): `generateProposals(tier: EnergyTier, context?: string, energyMix?: string): Promise<Recipe[]>` — forwards `energyMix` in the live body; mock ignores it.
- Produces (store): `stageNextHand(recipes: Recipe[])`, `promoteNextHand()`; `deck.nextHand` surfaced. Prefetch in-flight tracking lives in `DeckScreen` (a ref), not the store.

- [ ] **Step 1: Forward `energyMix` in `api.generateProposals`**

In `apps/native/src/services/api.ts`, change the `generateProposals` signature + body. Replace its signature line and the `invoke` body:

```ts
export async function generateProposals(
  tier: EnergyTier,
  context?: string,
  energyMix?: string
): Promise<Recipe[]> {
  if (mode === 'mock') {
    await lag(1200);
    return pickForTier(tier, 5);
  }
  await ensureSession();
  const { data, error } = await supabase.functions.invoke('generate-proposals', {
    body: { tier, context: context?.trim() || undefined, energyMix: energyMix?.trim() || undefined },
  });
```

(Leave the rest of the function body — the error handling and the `proposals.map(...)` normalization — unchanged.)

- [ ] **Step 2: Add `stageNextHand` + `promoteNextHand` to the store**

In `apps/native/src/stores/generationSession.ts`, extend the `deckState` import to include `stageNextHand`:

```ts
import {
  dealFreshHand,
  initDeck,
  keepAt as reduceKeep,
  passAt as reducePass,
  reconcileKept as reduceReconcile,
  setCookTonight as reduceSetCook,
  stageNextHand as reduceStageNext,
  type DeckState,
} from '../features/eat/deckState';
```

Add the two actions to the interface (after `startWeekReset`):

```ts
  startWeekReset: (nights: ResetNight[]) => void;
  stageNextHand: (recipes: Recipe[]) => void;
  promoteNextHand: () => void;
```

Implement them after the `startWeekReset` action implementation:

```ts
  // Background prefetch stashed a hand — hold it until the swiper exhausts the
  // current one, then promote it into place (dealFreshHand keeps prior keeps).
  stageNextHand: (recipes) =>
    set((s) => (s.deck ? { deck: reduceStageNext(s.deck, recipes) } : s)),
  promoteNextHand: () =>
    set((s) =>
      s.deck && s.deck.nextHand ? { deck: dealFreshHand(s.deck, s.deck.nextHand) } : s,
    ),
```

- [ ] **Step 3: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/services/api.ts apps/native/src/stores/generationSession.ts && git commit -m "feat(deck): energyMix passthrough + stage/promote next-hand actions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task B6: `DeckScreen` — background prefetch + silent retry + "Deal again" card

**Files:**
- Modify: `apps/native/src/features/eat/DeckScreen.tsx`

**Interfaces:**
- Consumes: `shouldPrefetchNextHand` (B1), `swipeSummary`/`sessionExcludeTitles` (B2), `buildRedealContext` (B3), `stageNextHand`/`promoteNextHand`/`resetNights`/`mode` (B5/A2), `unfilledResetNights` + `TIER_MAX_MINUTES`-free unfilled count.
- Behavior: while swiping in `mode === 'week'`, when `shouldPrefetchNextHand` fires, kick a background `generateProposals` (with re-deal context + energy mix) and `stageNextHand` the result; one silent retry on failure. When the hand exhausts: if a `nextHand` is staged, `promoteNextHand`; else if a background prefetch failed, render a card-shaped "Deal again" retry in the deck's card slot (no blocking modal).

- [ ] **Step 1: Add the imports + prefetch refs**

In `apps/native/src/features/eat/DeckScreen.tsx`, extend the imports:

```ts
import { focusedRecipe, isExhausted, swipeSummary, sessionExcludeTitles } from './deckState';
import { shouldPrefetchNextHand } from './handPrefetch';
import { buildRedealContext } from './redealContext';
import { unfilledResetNights } from './weekReset';
import { activePickFor } from '../../stores/weekPlan';
```

(`useWeekPlan` is already imported — add `activePickFor` from the same module or its existing import site.)

Add store reads inside `DeckScreen` (after the existing `reset` read):

```ts
  const mode = useGenerationSession((s) => s.mode);
  const resetNights = useGenerationSession((s) => s.resetNights);
  const stageNextHand = useGenerationSession((s) => s.stageNextHand);
  const promoteNextHand = useGenerationSession((s) => s.promoteNextHand);
  const plan = useWeekPlan((s) => s.plan);
```

Add prefetch-tracking refs alongside the existing `requestedRef`:

```ts
  const prefetchInFlightRef = useRef(false);
  const prefetchRetriedRef = useRef(false);
  const [prefetchFailed, setPrefetchFailed] = useState(false);
```

- [ ] **Step 2: Compute the unfilled-night count + prefetch effect**

Add, after the existing art-prefetch `useEffect`, a hand-prefetch effect. It only runs in week mode:

```ts
  // Count nights this reset still needs to fill (excludes days already carrying
  // a committed recipe). Drives whether another hand is worth prefetching.
  const unfilledNights = React.useMemo(() => {
    if (mode !== 'week') return 0;
    const filled = new Set(
      Object.keys(plan).filter((date) => activePickFor(plan[date as keyof typeof plan]) != null),
    );
    return unfilledResetNights(resetNights, filled).length;
  }, [mode, resetNights, plan]);

  const prefetchNextHand = useCallback(() => {
    if (!tier || !deck) return;
    prefetchInFlightRef.current = true;
    const sum = swipeSummary(deck);
    const excludeTitles = sessionExcludeTitles(deck);
    const redealContext = buildRedealContext({ voiceContext: context, summary: sum, excludeTitles });
    void (async () => {
      try {
        const recipes = await api.generateProposals(tier, redealContext);
        stageNextHand(recipes);
        prefetchRetriedRef.current = false;
      } catch {
        if (!prefetchRetriedRef.current) {
          // One silent retry (spec §1.1.5).
          prefetchRetriedRef.current = true;
          prefetchInFlightRef.current = false;
          prefetchNextHand();
          return;
        }
        setPrefetchFailed(true);
      } finally {
        prefetchInFlightRef.current = false;
      }
    })();
  }, [tier, deck, context, stageNextHand]);

  useEffect(() => {
    if (!deck || mode !== 'week') return;
    const fire = shouldPrefetchNextHand({
      position: deck.position,
      handSize: deck.proposals.length,
      unfilledNights,
      prefetchInFlight: prefetchInFlightRef.current,
      nextHandReady: deck.nextHand != null,
    });
    if (fire) {
      setPrefetchFailed(false);
      prefetchNextHand();
    }
  }, [deck, deck?.position, mode, unfilledNights, prefetchNextHand]);
```

- [ ] **Step 3: Promote the staged hand on exhaustion; show the retry card**

Replace the exhausted-branch render. Currently the exhausted well shows "Nothing grabbed you?" + a manual "Deal a fresh hand". Add an automatic promotion effect + a card-shaped failure state. Insert this effect after the prefetch effect:

```ts
  // When the current hand runs out and a prefetched hand is staged, reveal it.
  useEffect(() => {
    if (deck && isExhausted(deck) && deck.nextHand != null) {
      requestedRef.current = [];
      promoteNextHand();
    }
  }, [deck, promoteNextHand]);
```

Then change the exhausted branch so that, in week mode with a failed prefetch, it renders a tappable "Deal again" card-shaped state (mirrors the existing `emptyWell` styling, retries via `handleFreshHand` which already resets refs). Replace the `) : exhausted ? (` block's body with:

```tsx
      ) : exhausted ? (
        <View style={styles.emptyWell}>
          <Mono size={10} bold color={palette.accentDeep}>
            {prefetchFailed ? "couldn't deal the next hand" : "that's the hand"}
          </Mono>
          <View style={{ height: spacing.sm }} />
          <DisplayText size={26} color={palette.primary} style={{ textAlign: 'center' }}>
            {prefetchFailed ? 'Deal again?' : 'Nothing grabbed you?'}
          </DisplayText>
          <View style={{ height: spacing.md }} />
          <PolishedButton label="Deal a fresh hand" tone="forest" onPress={handleFreshHand} />
          {keptCount > 0 ? (
            <>
              <View style={{ height: spacing.sm }} />
              <ItalicText size={14} style={{ textAlign: 'center' }}>
                {keptCount === 1 ? '1 keep waiting to be placed.' : `${keptCount} keeps waiting to be placed.`}
              </ItalicText>
            </>
          ) : null}
        </View>
      ) : focused ? (
```

Update `handleFreshHand` to clear the failure flag + retry refs at the top of its body (after `if (!tier) return;`):

```ts
  const handleFreshHand = useCallback(() => {
    if (!tier) return;
    press();
    setPrefetchFailed(false);
    prefetchRetriedRef.current = false;
    setDealing(true);
```

(Leave the rest of `handleFreshHand` unchanged.)

- [ ] **Step 4: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/DeckScreen.tsx && git commit -m "feat(deck): background-prefetch the next hand with silent retry + deal-again state

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

**Phase B ships here.** In a weekly reset, later hands mask their wait behind swiping; re-deals steer away from passes; a failed prefetch degrades to a tappable card, never a blocking modal. (The `energyMix` hint activates only after Zach deploys Task B4; until then the endpoint safely ignores the field.)

**Note — passing the mix from the deck:** wiring the `energyMix` argument into the reset's *first* hand is optional polish. `GenerationLoadingScreen` currently calls `api.generateProposals(tier, context)`; to send a mix, compute it from `resetNights` (e.g. counts per tier → "about 3 quick, 2 medium") and pass as the third arg. This is a 1-line change gated on B4's deploy; include it in the B4 deploy follow-up rather than blocking Phase B.

---

# PHASE C — The bench

Persist the session so backgrounding resumes; capture passes + over-keeps as bench cards; a per-day sheet places them instantly (free) or deals one fresh day-scoped hand; hearting saves permanently. Bench clears on the next reset.

## Task C1: `allocateKeeps` over/under-keep mapping (pure)

**Files:**
- Modify: `apps/native/src/features/eat/allocation.ts`
- Modify: `apps/native/src/features/eat/allocation.test.ts`

**Interfaces:**
- Produces: `KeepAllocation { placed: AllocationWrite[]; benched: Recipe[]; emptyNights: ISODate[] }`; `allocateKeeps(choices: AllocationChoice[], nights: ISODate[]): KeepAllocation` — placed = dated choices; benched = undated choices (over-keeps); emptyNights = `nights` with no placed write (under-keep).

- [ ] **Step 1: Write the failing test**

In `apps/native/src/features/eat/allocation.test.ts`, add (import `allocateKeeps`):

```ts
import { allocateKeeps } from './allocation';

function rr(id: string): Recipe {
  return { id, title: `Dish ${id}` } as Recipe;
}

describe('allocateKeeps', () => {
  test('over-keep: extras with no night go to the bench', () => {
    const choices = [
      { recipe: rr('a'), date: '2026-07-13' as ISODate },
      { recipe: rr('b'), date: null },
      { recipe: rr('c'), date: null },
    ];
    const out = allocateKeeps(choices, ['2026-07-13' as ISODate]);
    expect(out.placed.map((w) => w.recipe.id)).toEqual(['a']);
    expect(out.benched.map((r) => r.id)).toEqual(['b', 'c']);
    expect(out.emptyNights).toEqual([]);
  });

  test('under-keep: unfilled nights are reported, none benched', () => {
    const choices = [{ recipe: rr('a'), date: '2026-07-13' as ISODate }];
    const out = allocateKeeps(choices, ['2026-07-13' as ISODate, '2026-07-14' as ISODate]);
    expect(out.placed.map((w) => w.recipe.id)).toEqual(['a']);
    expect(out.benched).toEqual([]);
    expect(out.emptyNights).toEqual(['2026-07-14']);
  });
});
```

(`ISODate` and `Recipe` are already imported at the top of the test file; if not, add `import type { Recipe } from '@qook/shared';` and `import type { ISODate } from '../week/weekDates';`.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/allocation.test.ts`
Expected: FAIL — `allocateKeeps` not exported.

- [ ] **Step 3: Add `allocateKeeps` to `allocation.ts`**

In `apps/native/src/features/eat/allocation.ts`, append:

```ts
export interface KeepAllocation {
  placed: AllocationWrite[];
  benched: Recipe[];
  emptyNights: ISODate[];
}

// Split the user's day choices into: writes for dated keeps, over-keeps (no
// day chosen) destined for the bench, and the reset's nights left empty. The
// app NEVER fills an empty night itself (spec D6) — emptyNights is surfaced as
// a "Deal fresh ideas" affordance, not auto-drafted.
export function allocateKeeps(
  choices: AllocationChoice[],
  nights: ISODate[],
): KeepAllocation {
  const placed = allocationWrites(choices);
  const benched = choices.filter((c) => c.date == null).map((c) => c.recipe);
  const usedNights = new Set(placed.map((w) => w.date));
  const emptyNights = nights.filter((d) => !usedNights.has(d));
  return { placed, benched, emptyNights };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/allocation.test.ts`
Expected: PASS — new + existing cases green.

- [ ] **Step 5: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/allocation.ts apps/native/src/features/eat/allocation.test.ts && git commit -m "feat(allocation): over/under-keep mapping (bench + empty-night reporting)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task C2: `deckState` bench + JSON round-trip

**Files:**
- Modify: `apps/native/src/features/eat/deckState.ts`
- Modify: `apps/native/src/features/eat/deckState.test.ts`

**Interfaces:**
- Produces: `DeckState` gains `bench: Recipe[]`; `initDeck` seeds `bench: []`; `addToBench(state, recipes)` dedup-appends; `benchCards(state): Recipe[]` = passes ∪ explicit bench (over-keeps), deduped by id, minus anything currently kept.

- [ ] **Step 1: Extend the failing test**

In `apps/native/src/features/eat/deckState.test.ts`, add (import `addToBench`, `benchCards`):

```ts
import { addToBench, benchCards } from './deckState';

describe('deckState bench', () => {
  test('bench = passes plus over-keeps, minus kept, deduped', () => {
    let s = initDeck([rc('a', 'Thai'), rc('b', 'Italian'), rc('c', 'Thai')]);
    s = passAt(s); // pass a
    s = keepAt(s); // keep b
    s = addToBench(s, [rc('c', 'Thai')]); // over-keep c
    expect(benchCards(s).map((r) => r.id)).toEqual(['a', 'c']);
  });

  test('round-trips through JSON unchanged', () => {
    let s = initDeck([rc('a', 'Thai')]);
    s = keepAt(s);
    const round = JSON.parse(JSON.stringify(s));
    expect(round).toEqual(s);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/deckState.test.ts`
Expected: FAIL — `addToBench`/`benchCards` not exported; `bench` missing.

- [ ] **Step 3: Add `bench` to `DeckState`**

In `apps/native/src/features/eat/deckState.ts`:

Add `bench: Recipe[];` to the `DeckState` interface (after `nextHand`):

```ts
  nextHand: Recipe[] | null;
  bench: Recipe[];
  cookTonightId: string | null;
```

Seed it in `initDeck`:

```ts
    nextHand: null,
    bench: [],
    cookTonightId: null,
```

Add the two functions at the end of the file:

```ts
// Over-keeps land on the bench (spec §1.1.7). Dedup-append.
export function addToBench(state: DeckState, recipes: Recipe[]): DeckState {
  let bench = state.bench;
  for (const r of recipes) bench = dedupePush(bench, r);
  return { ...state, bench };
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/deckState.test.ts`
Expected: PASS — new + existing cases green.

- [ ] **Step 5: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/deckState.ts apps/native/src/features/eat/deckState.test.ts && git commit -m "feat(deck): bench state (passes + over-keeps) with JSON round-trip

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task C3: Persist the session store + bench/place actions

**Files:**
- Modify: `apps/native/src/stores/generationSession.ts`

**Interfaces:**
- Produces: `useGenerationSession` wrapped in `persist` (key `qook.generationSession.v1`, AsyncStorage), partialized to `{ deck, tier, context, mode, resetNights }`; new actions `addToBench(recipes: Recipe[])`, `placeFromBench(recipe: Recipe): void` (moves a bench card into `kept` so the existing allocation/write path handles it). `startWeekReset` already clears `deck` → bench resets each reset (spec D7).

- [ ] **Step 1: Wrap the store in `persist`**

In `apps/native/src/stores/generationSession.ts`, add the middleware imports at the top:

```ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
```

Change the `create<GenerationSessionState>((set) => ({ ... }))` wrapper to `create<GenerationSessionState>()(persist((set, get) => ({ ... }), { ... }))`. Concretely, change the opening line:

```ts
export const useGenerationSession = create<GenerationSessionState>()(
  persist(
    (set, get) => ({
```

and the closing line from `}));` to:

```ts
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
```

- [ ] **Step 2: Add `addToBench` + `placeFromBench`**

Extend the `deckState` import to include `addToBench` and `reduceAddBench` alias:

```ts
import {
  addToBench as reduceAddBench,
  dealFreshHand,
  initDeck,
  keepAt as reduceKeep,
  passAt as reducePass,
  reconcileKept as reduceReconcile,
  setCookTonight as reduceSetCook,
  stageNextHand as reduceStageNext,
  type DeckState,
} from '../features/eat/deckState';
```

Add to the interface (after `promoteNextHand`):

```ts
  stageNextHand: (recipes: Recipe[]) => void;
  promoteNextHand: () => void;
  addToBench: (recipes: Recipe[]) => void;
  placeFromBench: (recipe: Recipe) => void;
```

Implement after `promoteNextHand`:

```ts
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
```

Note: the `initDeck`/action bodies now can use `get` (available from the `(set, get)` signature) but none require it; leaving `get` unused is fine because other zustand stores in this repo also do (lint passes — `get` is a declared param, not an unused local). If lint flags it, prefix the closure as `(set) =>` and keep it — no action needs `get`.

- [ ] **Step 3: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0. (If lint flags an unused `get`, drop it back to `(set) =>`.)

- [ ] **Step 4: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/stores/generationSession.ts && git commit -m "feat(deck): persist the reset session; bench place/add actions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task C4: Route over-keeps to the bench in `AllocationScreen`

**Files:**
- Modify: `apps/native/src/features/eat/AllocationScreen.tsx`

**Interfaces:**
- Consumes: `allocateKeeps` (C1), `addToBench` (C3).
- Behavior: on `finish()` in week mode, dated keeps write to their nights and undated keeps are added to the bench (with a brief "N saved to your bench" acknowledgment), rather than merely staying saved. Tonight mode is unchanged.

- [ ] **Step 1: Swap `finish()` to `allocateKeeps` + bench the extras**

In `apps/native/src/features/eat/AllocationScreen.tsx`, import `allocateKeeps` and read `addToBench` + `resetNights` day list:

```ts
import { allocationWrites, allocateKeeps, tierMismatch } from './allocation';
```

```ts
  const addToBench = useGenerationSession((s) => s.addToBench);
```

Replace the body of `finish()` that builds `writes` and loops, with a version that also benches over-keeps in week mode:

```ts
  const finish = async () => {
    press();
    const liveKept = useGenerationSession.getState().deck?.kept ?? kept;
    const choices = liveKept.map((r, i) => ({ recipe: r, date: choices[i] ?? null }));
    const nightDates = mode === 'week' ? days.map((d) => d.date) : [];
    const outcome = allocateKeeps(choices, nightDates);

    for (const w of outcome.placed) {
      const fresh = (await api.getRecipeById(w.recipe.id).catch(() => null)) ?? w.recipe;
      appendRecipeAndSelect(w.date, fresh);
      commitSelection(w.date);
    }
    if (mode === 'week' && outcome.benched.length) {
      addToBench(outcome.benched);
    }

    const cooked = useGenerationSession.getState().deck?.cookTonightId ?? cookTonightId;
    reset();
    if (cooked) {
      router.replace({ pathname: '/(modals)/recipe/[id]', params: { id: cooked } });
    } else {
      router.replace(mode === 'week' ? '/(tabs)/week' : '/(tabs)/tonight');
    }
  };
```

**Naming caution:** the local `const choices = ...` above shadows the `choices` state variable used to seed it — rename the local to `dayChoices` to avoid the self-reference bug:

```ts
    const dayChoices = liveKept.map((r, i) => ({ recipe: r, date: choices[i] ?? null }));
    const nightDates = mode === 'week' ? days.map((d) => d.date) : [];
    const outcome = allocateKeeps(dayChoices, nightDates);
```

(Use `dayChoices` in the `allocateKeeps(...)` call. The state `choices[i]` on the right-hand side still refers to the React state map, which is correct.)

Note: `reset()` clears the deck (and thus the bench). Bench survives to the Plan tab because `addToBench` runs BEFORE `reset()` and the bench is read from the persisted store — but `reset()` nulls `deck`. **The bench must outlive `reset()`.** Since the bench lives on `deck` and `reset()` nulls it, the day sheet (Task C5) reads the bench from the persisted store, which `reset()` also clears. Resolve this by NOT calling `reset()` in week mode when there are benched cards — see Step 2.

- [ ] **Step 2: Keep the session alive in week mode so the bench persists**

The bench lives on `deck`; `reset()` nulls `deck` and would wipe the bench the day sheet needs. In week mode, do NOT `reset()` — leave the session (and its bench) in place until the next `startWeekReset` clears it (spec D7). Replace the tail of `finish()`:

```ts
    const cooked = useGenerationSession.getState().deck?.cookTonightId ?? cookTonightId;
    if (mode !== 'week') reset();
    if (cooked) {
      router.replace({ pathname: '/(modals)/recipe/[id]', params: { id: cooked } });
    } else {
      router.replace(mode === 'week' ? '/(tabs)/week' : '/(tabs)/tonight');
    }
```

And in `skipAll()`, likewise skip `reset()` in week mode so a "skip — just save them" still leaves passes/keeps on the bench:

```ts
  const skipAll = () => {
    press();
    if (mode === 'week') {
      // In week mode keeps were already saved (savedRecipeIds) and passes/
      // over-keeps stay on the bench for the day sheet; leave the session.
      addToBench(useGenerationSession.getState().deck?.kept ?? []);
    } else {
      reset();
    }
    router.replace(mode === 'week' ? '/(tabs)/week' : '/(tabs)/tonight');
  };
```

Also update the `nothingToPlace` effect so it does not `reset()` in week mode (leave the session for the bench):

```ts
  useEffect(() => {
    if (nothingToPlace) {
      if (mode !== 'week') reset();
      router.replace(mode === 'week' ? '/(tabs)/week' : '/(tabs)/tonight');
    }
  }, [nothingToPlace, reset, router, mode]);
```

- [ ] **Step 3: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/AllocationScreen.tsx && git commit -m "feat(allocation): route over-keeps to the bench; keep the week session alive

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task C5: The day sheet (bench UI + deal-fresh + heart-to-save)

**Files:**
- Create: `apps/native/src/features/week/DaySheet.tsx`
- Modify: `apps/native/src/features/week/DayRow.tsx`
- Modify: `apps/native/src/features/week/WeekScreen.tsx`

**Interfaces:**
- Produces: `DaySheet({ date, tier, visible, onClose })` — a bottom sheet (RN `Modal`) listing `benchCards(deck)`; tapping a card places it on `date` (via `placeFromBench` + `appendRecipeAndSelect`/`commitSelection`); a heart toggles `toggleSavedRecipe`; "Deal fresh ideas" opens the reset flow scoped to this one night.
- Consumes: `benchCards` (C2), `placeFromBench` (C3), `startWeekReset` (A2), `useWeekPlan` writes, `savedRecipeIds`/`toggleSavedRecipe`.
- `DayRow` gains an `onOpenDay?: (date: ISODate) => void` prop; when set, tapping an empty day row opens the sheet instead of doing nothing.

- [ ] **Step 1: Create `DaySheet`**

Create `apps/native/src/features/week/DaySheet.tsx`:

```tsx
import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, X } from 'lucide-react-native';
import type { EnergyTier } from '@qook/shared';

import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { Vignette } from '../../components/Vignette';
import { palette, radius, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { useGenerationSession } from '../../stores/generationSession';
import { useWeekPlan } from '../../stores/weekPlan';
import { benchCards } from '../eat/deckState';
import { formatDayShort, type ISODate } from './weekDates';
import type { ResetNight } from '../eat/weekReset';
import type { SeedMealKey } from '../../lib/assets';

export function DaySheet({
  date,
  tier,
  visible,
  onClose,
}: {
  date: ISODate;
  tier: EnergyTier;
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { press, tap } = useHaptics();
  const deck = useGenerationSession((s) => s.deck);
  const placeFromBench = useGenerationSession((s) => s.placeFromBench);
  const startWeekReset = useGenerationSession((s) => s.startWeekReset);
  const appendRecipeAndSelect = useWeekPlan((s) => s.appendRecipeAndSelect);
  const commitSelection = useWeekPlan((s) => s.commitSelection);
  const savedRecipeIds = useWeekPlan((s) => s.savedRecipeIds);
  const toggleSavedRecipe = useWeekPlan((s) => s.toggleSavedRecipe);

  const cards = useMemo(() => (deck ? benchCards(deck) : []), [deck]);
  const { weekday } = formatDayShort(date);

  const place = (recipeId: string) => {
    const card = cards.find((c) => c.id === recipeId);
    if (!card) return;
    press();
    placeFromBench(card);
    appendRecipeAndSelect(date, card);
    commitSelection(date);
    onClose();
  };

  const dealFresh = () => {
    press();
    const night: ResetNight = { date, tier };
    startWeekReset([night]);
    onClose();
    router.push('/(eat)/context');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.head}>
          <View>
            <Mono size={10} bold color={palette.accentDeep}>
              {weekday.toLowerCase()}
            </Mono>
            <View style={{ height: 4 }} />
            <DisplayText size={24} color={palette.primary}>
              {cards.length ? 'From your bench' : 'Nothing benched yet'}
            </DisplayText>
          </View>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <X size={18} color={palette.ink} strokeWidth={2.2} />
          </Pressable>
        </View>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {cards.map((c) => {
            const saved = savedRecipeIds.includes(c.id);
            return (
              <View key={c.id} style={styles.card}>
                <Pressable style={styles.cardMain} onPress={() => place(c.id)} accessibilityRole="button">
                  <Vignette
                    size={44}
                    localKey={c.localImageKey as SeedMealKey | undefined}
                    remoteUrl={c.heroImageUrl}
                    imageStatus={c.imageStatus}
                    title={c.title}
                  />
                  <View style={styles.cardText}>
                    <DisplayText size={16} color={palette.ink} numberOfLines={2}>
                      {c.title}
                    </DisplayText>
                    <Mono size={10} color={palette.textSecondary}>
                      {c.timeMinutes} min · {c.cuisine.toLowerCase()}
                    </Mono>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => {
                    tap();
                    toggleSavedRecipe(c.id);
                  }}
                  hitSlop={10}
                  accessibilityLabel={saved ? 'Unsave' : 'Save'}
                >
                  <Heart
                    size={18}
                    color={saved ? palette.accent : palette.textTertiary}
                    fill={saved ? palette.accent : 'transparent'}
                    strokeWidth={2}
                  />
                </Pressable>
              </View>
            );
          })}
          {!cards.length ? (
            <BodyText size={14} color={palette.textSecondary} weight="medium" style={styles.empty}>
              Deal a fresh hand for {weekday} — passes and extras land here for quick swaps.
            </BodyText>
          ) : null}
          <View style={{ height: spacing.md }} />
        </ScrollView>

        <PolishedButton label="Deal fresh ideas" tone="forest" onPress={dealFresh} />
        <View style={{ height: spacing.md }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 24, 18, 0.35)',
  },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    maxHeight: '78%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.statRuleColor,
    marginBottom: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  list: {
    flexGrow: 0,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.statRuleColor,
    gap: spacing.sm,
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  empty: {
    paddingVertical: spacing.lg,
  },
});
```

- [ ] **Step 2: Add an `onOpenDay` affordance to `DayRow`**

In `apps/native/src/features/week/DayRow.tsx`, extend the props to accept an optional day-open handler and expose the row's tier so the parent can open the sheet. Change the component signature:

```tsx
export function DayRow({
  date,
  onOpenRecipe,
  onOpenDay,
}: {
  date: ISODate;
  onOpenRecipe: (recipeId: string) => void;
  onOpenDay?: (date: ISODate, tier: EnergyTier) => void;
}) {
```

In the branch that renders a tagged-but-unfilled row (the row with energy set but no `pick`), wire the row press to `onOpenDay`. Locate the empty-row `Pressable` (the one that is NOT the `pick` branch) and set its `onPress`:

```tsx
        onPress={() => {
          if (activeTier && onOpenDay) onOpenDay(date, activeTier);
        }}
```

(If the empty row currently has no wrapping `Pressable`, wrap the empty-state content in one with the handler above. Keep the chip row's own `onChipPress` handlers intact — they must still fire independently; a chip `Pressable` inside the row already stops propagation via its own `onPress`.)

- [ ] **Step 3: Mount the sheet from `WeekScreen`**

In `apps/native/src/features/week/WeekScreen.tsx`, add local sheet state + render `DaySheet`, and pass `onOpenDay` to every `DayRow`. Add imports:

```ts
import { useState } from 'react';
import type { EnergyTier } from '@qook/shared';
import { DaySheet } from './DaySheet';
import type { ISODate } from './weekDates';
```

(Adjust the existing `import React from 'react';` to `import React, { useState } from 'react';`, and merge the `ISODate` type import into the existing `./weekDates` import line.)

Add state inside the component:

```ts
  const [sheet, setSheet] = useState<{ date: ISODate; tier: EnergyTier } | null>(null);
  const onOpenDay = (date: ISODate, tier: EnergyTier) => {
    press();
    setSheet({ date, tier });
  };
```

Pass `onOpenDay` to both `DayRow` usages:

```tsx
        <DayRow date={days[0]} onOpenRecipe={onOpenRecipe} onOpenDay={onOpenDay} />
```

```tsx
          {days.slice(1).map((date) => (
            <DayRow key={date} date={date} onOpenRecipe={onOpenRecipe} onOpenDay={onOpenDay} />
          ))}
```

Render the sheet just before the closing `</ScreenShell>`:

```tsx
      {sheet ? (
        <DaySheet
          date={sheet.date}
          tier={sheet.tier}
          visible={sheet != null}
          onClose={() => setSheet(null)}
        />
      ) : null}
      <View style={{ height: insets.bottom + screen.tabBarHeight + spacing.sm }} />
```

- [ ] **Step 4: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/week/DaySheet.tsx apps/native/src/features/week/DayRow.tsx apps/native/src/features/week/WeekScreen.tsx && git commit -m "feat(bench): per-day sheet with instant bench placement, heart-to-save, deal-fresh

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

**Phase C ships here.** Passes and over-keeps persist as a bench; tapping a day places one instantly and free, or deals one fresh day-scoped hand; hearting saves permanently; the bench clears on the next `startWeekReset`.

---

# PHASE D — Encore cards

The 6th card: a proven favorite from the user's own history, zero generation cost, only when there are enough eligible dishes.

## Task D1: `encoreCandidateId` (pure)

**Files:**
- Create: `apps/native/src/features/eat/encore.ts`
- Test: `apps/native/src/features/eat/encore.test.ts`

**Interfaces:**
- Produces: `ENCORE_THRESHOLD = 5`; `encoreCandidateId(args: { savedIds: string[]; cookedIds: string[]; placedThisWeekIds: string[]; dealtThisSessionIds: string[] }): string | null` — eligible = (saved ∪ cooked) − placed − dealt; returns the first eligible id only when eligible.length ≥ 5, else null.

- [ ] **Step 1: Write the failing test**

Create `apps/native/src/features/eat/encore.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { encoreCandidateId, ENCORE_THRESHOLD } from './encore';

const base = { savedIds: [] as string[], cookedIds: [] as string[], placedThisWeekIds: [] as string[], dealtThisSessionIds: [] as string[] };

describe('encoreCandidateId', () => {
  test('returns a candidate at exactly the threshold', () => {
    const saved = ['a', 'b', 'c', 'd', 'e'];
    expect(encoreCandidateId({ ...base, savedIds: saved })).toBe('a');
  });

  test('returns null one below the threshold', () => {
    const saved = ['a', 'b', 'c', 'd'];
    expect(encoreCandidateId({ ...base, savedIds: saved })).toBe(null);
  });

  test('unions saved and cooked without double-counting', () => {
    const out = encoreCandidateId({ ...base, savedIds: ['a', 'b', 'c'], cookedIds: ['c', 'd', 'e'] });
    expect(out).toBe('a'); // 5 distinct: a,b,c,d,e
  });

  test('excludes already-placed and already-dealt ids from eligibility', () => {
    const out = encoreCandidateId({
      savedIds: ['a', 'b', 'c', 'd', 'e', 'f'],
      cookedIds: [],
      placedThisWeekIds: ['a'],
      dealtThisSessionIds: ['b'],
    });
    // eligible = c,d,e,f → 4 < 5 → null
    expect(out).toBe(null);
  });

  test('threshold constant is 5', () => {
    expect(ENCORE_THRESHOLD).toBe(5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/encore.test.ts`
Expected: FAIL — module `./encore` not found.

- [ ] **Step 3: Write the module**

Create `apps/native/src/features/eat/encore.ts`:

```ts
// Encore selection (spec §1.3): the 6th card is a proven favorite from the
// user's own history — saved OR previously cooked — minus anything already
// placed this week and minus anything already dealt this session. Only offered
// when there are at least ENCORE_THRESHOLD eligible dishes, so a nearly-empty
// history never surfaces a thin, repetitive encore. Pure — bun-testable.
export const ENCORE_THRESHOLD = 5;

export function encoreCandidateId(args: {
  savedIds: string[];
  cookedIds: string[];
  placedThisWeekIds: string[];
  dealtThisSessionIds: string[];
}): string | null {
  const { savedIds, cookedIds, placedThisWeekIds, dealtThisSessionIds } = args;
  const excluded = new Set([...placedThisWeekIds, ...dealtThisSessionIds]);
  const eligible: string[] = [];
  const seen = new Set<string>();
  for (const id of [...savedIds, ...cookedIds]) {
    if (excluded.has(id) || seen.has(id)) continue;
    seen.add(id);
    eligible.push(id);
  }
  if (eligible.length < ENCORE_THRESHOLD) return null;
  return eligible[0];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/encore.test.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/encore.ts apps/native/src/features/eat/encore.test.ts && git commit -m "feat(encore): pure eligibility with the 5-dish threshold

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task D2: Attach the encore as the 6th card + kicker

**Files:**
- Modify: `apps/native/src/features/eat/deckState.ts` (+ `deckState.test.ts`)
- Modify: `apps/native/src/stores/generationSession.ts`
- Modify: `apps/native/src/features/eat/GenerationLoadingScreen.tsx`
- Modify: `apps/native/src/features/eat/DeckScreen.tsx`

**Interfaces:**
- Produces: `DeckState` gains `encoreId: string | null`; `appendEncore(state, recipe): DeckState` pushes a full recipe onto `proposals` (and records it in `dealt`) and sets `encoreId`. Store action `attachEncore(recipe: Recipe)`. `DeckScreen` shows a "FROM YOUR KITCHEN" `Mono` kicker on the card whose `id === deck.encoreId`.
- Behavior: after the reset's first hand is set, compute the encore candidate from `savedRecipeIds` + cooked-day recipe ids − placed − dealt; if present, fetch the full recipe by id and `attachEncore`. Below threshold → no 6th card (candidate is null). Encore only attaches in `mode === 'week'` (Tonight keeps a plain 5).

- [ ] **Step 1: Extend the deckState test**

In `apps/native/src/features/eat/deckState.test.ts`, add (import `appendEncore`):

```ts
import { appendEncore } from './deckState';

describe('deckState encore', () => {
  test('appendEncore adds a sixth card + records the encore id', () => {
    const s = appendEncore(initDeck(HAND), rc('enc', 'French'));
    expect(s.proposals.length).toBe(6);
    expect(s.encoreId).toBe('enc');
    expect(s.dealt.map((d) => d.id).includes('enc')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/deckState.test.ts`
Expected: FAIL — `appendEncore` not exported; `encoreId` missing.

- [ ] **Step 3: Add `encoreId` + `appendEncore` to `deckState.ts`**

Add `encoreId: string | null;` to the `DeckState` interface (after `cookTonightId`):

```ts
  cookTonightId: string | null;
  encoreId: string | null;
```

Seed it in `initDeck`:

```ts
    cookTonightId: null,
    encoreId: null,
  };
```

Add the function at the end of the file:

```ts
// The 6th card: a full recipe from the user's history, appended after the fresh
// five (spec §1.3). Recorded in `dealt` so it can't reappear in re-deals; marked
// via encoreId so the card can wear a distinct kicker.
export function appendEncore(state: DeckState, recipe: Recipe): DeckState {
  if (state.proposals.some((r) => r.id === recipe.id)) return state;
  return {
    ...state,
    proposals: [...state.proposals, recipe],
    dealt: [...state.dealt, { id: recipe.id, title: recipe.title }],
    encoreId: recipe.id,
  };
}
```

- [ ] **Step 4: Run the deckState test to verify it passes**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/deckState.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the `attachEncore` store action**

In `apps/native/src/stores/generationSession.ts`, extend the `deckState` import with `appendEncore as reduceAppendEncore`, add `attachEncore: (recipe: Recipe) => void;` to the interface (after `placeFromBench`), and implement it:

```ts
  attachEncore: (recipe) =>
    set((s) => (s.deck ? { deck: reduceAppendEncore(s.deck, recipe) } : s)),
```

- [ ] **Step 6: Compute + attach the encore after the first hand**

In `apps/native/src/features/eat/GenerationLoadingScreen.tsx`, after `setProposals(proposals)` in BOTH the main effect and `retry()` (or, DRY, factor a small helper), attach an encore in week mode. Add the reads + a helper near the top of the component:

```ts
  const mode = useGenerationSession((s) => s.mode);
  const attachEncore = useGenerationSession((s) => s.attachEncore);
  const savedRecipeIds = useWeekPlan((s) => s.savedRecipeIds);
  const plan = useWeekPlan((s) => s.plan);
```

Add the imports:

```ts
import { useWeekPlan, activePickFor } from '../../stores/weekPlan';
import { encoreCandidateId } from './encore';
```

Add a `maybeAttachEncore` callback (before the effects):

```ts
  const maybeAttachEncore = React.useCallback(
    async (dealtIds: string[]) => {
      if (mode !== 'week') return;
      const cookedIds = Object.values(plan)
        .filter((d) => d.cookedAt && d.recipes?.length)
        .map((d) => activePickFor(d)?.id)
        .filter((id): id is string => Boolean(id));
      const placedThisWeekIds = Object.values(plan)
        .map((d) => activePickFor(d)?.id)
        .filter((id): id is string => Boolean(id));
      const candidateId = encoreCandidateId({
        savedIds: savedRecipeIds,
        cookedIds,
        placedThisWeekIds,
        dealtThisSessionIds: dealtIds,
      });
      if (!candidateId) return;
      const full = await api.getRecipeById(candidateId).catch(() => null);
      if (full) attachEncore(full);
    },
    [mode, plan, savedRecipeIds, attachEncore],
  );
```

Call it right after `setProposals(proposals)` in both places:

```ts
        setProposals(proposals);
        void maybeAttachEncore(proposals.map((p) => p.id));
```

(`React` is already imported in this file as the default import; if only named hooks are imported, add `useCallback` to the existing `react` import and call `useCallback` directly instead of `React.useCallback`.)

- [ ] **Step 7: Show the "FROM YOUR KITCHEN" kicker in `DeckScreen`**

In `apps/native/src/features/eat/DeckScreen.tsx`, pass an `isEncore` flag to `DeckCard` and render the kicker. Where `focused` is rendered:

```tsx
      ) : focused ? (
        <DeckCard
          key={`${focused.id}-${deck.position}`}
          recipe={focused}
          isEncore={focused.id === deck.encoreId}
          onKeep={handleKeep}
          onPass={handlePass}
          onCookTonight={handleCookTonight}
        />
      ) : null}
```

Extend `DeckCard`'s props + render a kicker above the title. Change its signature:

```tsx
function DeckCard({
  recipe,
  isEncore,
  onKeep,
  onPass,
  onCookTonight,
}: {
  recipe: Recipe;
  isEncore?: boolean;
  onKeep: () => void;
  onPass: () => void;
  onCookTonight: () => void;
}) {
```

Inside the front-face `cardBody`, replace the cuisine kicker `Mono` with an encore-aware one:

```tsx
                  <Mono size={10} bold color={isEncore ? palette.accent : palette.accentDeep}>
                    {isEncore ? 'from your kitchen' : recipe.cuisine.toLowerCase()}
                  </Mono>
```

- [ ] **Step 8: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0.

- [ ] **Step 9: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/deckState.ts apps/native/src/features/eat/deckState.test.ts apps/native/src/stores/generationSession.ts apps/native/src/features/eat/GenerationLoadingScreen.tsx apps/native/src/features/eat/DeckScreen.tsx && git commit -m "feat(encore): attach a history favorite as the 6th card with a FROM YOUR KITCHEN kicker

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

**Phase D ships here.** When the user has ≥5 eligible history dishes, the weekly hand is 5 fresh + 1 encore (6 total), the encore costs nothing (it points at an existing full row), and it wears a distinct kicker. Below threshold, the hand is a plain 5 — indistinguishable from Phase A/B.

---

## Self-review (run before reporting; findings already folded in above)

**1. Spec coverage** — every §1 requirement maps to a task:
- §1.1.1 chips unchanged → no work (confirmed DayRow chips untouched except removing the batch guard, A5).
- §1.1.2 voice-context moment, reworded → A3. (Char-cap discrepancy flagged, not silently changed.)
- §1.1.3 hand of 6 (5 fresh + encore) → 5 fresh in A; encore 6th in D2. ✅
- §1.1.4 swipe unchanged → DeckScreen gestures untouched. ✅
- §1.1.5 progressive dealing + swipe summary + silent retry + Deal-again → B1/B3/B6. ✅
- §1.1.6 hand-mix hint → B4 (`energyMix`, ceilings unchanged, deploy Zach-gated). ✅
- §1.1.7 allocation to nights, warn-not-block, over-keep→bench, under-keep empty → A4 (warn) + C1/C4 (over/under). ✅
- §1.1.8 quota at generation → unchanged endpoint behavior; noted. ✅
- §1.1.9 exclude set → B2 (`dealt`/`sessionExcludeTitles`) + B3 (titles-only serialization). ✅
- §1.1.10 persistence → C3 (`persist`, partialized). ✅
- §1.2 the bench → C2/C3/C4/C5 (bench cards, place free, deal-fresh, clears on reset via `startWeekReset` nulling `deck`). ✅
- §1.3 encores → D1/D2 (threshold, zero-cost pointer, kicker, below-threshold silent 5). ✅
- §1.4 non-goals → no price/cost UI added anywhere; no auto-fill (C1 comment + emptyNights surfaced, never written). ✅
- §1.5 retirements → A5 deletes batchDraft/batchSession; generate-recipe endpoint + client binding left in place (noted). ✅
- §5 error handling → initial-hand error reuses existing loader path; prefetch silent-retry + Deal-again (B6); fill-recipe failure path unchanged; bench deal-fresh reuses single-hand path (C5 routes into the same flow); quota exhaustion reuses existing 429 toast (unchanged). ✅
- §6 testing → weekReset, handPrefetch, redealContext, deckState (passes/dealt/bench/round-trip/encore), allocation (tierMismatch + allocateKeeps), encore, edge proposals-prompt — all present. ✅

**2. Placeholder scan** — no "TBD/TODO/handle edge cases/similar to Task N". The one spec-acknowledged TBD ("FROM YOUR KITCHEN" final copy, §1.3) is resolved to a concrete string in D2. Every code step shows real code.

**3. Type consistency** — `DeckState` grows monotonically (`passed`, `dealt`, `nextHand`, `bench`, `encoreId`) with each field seeded in `initDeck` at the task that introduces it; `dedupePush` is reused by `keepAt`/`passAt`/`addToBench`. Store action names are stable (`startWeekReset`, `stageNextHand`, `promoteNextHand`, `addToBench`, `placeFromBench`, `attachEncore`). `ResetNight`/`TIER_MAX_MINUTES` defined once (A1) and imported by allocation, DeckScreen, DaySheet. `generateProposals(tier, context?, energyMix?)` signature consistent between B4 endpoint body and B5 client. `mode: 'tonight' | 'week'` used identically across ContextStep/AllocationScreen/DeckScreen/DaySheet/GenerationLoadingScreen.

**One consistency risk called out for the executor (C4):** the local `dayChoices` MUST NOT be named `choices` — it would shadow the `choices` React state it reads from. The step spells this out explicitly.
