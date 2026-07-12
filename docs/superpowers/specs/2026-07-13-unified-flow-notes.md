# Unified Planning Flow — synthesis notes (pre-spec)

**Date:** 2026-07-13 · **Status:** discussion synthesis, NOT approved for build.
Zach + Fable, after the weekly-reset-deck TestFlight round. Codex review pending.

## The diagnosis

Tonight and Plan both write to the same week (Tonight = today's row) but present
as separate products: two entry points, different geometry (one target vs.
many), different exits. Worst offender: "Cook tonight" mid-deck in week mode —
a placement decision that behaves like an exit, silently downgrading a
week-sized transaction to a tonight-sized one.

## The model (agreed in principle)

1. **Scope first.** One entry — pick **Tonight · Next few nights · The whole
   week** (scroll-wheel/segment feel). Per-night tier chips (15/30/45) remain
   as the fine-grained layer for multi-night scopes. Tonight tab's CTA skips
   the scope screen (scope implied), so the extra step only appears where
   ambiguity exists.
2. **Deck is scope-agnostic.** Same swiping regardless of scope. "Cook
   tonight" on a card = a **pin-tag** (pre-assigns tonight's slot, keep
   swiping), never an exit. Tonight-only scope collapses allocation: first
   keep ends the flow.
3. **No auto-clear — ask at entry.** Starting a week-scope plan over existing
   meals asks once: "Replace your upcoming nights? Tonight's set too — replan
   or keep it?" (Both agreed: destructive defaults rejected. "Clear future
   nights" button becomes less load-bearing.)
4. **Everything exits to Plan**, tonight highlighted. Tonight tab becomes a
   pure consumption surface: cook mode, swap among alternates. It originates
   nothing.

## New this round (Zach 2026-07-13)

5. **Browse before generate.** It should be easy to see what meals you already
   have and just pick one — "flick through a list, okay, this looks good." Not
   every night needs a fresh generation. Direction: promote DaySheet into a
   **universal day sheet** on tapping ANY day: bench + saved + recent history,
   pick-to-place, with "Deal fresh ideas" as one option among them. (Also
   fixes the known gap: bench notice says "tap a night" but untagged nights
   are inert.)
6. **Plan empty state is an invitation**, not a blank: roughly "What do you
   want to add to your cooking?" — with the tonight row always present.
7. **Tab naming open question.** Zach floated renaming (e.g. first tab "Qook").
   Fable pushback: the app name as a tab label has weak information scent;
   after the flow unification, "Tonight" becomes MORE accurate (pure
   consumption). Decide last, once flows settle.
8. **Drag-and-drop meals between days** (snap between rows) — existed in a
   prior app (sashafood); research pending on where that code lives and what
   it used.

## Codex review (2026-07-13, gpt-5.6-sol) — accepted amendments

Verdict: unification directionally right; "cook tonight" must become a pin.
But it sharpened the model in ways we're adopting:

- **Scope is inferred, not ceremonial.** Tonight CTA → `[today]`, day-sheet
  "deal fresh" → `[that date]`, no scope screen for either. Only the Plan CTA
  shows scope — as a *lightweight editable set of concrete dates* (defaulted
  from tagged/empty upcoming days), not a three-option wheel. "Tonight / next
  few / week" is presentation; domain state is `scope: ISODate[]`.
- **"Exits only at the end" is not absolute.** The durable frame is choose
  scope → collect → place → return to Plan; tonight-scope legitimately
  collapses collect+place into one action, and leaving mid-flow must be SAFE
  (persisted session + visible "Continue planning 3 nights" resume entry +
  deliberate "Start over"), not forbidden.
- **Allocation can't just disappear.** Collision rules needed: two keeps on
  one day, replacing an occupied day (explicit + reversible, decided BEFORE
  money is spent on generation), more/fewer keeps than dates, tier mismatch.
  Auto-place only when exactly one unambiguous target; otherwise a compact
  review, not the full ceremony.
- **Session store needs a real v2 migration.** `mode` → `origin` + `scope` +
  `pinnedPlacements` (don't overload one field); versioned persistence with
  hydration validation + stale-session expiry — old TestFlight state must not
  reopen into impossible combinations. This touches prefetch, exits,
  representative tier, bench lifetime, route guards.
- **Day sheet = day picker, not a bigger bench drawer.** Order: current
  meal's actions (open/replace/move/remove) → "best for this day" (blended
  bench+saved+recents, tier-aware, week-deduped) → saved → recently cooked →
  bench → "Deal fresh ideas" persistent footer. Bench ranks LOW (session
  residue; saved expresses intent). Provenance labels ("Saved", "Cooked 3
  weeks ago"). Section-local empty states.
- **"Move to…" before drag-and-drop.** A reliable move action in the day
  sheet covers most demand; drag carries gesture/scroll/a11y/accidental-
  replacement costs — add it on evidence, not instinct.
- **Keep Tonight as the tab name** (agrees with Fable's pushback).
- **Flagged pre-existing conflation:** the deck auto-saves every keep, so
  Saved is currently low-intent — fix before the day picker treats Saved as a
  high-intent source.
- Also: failure/offline paths must preserve existing picks and offer
  browse-only completion; Shop must recompute on move/replace; saved/recents
  can contain skeletons/dead rows/missing art; date rollover can make
  `[today]` stale mid-session; keep/pass and move need non-gesture controls.

## Sequencing (Codex-revised, adopted)

1. Scope/session model + migration + collision/replacement rules (the
   foundation everything else stands on).
2. Universal day sheet (every day tappable; saved/recents/current-meal first).
3. Convert generation entries to date scopes; "Cook tonight" → pin.
4. Simplify allocation; every successful exit lands on Plan.
5. "Move to…" controls (drag-and-drop later, on evidence).
6. Naming pass last.

## Also queued (not this flow)

- Card-back polish: type a touch small (Zach).
- Image prompt: protein *form* hint (ground beef painted as sirloin chunks).
- Apple sign-in (Phase 5) before wide sharing; TestFlight internal sharing
  works today on anon auth.

## Prior-art: drag-and-drop research (sashafood, 2026-07-13)

Found — it was the OLD RN app (the SwiftUI app used tap-to-assign day chips
instead). `apps/native/components/meal-plan/draggable-meal-card.tsx` +
`dinner-list.tsx`: hand-rolled `Gesture.Pan()` (long-press 350ms to arm, so
it never fights scroll) + reanimated springs — the SAME gesture-handler/
reanimated v4 stack the new repo runs, so the ~40-line gesture block is
near drop-in.

Honest limits: it's a 1:1 **swap** between fixed day slots (no reflow/insert),
its snap math assumes **uniform fixed-height rows** (`round(translationY /
(CARD_HEIGHT + GAP))`) — the new DayRow is variable-height (filled row vs.
chip row), so target resolution must be rebuilt on measured layouts. No
haptics (cheap to add), no persistence (it was a prototype on mock state).

Verdict: port the *feel* (long-press arm → float → spring settle →
border-flash confirm), rebuild targeting. Consistent with Codex's call:
ship "Move to…" in the day sheet first, add drag when usage demands it.
