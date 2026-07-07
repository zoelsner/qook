# Phase 2 deploy notes (ops log)

Date: 2026-07-07. Executed by Claude (SDD Task 11, adapted cloud-first — no Docker on machine, so the plan's local-stack steps were replaced with cloud equivalents against the real project).

## Account / project

- Supabase account: Zach's NEW dedicated account (old account hit the 2-active-free-project limit; FTP untouched per Zach).
- Org: "Zach's Qook" (`mmidcvwztglgjlgrynpx`), free plan.
- Project: `eehjclffugngogbvctib` ("zooelsner@gmail.com's Project", us-west-2, Postgres 17) — auto-created at signup; adopted rather than creating a second.
- Auth: CLI via `SUPABASE_ACCESS_TOKEN` in `~/Projects/qook/.env.local` (also `SUPABASE_DB_PASSWORD` there). **TODO Zach: rotate both later** — they transited chat once.
- Worktree `~/Projects/qook-phase2` linked: `supabase link --project-ref eehjclffugngogbvctib`.

## Migrations

- `supabase db push` — first run FAILED: `ERROR: column "user_id" specified more than once (42701)` in `my_saved_recipes` view (latent April bug; view had never applied anywhere, zero consumers). Fixed by removing the view from `20260421000000_init_schema.sql` (commit 67cf5c5), re-push: all 4 migrations applied clean.

## Functions

- Deployed with in-code auth, platform gate off (Zach approved 2026-07-07): `supabase functions deploy <fn> --no-verify-jwt` for `generate-recipe`, `shopping-share`, `generate-image`, `delete-account`. All returned "Deployed Functions."

## Secrets

- `supabase secrets set OPENROUTER_API_KEY="$(grep '^OPENROUTER_API_KEY=' ~/Projects/qook/.env.local | cut -d= -f2-)"` → "Finished supabase secrets set." Confirmed present via `supabase secrets list` (name only; value never printed).

## Smoke (free, pre-AI)

- `POST /functions/v1/generate-recipe` unauthenticated → **401 `{"code":"unauthorized","message":"Sign in required."}`** (our typed body — function boots, auth-guards before spend).
- `POST /functions/v1/shopping-share` unauthenticated → 401 (plain-text body from shared `requireUser` — known minor, recorded for final review).

## app.json

- `extra.supabaseUrl` / `extra.supabaseAnonKey` set to the real project values (anon key is public by design). `apiMode` remains `"mock"` — the live flip is Task 14.

## Still owed (recorded in SDD ledger)

- Task 13 [COST] text smoke (STOP-CONFIRM), Task 14 live flip + sim walk, Task 18 [COST] image smoke, Task 20 final verification.
- Post-deploy hard gate: delete-account cascade smoke with a throwaway user.
