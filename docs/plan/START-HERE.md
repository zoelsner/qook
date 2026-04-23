# START HERE

**Today:** 2026-04-20 (plan day)
**First build day:** 2026-04-21 (Monday)
**Ship:** 2026-05-24 — 32 days

---

## 📍 Active execution plan (2026-04-22)

For the current MVP coding pass — **Tonight dashboard + Week planner + Shop derivation**:

- **[qook-mvp-plan.md](./qook-mvp-plan.md)** — 10-move execution plan with full code snippets, dependencies, and verification. Self-contained, executable cold by Codex or a fresh Claude session.
- **[qook-mvp-design-decisions.md](./qook-mvp-design-decisions.md)** — the *why*: product thesis, locked palette/typography/icons, state-model rationale, two Codex adversarial review passes, alternatives considered & rejected.

Both docs supersede the Week/tab sections of NEXT-PASS.md and the scoping in SCOPE-couple-first.md for anything in Moves 1–10.

---

## Status: Day 0 + Day-1 slice + painted-aesthetic design pivot

Day 0 shipped the initial scaffold. Day-1 autonomous slice landed primitives + Expo Router + mock services + 5 stub screens + modal + swipe deck. **Late Day 1: full design pivot to "painted" hand-drawn aesthetic from Paper file.** 8 commits past initial push are local-only, waiting on Zach's push approval.

**Paper is the design source of truth.** File has 16 artboards (light + dark variants of every screen, plus Hand-drawn UI Study, Palette + Wobble Study, Tier Icons). Port new UI from there — use `mcp__paper__*` tools to pull computed styles and SVG JSX exactly, don't eyeball from screenshots.

## What's done (as of 2026-04-20 EOD)

Three commits on `main` (3fefc43 latest — partially pushed; see §Publish):

**Repo + planning**
- [x] Fresh repo at `~/Projects/qook/`, plan docs at `docs/plan/`, `CLAUDE.md` with locked decisions
- [x] GitHub repo live: https://github.com/zoelsner/qook (private)

**Scaffold (commit `1f112e3`)**
- [x] `apps/native/` scaffolded via `create-expo-app --template blank-typescript` — Expo **54** (not 52; current stable)
- [x] Expo native deps: expo-router v6, reanimated 4, gesture-handler, svg, skia, blur, haptics, image, linking, linear-gradient, async-storage
- [x] JS deps: `@supabase/supabase-js`, `@tanstack/react-query`, `zustand`, `@expo-google-fonts/{dm-sans,fraunces,jetbrains-mono}`, `simplex-noise`
- [x] Monorepo layout: `packages/shared/src/{types,domain}`, `supabase/{migrations,functions/_shared,functions/generate-{recipe,image,deck-batch},functions/warm-start-import,functions/delete-account}`
- [x] 24 Seedream watercolor PNGs copied to `apps/native/assets/meals-seed/v2/`
- [x] `privacy-policy.html` copied (needs Qook rebrand before public launch)
- [x] Supabase CLI installed + `supabase init` (config.toml + functions dir + migrations dir)
- [x] 4 migration files written with SQL from section-backend.md §2-5: `init_schema`, `rls_policies`, `auth_triggers`, `storage_buckets` (cohort_decks reordered before weekly_decks for FK order)
- [x] `.env.example` at repo root

**Frontend foundation (commit `cd2ec12`)**
- [x] `app.json`: bundle ID `com.kata.qook` (iOS + Android), scheme `qook://`, cream `#FAF5EC` splash bg, plugins (expo-router, expo-font, expo-splash-screen), `typedRoutes`, `apiMode: "mock"` extras
- [x] Design tokens: `src/design/{colors,typography,spacing,shadows,washes,index}.ts` (pure TS, no React)
- [x] Primitives: `src/components/{PaperCard,WashBackground,BrushstrokeUnderline,ScreenShell,Text}.tsx`
- [x] `App.tsx` loads Fraunces/DM Sans/JetBrains Mono + renders preview using primitives

**Review + fixes (commit `3fefc43`)**
- [x] Installed `react-native-worklets` (Reanimated 4 peer dep; without it app crashes on device)
- [x] Downgraded `eslint-config-expo` 55 → 10 (Expo 54 compat)
- [x] Split typography tokens (`src/design/typography.ts`) from React components (`src/components/Text.tsx`) — keeps design barrel React-free so scripts/packages/shared/edge-fns can import tokens without pulling React
- [x] Verified: `tsc --noEmit` clean, Metro bundle builds

**Day-1 autonomous slice (commits `eb50211` → `23ec380`)**
- [x] Remaining primitives: `FoodHeroImage`, `RingSpinner`, `StepDots`, `EnergyBadge`, `EnergyPicker`, `FloatingTabBar` + `useHaptics` + `src/lib/assets.ts` (24-key seedMeals require map)
- [x] `scripts/bake-wobble.ts` + regenerated real simplex-noise paths in `BrushstrokeUnderline.tsx`
- [x] Monorepo workspace: root `package.json` with bun workspaces, `packages/shared/` live
- [x] `@qook/shared` full type set (`primitives`, `recipe`, `deck`, `grocery`, `user`, `generation`) + domain (`energyTier`, `recipeTaxonomy`, `recipeNormalize`, `signature`) — `recipeNormalize` + `recipeTaxonomy` ported from sashafood
- [x] `metro.config.js` monorepo-aware; `apps/native/tsconfig.json` path alias `@qook/shared`
- [x] `src/services/{supabase,api}.ts` + TS fixtures (3 recipes, 1 deck padded to 12, 9 groceries)
- [x] Expo Router migration: `app/_layout.tsx` + `app/index.tsx` + `app/(tabs)/_layout.tsx` + 5 tab routes + `app/(modals)/recipe/[id].tsx`; `App.tsx` + `index.ts` removed
- [x] 5 stub feature screens (Tonight/Swipe Night/Shop/Saved/More) rendering real mock fixtures through `useQuery`
- [x] `eslint.config.js` (flat) added — lint now runs clean
- [x] Verified: `tsc --noEmit` clean both workspaces, `eslint` clean, `expo-doctor` 16/17, `bunx expo export --platform ios` succeeds (4.8MB hbc bundle, all 24 seed PNGs + expo-router assets)

**Intentionally deferred:** `src/services/auth.tsx` + SessionProvider (blocked on Supabase project); `groceryNormalize.ts`, `deckVariety.ts`, `dietaryTags.ts` (Week 2-3 per section-domain §10).

**Known issue:** `expo-doctor` flags "duplicate native module dependencies" — cosmetic bun workspace symlink artifacts (same-version copies under `node_modules/.bun/`). Metro resolver uses top-level `node_modules/` first, so the iOS bundle is fine. Can revisit if it causes EAS Build issues.

**Design pivot (commits `ccfe3dd` → `3073b74`):**
- [x] `RecipeDetailModal` full rebuild per Paper `Recipe Modal — Light` — hero image, IconPill close/bookmark/share, chip row, 22/2/8 stat trio, checkable ingredient rows, numbered step sections, timeline, notes, fixed Cook Dock (Heart save pill + filled-forest "Cook tonight" CTA with cooking-steam glyph).
- [x] Swipe Night gesture stack (Reanimated Pan + spring snap-back + throw threshold, Zustand `swipeDeck` store, save/skip overlay interpolation, keyed card remount to avoid shared-value leak). Action buttons now `PaintedButton(rust)` + painted skip pill.
- [x] **Palette:** B primary (cream `#FAF5EC` / forest `#2A3A26` / sage `#5F7057` / rust `#C36A48` / deep rust `#A85539`) with selected C highlights — prussian `#3D5469` + ochre `#E2BA7C` reserved for secondary callouts. Paper file is palette A; code is B per CLAUDE.md lock + user call.
- [x] **Painted primitives** (`src/components/painted/`) — `PaintedButton`, `PaintedCheckbox` + `PaintedRadio`, `PaintedDivider`, `PaintedArcSpinner`, `IconPill` + `GlassChip`, 13-glyph Icon set (Close, Bookmark, Share, Heart, PaintedHeart, Refresh, ArrowRight, CookingSteam, Tab{Tonight/Swipe/Shop/Saved/More}). All SVG paths ported verbatim from Paper's `Hand-drawn UI Study`. Known divergence: Paper uses `feTurbulence`+`feDisplacementMap` which react-native-svg doesn't support; base hand-coded curves stand in (already wobbly enough at medium intensity).
- [x] **Tonight** spotlight + more-picks layout — "TONIGHT · SPOTLIGHT 1/3 READY" kicker, 56/56 Fraunces title with brushstroke, refresh `IconPill`, 218-tall watercolor hero with Glass badges, "READY TO COOK" status + inline Cook button, 2 mini cards that swap into the spotlight slot on tap.
- [x] **FloatingTabBar** — 5 tabs with painted SVG icons + label; focused tab renders a baked wobbly underline (150×6 path from Paper). 68h · 22r · tinted hairline border + forest drop shadow.
- [x] **Shop (Grocery List)** — kicker + brushstroke display + add `IconPill`, section headers with hairline rule, `PaintedCheckbox` rows with optimistic toggle, Shop Dock (Ready to shop + EST price + Instacart `PaintedButton` + Copy list · Share · AmazonFresh fallback row).
- [x] **Saved / More** headers regularized to match (kicker · display · brushstroke).
- [x] **Eat flow** — `app/(eat)/energy|loading|review` modal stack. Uses `PaintedArcSpinner` for generation state; Review shows 3 recipe cards with tap-to-open + inline heart-toggle save. Entry wiring left for next session (direct nav to `/(eat)/energy` works today).

**Design fidelity notes:**
- Paper paths include `feTurbulence` displacement filters for live wobble; we use static hand-coded bezier curves (still visually imperfect at "medium" intensity). If we ever want the extra jitter, run an offline baking script that applies displacement and writes the mutated path string.
- RN supports a single shadow per view — Paper's layered `box-shadow` stacks are approximated by the dominant layer; nesting Views gives the stacked halo/contact effect where needed (see `PaperCard`).

## Still pending (Day 1 externals — you drive these)

Order doesn't strictly matter; Apple + Supabase should come first since they unblock everything else.

```
[ ]  1. Apple Developer status check + register Bundle ID com.kata.qook
        (Services ID `com.qook.signin`, capabilities: SIWA + Associated
        Domains + Push)
[ ]  2. Supabase: create `qook-prod` + `qook-staging` projects on Free tier
[ ]  3. `cd ~/Projects/qook && supabase link --project-ref <qook-prod-ref>`
[ ]  4. `supabase db push` — applies the 4 migrations to prod
[ ]  5. `supabase gen types typescript --linked > packages/shared/src/database.ts`
[ ]  6. Buy qook.app via Cloudflare Registrar (~$12/yr)
[ ]  7. Set Edge Function secrets:
        supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
        supabase secrets set OPENROUTER_TEXT_MODEL=anthropic/claude-haiku-4.5
        supabase secrets set OPENROUTER_POLISH_MODEL=anthropic/claude-sonnet-4.6
        supabase secrets set OPENROUTER_IMAGE_MODEL=bytedance-seed/seedream-4.5
[ ]  8. `npm i -g eas-cli && eas login && eas init && eas credentials --platform ios`
[ ]  9. Set EAS secrets:
        eas secret:create --name SUPABASE_ANON_KEY_DEV --value <anon>
        eas secret:create --name SUPABASE_ANON_KEY_PROD --value <anon>
[ ] 10. (Optional) Install OrbStack or Docker Desktop for local `supabase start`
[ ] 11. 15-min Seedream commercial-use check (OpenRouter TOS + Bytedance
        model card) before running the cohort batch
```

## Pick up here next session (autonomous track)

Original Day-1 items 1-5 are done. Design pivot chunk is done. Remaining queue:

1. **Eat-flow entry wiring** — decide where users enter `/(eat)/energy` from. Candidates: Tonight refresh button (long-press vs tap — already used for refetch), SwipeNight empty state "shuffle again", Saved empty state "generate some", or a dedicated FAB. Needs product decision before wiring.
2. **Paper import polish** — the light artboards for Sign In, Swipe Night, Energy Picker are all in Paper with specific chrome that's worth porting at some point. Lower-priority than the 5-tab happy path which is now done.
3. **`src/services/auth.tsx` + `(auth)/sign-in.tsx` + `(auth)/sign-up.tsx`** — blocked on Supabase project existing (ref + anon key). Sign In artboard exists in Paper.
4. **Generate `assets/paper-grain.png`** (one-time ~$0.04 Seedream call — needs OPENROUTER_API_KEY). Re-enables `WashBackground` grain overlay.
5. **Edge functions** (`_shared/openrouter.ts`, `_shared/supabase.ts`, then the 4 live fns) — blocks on Supabase link + OPENROUTER_API_KEY.
6. **`packages/shared/src/domain/{groceryNormalize,deckVariety,dietaryTags}.ts`** — port/write when first consumer needs them (Week 2-3 per section-domain §10).
7. **`supabase gen types typescript --linked > packages/shared/src/database.ts`** — after Supabase link; regenerates the DB row types that domain mappers consume.
8. **Wobble baking script** (nice-to-have) — extend `scripts/bake-wobble.ts` to output displaced variants of the painted-shape paths so they read more "turbulence-y" without running filters at runtime. Only worth it if current "medium" wobble feels too tame in-device.

## Publish state (as of this file)

**8 commits unpushed** on `main` local, waiting on Zach's approval before `git push`. In order:

```
ccfe3dd  feat(frontend): RecipeDetailModal — ingredients, steps, timeline
925c160  feat(frontend): Swipe Night — gesture-driven deck with Zustand store
5905151  feat(design): pivot palette to Paper baseline (A) [reverted in next commit]
594b3ee  feat(design): painted primitives ported from Paper hand-drawn UI study
449794c  feat(frontend): rebuild RecipeDetailModal to match Paper Recipe Modal — Light
26b983f  feat(frontend): TonightScreen + FloatingTabBar rebuilt to Paper spec
8de91e5  feat(frontend): port Shop, Saved, More, Swipe Night to painted aesthetic
3073b74  feat(frontend): Eat flow (Energy → Loading → Review) in painted aesthetic
```

Ask before pushing:

```bash
git push origin main
```

## Resolved (2026-04-20 EOD)

1. **Seedream licensing** → leaning yes, verify Day 1 before cohort batch (check OpenRouter TOS + Seedream model card). 15-min task.
2. **Budget: text-only live mode** ($65/mo @ 100 testers). Cohort images eager, live generation NEVER creates images (even on save). Live recipes show watercolor paper-texture placeholder. Supersedes PLAN.md §6.7 "save-gated" — tighter now, revisit post-TestFlight.
3. **Recipe edit UX: clone-on-edit confirmed.** Cohort/AI rows immutable; user edits fork new row with `source='user'`.

## Still open (lower priority, not blocking Day 1)

See [PLAN.md §10](./PLAN.md#10-open-questions-for-zach) — nutritional estimates UI, TestFlight submission timing, app name keywords, Instacart fallback, privacy policy hosting, paywall copy.

## Critical path (don't let these slip)

See [PLAN.md §5](./PLAN.md#5-critical-path-top-7-blockers). Seven hard gates:

1. Apple Dev approval by D7 (escalate if not)
2. EAS first build smoke test by D3
3. AI image pipeline ships 1 real image by D5
4. Full happy-path E2E by D14
5. Account deletion shipped by D17
6. Supabase Pro upgrade by D20
7. External TestFlight submission by D30

## If you get stuck

- Plan has a **risk register** at [PLAN.md §8](./PLAN.md#8-risk-register-top-10) with mitigations for the top 10 risks
- Each section-*.md has its own "Open questions / risks" at the end
- When blocked on design, re-read the design system in `CLAUDE.md` (§ Design system)
- When blocked on architecture decisions, re-read the cross-cutting resolutions in [PLAN.md §6](./PLAN.md#6-cross-cutting-decisions-resolved)

## Workflow patterns during build

- **Plan mode by default** for anything non-trivial (3+ steps)
- **Verification before done** — build, tests, or demo; never mark complete without proof
- **UI changes one at a time** — verify render before next change
- **Commit often** — end-of-day minimum, after any green gate
- **Don't merge PRs to main** — Zach handles merges himself

## When you finish a chunk of the "Still pending" list above

Move `[ ]` → `[x]` in the checklist, and commit. Then pick the next unblocked item from "Pick up here next session."

Day 2-3 target per [PLAN.md §4](./PLAN.md#4-32-day-timeline-apr-21--may-24): RLS verification + remaining primitives + auth wiring.
