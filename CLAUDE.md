# CLAUDE.md — Qook

## Project

Qook — iOS meal-planning app. Fresh rewrite on Expo + Supabase.

**Target:** TestFlight via the 2026-07 revival (auth is Phase 5, TestFlight after). The original 2026-05-24 date lapsed.

## Backend live state (2026-07-10 — supersedes anything below that contradicts it)

- **Supabase project `eehjclffugngogbvctib`** (org "Zach's Qook" `mmidcvwztglgjlgrynpx`, free, us-west-2) on Zach's dedicated account. Do NOT touch the FTP project on the old account. Ops log: `docs/superpowers/plans/phase2-deploy-notes.md`.
- **`apiMode` is `"live"`** in `app.json`; mock fixtures remain behind the flag.
- **4 Edge Functions deployed** with `--no-verify-jwt` (auth enforced in-code by `requireUser`): `generate-recipe` (SSE stream, structured outputs, signature-dedup global cache), `generate-image` (draft-time today; atomic `image_status pending|failed→generating` spend lock), `shopping-share` (keyless Instacart search-fallback — the IDP program is closed), `delete-account` (cascade verified).
- **Auth today:** anonymous sign-ins enabled; client `ensureSession()` bootstraps an anon session. Anon signups capped 10/hr/IP. Real auth (Apple + email) is Phase 5.
- **Images:** `google/gemini-3.1-flash-image` (~$0.068/image) via OpenRouter, style-locked by the canon reference at `apps/native/assets/meals-seed/canon/canon-v1.png`. Seedream is GONE from OpenRouter. The current client requests art for all 3 proposals after recipe text finishes; save/retry can safely re-fire because the DB lock allows at most one paid generation per recipe state. Missing art renders a neutral blur/letter—not another recipe—and TanStack Query polls only while `image_status` is `pending`/`generating`. Latest measured run: recipes ready in ~34s; images ready ~11–22s later in parallel; all art ready ~54s from start. Verified 2026-07-10.
- **Quotas:** 10 generations/user/day (failed generations excluded); recipes persist tags + nutrition (migration `20260707000001`).
- **Secrets/tokens:** `OPENROUTER_API_KEY` lives ONLY in Supabase function secrets. `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` live in `~/Projects/qook/.env.local` (gitignored) — load with `set -a; source …; set +a`, NEVER cat/echo/print them (rotation pending — they transited chat once). The anon key in `app.json` is public by design.
- **DB row ↔ client mapping:** edge `supabase/functions/_shared/recipe-map.ts` and client `apps/native/src/services/recipeRow.ts` must stay in sync — never cast a raw snake_case row `as Recipe`.
- **Backend decision:** stay on Supabase. Convex would make reactive query updates automatic, but Qook already has working Postgres/RLS/Storage/Edge Functions; the 2026-07-10 image incident was a missing client cache refresh, not a Supabase limitation. Do not plan a migration for this issue.

## Start every session by reading

0. **Revival docs first (2026-07):** `docs/superpowers/plans/2026-07-10-finish-line.md`, then `docs/superpowers/specs/2026-07-06-qook-revival-design.md` + the latest implementation plan in `docs/superpowers/plans/`. The April docs below describe the pre-revival state.

1. `docs/plan/START-HERE.md` — current phase + what's done vs pending
2. `docs/plan/PLAN.md` — 32-day execution plan (especially §9 Day 1 checklist + §4 timeline)
3. `docs/plan/SCOPE-couple-first.md` — 2026-04-20 scoping pivot: household-first, decision-load axis, 4 tabs (Tonight / Week / Shop / More), one-store (`weekPlan`) product loop
4. `docs/plan/NEXT-PASS.md` §0 + §11 — shipped commits + still-valid polish backlog
5. `docs/plan/AUDIT-2026-04-23.md` — fresh-eye whole-app audit, Instacart redesign, categorization + model picks (reference, not execution plan)
6. Section files as needed:
   - `docs/plan/section-backend.md` — Supabase (schema, RLS, Edge Fns, cron, storage)
   - `docs/plan/section-frontend.md` — Expo + RN (design tokens, primitives, routing)
   - `docs/plan/section-domain.md` — TS types + flows + normalize
   - `docs/plan/section-ai.md` — OpenRouter wrapper + prompts + streaming + cost
   - `docs/plan/section-testflight.md` — EAS + TestFlight + launch assets

## Current product shape (2026-07-10)

- **4 tabs**: Tonight (dashboard) · Week (energy-map planner) · Shop (derived list) · More (settings, taste prefs, plan reset).
- **One unified product-loop store** `useWeekPlan` (Zustand + `persist` to AsyncStorage, key `qook.weekPlan.v1`). Tonight reads `plan[today]`, Week writes `plan[*]`, Shop aggregates ingredients across future days. `activePickFor(day)`, `recentSelectedDays(plan, today, N)` are the selector helpers.
- **Prefs sidebar store** `usePrefs` (key `qook.prefs.v1`) — cuisines, proteins, avoid list, servings, unit system, default tier, planning start day. Lives alongside `useWeekPlan` so plan resets (including `clearAll`) don't nuke user preferences. Summary lines on More read from here.
- **`clearFuture()` keeps today + past; wipes dates > today.** There's no `clearFutureOnly` — it's `clearFuture`. `clearAll` wipes everything. Persisted state survives sim reloads; to reset, call `useWeekPlan.getState().clearAll()` from the JS debugger or uninstall the app.
- **Mock vs live** — `app.json.extra.apiMode` = `'mock' | 'live'`. **Live since 2026-07-07** (see "Backend live state" above). Mock mode still reads `apps/native/src/services/fixtures/recipes.ts` — 24 recipes tied to watercolor PNGs at `apps/native/assets/meals-seed/v2/`.

## Routes (Expo Router v6, file-based)

- `(tabs)/{tonight,week,shop,more}.tsx` — bottom tab bar, rendered by custom `FloatingTabBar`. Height is `screen.tabBarHeight` (design token in `src/design/spacing.ts`) — any sticky dock that sits above the bar uses `insets.bottom + screen.tabBarHeight + gap` (see `ShopScreen.tsx`). Don't hardcode the number.
- `(eat)/{energy,loading,review,context}.tsx` — modal stack for the energy → draft → pick flow.
- `(modals)/recipe/[id].tsx` — recipe detail modal.
- `preferences.tsx` · `household.tsx` · `generation.tsx` — top-level routes pushed from More rows (`router.push('/preferences')` etc.). Source lives in `src/features/more/`. File-based routing auto-registers them; they're not enumerated in root `_layout.tsx` Stack.Screen entries. If Expo Router ever stops auto-picking them up, either add explicit Stack entries or wrap them in a `(settings)/` group with its own `_layout.tsx`.
- `(auth)/sign-in.tsx` · `(onboarding)/index.tsx` — brand mark on both renders `assets/icon.png` (the watercolor bowl), not a text-"Q" glyph.

## Stack

- **Monorepo layout:** `apps/native/` (Expo) + `packages/shared/` (TS domain types) + `supabase/` (migrations + edge functions). **Root `package.json` has no scripts — all dev commands run from `apps/native/`.**
- **Package manager:** `bun` (workspaces via `"workspaces": ["apps/*","packages/*"]`)
- **Expo:** 54 + Expo Router v6, TypeScript
- **State:** TanStack Query (server) + Zustand (UX)
- **Backend:** Supabase CLI, migrations at `supabase/migrations/`
- **AI:** OpenRouter — recipe generation via structured outputs (SSE-streamed from `generate-recipe`); images via `google/gemini-3.1-flash-image`, canon-locked. (Seedream no longer exists on OpenRouter.)

## Key locked decisions

- **Bundle ID:** `com.kata.qook`
- **App name:** Qook. Subtitle: "Tonight's dinner, sorted."
- **Domain:** `qook.app` (purchase Day 1 via Cloudflare Registrar)
- **Auth:** Sign in with Apple + email/password (both via Supabase Auth)
- **No IAP in v1.** Paywall ships in v1.1 via RevenueCat.
- **Account deletion in-app** (Apple 5.1.1(v) requirement)
- **Draft-time live images are currently enabled:** all 3 proposals request art after text generation (~$0.204/session at current pricing). This supersedes older save-gated notes, but the proposal-time vs selected-meal cost decision must be made before TestFlight; see the finish-line plan.
- **Mock/live toggle** — `app.json.extra.apiMode` flips between fixtures and Supabase

## Design system (Phase 3b "Menu" restyle landed 2026-07-08; see `docs/superpowers/plans/2026-07-08-phase3b-menu-restyle.md`)

- Palette: cream ground `#FBF7EE` / active well `#F1E9D9` / surface `#FFFCF6` / forest ink `#2A3A26` / rust `#C36A48` / prussian `#3D5469`
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
- **External API cost:** always test with 1-2 items before batch (Gemini 3.1 Flash Image is ~$0.068/image; a text generation is a few cents)
- **OpenRouter key:** lives ONLY in Supabase Edge Function secrets. Never in client bundle, never in EAS.
- **RLS is the security model:** every client query must pass RLS. Edge Functions hold service role key for admin ops.
- **Signature dedup:** SHA-256 over canonical `{title, cuisine, tier, sorted ingredients}` → global recipe cache
- **No emojis in UI** — color, typography, iconography only
- **SwiftUI reference only** — active code path is Expo/React Native. Do not edit `sashafood/apps/swift/` from this project.
- **Metro hot-reload occasionally misses fixture edits** — if a code change doesn't appear in the sim, shake the sim (`Cmd+Ctrl+Z` in Simulator) → tap **Reload** in the Expo dev menu. Cmd+R alone sometimes re-renders with a stale bundle.
- **Security-hook word trigger** — the write-time security hook flags certain Python-stdlib names that happen to also be cooking terms (the one starting with `pi-` for preserving vegetables in vinegar). Reword recipe sections to avoid it: "quick vinegar cucumber", "cucumber finish", etc.
- **Don't fabricate URLs or endpoints** — `qook.app` isn't purchased yet (Day 1 task), so no `qook.app/privacy`, `qook.app/terms`, or `@qook.app` emails in code. Render legal/feedback rows as "Coming at TestFlight launch" stubs until the domain is provisioned. If an endpoint, API, or address doesn't exist yet, say so in-copy rather than guessing a placeholder URL.

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
