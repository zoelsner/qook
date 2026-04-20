# Next Pass — Friends-Feedback Ship Plan

**Created:** 2026-04-20 (end of Day 1)
**Handoff from:** Claude Opus 4.7 after live demo on iPhone 17 Pro Simulator
**Target:** ship to a few friends for feedback within the next couple sessions

---

## 1. Handoff state

### What's running right now

- **Metro bundler + iOS Simulator** are live in the background. If stale:
  ```bash
  cd /Users/zach/Projects/qook/apps/native && bunx expo start --ios
  ```
  Bundle cold-compiles in ~6s, 1957 modules. Simulator auto-opens iPhone 17 Pro (iOS 26.2).
- App name on Simulator: `Qook` (bundle id `com.qook.app` from a pre-existing dev build; running through Expo Go during JS dev, so this id doesn't matter until EAS Build).
- Expo Go logs spam a harmless `ENOENT: assets/images` — Expo CLI expects a conventional folder we don't have. Ignore.

### Git state at handoff

- Branch `main`, clean working tree, up to date with `origin/main`.
- 9 commits pushed through `a4aea2c` (see [START-HERE.md](./START-HERE.md) for the list).
- `apps/native/tsconfig.json` was auto-modified by Expo CLI on startup (it updates the `include` property). Not staged. Safe to commit or leave — Expo regenerates on start anyway.

### What the 5 tabs look like right now

- **Tonight** — spotlight card (Sheet Pan Chicken) + 2 more-picks (Miso Salmon, Peanut Noodles). Refresh icon top-right. "READY TO COOK" status + small inline "Cook tonight" green pill.
- **Swipe** — painted stack (3 recipes cycled through 12 deck slots). SKIP (outlined rust) + Save (rust painted) buttons. 9/12 · 5 SAVED progress line.
- **Shop** — Grocery list grouped by Protein/Pantry. PaintedCheckbox rows. "Ready to shop · 1 items left · delivered via Instacart" dock with forest painted CTA + Copy list · Share · AmazonFresh fallback.
- **Saved** — empty state card explaining where swipe-ins land.
- **More** — 4-row settings list with "TASTE / WHO / WHEN / YOU" kicker slots.

---

## 2. User feedback (Zach's 2026-04-20 live-demo comments)

Direct quotes, paraphrased where long:

- **Ship vibe:** "Starting to look pretty good. Maybe I should just get this out sooner than later and get some feedback from friends."
- **Tonight underline:** "The Tonight and the squiggly line. I like that." (keep)
- **Color anxiety (open):** "I'm wondering if people like the colors." (not asking for a change — noting)
- **Swipe Save button is off:** "The Save is a little odd... the Skip feels like, can we make this Save like the Shop?" → wants Swipe Save to look like the **forest painted CTA from Shop's Instacart button**, not rust.
- **Checkboxes are tap-broken:** "They're kind of hard to click, though. You have to click on the name and not the square, so we should fix that." (confirmed bug — see §3)
- **Settings look good:** "Preferences, household, generation, account." (keep More as-is)
- **Value-prop question:** "So what even is our value prop here, and is it cool, is it different? What are we actually bringing to the table?" (pushback solicited — see §5)
- **Tonight refresh → Eat flow (decided):** "If I click the refresh, then it should go to asking me 'Okay, what are my energy levels?' and then give me like 10 seconds of feedback that I can put into helping figure out what else I'm looking for. Then we would pull down from... a set of meals or something."
  - This is the **Eat-flow entry point decision** that was left open. Tonight's refresh IconPill now routes into `/(eat)/energy`.
  - The "10 seconds of feedback" is the **voice/prompt Context step** between EnergyPicker and GenerationLoading. Matches PLAN.md §6.4 state `collecting_context`. Currently unbuilt.
- **Instacart is cool but needs prominence:** "I like that. I want to try to get that hooked up." + wants it more visible.
- **Feedback invitation:** "Always, always feel free to push back."

---

## 3. Tier 1 — Bugs + quick visual fixes (ship before friends demo)

Do these in separate small commits. Each is <15min of work. Verify tsc + lint + expo export after each.

### 3.1 — Fix PaintedCheckbox tap propagation (real bug)

**File:** [apps/native/src/components/painted/PaintedCheckbox.tsx](../../apps/native/src/components/painted/PaintedCheckbox.tsx)

**Root cause:** `PaintedCheckbox` wraps its SVG in its own `<Pressable>` whose `onPress` calls `onChange?.(!checked)`. In both ShopScreen and RecipeDetailModal, we don't pass `onChange` — the parent row is the Pressable. So tapping the square hits the inner Pressable, finds no handler, and swallows the event. Tapping the name works because the outer row catches it.

**Fix:** when `onChange` is undefined, render as `<View pointerEvents="none">` so taps bubble to the parent. Keep the existing Pressable wrapper for standalone use. Both existing callsites (ShopScreen.GroceryRow, RecipeDetailModal.IngredientRow) will Just Work.

```tsx
// In PaintedCheckbox.tsx
if (!onChange) {
  return (
    <View
      pointerEvents="none"
      style={[{ width: size, height: size, opacity: disabled ? 0.5 : 1 }, style]}
    >
      {svg}
    </View>
  );
}
// ... otherwise keep the Pressable branch
```

**Verify:** tap the square on Shop → row toggles. Tap the square on a Recipe Modal ingredient → strike-through applies.

### 3.2 — Swipe Night Save: rust → forest (match Shop's Instacart CTA)

**File:** [apps/native/src/features/swipe-night/SwipeNightScreen.tsx](../../apps/native/src/features/swipe-night/SwipeNightScreen.tsx)

**Change:** `<PaintedButton label="Save" ... tone="rust" ...>` → `tone="forest"`.

**Rationale:** User wants the primary swipe action to feel like the primary CTA elsewhere. Rust reads "warning" / "destructive." Forest reads "do this." Instacart button is forest, Cook Tonight in Recipe Modal is forest, this should be too.

The **Skip** button stays outlined (secondary), but could also be updated to match — try it with palette.primaryMuted border instead of utilityMuted for warmer look. Try on device, pick what reads better.

### 3.3 — Tonight refresh IconPill → `/(eat)/energy`

**File:** [apps/native/src/features/tonight/TonightScreen.tsx](../../apps/native/src/features/tonight/TonightScreen.tsx)

**Change:** The refresh `IconPill`'s `onPress` currently calls `refetch()` (a no-op in mock mode). Replace with:

```tsx
onPress={() => {
  press();
  router.push('/(eat)/energy');
}}
```

Remove the `refetch`/`isRefetching` bits since they're now unused. Icon stays the same (circular arrow reads as "new ideas" clearly enough).

This wires the biggest flow-level UX decision Zach had been holding open. The Eat flow is already fully built ([app/(eat)/energy](../../apps/native/app/(eat)/energy.tsx)|loading|review) — we're just adding the entry trigger.

### 3.4 — Same refresh entry from Tonight EMPTY state

**Condition:** today `recipes.length === 0` on Tonight shows "no plan yet" in a `<Mono>`. On Sunday-before-new-deck, a user should see a friendly CTA to generate.

**Fix:** replace the `<Mono>no plan yet</Mono>` branch with a small card:
- Kicker "sunday reset"
- DisplayText "No plan yet."
- BodyText "Cook up fresh picks for tonight — takes about 10 seconds."
- PaintedButton "Draft tonight" size=lg tone=forest → routes to `/(eat)/energy` (same as refresh)

### 3.5 — Make Shop dock more prominent

**File:** [apps/native/src/features/shop/ShopScreen.tsx](../../apps/native/src/features/shop/ShopScreen.tsx) — `<ShopDock>` component

**Zach:** "I think we want to make that a little more visible but I like that."

**Options (pick one on device):**
1. **Sticky at bottom** — Wrap the ShopDock in a `<View style={{ position: 'absolute', bottom: 16, left: 12, right: 12 }}>` above the tab bar like RecipeDetailModal's Cook Dock. Content scrolls behind it. Slight transparency / shadow.
2. **Larger inline block** — keep inline, bump padding to 28 + add the total dollar estimate at 32px display, add a second-line tagline under "Ready to shop" like "4 recipes · 11 items left."
3. **Both** — sticky AND larger.

Default to #1 (sticky) since it matches the RecipeDetailModal pattern and keeps the dock always one tap away.

### 3.6 — `apps/native/tsconfig.json`

Auto-modified by Expo CLI. Either commit with a note ("chore: accept tsc include update from expo CLI") or revert + add to `.gitignore` if it regenerates every run. Inspect first; if the diff is just include-path normalization, commit it.

### 3.7 — Lighter background + quieter washes — ALREADY APPLIED + COMMITTED in this pass

Zach: "All the colors are kind of a lot, like maybe it is just a little creamier... Even 20% lighter, start there."

Changes in [src/design/colors.ts](../../apps/native/src/design/colors.ts) (commit in this pass):

- `background`: `#FAF5EC` → `#FCF9F1` (~20% lighter, pulled off the yellow cast)
- `surface` + all `surfaceTranslucent*` tokens: bumped to `#FFFCF6` base
- `washSage` alpha: 0.22 → 0.16
- `washRust` alpha: 0.14 → 0.10
- `washAmber` alpha: 0.12 → 0.09

**Verified visually** in Simulator — orange bloom at bottom is tamed, PaperCards pop more against the lighter ground. If friends still flag "too warm," next step is moving `background` to `#FDFBF5` (near-pure white with trace warmth). Don't move further unless feedback demands.

---

## 4. Tier 2 — Design decisions still open for Zach

These need Zach's call before execution. Paper mockups for each would help.

### 4.1 — Instacart integration: real vs copy-list

Zach said: "I want to try to get that hooked up."

**Reality check:** Instacart Connect Platform is a partner API. Approval takes weeks and requires a real business entity + volume projections. Before TestFlight we probably get the **fallback** working well, then apply for Platform access for v1.1.

**Fallback approach for v1 (shippable in a day):**
- "Shop with Instacart" button → opens `https://www.instacart.com/store/search_v3/{query}?query=salmon%20fillet%208oz%20...` with the full list URL-encoded. Loses dedup + quantity smarts but works.
- "Copy list" → copies to clipboard in an Instacart-friendly format
- "Share" → iOS share sheet (paste into iMessage, etc.)
- "AmazonFresh" → same URL deep-link approach

**Real Platform approach (later):**
- Apply to `instacart.com/connect` for Platform API access
- On approval: OAuth connect flow, server-side cart creation, deep-link to prefilled cart
- Zach's business entity + a real app shell are prerequisites

**Ask Zach:** which bar do we need for friends feedback — does the URL fallback feel credible enough?

### 4.2 — Context/voice step between EnergyPicker and GenerationLoading

**Zach said:** "give me like 10 seconds of feedback that I can put into helping figure out what else I'm looking for."

**Proposed step:** `/(eat)/context` between `/energy` and `/loading`. Screen shows:
- Kicker + display header ("Anything specific?")
- Large text input OR a mic button (voice → transcribe → text)
- Ghost button "Skip" → goes straight to loading
- Primary PaintedButton "Draft with this" → goes to loading

On "Draft": pass the context string as part of `useGenerationSession` state (extend `generationSession.ts` with `context: string`). Loading-screen passes it to `api.generateRecipesForEnergy(tier, context)` (signature change).

**Mic implementation:** `expo-speech-recognition` (native module — may need dev client) OR simpler: prompt user to tap a record button, record 10s via `expo-av`, send to Whisper/Deepgram. For v1 demo, plain text input is fine.

**Ask Zach:** start with typed context (ships today) and add voice in v1.1, or skip both until after TestFlight?

### 4.3 — Color direction (open-ended worry)

Zach: "I'm wondering if people like the colors."

**Current:** palette B with selected C highlights (cream / forest / sage / rust / prussian blue / ochre).

**Before changing anything:** get the friends-demo feedback first. Three data points on "do people like it" beats more bikeshedding now.

**If colors get flagged:** the alternatives in Paper are palette A (lighter cream + lighter forest, modal-mock used this) and palette C (wider palette with blue + ochre as primary, not just accents). Nothing else.

### 4.4 — Onboarding / first-run

Currently the app opens straight to Tonight. New user has zero idea why they're seeing salmon vs pizza. Before friends demo, add minimum:

**Slides (skip-able):**
1. "Tonight's dinner, sorted." — brushstroke logo + tagline
2. "How much energy have you got?" — 4 tier chips illustrating the segmentation
3. "Swipe through. Save what clicks. Shop with one tap." — 3-step visual

3 slides at most. SkipStacking carousel ([react-native-pager-view](https://github.com/callstack/react-native-pager-view) or bare FlatList pagingEnabled). Persist "onboarding_shown" in AsyncStorage; route straight to tabs thereafter.

### 4.5 — Sign-in stub

**Reality:** without Supabase wired (blocked on Zach's externals: Apple Dev + `supabase link`), we can't do real auth. But friends demo needs at least a **fake sign-in screen** so the flow feels legit:
- Display title "Welcome back"
- Sign in with Apple button (stubbed — logs to console, sets `signedIn: true` in AsyncStorage, routes to /(tabs))
- "Continue as guest" link below

The real Apple Sign-in wiring needs: Apple Dev capability enabled on the bundle, Supabase `sign_in_with_apple` edge function live, Sign in with Apple native module (Expo provides `expo-apple-authentication`). Can stub today, wire Day 5 per PLAN.md.

---

## 5. Tier 3 — Value prop pushback (my honest take)

Zach asked: "What are we actually bringing to the table?"

Genuine answer, ranked by strength of the differentiator:

### Strongest: the energy-tier framing
No other meal-planning app (Mealime, Plan to Eat, Paprika, Samsung Food) segments by **cognitive bandwidth**. "Brain-fried / after-work / got-energy / weekend" is a lens people recognize viscerally — most meal apps ask for "max cook time" which is a symptom, not a cause. **This is the pitch.** Protect it: every recipe must feel truly native to its tier.

### Strong: the visual identity
Watercolor food + hand-drawn chrome + Fraunces display type — nothing else in this category looks like this. Mealime is a utility, Plan to Eat is a spreadsheet, Samsung Food is Instagram. Qook could live on someone's bookshelf. This is the reason people will show it to friends.

### Medium: integrated grocery + Instacart
Most apps have a grocery list but the Instacart handoff is clunky. If we nail the "one tap → cart is ready" flow (real Platform integration, not URL-hack), it's a real moat. If we stop at copy-list, it's table stakes.

### Medium: swipe-to-build-week
Tinder-for-food has been tried (Mealime had one for a minute, removed). The UX works when the feed is curated well. Our version has real variety guardrails on the cohort batch; without them it's just random.

### Thin today (needs Eat flow to actually work): AI personalization
Right now Eat-flow generation returns mock recipes. Until OpenRouter + edge functions ship, we're a beautiful cookbook with a fake brain. **This is the hard dependency that turns Qook from "pretty" to "smart."** The Context-step (§4.2) is where AI personalization visibly enters the product.

### What we're missing vs competitors

1. **Weekly plan view** — Plan to Eat's killer chart (Mon-Sun dinner grid). Currently no such view in Qook. Tonight is 1 day; swipe builds a deck; but the "what's my week" overview is absent.
2. **Pantry tracking** — "I have chicken and broccoli, what can I make?" The generation prompt should take pantry state. Unbuilt.
3. **Leftovers / make-ahead logic** — a good meal plan reuses ingredients across days. Current grocery-list dedup doesn't look at plan cohesion.
4. **Reminder / calendar integration** — "Cook at 6pm" push notification. Unbuilt, non-trivial.
5. **Social proof on recipes** — "2,341 people cooked this this week" feels real. Requires aggregate counts in Supabase + some UX surface. Deferred for v1.

**Recommendation:** don't try to solve 1–5 before friends demo. The honest pitch for friends is: "it's a personalized weeknight-cooking assistant with a point of view." Ship a polished 5-tab + Eat-flow demo; defer everything else. Use friends' reactions to prioritize.

---

## 6. Paper design tasks

Before fresh-Claude writes the code for Tier-2 items, sketch them in Paper. File is open, add new artboards at bottom-right so nothing overlaps.

### 6.1 — Tonight empty state (Sunday reset)
Mirror "Tonight — Populated" but replace spotlight + more picks with a single empty-state card (see §3.4). Shows what fresh-Claude should build.

### 6.2 — Eat flow Context step
New artboard "Eat — Context" between "Eat — Energy Picker" and whatever "Loading" would be. Shows either text-input variant, voice-record variant, or both side-by-side.

### 6.3 — Shop dock v2 — prominence options
Three sub-frames: (a) current inline, (b) sticky-bottom, (c) larger inline with $ figure at 32px display.

### 6.4 — Onboarding 3-slide sequence
Three artboards: brand slide, energy-tier intro slide, "swipe / save / shop" demo slide.

### 6.5 — Sign-in (stub + real)
We already have "Sign In" + "Sign In — Light" artboards in Paper. Good — use them as-is. Fresh-Claude can port them when wiring §4.5.

---

## 7. Execution order for fresh-Claude

Do in this order. Each numbered item is one commit. Verify tsc + eslint --max-warnings=0 + `bunx expo export --platform ios` clean before each commit. Test in Simulator (which is already running; Metro auto-reloads).

### A. Tier-1 fixes — ship to friends

1. Fix `PaintedCheckbox` tap propagation (§3.1). Commit: `fix(painted): PaintedCheckbox doesn't swallow row taps`.
2. Change Swipe Save to forest (§3.2). Commit: `style(swipe): Save button forest tone matches primary CTA`.
3. Wire Tonight refresh → `/(eat)/energy` (§3.3). Commit: `feat(tonight): refresh routes to Eat flow`.
4. Tonight empty state CTA (§3.4). Commit: `feat(tonight): Sunday-reset empty state with Draft CTA`.
5. Shop dock sticky-bottom treatment (§3.5). Commit: `style(shop): sticky ShopDock for prominence`.
6. Handle `apps/native/tsconfig.json` (§3.6). Commit if committing: `chore: accept tsc include update from expo cli`.

### B. Onboarding + sign-in stub (Tier-2 quick wins)

7. Sign-in stub screen (§4.5) — route `app/(auth)/sign-in.tsx`, AsyncStorage gate in `app/index.tsx`. Commit: `feat(auth): stub Sign in with Apple + guest entry`.
8. Onboarding 3-slide carousel (§4.4) — route `app/(onboarding)/index.tsx` gated by AsyncStorage. Commit: `feat(onboarding): 3-slide first-run sequence`.

### C. Context step (after 7–8 or in parallel)

9. Extend `generationSession.ts` with `context: string`. (no commit yet — bundled with next)
10. Add `/(eat)/context.tsx` route + `ContextStep` screen (§4.2) with typed text input first, mic later. Wire EnergyPicker → Context → Loading flow. Commit: `feat(eat): context step between energy and generation`.

### D. Instacart fallback

11. Shop "Shop with Instacart" button → URL-encode list + `Linking.openURL`. Copy list / Share / AmazonFresh buttons wired to clipboard / share-sheet / amazon URL. Commit: `feat(shop): Instacart + fallback integrations`.

### E. Before friends demo — polish pass

12. Regenerate `expo export` + one screenshot per tab + the Recipe Modal + Eat flow. Use for a short "here's what's in it" doc to send friends alongside the TestFlight link (or a video if we haven't submitted yet).

### Pause points

After (6): show Zach on device and confirm vibe.
After (8): show onboarding + first-run feel.
After (10): demo the Eat flow end-to-end (energy → context → loading → review).
Before (11): confirm with Zach on URL-fallback vs waiting for Platform API.

---

## 8. Hard blockers (Zach must drive)

Already tracked in [START-HERE.md](./START-HERE.md). Recap for this pass:

- **Apple Developer** — needed for real Sign in with Apple + bundle id registration. Stub is fine for friends demo.
- **Supabase project create + link + `supabase db push`** — needed for real auth, real cohort decks, real generation persistence. Mock mode covers the demo.
- **OPENROUTER_API_KEY** — needed for live recipe generation + Seedream images. Mock covers the demo; stays fake AI until this lands.
- **qook.app domain** — deferred; no user-facing impact for friends demo.

For friends demo (target: next few sessions), NONE of these block. For TestFlight (D30 gate), all 4 are required.

---

## 9. Gotchas / known imperfections

- **Paper grain texture** is missing ([assets/paper-grain.png](../../apps/native/assets/) not generated). WashBackground falls back to cream + 3 radial washes. Background looks slightly flat vs Paper mocks. One-time `$0.04` Seedream call when OPENROUTER_API_KEY lands.
- **Haptics don't fire on Simulator** — only on real device. Confirm on your phone via `expo start --tunnel` + Expo Go app before shipping.
- **Font pop on first launch** — Fraunces / DM Sans / JetBrains Mono download from Google Fonts on cold start. ~200ms of system font before swap. Acceptable; caches after first launch.
- **Reanimated warnings** sometimes appear in Metro logs about worklets — cosmetic, not blocking. Related to the `react-native-worklets` peer dep we already added.
- **Swipe gesture sometimes gets stuck** in a throw-mid-animation state — worth a second look on real device. Suspect: the `withTiming(target, ..., cb)` → `runOnJS` callback timing. Low-pri; works in Simulator.
- **`assets/images` ENOENT** in Metro logs — harmless, Expo CLI expects a conventional folder we don't have.
- **Recipe Modal scroll under cook dock** — when you scroll all the way down, the dock hovers above content. Confirmed visually correct on iPhone 17 Pro. Smaller devices may need bottom padding tuning.

---

## 10. What "done with this pass" looks like

Zach can hand his phone to a friend with Expo Go installed, share the dev URL, and the friend can:

1. See the onboarding carousel on first launch
2. Hit a stubbed Sign-in screen with "Continue as guest" option
3. Land on Tonight with a spotlight + 2 more picks
4. Tap refresh → go through EnergyPicker → Context → Loading → Review (all mocked)
5. Save a recipe (heart toggle) → see it in Saved
6. Scroll Shop, check off items with PaintedCheckbox taps on the square, tap "Shop with Instacart" to open a search URL in Safari
7. Tap any recipe → see the full modal with ingredients + steps + timeline
8. Report back: *"Is this something you'd use? What's missing? What's odd?"*

That feedback loop is the actual goal of this pass — not perfect code, not real AI. Get 3 real reactions, adjust.
