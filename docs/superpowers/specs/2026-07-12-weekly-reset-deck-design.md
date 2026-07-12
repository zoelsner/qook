# Weekly Reset Deck — design spec

**Written:** 2026-07-12
**Goal:** unify Qook's two generation flows into one — the swipe deck becomes THE week-planning flow, with a bench for single-day fixes.
**Approved by:** Zach, 2026-07-12 (design artifact https://claude.ai/code/artifact/b1340c4b-40a1-4e64-b4e4-c9bb34622e93; price/cost badges cut by Zach, hand size raised from 5 to 6 by Zach).

---

## 0. Context

Qook currently ships two independent ways to fill the week:

1. **The Week tab's silent auto-draft loop** — per-night energy chips (15/30/45) tag days, "Draft N dinners" calls `batchDraft()` (`apps/native/src/features/week/batchDraft.ts`), which sequentially calls `generate-recipe` once per tagged night. Each call is a **full** SSE-streamed 3-recipe generation and burns **1 quota unit per night**, with zero interaction — the first proposal silently wins and lands on the day.
2. **The swipe deck** (shipped 2026-07-10, `docs/superpowers/plans/2026-07-10-swipe-deck.md`) — a standalone `(eat)/{energy,loading,review→deck,context}` flow: `generate-proposals` deals a hand of 5 cheap skeleton proposals (1 quota unit total), the user swipes keep/pass on `DeckScreen`, kept cards get written to full recipes on demand via `fill-recipe` (quota-free), and `AllocationScreen` places keeps onto specific days.

These are redundant and inconsistent: the Week tab's loop is 5× the quota cost of a deck hand for the same five nights, gives the user no say in what lands on each day, and the deck flow already exists but is only reachable from the Tonight tab's "Find dinner tonight" entry — never from weekly planning.

This spec merges them: **the deck becomes the weekly reset**, reusing 100% of the shipped deck infrastructure (`DeckScreen`, `AllocationScreen`, `generate-proposals`, `fill-recipe`, `content_status` skeletons, `useSwipeGesture`, `DealingHandLoader`) plus voice context and energy chips already on the Week tab. The old per-night auto-draft loop is retired.

**Terminology note:** this spec calls the Week tab the "Plan tab" throughout, per Zach's naming in the approved artifact. This is the *existing* Week tab route (`apps/native/app/(tabs)/week.tsx` → `WeekScreen`) — its on-screen kicker already reads "PLAN". No new tab or route rename is required; "Plan tab" and "Week tab" are the same screen in this document.

---

## 1. The system

All decisions below are locked — write against them as requirements, not options.

### 1.1 Entry 1 — Weekly reset (Plan tab, "Plan my week")

1. **Energy chips unchanged.** The user sets per-night energy chips (15/30/45, i.e. the existing `EnergyChip` ghost-chip rows on `DayRow`) on the Plan tab exactly as today. No UI change to chip-setting.
2. **Reset opens with a ~10s voice-context moment.** Reuses the existing voice input from the eat flow's `ContextStep` (`apps/native/src/features/eat/ContextStep.tsx`, 500-char cap via `MAX_CHARS`). Prompt copy explicitly asks about the week's energy alongside cravings — e.g. *"How's your week looking — tired nights? anything you're craving?"* — replacing the tonight-only framing of the existing copy. Voice context flows into generation exactly as today: a single `context` string param (≤500 chars), passed to `generate-proposals`. Per-night chips remain the structured source of truth (tier per night); voice only steers cuisine/mood within those tiers, never overrides a chip's tier.
3. **Deal a hand of SIX cards:** 5 fresh proposals from ONE `generate-proposals` call (1 quota unit) + 1 encore card (§1.3). `DealingHandLoader` plays exactly as today during the wait.
4. **Swipe mechanics unchanged.** Keep-right / pass-left on the existing `DeckScreen`. The info (ⓘ) pill flips a card to its ingredients/plan back — already shipped; card visuals and gesture code are untouched.
5. **Progressive dealing.** When the user is 2 cards from the end of the current hand **and** unfilled nights remain in the current week-plan horizon, the next hand generates in the background (same prefetch-window pattern as `imagePrefetch.ts`'s `artIndicesToRequest`, applied to hands instead of art). Round N+1's `context` param includes a compact swipe summary of round N — kept titles/cuisines and passed cuisines — appended to the voice-context string, so re-deals steer away from passes. Failure handling: **one silent retry** on prefetch failure; if the user exhausts the current hand with no next hand ready (retry also failed), show a card-shaped "Deal again" error state in place of the next card — not a blocking modal, not a toast that loses deck position.
6. **Hand composition softly mirrors the week's energy mix.** The `generate-proposals` prompt is given the week's chip distribution and asked for a matching split in prose (e.g. "about 3 quick, 2 medium" when the tagged nights lean toward 15-min tiers). This is prompt guidance only — **per-card tier ceilings stay hard** (`TIER_RULES[tier].maxMinutes` is still enforced in the Zod schema exactly as today; the mix request never relaxes a ceiling).
7. **Allocation reuses `AllocationScreen` unchanged in mechanism, extended in copy:**
   - Flow keeps to nights whose tier matches the card's tier; a tier mismatch **warns, never blocks** (the user can still place a 45-min card on a 15-min night).
   - **Over-keep** (more keeps than unfilled matching nights): extras are saved to the bench, not discarded. Copy: *"2 extra saved to your bench."*
   - **Under-keep** (fewer keeps than unfilled nights): those nights stay empty with a per-day deal affordance (opens the day sheet, §1.2). **The app never auto-fills a dish the user didn't choose** — this is the core behavior the auto-draft loop violated and the reason it's retired.
8. **Quota is charged at generation, server-side, exactly as today's deck** (`generate-proposals` counts as 1 unit regardless of how many cards are later kept). A prefetched hand the user never reveals still costs its unit — accepted, because prefetch only fires while unfilled nights remain (§1.1.5), bounding waste to at most one wasted hand per reset.
9. **Dedup via a session exclude set.** The deck session tracks every recipe already placed this week **plus** every card dealt this session (kept, passed, or benched). Fresh hands receive this set compactly in the `generate-proposals` context param (titles, not full recipes — the same compactness principle as the swipe-summary in §1.1.5); encores (§1.3) filter by recipe id client-side against the same set, no server round-trip needed.
10. **Session persistence.** Deck session state (current hand, swipe history, bench) persists via the app's existing Zustand + AsyncStorage pattern (matching `useWeekPlan`'s `persist` middleware, key `qook.weekPlan.v1`) so backgrounding mid-reset resumes exactly where the user left off — no re-deal, no lost swipes.

### 1.2 Entry 2 — The Bench (single-day fix)

Tapping any day on the Plan tab opens a bottom sheet with:

- **Benched cards** — passed or over-kept cards from this week's reset. Placing one from the bench is instant and free (no `generate-proposals` call; the recipe row already exists, skeleton or full).
- **"Deal fresh ideas"** — one new `generate-proposals` hand scoped to that single day's tier (1 quota unit), same dedup exclude set as the weekly reset.

The bench clears when the next weekly reset begins (a fresh reset starts a fresh session store, discarding the prior week's bench). Hearting a bench card saves it permanently via the existing saved-recipes system (`useWeekPlan.toggleSavedRecipe` / `savedRecipeIds`) — hearting is the only way a bench card survives past the next reset.

### 1.3 Encore cards

- At most **1 encore per hand** (hands are 5 fresh + 1 encore = 6 total, per §1.1.3).
- Only appears when the user has **≥5 eligible history dishes**: saved (`savedRecipeIds`) or previously cooked (rows with `cookedAt` set in `weekPlan`), **minus** anything already placed this week and minus anything already dealt this session (same exclude set as §1.1.9).
- **Zero generation cost** — the recipe and its art already exist; the encore card is a client-side pointer to an existing full row, not a new `generate-proposals`/`fill-recipe` call.
- Distinct card kicker treatment to mark it as a repeat rather than a new idea: **"FROM YOUR KITCHEN"** (final copy TBD at build — this is the one deliberately open item in this spec).
- Below the 5-dish threshold, hands are **5 fresh cards only** — no degraded/placeholder encore slot, no error state. The sixth-card affordance simply doesn't render.

### 1.4 Explicit non-goals (v1)

- **Price/cost badges** — considered in the design exploration and cut by Zach; the energy tier already carries most of the cost signal a badge would add.
- Real grocery pricing or budget math.
- Per-day sub-tabs.
- Auto-filling nights the user didn't choose (explicitly forbidden, §1.1.7).
- Parallelizing the old auto-draft loop for speed — it is retired outright, not optimized (§1.5).

### 1.5 Retirements

- **`WeekScreen`'s `batchDraft` loop** (`apps/native/src/features/week/batchDraft.ts`, its `useBatchSession` store, and the sequential `api.generateRecipesForEnergy` calls it makes) is deleted. The "Draft N dinners" CTA on `WeekScreen.tsx` (line ~160, `` `Draft ${tagged.length} ${tagged.length === 1 ? 'dinner' : 'dinners'}` ``) becomes **"Plan my week"**, routing into the reset flow (§1.1) instead of calling `batchDraft`.
- **The `generate-recipe` endpoint itself is not removed.** Nothing in this spec's flow calls it (the deck uses `generate-proposals` + `fill-recipe` exclusively), but it's left deployed as a candidate for later removal once no caller remains — do not delete it in the same change that lands this spec; confirm zero call sites first.

---

## 2. Architecture notes

### 2.1 Reused as-is (no changes)

- `DeckScreen` (`apps/native/src/features/eat/DeckScreen.tsx`) — swipe gestures, card flip, `CardArt`.
- `AllocationScreen` (`apps/native/src/features/eat/AllocationScreen.tsx`) — day-chip placement, `finish()` re-fetch-before-write behavior.
- `generate-proposals` / `fill-recipe` Edge Functions and their schemas (`supabase/functions/generate-proposals/`, `supabase/functions/fill-recipe/`, `supabase/functions/_shared/schema.ts` `ProposalsEnvelope`/`Proposal`).
- Voice context capture (`ContextStep.tsx`, 500-char cap) — copy changes only (§1.1.2).
- Energy chips (`EnergyChip`, `DayRow` ghost-chip rows) — no changes.
- `DealingHandLoader` — no changes; hand size going from 5 to 6 does not change its choreography (it is card-count-agnostic per the 2026-07-10 lock).
- `content_status` skeleton/full distinction (`recipes.content_status`, `recipe-map.ts` `toSkeletonInsert`/`toFillUpdate`, `dedup.ts` `resolveFillTarget`).

### 2.2 New for this spec

- **Deck session store** (new Zustand + AsyncStorage store, or an extension of the existing deck slice in `apps/native/src/stores/generationSession.ts`) carrying: current hand, swipe history (kept/passed/benched card ids with their recipe snapshots), the session exclude set (placed-this-week + dealt-this-session titles/ids), and bench contents. Persisted so backgrounding resumes (§1.1.10).
- **Progressive prefetch trigger** — a pure function analogous to `imagePrefetch.ts`'s `artIndicesToRequest`, but keyed on deck position vs. hand length vs. remaining unfilled nights, deciding when to fire the next `generate-proposals` call and whether unfilled-nights remain to justify it (§1.1.5, §1.1.8).
- **Encore selection** — a pure function: given saved + cooked recipe ids, the current week's placed ids, and the session exclude set, return 0 or 1 eligible history recipe id for the hand (§1.3).
- **Allocation over/under-keep handling** — new branches in `AllocationScreen`'s finish/placement logic: excess keeps route to the bench store instead of being dropped; short falls leave nights empty with a "Deal fresh ideas" affordance surfaced (not silently blank) (§1.1.7).
- **Plan-tab entry point** — `WeekScreen`'s CTA rewritten from `batchDraft(tagged)` to routing into `(eat)/energy` (or a new reset-scoped route) carrying the full set of tagged nights + their tiers, instead of the deck's existing single-tier entry from Tonight.
- **Day sheet (the Bench UI)** — new bottom sheet component, opened by tapping a day row on the Plan tab, rendering bench cards + "Deal fresh ideas" (§1.2).

---

## 3. Phasing

Each phase is independently shippable; later phases build on earlier ones without requiring them to be re-touched.

- **Phase A — deck as weekly reset.** Plan-tab entry point wired to the deck flow with the week's tagged nights + tiers; allocation writes to the week plan; `batchDraft`/`useBatchSession`/"Draft N dinners" retired. Ships with a plain hand of 5 (no progressive dealing, no bench, no encores yet) — functionally: today's deck UX, entered from the Plan tab instead of Tonight, feeding multiple nights via one `AllocationScreen` pass.
- **Phase B — progressive dealing + swipe-informed re-deal.** Background prefetch of the next hand at 2-cards-remaining (§1.1.5), swipe-summary context passthrough, silent-retry + "Deal again" error state.
- **Phase C — the bench.** Persist passes/over-keeps across the session, day-tap sheet (§1.2), hearting-to-save.
- **Phase D — encores.** Eligibility function, sixth-card slot, "FROM YOUR KITCHEN" kicker (copy finalized at build).

---

## 4. Cost / latency comparison

| | Today (auto-draft loop) | Proposed (deck-as-reset) |
|---|---|---|
| Quota cost for a 5-night week | 5 units (1 per night, `generate-recipe`) | 2–3 units (1 per hand of 6; a second hand only if the first hand's keeps don't cover all 5 nights) |
| Latency | ~75s sequential (5× full-recipe SSE streams, one after another, before anything is visible) | First cards visible ~8s after `DealingHandLoader` starts (single `generate-proposals` call); remaining hands mask their wait behind swiping via prefetch (§1.1.5) |
| User interaction | Zero — first proposal per night silently wins | Full — every dish on every night was swiped and kept by the user |

---

## 5. Error handling

- **`generate-proposals` failure (initial hand):** identical to today's deck — `DealingHandLoader` surfaces the existing error/retry affordance; no new behavior needed since this is the same call the deck already makes.
- **Background prefetch failure (progressive dealing, Phase B):** one silent retry (§1.1.5). If the retry also fails and the user reaches the end of the current hand, render a card-shaped "Deal again" state in the deck's card stack — same visual slot a real card would occupy, tappable to retry, preserving swipe position and the exclude set. Never a blocking modal.
- **`fill-recipe` failure on a kept card:** unchanged from the existing deck spec — `content_status` stays `'proposal'`, `generation_error` is recorded, `AllocationScreen`'s finish-time re-fetch picks up whatever state exists (full or still-skeleton) rather than blocking the whole allocation on one failed fill.
- **Bench "Deal fresh ideas" failure (Phase C):** same single-hand error handling as the initial hand (day-scoped, so failure just leaves the day sheet showing existing bench cards with a retry, not a whole-week failure).
- **Encore eligibility miscount (Phase D):** never surfaced as an error — below-threshold (<5 eligible dishes) silently yields a 5-card hand (§1.3), which is indistinguishable from Phase A/B's normal hand.
- **Quota exhaustion mid-reset:** identical `429 rate_limited` handling to today's `generate-proposals` — surfaces the existing "You've hit today's recipe limit" toast; unfilled nights stay empty with the per-day bench affordance (§1.1.7) rather than the reset silently truncating.

---

## 6. Testing

Pure logic, bun-testable (no React Native imports, per the existing deck-plan convention):

- **Deck session reducer** — exclude-set accumulation across hands (placed-this-week ∪ dealt-this-session), persistence round-trip shape.
- **Progressive prefetch trigger** — position-vs-hand-length-vs-unfilled-nights decision function (analogous to `imagePrefetch.test.ts`'s coverage of `artIndicesToRequest`): fires at exactly 2-from-end, does not fire when no unfilled nights remain, does not double-fire while a prefetch is already in flight.
- **Encore eligibility** — threshold boundary (exactly 5 vs. 4 eligible dishes), exclusion of already-placed/already-dealt ids, "at most 1" invariant.
- **Allocation over/under-keep mapping** — extends the existing `allocation.test.ts` coverage: N keeps vs. M matching-tier unfilled nights → correct split of (placed, benched) for N > M, and correct "night stays empty" set for N < M.

Edge-side (deno-tested), only if any server logic changes beyond what's already shipped:

- `generate-proposals`'s hand-mix prompt construction (§1.1.6) — a pure prompt-builder test analogous to `proposals-schema.test.ts`, confirming the tier-mix hint is included and per-card `maxMinutes` ceilings are unchanged in the JSON schema.
- Exclude-set passthrough in the `context` param — confirms compact title-only serialization, not full recipe payloads (keeps token cost down, same principle as the existing swipe-summary requirement in §1.1.5).

No new edge functions are introduced by this spec (`generate-proposals`/`fill-recipe` are reused unmodified in Phase A); edge-side tests are only needed if Phase B's hand-mix hint or exclude-set passthrough touch prompt-builder code.

---

## 7. Decisions log

- **D1 — One system, not two.** The auto-draft loop and the swipe deck are merged into a single weekly-reset flow; the loop is retired rather than kept as a fallback. *Rationale: the loop is both more expensive (5 units vs. 2–3) and worse UX (zero interaction) than the deck for the identical job.*
- **D2 — Hand size is 6, not 5.** *Zach raised the hand size from the shipped deck's 5 to 6, to make room for the encore slot without shrinking the fresh-idea count.*
- **D3 — Encore cards cost nothing.** They point at existing full rows with existing art; no `generate-proposals`/`fill-recipe` call. *Rationale: reusing proven favorites should never compete with the fresh-idea quota budget.*
- **D4 — Per-night chips stay the tier source of truth; voice only steers.** *Rationale: chips are structured and unambiguous; free-text voice context is good at "tired, craving something spicy" but bad at reliably encoding a hard time ceiling — keeping tiers chip-driven avoids the model silently ignoring a stated constraint.*
- **D5 — Allocation mismatches warn, never block.** *Rationale: matches the existing `AllocationScreen` philosophy (already shipped) — a 45-min card on a 15-min night is the user's call, not the app's to prevent.*
- **D6 — The app never auto-fills a night.** Under-keep leaves nights empty with a manual affordance rather than silently drafting something. *Rationale: this is the exact behavior being retired from the old loop — reintroducing it anywhere in the new flow would defeat the point of the merge.*
- **D7 — Bench clears on next reset; only hearting survives it.** *Rationale: keeps the bench mental model simple ("this week's leftovers"), and reuses the existing saved-recipes system as the one durable escape hatch rather than inventing a second persistence tier.*
- **D8 — Price/cost badges cut.** *Zach's call in the design artifact review: the energy tier already communicates most of what a cost badge would, and real grocery pricing is out of scope for v1 regardless.*
- **D9 — Prefetched-but-unrevealed hands still cost their quota unit.** *Rationale: charging at generation (not at reveal) matches the existing deck's shipped behavior and avoids a "free preview" exploit; the cost is bounded because prefetch only fires while unfilled nights remain (§1.1.5), so at most one hand per reset can go unrevealed.*

---

## 8. Out of scope references

`generate-recipe`'s eventual removal (tracked, not executed here — §1.5), Android/iPad (unaffected, pre-existing exclusion), paywall/RevenueCat interaction with quota costs (v1.1, unaffected by this spec).
