# Scope decision — couple-first, decision-load axis

**Created:** 2026-04-20 (scoping session, no code touched)
**Status:** Design direction. Supersedes the "tonight-vs-week" framing in
NEXT-PASS.md §11. Does NOT supersede the visual-debt or flow-polish items.
**Next session:** implement from this brief.

---

## 1. The framing decision

**Old framing (wrong):** Qook has two products — a tonight-decision tool
(Eat flow) and a week-planning tool (Swipe). They fight for tab space.

**New framing (right):** Qook is an **energy-aware decision-minimizer.**
Solo-first product. Couples are a paid feature on top. The organizing
axis is decision-load, not time horizon.

The core pain — confirmed by prior Reddit research in sashafood docs —
is the "I don't know, what do YOU want?" loop at 5pm. Real user quote:
*"I argue with my husband for about 30 min… Today we're going out."*
That's decision-deadlock, not planning. "Just pick one" ends that
argument in one tap, which is why it's the hero flow, not a feature.

Couples layer (shared household, match list, "⭐ you both liked") is
a **paid upgrade**, not the identity. Per sashafood's own Feb 2026
product spec: *"Couples as feature, not identity… Solo-first product,
couples as a Pro upgrade."* This session re-litigated a settled call;
reverting to solo-first is a correction, not a pivot.

### Why the old framing broke

- `ReviewRecipesScreen.tsx:108` already contradicted it — Eat flow's
  Review step hearts recipes into Saved, identical output to Swipe.
  Two "products," one output bucket, feature duplication.
- Tonight's refresh routes to Eat flow but free users would hit a wall.
  The two were fighting because they were never actually different jobs.

### Why solo-first with couples-as-paid unlocks everything

- **Solo users get the whole decision-minimizer experience.** Energy →
  Tonight's pick. That's the product. No partner required to feel the
  value. Fair Play / mental-load framing applies to single cooks too.
- **Couples are a distribution play + a paid premium.** Per sashafood
  research: "Requires two installs = built-in distribution." Mutual-
  swipe is the viral growth loop *and* the paid unlock — not the core
  JTBD. Real couple workflow today is "one person decides unilaterally
  and texts the plan" — the app supports ONE person driving, with
  optional partner visibility.
- **"Match list" is a paid-tier artifact** (shared household, "⭐ you
  both liked"). Free solo users have a private library and still get
  the full Tonight + Plan + Shop flow.
- **The §9 fallback is now trivially clean** — the couple layer is
  genuinely optional infrastructure that lives behind the paywall
  flag. Strip it = strip a paid add-on, not rebuild the core product.

---

## 2. Tab spec — 4 tabs

Drop from 5 → 4. Kill the Swipe tab and the Saved tab as separate tabs.

| Tab | Primary job | Empty state |
|---|---|---|
| **Tonight** | Show tonight's planned meal. Cook it or swap it. | "Nothing planned — just pick one" button (paid) or "Start planning" link (free) |
| **Plan** | Build / manage the weekly match list. Co-swipe entry. | "Start planning" CTA → solo or paired swipe |
| **Shop** | Aggregate ingredients from Tonight + Plan, pantry check, Instacart. | "Shop list builds when you plan" |
| **More** | Settings, household (add partner), taste prefs, account. | — |

### What happens to Swipe tab

**Killed as a tab.** Swipe gesture moves into Plan tab as the primary
interaction. PaintedCard + gesture + SKIP/Save buttons preserved
visually — just relocated. The Plan tab has two swipe modes:

1. **Swipe this week's drop** (cohort, 48 recipes, free)
2. **Swipe my library** (narrow down what you've already saved — replaces
   the "cycling through 3 cards" sparse feeling for returning users)

Both partners of a household see the same library + cohort state. Either
can swipe at any time. Recipes both have swiped right on get a "⭐ you
both liked" badge in the library and match list. No scheduled session, no
"swipe with Kate right now" mode.

### What happens to Saved tab

**Killed as a tab.** Saved is demoted to an implicit library accessed:
- From inside Plan as a "My library" filter
- From inside Shop as the source list
- From inside Tonight as what the swap button pulls from (paid users)

Everything a user ever swipes right on goes to the library. The **match
list** (current unscheduled agreed-on recipes) is a view on top of it.

---

## 3. Flow map — user intent → screen

### 3a. The "I can't decide" flow (paid, the hero)

1. User taps Tonight.
2. If tonight's slot is already filled (from match list), show the meal.
3. If empty, user taps **"Just pick one"** PaintedButton.
4. Shell asks energy (existing `/(eat)/energy`).
5. App picks one recipe — **from Saved first**, falls back to cohort if
   Saved is thin. No AI call. Instant.
6. Shows recipe in Tonight's spotlight. Swap button persists for "I
   really can't."

This flow is **free of AI cost** (it's picking from existing inventory).
But it's gated paid because the magic is the decision-minimization.

### 3b. The "we want to plan" flow (free)

1. Each partner, on their own time, opens Plan and swipes through the
   cohort (or their library). Every right-swipe goes into the shared
   household library.
2. Recipes that **both partners** swiped right on get an automatic
   "⭐ you both liked" badge. These surface in a **Match list** view at
   the top of Plan when it has ≥2 entries.
3. Optional push notification to partner when a new match lands ("you
   and Kate both liked Thai Basil Chicken"). Low-key — it's a nudge, not
   a planning-session prompt.
4. Either partner trims the match list to the week's count ("we want 4
   meals this week"). Removed ones stay in library.
5. Commit → these become the **week's meals**. Shop aggregates ingredients.
6. Tonight auto-fills from the committed list (FIFO).

Solo users: the Match list doesn't exist for them (no partner = no
"both liked"). Plan tab just shows library + cohort swipe entries. The
commit step still exists — "these 4 are what I'm cooking this week" —
even solo.

### 3c. The "I want something new tonight" flow (paid)

1. Tonight's slot has a planned meal, but user wants out.
2. Tap "I really can't" → bottom sheet offers: **swap from Saved** (free)
   or **draft something new** (paid, Eat flow).
3. If Eat flow: existing `/(eat)/energy` → `/context` → `/loading` →
   `/review` but with **Review rewritten**: user PICKS ONE recipe that
   becomes Tonight's meal. The other 2 drafts are discarded (or logged
   silently for prompt tuning). No hearts, no "save all three."

### 3d. The "shopping day" flow (free)

1. User taps Shop.
2. Aggregated ingredients from match list + tonight's meal.
3. Pantry-subtraction step (new): "Anything you already have? Check it
   off." Items with checks don't go to the cart.
4. Remaining list → Instacart URL / Amazon / Copy / Share (existing).

Pantry check is **on-demand at shop time**, not a persistent inventory
tracker. Dramatically simpler than "fridge mode."

---

## 4. Paywall gate

Per Zach's 2026-04-20 confirmation:

### Free (solo decision-minimizer)

- Energy-first Tonight empty state → picks from cohort or library
- Swipe solo over this week's cohort or personal library
- Personal library (private, no sharing)
- Shop flow (Instacart fallback, pantry check)
- Commit week (solo): cook-these-4 action over library
- Tonight auto-fill (FIFO from committed recipes)
- Manual swap from library

### Paid (AI + Couples)

- **AI Eat flow** (Energy → Context → Loading → Review-picks-one) — the
  "night-of custom recipe tuned to you" hero
- **"Just pick one"** with AI re-ranking (context-aware pick, not just filter)
- **Couples:** pair with partner → shared household → match list +
  "⭐ you both liked" badge → ends the "I don't know, what do YOU want"
  loop
- (future v1.1) Unlimited night-of drafts, priority cohort, pantry memory

### Trial + pricing

**Trial: 3 days.** Short enough to push to paid quickly; long enough to
feel the decision-minimizer magic across 2–3 weeknights.

**Price framing:** annual plan ($19 or $30/yr) displayed as weekly-equivalent
cost (~$0.37/wk at $19/yr) for perceived cheapness. Monthly option shown
alongside for users who want flexibility.

**Premium toggle:** `app.json.extra.premiumMode` flag — flip paid on/off
globally without code changes, for friend testing. Complements the
existing `apiMode` mock/live toggle.

Track `paid_until` locally (AsyncStorage) until Supabase + RevenueCat
land. v1.1 promotes to real IAP.

### Gate placement

- Tonight "Just pick one" button → paywall sheet if not paid
- Eat flow entry (from Tonight swap sheet) → paywall sheet if not paid
- **NEVER** let a free user get into `/(eat)/energy` → `/context` →
  `/loading` and then hit a wall. Gate at entry tap, not mid-flow.

Copy: "Unlock tonight's custom picks — tuned to your energy, fridge,
and mood." Don't say "paywall," don't say "upgrade."

---

## 5. What this means for existing code

**Fine, leave alone:**
- PaintedArcSpinner (loading) — preserved, used in Eat flow
- Co-swipe mechanic doesn't exist yet, but the painted-card primitive
  transfers 1:1
- Shop tab is mostly right (just add pantry-check step)
- More tab is fine (add "Household" row for partner pairing)
- Onboarding carousel is a good base (may need a 4th slide: "plan with
  your partner")

**Needs rewriting:**
- `ReviewRecipesScreen.tsx` — primary action becomes "Cook this tonight"
  on one recipe, not "Save all three." Hearts can stay as a bonus action.
- `TonightScreen.tsx` — add "Just pick one" empty-state CTA when no
  planned meal; add "I really can't" swap button when there is one.
- `SwipeNightScreen.tsx` + its tab route — move into Plan tab or rename
  tab to Plan. Add co-swipe session state.
- `SavedScreen.tsx` + its tab route — delete tab; expose library via
  filter inside Plan.

**New surfaces needed:**
- Plan tab empty state + entry choices (swipe cohort / swipe with
  partner / swipe library)
- Match list view inside Plan (post-swipe, pre-commit)
- Pantry-subtraction step on Shop
- Household setup screen in More (add partner by email/invite)
- Paywall sheet component

**Tab bar update:**
- `apps/native/app/(tabs)/_layout.tsx` — 5 tabs → 4 tabs. Route renames:
  `swipe-night` → `plan`, remove `saved`.

---

## 6. Open decisions flagged, not blocking

These are defaults I made in the brief. Override if you want.

1. **No co-swipe session.** Both partners use the app independently on
   their own schedule. Shared household state is the mechanic; matches
   surface organically when both swipe right on the same recipe.
   Real-time "swipe together" is explicitly NOT built.
2. **Tonight auto-fills FIFO** from the committed match list (oldest
   commit first). Alternative: soonest-perishable-first. FIFO ships; the
   perishability logic can ride on top later.
3. **Discarded Eat-flow drafts are logged silently**, not saved. This
   prevents the "did I just lose 2 recipes?" anxiety while keeping prompt-
   tuning data.
4. **Pantry check is ephemeral** (per shop session), not a persistent
   inventory. No "my fridge" model in v1.
5. **Solo users get the same tab structure** as couples; Plan tab's co-
   swipe option is greyed out or hidden until they pair in More.
6. **Trial length:** default 14 days. Override to 7 if revenue pressure.
7. **Match commit action** is explicit — user must tap "Cook these 4" to
   move from match list → week's meals. Prevents accidental commits.

---

## 7. Explicit non-goals for v1

Don't build these, even if tempted. Add to PLAN.md §10 if they come up
again:

- **Real-time co-swipe session** ("swipe together right now, see matches
  as they land"). Zach likes the idea — parked as a **v1.1+ feature**.
  For v1, shared household state is sufficient: organic matches via
  parallel swipes. Revisit after friends-demo feedback tells us whether
  the household already feels collaborative enough, or whether users
  specifically ask to swipe together live.
- Mon–Sun grid / calendar view. Match list is count-based, not
  day-based. "4 meals this week" not "Monday is salmon."
- Persistent pantry / fridge tracking
- Leftovers / make-ahead logic
- Cook-time push notifications
- Social proof ("2,341 people cooked this")
- Recipe commenting / rating
- Nutrition tracking
- Multi-household groups (roommates, families with 3+). Pair = 2 users
  only in v1.

---

## 8. What the next session should do first

In this order:

1. **Rewrite `ReviewRecipesScreen.tsx`** to pick-one instead of save-many.
   This is the smallest, most contained change and de-duplicates Eat vs.
   Swipe immediately. Copy change + primary CTA change + one-select state
   instead of multi-select hearts. ~30 min.
2. **Update `TonightScreen.tsx`** to show "Just pick one" when empty and
   "I really can't" swap button when filled. Gate "Just pick one" behind
   a local `isPaid` flag (AsyncStorage bool, hardcode true for now).
   ~45 min.
3. **Rename Swipe tab → Plan tab.** One-file rename plus some copy
   updates. Don't build co-swipe yet. Just reframe the tab's empty state
   to "Solo swipe" + a greyed "Swipe with partner (coming soon)" row.
   ~30 min.
4. **Delete Saved tab.** Expose library via a filter chip inside Plan.
   ~30 min.
5. **Pause for device demo + friend feedback** before building:
   - Co-swipe backend session model
   - Household pairing
   - Match-list commit → Tonight auto-fill
   - Pantry-subtraction step
   - Paywall sheet

Items 1–4 reframe the app for friends without building new infra. That's
enough for a credible demo that validates the couple-first pitch. The
heavy lifts (5+) gate on feedback saying "yes, co-swipe is the thing."

---

## 8b. Decisions locked end-of-day 2026-04-20 (supersede earlier sections on conflict)

Three late-evening decisions that tighten the brief. **Read these before
re-reading §3–§5** — they simplify the flow.

### 8b.1 — Ingredients: OPEN, revisit next session

Tentative answer was "assume they have it" but Zach flagged this as
load-bearing: it determines whether Qook is a **spontaneous/discovery**
product (cook what's already home) or a **meal-planning** product
(decide, then shop, then cook). Those are different products.

**The tension:**
- If "assume they have it" — Qook is spontaneous/night-of. Ingredient
  list is advisory. User may find they can't cook the recommendation
  and bounce.
- If "factor in shopping" — Qook is planning-first. User needs to
  decide earlier in the day, or the app needs to route them to Shop.
- The decision-deadlock pain ("what do YOU want") happens at 5pm
  when shopping is late. That suggests spontaneous.
- But the Reddit research also showed users want "shared grocery lists"
  (Mealime reviews) — which suggests planning.

**Do NOT decide this at end-of-day 2026-04-20.** Resolve next session
with fresh brain. The right way to frame it next time:

> "When does the target user actually open Qook? At 3pm (plan + shop)?
> At 5pm (spontaneous)? Both? If both, does the empty state branch?"

Shop tab still handles pantry-subtract at shop time regardless (§3d
stays — opt-in checklist, not an inventory model).

### 8b.2 — Paid = "it decides for you" (collapse Eat flow)

The paid pitch is **one sentence:** "Stop deciding. Tap once, cook tonight."

Collapse the separate AI Eat flow (§3c) into the "Just pick one" flow
(§3a). They are ONE flow:

1. Tonight empty state → **"What's your energy?"**
2. User taps a tier → spinner → Tonight populates with a recipe.

Under the hood, the pick can come from:
- User's Saved library (filtered by tier), OR
- The weekly cohort (filtered by tier), OR
- A fresh AI-generated recipe (only if no good match in Saved/cohort)

User never sees these as separate paths. It's just "the app picked for me."

**The "Context" step (optional text input like 'vegetarian tonight')
becomes a skippable expand on the Energy screen, not a standalone route.**
90% of users tap straight through.

**Review screen shows ONE recipe, not three.** It's Tonight's spotlight.
The 3-draft pick-one-of-three pattern is killed. If user doesn't want
this pick, "Something else" button rolls to the next one.

**Paid tiers (updated):**
- **Free:** cohort browse, manual swipe to library, personal library,
  Shop flow, commit week manually (no energy-pick, no auto-selection)
- **Paid:** tap energy → it decides. Plus couples (shared household +
  match list + ⭐ you-both-liked badge)

The AI Eat flow as a named concept goes away. There's only "the app
picks for you," powered by AI when needed.

### 8b.3 — Aesthetic: dial back hand-drawn, keep brand moments

Update to the design system:
- **KILL:** PaintedButton (wobbly/misshaped buttons), hand-drawn icons
  (IconClose, IconRefresh, IconHeart, IconArrowRight, IconArrowDown,
  etc. — replace with Lucide or cleaner SVG), PaintedCheckbox's
  wobble style
- **KEEP:** watercolor food imagery (Seedream), PaperCard borders,
  BrushstrokeUnderline (used sparingly as title accent — not everywhere),
  cream/forest/rust/prussian palette, Fraunces + DM Sans + JetBrains Mono
- **SHIFT:** lean harder on typography. Let Fraunces + DM Sans pairing
  carry visual interest. Brushstrokes are accents, not the system.

This is a Claude-style restraint pass on the chrome. The food photography
and palette remain distinctive; the over-polished hand-drawn primitives
retreat.

Implementation: `PolishedButton` (already introduced) becomes the default
CTA. PaintedButton is deprecated. Replace painted icons with `lucide-react-native`
equivalents (`X`, `RefreshCw`, `Heart`, `ArrowRight`, etc.). PaintedCheckbox
can stay but lose its stroke wobble.

### 8b.4 — Parked for later (explicit)

- Real-time co-swipe / mutual-swipe Tinder-for-two mechanic — v1.1+
  distribution play, per sashafood research. Don't forget this exists.
- Time-of-day-aware ingredient logic — not v1.
- Pantry tracking — not v1.

---

## 9. How to tell the next session if this brief is wrong

If friends hate the household framing — say it feels weird without a
partner, or solo users bounce — the fallback is:

- Keep the 4-tab structure
- Drop the household layer entirely (no partner pairing, no Match list,
  no "both liked" badge)
- Plan tab becomes pure solo-swipe over cohort + library with a
  solo "cook these 4 this week" commit
- Everything else (decision-load axis, Tonight pick-one, Eat flow
  rewrite, pantry check) still holds

The household piece is a 20% addition on top of a 100% solo-working
app. It's not load-bearing. If it dies, the decision-minimizer pitch
survives.

---

## 10. Session-by-session budget

Rough estimate of what fits per session (use as sanity check):

- **Session 1 (reframe):** items 1–4 above. Demo-ready single-player
  decision-minimizer with renamed tabs.
- **Session 2 (household shell):** Plan tab expanded empty state with
  Match list component, household pairing in More, invite-by-email stub
  (no real email).
- **Session 3 (shared state backend):** Supabase `households` table,
  `household_members`, shared `swipes` and `library` scoped by household,
  "both-liked" query for match list, notification stub.
- **Session 4 (commit → shop):** Match-list commit action, Tonight
  auto-fill, pantry-subtraction step on Shop.
- **Session 5+ (paywall, polish, real Apple Sign-in, real Instacart):**
  The rest of the 32-day plan, unchanged.

Roughly aligns with 32-day target if Supabase/OpenRouter externals
clear by D10.
