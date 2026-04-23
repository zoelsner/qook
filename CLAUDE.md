# CLAUDE.md — Qook

## Project

Qook — iOS meal-planning app. Fresh rewrite on Expo + Supabase.

**Target:** v1 TestFlight 2026-05-24.

## Start every session by reading

1. `docs/plan/START-HERE.md` — current phase + what's done vs pending
2. `docs/plan/PLAN.md` — 32-day execution plan (especially §9 Day 1 checklist + §4 timeline)
3. `docs/plan/SCOPE-couple-first.md` — 2026-04-20 scoping pivot: household-first, decision-load axis, 4 tabs (Tonight / Week / Shop / More), one-store (`weekPlan`) product loop
4. `docs/plan/NEXT-PASS.md` §0 + §11 — shipped commits + still-valid polish backlog
5. Section files as needed:
   - `docs/plan/section-backend.md` — Supabase (schema, RLS, Edge Fns, cron, storage)
   - `docs/plan/section-frontend.md` — Expo + RN (design tokens, primitives, routing)
   - `docs/plan/section-domain.md` — TS types + flows + normalize
   - `docs/plan/section-ai.md` — OpenRouter wrapper + prompts + streaming + cost
   - `docs/plan/section-testflight.md` — EAS + TestFlight + launch assets

## Current product shape (2026-04-23)

- **4 tabs**: Tonight (dashboard) · Week (energy-map planner) · Shop (derived list) · More (settings).
- **One unified store** `useWeekPlan` (Zustand + `persist` to AsyncStorage, key `qook.weekPlan.v1`). Tonight reads `plan[today]`, Week writes `plan[*]`, Shop aggregates ingredients across future days. `activePickFor(day)`, `recentSelectedDays(plan, today, N)` are the selector helpers.
- **`clearFuture()` keeps today + past; wipes dates > today.** There's no `clearFutureOnly` — it's `clearFuture`. `clearAll` wipes everything. Persisted state survives sim reloads; to reset, call `useWeekPlan.getState().clearAll()` from the JS debugger or uninstall the app.
- **Mock vs live** — `app.json.extra.apiMode` = `'mock' | 'live'`. Mock mode reads `apps/native/src/services/fixtures/recipes.ts` — **24 recipes** (6 brain-is-fried / 9 after-work / 6 got-energy / 3 weekend-project), each tied to a Seedream PNG at `apps/native/assets/meals-seed/v2/`. `generateRecipesForEnergy(tier)` filters by tier + Fisher-Yates shuffles. `getTonightPlan()` returns a random 3.
- **Supabase Edge Functions are scaffolded but empty** (`generate-recipe`, `generate-deck-batch`, `generate-image`, `delete-account`, `warm-start-import`). Live path is not wired; `section-ai.md` is the spec.

## Stack

- **Monorepo layout:** `apps/native/` (Expo) + `packages/shared/` (TS domain types) + `supabase/` (migrations + edge functions). **Root `package.json` has no scripts — all dev commands run from `apps/native/`.**
- **Package manager:** `bun` (workspaces via `"workspaces": ["apps/*","packages/*"]`)
- **Expo:** 54 + Expo Router v5, TypeScript
- **State:** TanStack Query (server) + Zustand (UX)
- **Backend:** Supabase CLI, migrations at `supabase/migrations/`
- **AI:** OpenRouter (Haiku 4.5 draft, Sonnet 4.6 polish, Seedream 4.5 image)

## Key locked decisions

- **Bundle ID:** `com.kata.qook`
- **App name:** Qook. Subtitle: "Tonight's dinner, sorted."
- **Domain:** `qook.app` (purchase Day 1 via Cloudflare Registrar)
- **Auth:** Sign in with Apple + email/password (both via Supabase Auth)
- **No IAP in v1.** Paywall ships in v1.1 via RevenueCat.
- **Account deletion in-app** (Apple 5.1.1(v) requirement)
- **Save-gated live images** (cohort eager, live lazy) — keeps 100-tester OpenRouter ≈ $109/mo
- **Mock/live toggle** — `app.json.extra.apiMode` flips between fixtures and Supabase

## Design system (last touched 2026-04-23)

- Palette: cream `#FCF9F1` / surface `#FEFBF3` / text `#26241C` / forest `#2A3A26` / rust `#C36A48` / prussian `#3D5469`
- Fraunces Bold (display) · DM Sans (body) · JetBrains Mono (kickers)
- Fraunces 500 Italic preloaded in `_layout.tsx` for editorial moments ("Tap to spotlight" hint on Tonight)
- Primitives kept: PaperCard, ScreenShell (flat cream background, no gradient), PolishedButton (default CTA — tones: forest / rust / cream / ghost / apple)
- Primitives dialed back: **BrushstrokeUnderline** used sparingly as title accent only, not system-wide
- Primitives deprecated: **PaintedButton** (wobbly buttons), **painted icons** (IconClose, IconRefresh, IconHeart, IconArrowRight — replace with `lucide-react-native`), **PaintedCheckbox wobble**, **WashBackground gradient** (stripped from ScreenShell + all direct renders)
- 24 Seedream watercolor PNGs at `assets/meals-seed/v2/` (copied from sashafood) — the watercolor food imagery remains the distinctive visual
- Tonight hero composition: "TONIGHT · SPOTLIGHT N/M READY" kicker + Fraunces 44 "Tonight" title + BrushstrokeUnderline · asymmetric "● READY TO COOK" chip + "Cook tonight →" inline pill · MORE PICKS horizontal strip of non-spotlight recipes
- Aesthetic direction: Claude-style restraint on chrome, lean on typography (Fraunces + DM Sans), let watercolor food + palette carry the brand. Brushstrokes as accents, not as the system.

## Reference (NOT active code paths)

- `/Users/zach/Projects/sashafood/apps/swift/Qook/` — SwiftUI reference impl (TonightView renders in light-watercolor on iPhone 17 Pro sim). Keep as TypeScript-port reference only.
- `/Users/zach/Projects/sashafood/apps/native/` — old RN app with Convex backend. Cheat-sheet for patterns only; not porting.
- `/Users/zach/Projects/sashafood/packages/convex/convex/lib/recipeNormalize.ts` — normalize logic to port to `packages/shared/src/domain/recipeNormalize.ts`
- `/Users/zach/Projects/sashafood/packages/convex/convex/lib/recipeTaxonomy.ts` — cuisine/protein taxonomies to port

## Rules

- **Do NOT merge PRs to main** — Zach handles merges himself
- **External API cost:** always test with 1-2 items before batch (Seedream is $0.04/image)
- **OpenRouter key:** lives ONLY in Supabase Edge Function secrets. Never in client bundle, never in EAS.
- **RLS is the security model:** every client query must pass RLS. Edge Functions hold service role key for admin ops.
- **Signature dedup:** SHA-256 over canonical `{title, cuisine, tier, sorted ingredients}` → global recipe cache
- **No emojis in UI** — color, typography, iconography only
- **SwiftUI reference only** — active code path is Expo/React Native. Do not edit `sashafood/apps/swift/` from this project.
- **Metro hot-reload occasionally misses fixture edits** — if a code change doesn't appear in the sim, shake the sim (`Cmd+Ctrl+Z` in Simulator) → tap **Reload** in the Expo dev menu. Cmd+R alone sometimes re-renders with a stale bundle.
- **Security-hook word trigger** — the write-time security hook flags certain Python-stdlib names that happen to also be cooking terms (the one starting with `pi-` for preserving vegetables in vinegar). Reword recipe sections to avoid it: "quick vinegar cucumber", "cucumber finish", etc.

## Dev commands

All commands run from `apps/native/` unless noted.

```bash
bun install                               # install deps (from repo root, uses workspaces)
cd apps/native && bun run ios             # Expo dev server → iOS Simulator (primary dev loop)
cd apps/native && bun run start           # Expo dev server, pick target
cd apps/native && bun run typecheck       # tsc --noEmit
cd apps/native && bun run lint            # eslint

supabase start           # local Postgres + Auth + Storage + Edge runtime
supabase db reset        # replay migrations locally
supabase gen types typescript --local > packages/shared/src/database.ts  # regenerate types
supabase db push         # push migrations to prod
supabase functions deploy <fn>  # deploy single edge fn
```

**Sim workflow** — when a code change doesn't appear: `Cmd+Ctrl+Z` in Simulator → **Reload**. To reset persisted state: call `useWeekPlan.getState().clearAll()` from the JS debugger, or uninstall the app.
