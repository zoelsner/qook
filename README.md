# Qook

Qook is an iPhone app for deciding what to cook. You tell it your tastes, who you're cooking for and how much energy you have tonight. It deals a hand of dinner ideas as cards, each with a watercolor illustration. Keep the ones you like and Qook writes the full recipe. The app also plans your week, builds a shopping list (which you can send to Instacart) and saves recipes you like.

The iOS beta is in testing. Overview: https://zachoelsner.com/projects/qook

## How it works

- **App** (`apps/native`): Expo 54 and React Native with Expo Router and TypeScript. Tabs are Tonight, Week, Shop and More. Sign in with Apple or email and password, or start as a guest and upgrade later. Account deletion is in the More screen.
- **Backend** (`supabase`): Supabase Postgres with row-level security, Auth, Storage and Deno Edge Functions.
- **Edge Functions** (`supabase/functions`):
  - `generate-proposals` deals the hand of recipe ideas.
  - `fill-recipe` writes ingredients and steps for a dish you keep.
  - `generate-image` paints the recipe illustration and stores it in Supabase Storage.
  - `shopping-share` sends a shopping list to Instacart.
  - `delete-account` deletes the account and its data.
  - `generate-recipe` is an older streaming endpoint that the current app does not call.
- **Models**: all model calls go through OpenRouter. Defaults are in `supabase/functions/_shared/openrouter.ts`: `openai/gpt-6-luna` for text and `google/gemini-3.1-flash-image` for images. The `OR_TEXT_MODEL` and `OR_IMAGE_MODEL` environment variables override them.

## Run it locally

Requires [Bun](https://bun.sh) and Xcode for the iOS simulator.

```sh
bun install
cd apps/native
bun run ios
```

`apps/native/app.json` points the app at the hosted Supabase project. The OpenRouter key exists only as a Supabase function secret, never in the app or this repo.

## Tests

App checks, from `apps/native`:

```sh
bun run test
bun run typecheck
bun run lint
```

Edge Function checks need [Deno](https://deno.com), from the repo root:

```sh
sh scripts/qa/run-backend-tests.sh cache
sh scripts/qa/run-backend-tests.sh check
sh scripts/qa/run-backend-tests.sh test
```

CI runs both sets (`.github/workflows/ci.yml`).

## Repo layout

```
apps/native/        Expo app (screens in app/, features and services in src/)
packages/shared/    shared TypeScript package
supabase/functions/ Edge Functions and their tests
supabase/migrations/ Postgres schema and RLS
scripts/            generation, QA and test scripts
docs/               plans, specs and audits
```
