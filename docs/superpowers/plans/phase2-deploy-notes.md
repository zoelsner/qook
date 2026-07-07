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

## Task 13 [COST] text smoke — PASSED 2026-07-07

- Throwaway user `smoke-task13@qook.test` created via admin API (profile auto-created by `handle_new_user` trigger); signed in via password grant.
- Run 1 caught a real bug: `chatStream` never sent `response_format` → model free-formed JSON → Zod envelope validation failed after a full paid generation.
- Fix iterations (schema-validation 400s abort before token generation, so they cost ~nothing) mapped Anthropic's structured-outputs subset: no `maxItems`, no `minItems` > 1, no integer `minimum`/`maximum`, no `enum` on union types (nullable enum → `anyOf`). All stripped constraints remain enforced by Zod post-stream.
- 22s stream timeout aborted mid-generation once structured outputs produced the full detailed envelope → raised to 90s. Unthrottled cumulative `partial` events totaled ~900KB/generation → throttled to 500ms (titles unthrottled; `final` is built from re-read DB rows so the throttle cannot stale it).
- Passing run: `ready` → 3 `title` → 21 `partial` → `final` → `done` in 30s; 3 global cache recipes persisted (user_id null, signatures set, image_status pending); all 6 failed smoke sessions correctly marked `failed`, 1 `ready`.
- Task-reviewed (approved); validation-failure log trimmed to 300 chars of raw output (PII hygiene — model text can echo voice_context).

## Task 14 live flip + sim walk — DONE 2026-07-07 (one carried finding)

- Auth resolution: anonymous sign-ins enabled on the project (management API); `ensureSession()` in the client signs in anonymously when no session exists; `profiles.email` made nullable (migration `20260707000000`) because the signup trigger inserts a null email for anonymous users.
- Sim walk (idb-driven; computer-use screenshots were broken by a macOS screen-capture permission): Tonight → After Work → "Something easy with chicken" → loading → review landed a real AI recipe ("Pan-Seared Chicken with Garlic Butter and Asparagus"); DB shows the anonymous session `ready` with matching voice_context. First walk accidentally exercised the MOCK path (app was on a cached bundle from an older Metro) — detected because the DB showed no new session; forced a fresh bundle load from the worktree Metro (port 8082) and re-walked live.
- **Carried finding (Important, fix by Task 20):** GenerationLoadingScreen renders no text at runtime — no "Cooking up ideas…", no stage labels, no streamed titles; only the spinner and step dots show (verified in two captures at 15s/25s). Title SSE events are confirmed emitted server-side.

## Still owed (recorded in SDD ledger)

- Task 18 [COST] image smoke (STOP-CONFIRM), loading-screen text fix, Task 20 final verification.
- Post-deploy hard gate: delete-account cascade smoke — reuse the Task 13 smoke user.
