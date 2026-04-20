# START HERE

**Today:** 2026-04-20 (plan day)
**First build day:** 2026-04-21 (Monday)
**Ship:** 2026-05-24 — 32 days

## Status: planning complete, execution not yet started

Five architects (backend, frontend, domain, ai, testflight) produced ~6500 lines of detailed planning. Synthesized into the unified plan at [PLAN.md](./PLAN.md).

## What's done (today, 2026-04-20)

- [x] Fresh repo initialized at `~/Projects/qook/`
- [x] Plan docs copied into `docs/plan/`
- [x] `CLAUDE.md` written at repo root with stack + locked decisions
- [x] Design system locked: cream/forest/rust/prussian + Fraunces Bold + watercolor
- [x] 24 Seedream watercolor PNGs at `/Users/zach/Projects/sashafood/apps/native/assets/meals-seed/v2/` (to copy on Day 1)
- [x] Fraunces-Bold.ttf at `/Users/zach/Projects/sashafood/apps/swift/Qook/Resources/Fonts/Fraunces-Bold.ttf` (superseded — will use `@expo-google-fonts/fraunces` instead)
- [x] Checkpoint in Claude memory at `~/.claude/projects/-Users-zach-Projects-qook/memory/`

## Resolved (2026-04-20 EOD)

1. **Seedream licensing** → leaning yes, verify Day 1 before cohort batch (check OpenRouter TOS + Seedream model card). 15-min task.
2. **Budget: text-only live mode** ($65/mo @ 100 testers). Cohort images eager, live generation NEVER creates images (even on save). Live recipes show watercolor paper-texture placeholder. Supersedes PLAN.md §6.7 "save-gated" — tighter now, revisit post-TestFlight.
3. **Recipe edit UX: clone-on-edit confirmed.** Cohort/AI rows immutable; user edits fork new row with `source='user'`.

## Still open (lower priority, not blocking Day 1)

See [PLAN.md §10](./PLAN.md#10-open-questions-for-zach) — nutritional estimates UI, TestFlight submission timing, app name keywords, Instacart fallback, privacy policy hosting, paywall copy.

## Monday morning (Day 1 = 2026-04-21)

Run the 16-step checklist at [PLAN.md §9](./PLAN.md#9-day-1-action-list-monday-apr-21-2026).

Note: **steps 1, 6-7 are partially done** because this repo already exists. Adjusted flow:

```
[x]  1. Apple Developer status check — already applied Apr 13
[ ]  2. Supabase: create qook-prod project
[ ]  3. Supabase: create qook-staging project
[ ]  4. Apple Developer: register Bundle ID com.kata.qook
[ ]  5. Buy qook.app via Cloudflare Registrar
[x]  6. Create Expo project — ADJUSTED: this repo is pre-initialized as the monorepo root.
        DO: cd ~/Projects/qook && npx create-expo-app@latest apps/native --template blank-typescript
[x]  7. Initialize monorepo layout — ADJUSTED: docs/ already exists. Add the rest:
        mkdir -p packages/shared/src/{types,domain}
        mkdir -p supabase/{migrations,functions/_shared,functions/generate-recipe,functions/generate-image,functions/generate-deck-batch,functions/warm-start-import,functions/delete-account}
[ ]  8. Install Expo deps (run INSIDE apps/native/ after create-expo-app)
[ ]  9. Copy seed assets from sashafood (meals-seed/v2/ + privacy-policy.html)
[ ] 10. Supabase CLI init + link + start
[ ] 11. Create initial migration files (paste SQL from section-backend.md §2-5)
[ ] 12. Set Edge Function secrets (OPENROUTER_API_KEY, model overrides)
[ ] 13. Initialize EAS (eas login, eas init, eas credentials)
[ ] 14. Set EAS secrets (SUPABASE_ANON_KEY_*)
[ ] 15. git push to new GitHub repo qook
[ ] 16. By EOD: bun run start inside apps/native → simulator boots to cream background
```

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

## When you finish the Monday checklist

Immediately update this file: move `[ ]` → `[x]` for completed items in the checklist section above, and commit.

Then start Day 2-3 work per [PLAN.md §4](./PLAN.md#4-32-day-timeline-apr-21--may-24) — migrations, RLS, primitives, auth.
