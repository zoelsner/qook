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

## Task 18 [COST] image smoke — PASSED 2026-07-07

- Caught a real bug: comparing `Authorization` to env `SUPABASE_SERVICE_ROLE_KEY` fails on new-API-key projects (platform-injected key ≠ dashboard key; gateway also rejects key-shaped Authorization headers). Auth is now capability-based: callers send a service key via `x-internal-secret`; the function proves it with an `auth.admin.listUsers` probe. Anon key → 401 (verified).
- Paid smoke: 19s, `{"ok":true}`, 1024px PNG in `meal-images`, `image_status` ready, canon watercolor style transferred (visually verified). Note: nothing calls generate-image in-app yet (wiring open).

## Task 19 hard gate — delete-account cascade smoke PASSED 2026-07-07

- Deployed fn deleted the Task 13 smoke user: auth user, profile, preferences, and all 7 generation_sessions cascaded to zero; the 9 global cache recipes (user_id null) correctly retained. Smoke-user credentials are now dead.

## Task 20 — final whole-branch review (opus) 2026-07-07

- Verdict: READY WITH FIXES → fix commit `a19a20b` landed for all three Important findings: refusal path restored under structured outputs (envelope gained a required-nullable `refusal`; prompt + handler updated; paid confirm smoke passed post-deploy, 28s), pre-stream typed errors now reach the user via a buffered-fetch fallback (replaces the broken `functions.invoke` path; pure `parseBufferedSse` + bun tests), plus minors (context capped at 500 chars, image extension follows MIME, malformed-error-frame settle guard).
- Anonymous-spend exposure: app-level quota is per-user and anonymous users are mintable; platform default caps signups at 30/hour/IP. Tightening it and/or CAPTCHA needs Zach's decision (classifier requires his explicit OK for the config change).
- Open items carried out of Phase 2: GenerationLoadingScreen renders no text (needs interactive Metro debug; repro + evidence in ledger), generate-image and createInstacartShoppingList call-site wiring, nutrition columns product decision.

## Phase 3a — generate-image goes user-facing (2026-07-07/08)

- **Auth switched** `x-internal-secret` → shared `requireUser` (any signed-in user incl. anonymous; the internal-secret probe had zero callers and is removed). Function stays `--no-verify-jwt`; the anon-session JWT attaches automatically via `supabase.functions.invoke`.
- **Spend lock:** atomic conditional `UPDATE recipes SET image_status='generating' WHERE id=? AND image_status='pending' RETURNING id` — exactly one caller ever pays per recipe. Zero rows → 200 `{ok:true,skipped:true}`; UPDATE error → typed 500. Cost ceiling = global pending-count × ~$0.068, one-time. (Phase 3b Task 1 widens the lock to `IN ('pending','failed')` for retry-on-open + adds a 60s fetch abort.)
- **Client wiring:** save bookmark in RecipeDetailModal fires `api.requestRecipeImage(recipeId)` fire-and-forget on the unsaved→saved transition; Shop dock calls `createInstacartShoppingList` (shopping-share edge fn, keyless search fallback).
- **Crash fix:** `getRecipeById` was casting the raw snake_case DB row `as Recipe` → new client mapper `apps/native/src/services/recipeRow.ts` (port of `_shared/recipe-map.ts`; keep in sync). `getSwipeFeed` still has the raw cast (deferred; screen unrouted).
- **Verified E2E on sim 2026-07-08:** save → generate → recipe-specific canon-style watercolor ready in ~20s and rendered as modal hero; Instacart dock → Safari search fallback; loading-screen text fix confirmed live.
- **Deployed:** `generate-image` redeployed 2026-07-08 (commits 45ea3b6 + 0cec83c). Migrations unchanged since `20260707000001`.
- **Still pending (Zach):** rotate `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD`; push `main` (local c7d7cad) to origin.
