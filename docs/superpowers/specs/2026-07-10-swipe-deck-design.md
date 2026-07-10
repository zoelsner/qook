# Swipe Deck ("Hand of 5") + Two-Phase Generation — Design

**Date:** 2026-07-10
**Status:** Draft — awaiting Zach's review
**Decided in conversation** (artifacts: selection flows `827a4d93`, card treatments `2270935e`, model bake-off `5c5da862`)

## Goal

Replace the 3-recipe review list with a bounded swipe deck fed by two-phase
generation: proposals arrive fast and cheap, full recipes are written only for
dishes the user engages with, and keeps flow onto the week. Kills the 35–50s
single-call wait; the worst case becomes a ~15s "the kitchen is thinking"
moment with a fun loading visual, then five flicks.

## Decisions locked with Zach

- **Flow:** swipe deck (Flow B), not the list. Bounded **hand of 5** per deal —
  never an infinite feed. Nothing grabs you → one tap deals a fresh hand.
- **Immediate exit:** any card can be committed as *cook tonight* directly
  (button on the card; optionally swipe-up later). Finishing the deck is never
  required to get dinner.
- **Card:** Treatment 01 layout (generous art, Fraunces title, hook line,
  dot-leader stats, keep/pass affordances). The art block is **one swappable
  component** — circular mask vs square-top — final call made in the sim, not
  from mockups. Same underlying square watercolor asset either way; zero extra
  image cost.
- **Pending art state:** designed, not apologetic — Fraunces letter monogram on
  the well + quiet "painting…" tick (from Treatment 04).
- **Image firing:** pre-fire the **first 3 in parallel at deal time**, then stay
  **2 cards ahead** of the swiper. No fire-on-dwell timers in v1.
- **Loading:** one loading moment (~10–15s) covering phase-1 text + first
  card's art, reusing the existing circled-word loader personality. Deck
  reveals when proposal text + card-1 art are ready (art timeout → reveal with
  monogram anyway).
- **Text model:** `openai/gpt-5.6-luna` (set via `OR_TEXT_MODEL`, bake-off
  validated). Combo polish (luna→sonnet) is a future upgrade for phase 2 only —
  not in this build.
- **Week tab tie-in (this build):** keeps land as committed picks on chosen
  days via a simple allocation step. Per-day "generate one" / "regenerate" on
  the Week tab and weekly-batch generation (possible paid feature) are
  **future work** — noted, not built.
- **Deck size:** fixed at 5 for v1. "Choose your deck size" is a maybe-later,
  not built (YAGNI).

## Architecture

### Phase 1 — proposals (new)

`generate-proposals` (new mode or endpoint on `generate-recipe`): one Luna call
returning 5 proposals — `{title, hook, timeMinutes, proteinG, cuisine}` —
via a small strict JSON schema (~400 output tokens, target ~3–5s). Counts as
1 unit against the existing 10/day quota (a hand = one generation).

Each proposal is persisted immediately as a **skeleton row** in `recipes`:
`title`, `time_minutes`, `cuisine`, nutrition protein estimate, a new
`content_status` column `('proposal'|'full')`, `image_status='pending'`,
`user_id=null` (global-cache convention). A new `hook` text column carries the
one-liner. Skeleton rows are what `generate-image` fires against — the image
prompt is title-only today (`buildImagePrompt` uses the title; ingredients
are unused), so art needs nothing phase 2 produces.

**RLS/read rule:** skeleton rows behave exactly like recipes today (read own
or global). Client mapper (`recipeRow.ts` + edge `recipe-map.ts`) gains
`contentStatus` + `hook` — both mappers updated in the same commit, per the
sync rule.

### Phase 2 — full recipe (on engagement)

Fired when a card is **kept** or committed as **cook tonight** (whichever
happens first; idempotent). One Luna call writes ONE full recipe (same body
schema as today's envelope entries, ~3.5k tokens, target ~8–12s), validated,
then the skeleton row is filled in place: ingredient_groups, workflow
sections, tags, full nutrition, `content_status='full'`, signature computed
and deduped at this point (existing `computeSignature` — if an identical full
recipe already exists globally, the skeleton is replaced by/pointed at the
cache hit and the duplicate skeleton removed). Phase-2 calls for keeps run in
the background while the user finishes the hand; by allocation time they're
typically done. Opening a recipe whose phase 2 is still running shows the
existing streaming/loading treatment.

Failure: phase-2 failure marks the row `content_status='proposal'` +
`generation_error`; detail view offers retry. Phase-2 calls are quota-free
(the hand already paid); server caps: max 5 phase-2 fills per session row.

### Images

Unchanged function. Client requests: cards 1–3 at deal time (parallel),
card N+2 on revealing card N. Existing atomic lock dedupes. Expected spend
per hand: 3–5 × $0.034 ≈ $0.10–0.17.

### Client

- **Deck screen** (replaces ReviewRecipesScreen in the (eat) stack): card
  stack with peek, keep (right) / pass (left), kept-tray strip, "cook
  tonight" commit on the focused card, "deal a fresh hand" when exhausted.
- **Allocation step:** shown whenever the session ends with ≥1 unallocated
  keep — after the hand completes, after "done", and also after a
  cook-tonight exit (tonight is committed first, then remaining keeps get
  their day chips; skippable, skipped keeps stay saved). Keeps render as menu
  lines with day chips (Tonight / next days) → writes `plan[date]` picks via
  existing `weekPlan` actions (`appendRecipeAndSelect` / `commitSelection`).
- **Loading screen:** existing circled-word loader, retimed copy (honest
  ~15s, not "10 seconds").
- **Stores:** `generationSession` reshaped to hold proposals + deck state
  (kept ids, position). Plan/prefs stores unchanged.
- Old review screen is deleted once the deck ships (no dead flag).

## Not in this build

Per-day generate/regenerate on Week tab; weekly batch generation + paywall
gating; configurable deck size; combo polish for phase 2; swipe-up gesture
for cook-tonight (button first, gesture as polish).

## Testing

- Unit (bun): proposal schema parse, deck reducer (keep/pass/exhaust/fresh
  hand), image-prefetch window logic, allocation mapping to weekPlan.
- Edge: phase-1 + phase-2 happy path and phase-2 fill-in-place vs cache-hit
  dedup; skeleton rows never leak `content_status='proposal'` into surfaces
  that need full content without the loading treatment.
- Live smoke (1–2 paid calls, per cost rule) before any batch verification.
- Sim walk: deal → swipe → keep 2 → cook tonight exit → verify Tonight tab,
  Week allocation, Shop aggregation; circle vs square mask A/B happens here.

## Resolved questions (Zach, 2026-07-10)

1. **Phase-1 title cache shortcut: YES.** On exact title match against the
   global cache, the proposal points at the existing full row instead of a
   skeleton — the card arrives with `content_status='full'` AND finished art
   (`image_storage_path` lives on the same row), phase 2 and the image call
   both skipped. $0, instant.
2. **Voice-context pass-through: YES.** The hand inherits the context line
   the energy flow captures, passed into the phase-1 prompt unchanged.

## Loading screen

The ~10–15s deal moment gets a designed loading experience (concepts explored
in the card-treatments artifact `2270935e`, "deck forming / food" direction);
final pick happens alongside the card mask decision. The existing
circled-word loader is the fallback if none lands better.
