# Qook

iOS meal-planning app. Hybrid AI recipe generation with watercolor-illustrated decks.

**Target ship:** TestFlight 2026-05-24

## Status

**Phase:** Planning complete, execution starts 2026-04-21.

## Where to start

1. Read **[docs/plan/START-HERE.md](docs/plan/START-HERE.md)** — entry point
2. Follow **[docs/plan/PLAN.md](docs/plan/PLAN.md)** §9 — Day 1 checklist

## Stack

- **Client:** Expo 54 + Expo Router v6 + TypeScript + Reanimated 4 + react-native-svg
- **Backend:** Supabase (Postgres 15 + RLS + Edge Functions + Storage + Auth)
- **AI:** OpenRouter → Haiku 4.5 (draft) + Sonnet 4.6 (polish) + Seedream 4.5 (images)
- **Build:** EAS Build → TestFlight

## Architecture

Hybrid AI:
- **Cohort decks** — Saturday 22:00 UTC `pg_cron` generates 4 tiers × 12 recipes/week → public CDN JSON (shared, ~$9/mo)
- **Live personalized** — SSE-streamed `generate-recipe` Edge Function, rate-limited 10/user/day, 30/user/mo

## Design

Cream `#FAF5EC` / forest `#2A3A26` / rust `#C36A48` / prussian `#3D5469`.
Fraunces Bold (display) · DM Sans (body) · JetBrains Mono (kickers).
Watercolor-painted meal hero images.

## Docs

- `docs/plan/PLAN.md` — unified 32-day execution plan
- `docs/plan/section-backend.md` — Supabase schema, RLS, Edge Fns, cron
- `docs/plan/section-frontend.md` — Expo scaffold, design tokens, RN primitives
- `docs/plan/section-domain.md` — TS types, flows, normalization
- `docs/plan/section-ai.md` — hybrid AI, prompts, OpenRouter wrapper, cost
- `docs/plan/section-testflight.md` — EAS, TestFlight, launch assets
