# AGENTS.md — Qook

## Project

Qook — iOS meal-planning app. Fresh rewrite on Expo + Supabase.

**Target:** TestFlight via the 2026-07 revival. The original 2026-05-24 date lapsed.

## Start every session by reading

1. `docs/superpowers/plans/2026-07-10-finish-line.md` — authoritative launch blockers, product-completeness queue, and Fable brief
2. `CLAUDE.md` — current live backend, routes, architecture decisions, and gotchas
3. `docs/superpowers/specs/2026-07-06-qook-revival-design.md` + the latest implementation plan in `docs/superpowers/plans/`
4. April docs (`docs/plan/START-HERE.md`, `PLAN.md`, and section files) are pre-revival reference; use them only where the July docs have not superseded them.
5. Section files as needed:
   - `docs/plan/section-backend.md` — Supabase (schema, RLS, Edge Fns, cron, storage)
   - `docs/plan/section-frontend.md` — Expo + RN (design tokens, primitives, routing)
   - `docs/plan/section-domain.md` — TS types + flows + normalize
   - `docs/plan/section-ai.md` — OpenRouter wrapper + prompts + streaming + cost
   - `docs/plan/section-testflight.md` — EAS + TestFlight + launch assets

## Stack

- **Monorepo layout:** `apps/native/` (Expo) + `packages/shared/` (TS domain types) + `supabase/` (migrations + edge functions)
- **Package manager:** `bun`
- **Expo:** 54 + Expo Router v6, TypeScript
- **State:** TanStack Query (server) + Zustand (UX)
- **Backend:** Supabase CLI, migrations at `supabase/migrations/`
- **AI:** OpenRouter (Haiku 4.5 draft, Sonnet fallback, `google/gemini-3.1-flash-lite-image` for canon-locked meal art via OR_IMAGE_MODEL secret)

## Key locked decisions

- **Bundle ID:** `com.kata.qook`
- **App name:** Qook. Subtitle: "Tonight's dinner, sorted."
- **Domain:** `qook.app` (purchase Day 1 via Cloudflare Registrar)
- **Auth:** Sign in with Apple + email/password (both via Supabase Auth)
- **No IAP in v1.** Paywall ships in v1.1 via RevenueCat.
- **Account deletion in-app** (Apple 5.1.1(v) requirement)
- **Spotlight-first images (decided 2026-07-11):** the default proposal fires at draft time; alternates on engagement. Typical session ~$0.034–$0.10.
- **Mock/live toggle** — `app.json.extra.apiMode` flips between fixtures and Supabase

## Design system (Phase 3b Menu restyle landed 2026-07-08)

- Palette: cream ground `#FBF7EE` / active well `#F1E9D9` / surface `#FFFCF6` / forest ink `#2A3A26` / rust `#C36A48` / prussian `#3D5469`
- Fraunces Bold (display) · DM Sans (body) · JetBrains Mono (kickers)
- Primitives kept: PaperCard, ScreenShell (flat cream), PolishedButton (default CTA), MenuRow, Vignette
- Primitives dialed back: **BrushstrokeUnderline** used sparingly as title accent only, not system-wide
- Primitives deprecated: **PaintedButton** (wobbly buttons), **painted icons** (IconClose, IconRefresh, IconHeart, IconArrowRight, etc. — replace with `lucide-react-native`), **PaintedCheckbox wobble**
- 24 Seedream watercolor PNGs at `assets/meals-seed/v2/` (copied from sashafood) — the watercolor food imagery remains the distinctive visual
- Aesthetic direction: Codex-style restraint on chrome, lean on typography (Fraunces + DM Sans), let watercolor food + palette carry the brand. Brushstrokes as accents, not as the system.

## Reference (NOT active code paths)

- `/Users/zach/Projects/sashafood/apps/swift/Qook/` — SwiftUI reference impl (TonightView renders in light-watercolor on iPhone 17 Pro sim). Keep as TypeScript-port reference only.
- `/Users/zach/Projects/sashafood/apps/native/` — old RN app with Convex backend. Cheat-sheet for patterns only; not porting.
- `/Users/zach/Projects/sashafood/packages/convex/convex/lib/recipeNormalize.ts` — normalize logic to port to `packages/shared/src/domain/recipeNormalize.ts`
- `/Users/zach/Projects/sashafood/packages/convex/convex/lib/recipeTaxonomy.ts` — cuisine/protein taxonomies to port

## Rules

- **Do NOT merge PRs to main** — Zach handles merges himself
- **External API cost:** always test with 1-2 items before batch (`google/gemini-3.1-flash-lite-image` is approximately $0.034/image)
- **OpenRouter key:** lives ONLY in Supabase Edge Function secrets. Never in client bundle, never in EAS.
- **RLS is the security model:** every client query must pass RLS. Edge Functions hold service role key for admin ops.
- **Signature dedup:** SHA-256 over canonical `{title, cuisine, tier, sorted ingredients}` → global recipe cache
- **No emojis in UI** — color, typography, iconography only
- **SwiftUI reference only** — active code path is Expo/React Native. Do not edit `sashafood/apps/swift/` from this project.

## Dev commands

Run app commands from `apps/native/`; the root package has no scripts.

```bash
bun install                         # install deps from repo root
cd apps/native && bun run start     # Expo dev server
cd apps/native && bun run typecheck # tsc --noEmit
cd apps/native && bun run lint      # eslint
supabase start           # local Postgres + Auth + Storage + Edge runtime
supabase db reset        # replay migrations locally
supabase gen types typescript --local > packages/shared/src/database.ts  # regenerate types
supabase db push         # push migrations to prod
supabase functions deploy <fn>  # deploy single edge fn
```
