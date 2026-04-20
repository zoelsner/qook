# CLAUDE.md — Qook

## Project

Qook — iOS meal-planning app. Fresh rewrite on Expo + Supabase.

**Target:** v1 TestFlight 2026-05-24.

## Start every session by reading

1. `docs/plan/START-HERE.md` — current phase + what's done vs pending
2. `docs/plan/PLAN.md` — 32-day execution plan (especially §9 Day 1 checklist + §4 timeline)
3. Section files as needed:
   - `docs/plan/section-backend.md` — Supabase (schema, RLS, Edge Fns, cron, storage)
   - `docs/plan/section-frontend.md` — Expo + RN (design tokens, primitives, routing)
   - `docs/plan/section-domain.md` — TS types + flows + normalize
   - `docs/plan/section-ai.md` — OpenRouter wrapper + prompts + streaming + cost
   - `docs/plan/section-testflight.md` — EAS + TestFlight + launch assets

## Stack

- **Monorepo layout:** `apps/native/` (Expo) + `packages/shared/` (TS domain types) + `supabase/` (migrations + edge functions)
- **Package manager:** `bun`
- **Expo:** 52 + Expo Router v4, TypeScript blank template
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

## Design system (locked, do not revisit)

- Palette: cream `#FAF5EC` / surface `#FEFBF3` / text `#26241C` / forest `#2A3A26` / rust `#C36A48` / prussian `#3D5469`
- Fraunces Bold (display) · DM Sans (body) · JetBrains Mono (kickers)
- Primitives: PaperCard, WashBackground, BrushstrokeUnderline, ScreenShell
- 24 Seedream watercolor PNGs already generated at `assets/meals-seed/v2/` (copied from sashafood)

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

## Dev commands (post-scaffold)

```bash
bun install              # install deps
bun run start            # Expo dev server
bun run typecheck        # tsc --noEmit
bun run lint             # eslint
supabase start           # local Postgres + Auth + Storage + Edge runtime
supabase db reset        # replay migrations locally
supabase gen types typescript --local > packages/shared/src/database.ts  # regenerate types
supabase db push         # push migrations to prod
supabase functions deploy <fn>  # deploy single edge fn
```
