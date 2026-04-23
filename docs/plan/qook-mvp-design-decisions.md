# Qook MVP — Design Decisions & Rationale

**Companion to:** [qook-mvp-plan.md](./qook-mvp-plan.md)

This doc captures the *why* behind the plan. The plan tells you *what* to build; this tells you *why* it's shaped that way, what alternatives were rejected, and what judgment calls a future session should preserve vs. revisit.

---

## Product thesis

Qook is an **energy-aware dinner decision app**. Not a recipe browser. Not a meal planner in the traditional week-calendar sense. The product job is:

- Reduce decision fatigue on a tired Tuesday at 6pm.
- Give an honest picker that takes your actual bandwidth into account ("I have 30 minutes and no brain cells").
- Turn a messy dinner choice into one realistic next move.
- When planning-minded, let you tag upcoming days with energy and get a week's worth of dinners + one shopping list.
- Let you look back and re-cook things that worked.

**One loop, four tabs:**

- `Tonight` — hub. What's for dinner now + what's coming up + what you've cooked before.
- `Week` — energy map. Tag nights with 15/30/45 minute chips, draft a week at once.
- `Shop` — derived list. Aggregates ingredients from `Week`'s picks.
- `More` — settings drawer.

Saved/cookbook as a top-nav tab was removed. Its purpose ("look back at what worked") folds into Tonight's dashboard.

---

## Design system references

### Palette (locked)

Source of truth: `apps/native/src/design/colors.ts`.

| Role | Hex | Notes |
|---|---|---|
| Background | `#FCF9F1` | cream ground |
| Surface | `#FFFCF6` | raised cards |
| Surface translucent | `rgba(255, 252, 246, 0.85)` | glass chips |
| Ink / text | `#2A3A26` | deep forest doubles as primary |
| Text secondary | `#5F7057` | subheads |
| Text tertiary | `rgba(95, 112, 87, 0.65)` | dim state |
| Accent (rust) | `#C36A48` | decorative |
| Accent deep | `#A85539` | kicker text |
| Utility (prussian) | `#3D5469` | rare, tier chips / badges |
| Highlight (ochre) | `#E2BA7C` | rare warm callout |

Week's tier-chip backgrounds:

| Minutes | Tier | Color |
|---|---|---|
| 15 | `brain-is-fried` | `palette.utility` (prussian) |
| 30 | `after-work` | `palette.accent` (rust) |
| 45 | `got-energy` | `#7A8568` (sage, not in palette) |
| 60 | `weekend-project` | `palette.primary` (forest) — not used in Week v1's 3-tier scale |

### Typography (locked)

Source: `apps/native/src/design/typography.ts`.

- Display: **Fraunces_700Bold** — hero titles, minutes hero numbers
- Body Regular: **DMSans_400Regular**
- Body Medium: **DMSans_500Medium** — most body copy on Qook
- Body SemiBold: **DMSans_600SemiBold** — CTAs, card titles
- Mono: **JetBrainsMono_400Regular** / **JetBrainsMono_700Bold** — kickers, meta, tags (always uppercase)

Type scale: `displayXL=56 / displayL=44 / displayM=32 / displayS=22 / bodyLG=17 / bodyMD=15 / bodySM=13 / monoMD=11 / monoSM=10`.

### Spacing & radius

- Spacing: `xs=4 / sm=8 / md=16 / lg=24 / xl=32 / xxl=48`
- Radius: `tiny=8 / nested=12 / card=18 / sheet=24 / pill=999`

### Icon specs (locked)

Existing custom painted icons (`src/components/painted/Icon.tsx`) are the source. Lucide icons are used for in-screen actions (X, ArrowRight, RefreshCw, ChevronRight, Check). Tab icons are custom painted.

**Why custom painted tab icons:** they're tuned for the cream/forest brand at small sizes. Lucide defaults render muddier on the blurred tab bar. The icons were drafted in Paper (artboard `2PQ-0 "Tab Anatomy"`) and matched in code.

**Simplification for 22px:** the Paper Tab Anatomy icons work at 60px+ card display, but at 22px inside the blurred tab bar they need fewer marks. The plan's updated SVG paths drop interior details (no day-dots on Week, 2 steam ticks instead of 3 on Tonight) — Codex explicitly flagged this as a medium-severity regression in the first review pass.

**On-device verification is mandatory** (Move 1 exit criterion). If the simplified shapes still alias, drop further: Week → just the rounded rect + one top-tab, Tonight → bowl + 1 steam tick.

Final 22px SVG paths (in Move 1):

- **IconTabTonight (bowl + 2 steam ticks):**
  ```xml
  <Path d="M3 11 H 21" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
  <Path d="M4 11 Q 4 18, 12 18 Q 20 18, 20 11" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  <Path d="M10 4 V 8" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
  <Path d="M14 4 V 8" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
  ```

- **IconTabWeek (calendar rect + 2 top tabs + divider):**
  ```xml
  <Rect x={3.5} y={4.5} width={17} height={16} rx={2.5} stroke={color} strokeWidth={1.9} fill="none" />
  <Path d="M8 2.5 V 6.5" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
  <Path d="M16 2.5 V 6.5" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
  <Path d="M3.5 10 H 20.5" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
  ```

- **IconTabShop (unchanged):** existing tote-bag path at `src/components/painted/Icon.tsx:196-213`.
- **IconTabMore (unchanged):** three dots at `src/components/painted/Icon.tsx:231-239`.
- **IconTabSaved:** deleted.

---

## Paper artboard references

Zach's Paper file contains the visual reference. Artboard IDs for reference (internal to the Paper file, not accessible from code):

- **`2CT-0 "Happy Path — Tonight, Sorted"`** — full 7-step user flow: Tonight empty → Energy → Context → Loading → Review pick-one → Recipe Modal → Tonight populated.
- **`2PQ-0 "Tab Anatomy — Five tabs, two paths"`** — originally documented 5 tabs; now 4, but the icon style + card aesthetic remains the reference.
- **`2W5-0 "Week — Energy Map"`** — the final Week screen mock. 7 day rows, 3 chips per row (15/30/45), active chip tier color, draft CTA at bottom.

These are not exported; the plan captures everything code needs. If running a new Paper design pass later, reference these IDs.

---

## Codex review history

Two adversarial review passes run by `/codex:adversarial-review` during planning. Both are archived here because they inform decisions that look odd out of context.

### Pass 1 — first plan (pre-rewrite)

**Verdict: needs-attention.** Five findings:

1. **[high] Week v1 scoped as multi-day but generationSession is single-target.** Bolting a `forDate` scalar onto a singleton session doesn't represent multi-day state. → Addressed: `generationSession` is Tonight-only; Week uses a separate `batchSession` + `batchDraft` orchestrator.
2. **[high] "Draft N dinners" CTA only drafts first tagged day = product lie.** → Addressed: `batchDraft` actually drafts all N sequentially.
3. **[high] `forDate` cleared by `start()` drops commit-back on regenerate.** → Addressed: `forDate` doesn't exist. Review writes directly to `weekPlan[today]`. Week uses `batchDraft`, no session plumbing.
4. **[high] UTC ISO date math misfiles dinners for US evening users.** → Addressed: `weekDates.ts` uses local `getFullYear/getMonth/getDate`. Never `.toISOString().slice(0, 10)`.
5. **[medium] Tab glyphs too detailed for 22px.** → Addressed: further simplified paths in Move 1, on-device verify is an exit criterion.

### Pass 2 — revised plan

**Verdict: needs-attention.** Four findings (all addressed in this plan):

1. **[high] AsyncStorage hydration race overwrites live user interactions.** → Addressed: `useWeekPlan` has `hasHydrated` flag, custom `merge()` that overlays in-memory writes onto persisted state, `onRehydrateStorage` callback. Screens gate interactive CTAs on `hasHydrated`.
2. **[high] Batch drafting non-idempotent: retry regenerates successful days.** → Addressed: `batchSession` tracks `perDate: Record<ISODate, PerDateStatus>`. `batchDraft` accepts `{ redraftAll?: boolean }` option; default retry targets only pending/failed dates via `pendingOrFailedDates(perDate)`.
3. **[high] `cookedAt` conflated with selection; Shop drops selected-but-not-cooked days.** → Addressed: `DayPlan` now has separate `selectedAt` (set on pick commit) vs `cookedAt` (reserved for v1.1). Shop filters `date >= todayIso`, no `cookedAt` exclusion. Recent cooks filter on `selectedAt` past-dated.
4. **[medium] "Cook this tonight" modal overwrites existing recipes trio.** → Addressed: new `appendRecipeAndSelect(date, recipe)` action on `useWeekPlan` — appends if not present, moves pickIndex if present, never destroys the existing trio.

**Additional type bug Codex caught but didn't file as a finding:** `aggregateIngredients` drafted with `ingredients: {name, quantity}[]` but `Recipe.ingredients: IngredientGroup[]` (nested `.items: Ingredient[]`). → Addressed in Move 9: `pick.ingredients.flatMap(g => g.items)` with dedupe keyed on `parsed.canonicalKey` when present, falling back to lowercased `item` string.

### Expected Pass 3 posture

A third review pass should find no high-severity blockers if Moves 1–10 are executed as specified. Medium-or-lower findings likely to surface:

- Shop quantity strings are concatenated, not added (`"2 lb + 1 lb"` instead of `"3 lb"`). Acknowledged v1 scope; real unit arithmetic is v1.1.
- No visual feedback when `appendRecipeAndSelect` adds a recipe to an existing trio (the swap cycle silently grows from 3 to 4). Acknowledged; follow-on could add a toast.
- `clearFuture` removes tagged-but-undrafted days too. Intentional — "Clear future plans" is a big-hammer reset.

---

## State model rationale

### Why one unified `weekPlan` store

Considered splitting into `tonightSelection`, `weekPlan`, `cookHistory` separate stores. Rejected because:

- Tonight's hero IS `weekPlan[today]`. Separating them creates sync bugs.
- History IS `weekPlan[date < today]`. Same store, different time filter.
- Upcoming IS `weekPlan[today < date ≤ today+3]`. Same store, different filter.
- One source of truth means the dashboard can't go inconsistent with Week's writes.

### Why `selectedAt` but no `cookedAt` in v1

Explicit cook-confirmation ("I made it") adds a friction step users will forget or skip. The honest MVP assumes: if you picked a recipe for a past date, you probably cooked it. Past-date filter for "Recent cooks" uses `selectedAt` alone.

This becomes wrong when users backfill (e.g. "Yesterday I actually had takeout, but I'm logging in now and the UI auto-populates history with yesterday's selectedAt recipe"). Accepting that v1 quirk. v1.1 can add a single "Skipped it" tap on history rows.

### Why batchSession is not persisted

`batchSession` captures the *in-flight* batch state. If the app is killed mid-batch, we don't want a stale "drafting..." state blocking the UI on relaunch. Results get written to `weekPlan` as each day completes (that IS persisted). On relaunch: `batchSession` is idle, `weekPlan` reflects partial progress, and retry (if user chose to) targets only pending/failed dates — which are now recomputed from `weekPlan` (dates without recipes).

### Why `generationSession` stays single-target

Tonight's flow is a well-loved existing surface. Multi-day batching is a Week concern. Bolting multi-target state onto Tonight's session was the root of Codex Pass 1 findings. Keeping them independent is cheaper + clearer + bug-proof.

---

## Alternatives considered & rejected

**Aggregate `Draft N dinners` CTA as single-day with lying copy.** (Prior plan.) Rejected after Codex Pass 1: shipping a CTA that intentionally lies about behavior is a trust footgun.

**Store only recipe IDs in weekPlan, re-fetch full recipe on render.** Considered for storage size. Rejected because:
- In mock mode, recipes come from `mockRecipes` fixture — no re-fetch overhead.
- In live mode, recipes come from a generation call that's expensive; re-fetching by id from Supabase is fine, but adds a loading state to every Tonight hero render and every Upcoming card render.
- Recipe size is ~1-2KB — a week's worth is ~30KB persisted. Negligible.

**Use zustand/middleware persist with `skipHydration`.** Considered. Rejected — we actively want rehydration; we just want a flag to know when it's done. `onRehydrateStorage` + custom `merge` is the documented pattern.

**Shop with proper quantity math (unit conversion, arithmetic).** Considered. Rejected for v1 — the conversion logic is legitimately hard (cups/grams/tablespoons/pieces), and the MVP doesn't hinge on it. Concatenated distinct strings + recipe titles is enough to do a grocery run. Proper math is v1.1.

**Make `Try another` on Review use `PolishedButton tone="ghost"`.** Considered in earlier plan. Rejected — a text link sits better below the forest CTA without competing. Kept as `<Pressable><BodyText>Try another</BodyText></Pressable>`.

**Keep SwipeNightScreen as the Week tab content.** Considered early. Rejected — the swipe-per-card interaction is a different product (passive discovery) than Week (active commitment to specific days). Folder stays for archival; route is renamed.

---

## Open questions (deferred / v1.1+)

- **Explicit cook confirmation.** Tap a "Mark cooked" on Tonight hero after cooking → sets `cookedAt`. Tightens Shop semantics (exclude cooked from future shopping). Requires UX for the mark action.
- **Batch draft parallelism.** Currently sequential. If generation API proves stable + rate limits allow, parallel drafting would cut 3 dinners from ~15s to ~5s. Needs supabase edge function throughput check.
- **Shop persistence for check-off state.** Checkboxes reset on app relaunch today. Adding to `useWeekPlan` as a `checkedItemKeys: Set<string>` would persist.
- **Instacart export.** Zach's preferred v1 goal, punted if Platform approval slips. Fallback is the "Copy list" button currently in-plan.
- **Household sharing.** Two people on one weekPlan. Requires supabase sync layer; out of MVP.
- **Empty Week → "auto-plan this week for me" smart defaults.** Could pre-tag the next 5 days with inferred energy based on day-of-week. Interesting but unclear value for first ship.
- **Recipe Modal inside Tonight populated hero** — should Cook now go directly to cook mode (step timer) vs. Recipe Modal? Currently routes to Modal; cook-mode is a separate feature.

---

## Reasons to *not* touch certain things

- **`src/features/swipe-night/` folder** — archival of the original swipe deck. Don't delete. If we revisit passive discovery later, the code is there.
- **`src/stores/swipeDeck.ts`** — same reason. It's inert if the route is unreachable.
- **`src/services/api.ts` `getTonightPlan` function** — still used by the current TonightScreen. After Move 8, TonightScreen no longer calls it, but the function stays (could be used by future server-driven Tonight hydration).
- **`PaintedButton` primitive** — CLAUDE.md calls it deprecated in favor of `PolishedButton`. But the migration isn't part of this pass. PaintedButton stays functional; Review + Tonight empty + Week CTA still use it. Migrate cleanly in a focused follow-on pass.
- **Existing `IconTab*` icons that we're NOT touching** (`IconTabShop`, `IconTabMore`) — they work at 22px. Leave alone.

---

## Verification protocol

Before declaring a move complete:

1. **`bun run typecheck`** — clean.
2. **`bun run lint`** — clean.
3. **Sim walk** per move's verification block.
4. **Cross-move regression check** — touch the surfaces from earlier moves, confirm they still work.
5. **Persistence check** (Moves 3+) — force-quit app, relaunch, confirm state survives.

**Critical integration checks** (after Move 10 only):

- DST boundary behavior (manual clock setting).
- Batch failure → resume flow.
- Non-destructive "Cook this tonight" from modal doesn't drop existing trio.
- Hydration gate prevents empty-state flash on cold launch.

---

## Handoff to a fresh session / Codex

If Codex or a fresh Claude session picks up execution:

1. Read this doc first (design decisions).
2. Read [qook-mvp-plan.md](./qook-mvp-plan.md) (executable plan).
3. Read `apps/native/CLAUDE.md` (stack + locked decisions).
4. Read these three files before any edit to confirm current state:
   - `apps/native/src/components/painted/Icon.tsx`
   - `apps/native/src/features/tonight/TonightScreen.tsx`
   - `apps/native/src/features/shop/ShopScreen.tsx`
5. Execute moves in order 1→10. Each is a discrete commit target.
6. Do not batch unrelated moves into single commits — they're independent for a reason (rollback, reviewability).
7. If anything in the plan doesn't match the code, **read the code, update the plan, then edit** — do not assume the plan is right. This doc captures the *why*, but the code is source of truth for current shape.
