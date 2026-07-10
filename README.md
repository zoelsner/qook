# Qook

iOS meal-planning app. Hybrid AI recipe generation with watercolor-illustrated decks.

**Target:** TestFlight via the 2026-07 revival. The original May date lapsed.

## Status

**Phase:** Live Supabase generation + Menu restyle are working in the simulator. Real auth, account deletion UI, legal/support URLs, release plumbing, and final reliability work remain.

## Where to start

1. Read **[the finish-line plan](docs/superpowers/plans/2026-07-10-finish-line.md)** — current blockers, priorities, and Fable brief
2. Read **[CLAUDE.md](CLAUDE.md)** — live architecture and project gotchas
3. Use the April `docs/plan/` files only as background where the July revival docs have not superseded them

## Stack

- **Client:** Expo 54 + Expo Router v6 + TypeScript + Reanimated 4 + react-native-svg
- **Backend:** Supabase (Postgres 17 + RLS + Edge Functions + Storage + Auth)
- **AI:** OpenRouter → Haiku 4.5 (draft) + Sonnet fallback + Gemini 3.1 Flash Image (canon-locked art)
- **Build:** EAS Build → TestFlight

## Architecture

The app uses live personalized generation: `generate-recipe` streams three structured recipes, persists signature-deduped rows, and the client requests canon-locked art through `generate-image`. Supabase Storage serves the finished image; the app polls only while image status is pending/generating and never substitutes unrelated food.

Stay on Supabase. Convex is retained only as an old reference implementation; the current backend and security model are not migration targets.

## Design

Cream `#FBF7EE` / active well `#F1E9D9` / forest `#2A3A26` / rust `#C36A48` / prussian `#3D5469`.
Fraunces Bold (display) · DM Sans (body) · JetBrains Mono (kickers).
Watercolor-painted meal hero images.

## Docs

- `docs/superpowers/plans/2026-07-10-finish-line.md` — authoritative launch queue
- `docs/superpowers/plans/phase2-deploy-notes.md` — live Supabase operations and incident log
- `docs/superpowers/specs/2026-07-06-qook-revival-design.md` — revival product/architecture spec
- `docs/plan/PLAN.md` — original April plan (historical reference)
- `docs/plan/section-backend.md` — Supabase schema, RLS, Edge Fns, cron
- `docs/plan/section-frontend.md` — Expo scaffold, design tokens, RN primitives
- `docs/plan/section-domain.md` — TS types, flows, normalization
- `docs/plan/section-ai.md` — hybrid AI, prompts, OpenRouter wrapper, cost
- `docs/plan/section-testflight.md` — EAS, TestFlight, launch assets
