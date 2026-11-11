# Shop Meal-Filter Pills — Design

**Date:** 2026-07-13 · **Requested by Zach:** "at the top there's a slideable
toggle, kind of like how in Spotify … the meals you've selected. You can
unselect them, and that would change the shopping list."

## What it is

A horizontally scrollable row of meal pills at the top of the Shop tab — one
pill per meal currently feeding the shopping list. Every pill starts ON. Tapping
a pill toggles that meal's ingredients out of (and back into) the list. The
masthead count, category groups, Copy/Share, and Instacart/Amazon hand-offs all
follow the filtered list automatically because they already derive from the
aggregated items.

## Which meals get a pill

The same set that feeds the list today, in this order:

1. **Planned picks** — the active pick of every today-or-future day in
   `weekPlan.plan`, in date order, deduplicated by recipe id (a dish planned
   twice gets one pill; toggling it removes both nights' demand — you're either
   shopping for that dish or you aren't).
2. **Staged recipes** — active `shopStaging` entries ("Add all to list" from a
   saved recipe or detail view) not already present as a pick, in staging order.

The row renders only when there are **2+ meals** — filtering a single meal is
just emptying the list.

## Interaction model

- **Multi-toggle, not solo-scope.** All pills ON by default; each tap flips one
  pill. (Spotify's tap-one-to-scope-to-it was considered and rejected — Zach's
  words were "you can unselect them," and with 3–6 meals the common intent is
  "skip that one dish," not "show only this dish.")
- **Ephemeral state.** Exclusions live in ShopScreen component state alongside
  the existing `checked` map — same lifetime, nothing persisted. A meal that
  leaves the plan takes its pill and its exclusion with it.
- **All pills off** → the list area shows a one-line note ("Every meal is
  hidden — tap a pill to bring its ingredients back.") instead of the
  no-ingredients empty state, so it never reads as data loss.
- Toggling never touches per-item checkboxes; re-enabling a meal restores its
  items with their prior checked state (item keys are stable canonical keys).

## Visual

Placement: between the title row ("Shopping *list*") and the first category
divider. The row bleeds to the screen edges (negative margin, padded content)
so pills scroll off-screen Spotify-style.

Pill anatomy: a 22px `Vignette` thumb (the meal's watercolor art, monogram
fallback) + the recipe title, `BodyText` 13 medium, one line, max ~150pt wide.
Radius 999, hairline border.

- **ON:** `palette.well` fill, ink text, full-opacity thumb. Calm by design —
  the default state is all-on, so ON must not shout.
- **OFF:** transparent fill, `glassBorder` outline, `textTertiary` text, thumb
  at 35% opacity. Reads as "ghosted out," not deleted.

Accessibility: `accessibilityRole="button"`,
`accessibilityState={{ selected }}`, label "{title} — N items ON/OFF of list".
No emojis, no new colors, no new type styles — everything from the existing
token set.

## Implementation shape

- `aggregateIngredients.ts` gains `collectShopMeals(plan, todayIso, staged):
  Recipe[]` (the pill source list) and an optional `excludeIds:
  ReadonlySet<string>` parameter on `aggregateIngredients` that skips excluded
  recipes in both the picks and staged legs. Pure, bun-testable.
- `MealFilterPills.tsx` — presentational row component (meals + excluded set +
  onToggle).
- `ShopScreen.tsx` — `excluded` state map, `meals`/`excludeIds` memos, row
  render, filtered-empty note.

## Out of scope (deliberately)

- Persisting exclusions across sessions.
- Per-night pills for a dish planned twice.
- Unit arithmetic changes — quantities aggregate exactly as before.
