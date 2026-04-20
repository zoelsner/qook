# Qook Fresh — Unified Build Plan

**Owner:** synthesis of backend / frontend / domain / AI / testflight architects
**Target ship:** 2026-05-24 TestFlight
**Repo:** `~/Projects/qook/` (fresh, NOT inside sashafood)
**Today:** 2026-04-20 — 32 days to ship

---

## 1. Executive summary

Qook v1 is an iOS meal-planning app that hands users a weekly 12-card deck of watercolor-illustrated dinners, swipes to pick 3-5, auto-builds a grocery list, and lets them cook tonight — all on top of a fresh Expo + Supabase + OpenRouter stack. The architecture is hybrid AI: a Sunday pg_cron batch pre-generates 4 tiers × 12 recipes into public Storage JSON (cheap, shared), plus on-demand personalized generation via SSE-streaming Edge Functions (expensive, rate-limited per user). Design is locked to a cream/forest/rust/prussian watercolor palette with Fraunces Bold + DM Sans + JetBrains Mono, ported 1:1 from the Swift reference into RN/SVG primitives. We ship internal TestFlight by Day 25 (May 15), external by Day 30 (May 19), with May 24 as the public-facing ship date — all on Supabase Pro ($25/mo) + ~$30-170/mo OpenRouter for 100 testers.

---

## 2. Core decisions (cross-cutting)

- **Platform:** Expo 52 + Expo Router v4 + TypeScript + Supabase (Postgres + RLS + Edge Functions + Storage + Auth) + OpenRouter (single API key for text + images).
- **Repo:** Fresh at `~/Projects/qook/` — NOT inside the sashafood monorepo. Sashafood `apps/swift/` and `apps/native/` remain reference-only.
- **iOS-only v1.** Android deferred to v1.2 (late 2026). Tablet deferred indefinitely.
- **Hybrid AI architecture.** Cohort decks (pre-gen, CDN-fronted JSON) + live personalized generation (SSE, rate-limited).
- **Auth:** Sign in with Apple (required by App Store 4.8) + email/password. Supabase Auth handles both.
- **Design system locked.** Cream `#FAF5EC` / forest `#2A3A26` / rust `#C36A48` / prussian `#3D5469`. Fraunces Bold (display), DM Sans (body), JetBrains Mono (kickers). Watercolor-painted meal hero images.
- **Bundle ID:** `com.kata.qook` ("Kata" = parent brand, "qook" = product).
- **App Store name:** Qook. Subtitle: "Tonight's dinner, sorted."
- **No IAP / paywall in v1.** Free access during TestFlight. Paywall ships in v1.1 via RevenueCat.
- **Account deletion in-app.** Hard App Store 5.1.1(v) requirement; Edge Function `delete-account`.
- **Warm start.** 24 existing Seedream PNGs from sashafood `meals-seed/v2/` import once as seed cohort.
- **OpenRouter key lives only in Supabase Edge Functions.** Never in client bundle, never in EAS.
- **Dedup by signature hash.** SHA-256 of canonical recipe content — globally-cached recipe rows keyed by `signature`.
- **Mock/live toggle.** `app.json.extra.apiMode` flips between fixtures and Supabase. Flip on Day ~11.

---

## 3. Architecture overview

```
+-----------------------------------------------------------------------+
|                          EXPO iOS CLIENT                              |
|  app/ (Expo Router) → src/features → src/components → src/design      |
|  TanStack Query (server state)  |  Zustand (UX state)                 |
|  supabase-js + AsyncStorage     |  react-native-sse (live gen)        |
|  expo-image + expo-blur         |  Reanimated 3 + GestureHandler      |
+---------------------------------+-------------------------------------+
                                  |
            Supabase Anon JWT     |      SSE (live)  /  REST (reads)
                                  ▼
+-----------------------------------------------------------------------+
|                        SUPABASE (us-east-1)                           |
|                                                                       |
|   Edge Functions (Deno)         |   Postgres 15 + RLS                 |
|   - generate-recipe (SSE)       |   profiles / user_preferences       |
|   - generate-deck-batch (cron)  |   recipes (signature-deduped)       |
|   - generate-image              |   weekly_decks / deck_items         |
|   - warm-start-import           |   cohort_decks / generation_*       |
|   - delete-account              |   grocery_items / ai_circuit        |
|                                 |                                     |
|   Storage (public CDN)          |   Realtime (filtered subs)          |
|   - meal-images/<id>.webp       |   generation_sessions, _items       |
|   - cohort-decks/<week>/<tier>  |   recipes (image_status flips)      |
|                                 |                                     |
|   pg_cron + pg_net              |   Auth (Apple + Email/Password)     |
|   - Sat 22:00 UTC → batch       |   custom_access_token_hook          |
+---------------------------------+-------------------------------------+
                                  |
                       OPENROUTER_API_KEY (server-only)
                                  ▼
+-----------------------------------------------------------------------+
|                          OPENROUTER                                   |
|   anthropic/claude-haiku-4.5   (draft, ~$0.01/recipe)                 |
|   anthropic/claude-sonnet-4.6  (polish fallback, ~$0.03)              |
|   bytedance-seed/seedream-4.5  (images, $0.04 each)                   |
+-----------------------------------------------------------------------+
```

**Data flow summary:**
- Tonight / Cookbook / Shop / Saved → direct Supabase REST reads (cached via TanStack Query, RLS-scoped).
- Swipe Night deck seed → loads `cohort_decks/<week>/<tier>.json` from CDN, clones into `weekly_decks` + `deck_items`.
- Eat / live gen → client POSTs to `generate-recipe` SSE → server fans out N slots → writes `generation_items` → client subscribes to Realtime → UI fills card-by-card.
- Image ready → Realtime UPDATE on `recipes.image_status` → client swaps placeholder for CDN URL.
- Weekly cron → Sunday 22:00 UTC triggers `generate-deck-batch` → 48 recipes + 48 images → JSON mirror + DB rows.

---

## 4. 32-day timeline (Apr 21 → May 24)

Columns: **Backend / Frontend / Domain / AI / TestFlight**. Arrows mark dependencies. `[H]` = hard gate.

| Day range | Backend | Frontend | Domain | AI | TestFlight |
|---|---|---|---|---|---|
| **D1-3 (Apr 21-23)** | Supabase CLI init, `qook-prod` project, init_schema.sql, enums, indexes | `create-expo-app`, deps, `app.config.ts`, folder scaffold, `src/design/*` tokens | Primitive enums, User/Preference types in `packages/shared/` | Schema `_shared/schema.ts` + Zod, tier rules, OpenRouter wrapper | Apple Dev approval confirm [H], domain buy `qook.app`, privacy page, EAS secrets |
| **D3-5 (Apr 23-25)** | RLS policies, auth triggers, storage buckets, `supabase gen types` pipeline | PaperCard, WashBackground, BrushstrokeUnderline, ScreenShell, FloatingTabBar | Supabase mapper layer, onboarding-screen wiring | `generate-image` Edge Fn smoke test with 1 real image [H cost checkpoint] | First `eas build --profile development` on empty template [H] |
| **D5-7 (Apr 25-27)** | Apple SIWA dev keys, email templates, session refresh, run `warm-start-upload-images` for 24 PNGs → `warm-start-import` seeds recipe rows | Auth flow (sign-in, sign-up) E2E against Supabase; StepDots, RingSpinner; copy seed PNGs | Recipe, Ingredient, IngredientGroup, RecipeSection types | `validate-recipe` + `withPolish` helpers | Exit D7: auth live, 24 seed recipes visible with CDN images |
| **D8-10 (Apr 28-30)** | Enable Realtime on generation_sessions/items + recipes; circuit breaker table | TonightScreen with DisplayText + underline + DinnerCards, stagger animation | CohortDeck, WeeklyDeck, DeckItem, deckVariety.ts algorithm (pick 3 with cuisine spread) | Cohort batch prompts (Haiku, 12/tier), planCohortSlots, variety-hash | |
| **D10-12 (Apr 30 - May 2)** | `generate-deck-batch` Edge Fn + pg_cron schedule (Sat 22:00 UTC) | SwipeCard + useSwipeGesture (Pan + reanimated), 3-card stack | Recipe normalize port (ingredients, units, categories), signature hash | End-to-end batch test: 48 recipes + 48 images in <6 min | |
| **D12-14 (May 2-4)** | `generate-recipe` Edge Fn with SSE streaming + slot fan-out → `generation_items` | Eat flow: EnergyPicker → GenerationLoading → ReviewRecipes; SSE client hook | GenerationSession + state machine; recipePlanner planSlots | Partial JSON parser; polish-gate trigger; dedup cache | Exit D14: full happy path works [H] |
| **D15-17 (May 5-7)** | `warm-start-import` verified idempotent; grocery CRUD; rate limit (30 gens/mo) | Shop / Saved / More screens; recipe modal with matched transition | GroceryItem + groceryNormalize port + aggregation; dietaryTags inference | Daily quota enforcement (10 live gens/user/day) at edge | Account deletion flow [H]; privacy manifest audit |
| **D18-20 (May 8-10)** | Sentry in Edge Fns, monitoring, `/health` function; upgrade to Pro ($25) [H] | Onboarding flow (household, cuisines, avoid, tier); gate tabs on `onboarded` | Onboarding derive protein priorities from cuisines (CUISINE_TO_PROTEINS) | iOS `expo-speech-recognition` for voice context; safety screen | App icon + splash via Seedream; haptic audit |
| **D20-22 (May 10-12)** | Synthetic load test (100 concurrent); backup verification | EAS Build setup, error boundaries per screen, empty/loading/offline states | Types frozen after D21 — breaking changes gated | Fault inject circuit breaker; soak test 200 live requests | First `eas build --profile production` + ASC record [H]; screenshots (5×2 classes) |
| **D23-25 (May 13-15)** | Hotfix-loop readiness | TanStack offline-first reads, accessibility pass, keyboard edges | Verification on device | Cost dashboard (SQL view, daily $ per surface) | ASC metadata + privacy questionnaire; submit Internal TestFlight [H] |
| **D26-28 (May 16-18)** | Triage from internal testers | OTA hotfixes for JS-only diffs | Observability on variety algo | Watch Sonnet polish rate, image fail rate, quota trips | 10+ internal testers installed, feedback loop open |
| **D29-30 (May 19-20)** | Migration fixes, RLS tightening | Second internal build with fixes | | | Submit External TestFlight (24-48h review) [H] |
| **D31-32 (May 21-22)** | Buffer — cost/egress watch | Buffer | Buffer | Buffer | Respond to reviewer; external invites go out |
| **D33-35 (May 22-24)** | Hotfix window | Hotfix window | — | — | **2026-05-24 ship day [H FINAL GATE]** |

**Hard gates (cannot slip without ship-date slip):**
1. Apple Dev approved — D1 check, escalate D7 [H]
2. First EAS build succeeds on empty template — D3 [H]
3. AI image pipeline ships 1 real image — D5 [H cost-rule]
4. Full happy path E2E — D14 [H]
5. Account deletion works — D17 [H]
6. Supabase Pro upgrade — D20 [H]
7. First production build + ASC record — D22 [H]
8. Internal TestFlight live — D25 [H]
9. External review submitted — D30 [H]

---

## 5. Critical path (top 7 blockers)

If any of these slip by >1 day, ship slips:

1. **Apple Dev Program approval.** Applied 2026-04-13; assume 7 days. If not approved by D7 → call 1-800-633-2152. Blocks *all* builds (internal TestFlight also requires approval).
2. **EAS first build smoke test (D3).** On empty template, BEFORE dependencies. Surfaces cert / bundle ID / quota issues early.
3. **Supabase schema + RLS locked by D3.** All of backend depends on this; AI + domain contracts assume the enums and JSONB shapes exist.
4. **Shared types package frozen by D21.** Any type change after D21 cascades through backend DB types, AI Zod schemas, frontend mappers, and Supabase mappers.
5. **`generate-recipe` SSE end-to-end (D12-14).** SSE over Supabase Edge + CDN buffering is the biggest unknown-unknown; `X-Accel-Buffering: no` header + non-streaming fallback endpoint mandatory.
6. **Account deletion shipped by D17.** Apple 5.1.1(v) rejection-on-sight if missing.
7. **External TestFlight review submission (D30).** First external build requires ~24-48h review; submit D30 to have buffer for reviewer round-trip before D35.

---

## 6. Cross-cutting decisions resolved

### 6.1 Recipe JSONB shape (backend × domain × AI)

Three docs describe it slightly differently:
- **Backend:** `recipes.ingredient_groups jsonb`, `workflow_sections jsonb`, `timeline jsonb` with CHECK constraints for `jsonb_typeof = 'array'` only.
- **Domain:** `IngredientGroup[] { title, role, items[] }`, `RecipeSection[] { title, objective, steps[] }`, `RecipeTimelineItem[]`.
- **AI:** Zod schema `Recipe` with `ingredientGroups[]` and `workflowSections[]` + OpenRouter `json_schema`.

**Resolution:**
- Domain types are the canonical TS shape, named `ingredientGroups`, `workflowSections`, `timeline`.
- Backend stores snake_case: `ingredient_groups`, `workflow_sections`, `timeline`. Supabase-generated types map automatically.
- AI output matches domain `camelCase` directly (Zod schema). Normalizer does the snake↔camel bridge at insert time.
- Timeline is computed server-side from `workflowSections[*].steps[*].durationMin` — AI does NOT emit timeline directly; `normalizeRecipe` derives it.
- Owner of the shape: `packages/shared/src/types/recipe.ts`.

### 6.2 Signature hash algorithm (backend × AI)

**Resolution:** SHA-256 over canonical JSON of `{ title, cuisine, tier, sorted(ingredientGroups[*].items[*].item) }`. Lives in `packages/shared/src/domain/signature.ts`. Both Edge Functions import from shared package (Deno can import local TS via file path). Uniqueness constraint enforced by `recipes_signature_global_idx WHERE user_id IS NULL`.

### 6.3 Cohort deck data flow (domain × backend × AI)

**Resolution:**
- Sat 22:00 UTC `pg_cron` → HTTP POST to `generate-deck-batch` (per backend cron migration).
- Inside: 4 tiers × 12 recipes each, serial per-tier (OpenRouter rate limits), parallel across tiers.
- Each recipe: draft (Haiku) → normalize → signature → upsert global recipe row → fire image.
- After 12 recipes land, write `cohort-decks/<week>/<tier>.json` to public Storage.
- Also `upsert` into `cohort_decks` DB row for indexed lookup (`week_start_date`, `energy_tier`, `recipe_ids[]`, `storage_path`).
- Client reads CDN JSON directly (zero DB hit for Tonight/Swipe Night seed).
- Variety-pick 3 for Tonight is client/edge-side via `deckVariety.pickTonight()`.

### 6.4 Live generation UX states (domain × AI × frontend)

All three describe a similar state machine. **Unified set (final):**

| State | Screen | Trigger |
|---|---|---|
| `idle` | Eat home | mount |
| `collecting_context` | Voice / prompt modal | user taps "Generate" |
| `generating_text` | Review (skeleton cards) | context submitted, SSE opens |
| `streaming_recipes` | Review (cards fill in) | first `partial` SSE event |
| `finalizing` | Review (persisting) | `final` event received |
| `generating_images` | Review (placeholders) | recipes persisted, images kicked |
| `ready` | Review (full cards) | all `image_status='ready'` OR 30s timeout |
| `error` | Error card | any state × failure |

Owner: `packages/shared/src/types/generation.ts` defines enums; frontend hook `useGenerateRecipe` reduces SSE events into these states; Edge Function emits events matching names.

### 6.5 Rate limits (backend × AI × testflight)

**Resolution:**
- **Per-user daily cap:** 10 live generations / 24h. Enforced at start of `generate-recipe` Edge Function via count on `generation_sessions` (past 24h). Returns 429.
- **Per-user monthly cap:** 30 live sessions / 30 days. Paywall upsell when exceeded (soft barrier in v1: error toast; v1.1: RevenueCat paywall screen).
- **Cohort cron:** Serial per tier within batch to stay under OpenRouter request/sec ceiling.
- **Image concurrency:** 4 parallel workers in batch.
- Circuit breaker opens after 5 failures → 3-minute cool-off → natural reopen on next request.

### 6.6 Shared types package location (domain × backend × AI)

Domain says `packages/shared/src/`. Backend says `packages/shared-types/src/`. AI says `supabase/functions/_shared/`.

**Resolution:**
- `packages/shared/` (one workspace package) owns TS domain types + pure helpers (normalize, signature, deckVariety, dietary tags). Imported by the Expo app.
- `supabase/functions/_shared/` lives inside the Supabase Deno workspace and imports the same files via relative path (`../../../packages/shared/src/...`) since Deno supports local TS imports.
- `packages/shared-types/src/database.ts` is the auto-generated Supabase row types (from `supabase gen types`). Separate file, same workspace package.

**Net:** one `packages/shared/` workspace contains both hand-written domain types and generated Supabase row types. Edge Functions import from it via relative path.

### 6.7 Image eagerness (AI × testflight cost) — UPDATED 2026-04-20

**Resolution (tightened by Zach EOD):** **Text-only live mode.** Cohort eager, live generation never creates images.
- Cohort: 48 images/week eager — this IS the brand experience on Tonight.
- Live: zero images ever, even on save. Live recipes show watercolor paper-texture placeholder permanently in the Cookbook.
- Cost at 100 testers: ~$64/mo total ($9 OpenRouter cohort + $25 Supabase Pro + $5 Sentry/domain + $20 live text + $5 polish).
- Revisit post-TestFlight — if placeholders feel too thin in user feedback, ratchet back to save-gated (+$45/mo at 100 testers).

### 6.8 Voice context provider

**Resolution:** iOS `expo-speech-recognition` (on-device, free, private). Transcript never leaves device until submit. Whisper-via-OpenRouter considered and rejected (adds PII'd audio over network, per-minute cost). Android port (v1.2) will re-evaluate.

---

## 7. Cost model

### 7.1 Per-call (OpenRouter 2026-04 pricing)

| Call | Input | Output | Cost |
|---|---|---|---|
| Haiku cohort recipe (batched 12) | 1.2K tok | 14.4K tok | $0.058 / tier / week |
| Haiku live triple | 1.5K tok | 3.6K tok | $0.016 / triple |
| Sonnet polish (rare) | 2K tok | 1.5K tok | $0.029 / call |
| Seedream image | — | — | $0.04 / image |

### 7.2 Monthly totals

| Line item | 100 testers | 1K users | Notes |
|---|---|---|---|
| Supabase Pro base | $25 | $25 | flat |
| Cohort text (4 tiers × 12 × 4.3 wk) | $1 | $1 | shared across all users |
| Cohort images (48 × 4.3 wk) | $8 | $8 | shared |
| Live text (blend light+heavy, save-gated) | $20 | $200 | ~scales linear |
| Live images | $0 | $0 | **OFF per §6.7 — text-only live** |
| Polish fallback (<15% rate) | $5 | $50 | caps at 15% |
| Egress (CDN meal-images) | ~$0 (under 250GB) | ~$30 | monitor |
| Sentry + domain | $5 | $5 | flat |
| **Total** | **~$64/mo** | **~$319/mo** | text-only live locked 2026-04-20 |

Hard cap: **$75/mo OpenRouter** with 80% alert ($60) and 100% hard-stop switch. Per-user cap: 10 gens/day enforces blast radius.

---

## 8. Risk register (top 10)

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| 1 | Apple Dev approval slips past D7 | M | H | Call 1-800-633-2152 D7; dogfood via Expo Go until approved | TestFlight |
| 2 | SSE delta delivery broken by CDN buffering | M | H | `X-Accel-Buffering: no` header; non-streaming fallback endpoint; test on LTE + hotel WiFi | AI + Frontend |
| 3 | First external review rejection (2.3.1 AI content / 5.1.1(v)) | L | H | Clean review notes with demo account; in-app AI disclosure; account-deletion verified D17 | TestFlight |
| 4 | OpenRouter rate limits hit during cohort batch | M | M | Serial within tier (not parallel slots); image concurrency capped at 4 | AI |
| 5 | JSONB shape drift between AI output and Postgres CHECK | M | M | Single Zod schema in `packages/shared`; normalizer last defense; array-only CHECK constraints (loose) | Domain + Backend |
| 6 | Seedream watercolor style drift (~10% photorealistic) | M | L | Strong prompt prefix; visual spot-check on D9; optional style classifier v2 | AI |
| 7 | Cost blowup: heavy user generates 50/day | L | M | Daily cap 10/user enforced at edge; OpenRouter $100/mo alert at 80% | Backend + AI |
| 8 | Realtime message cap (2M/mo Free tier) | L | M | Pro tier = 5M/mo; monitor and disable Realtime on non-gen tables | Backend |
| 9 | `pg_cron` + `pg_net` unreliable on Free tier | M | M | Don't enable cron until Pro upgrade (D20); manual trigger for first cohort | Backend |
| 10 | Font loading delay / white flash | L | L | `SplashScreen.preventAutoHideAsync` + hide-on-load in root; splash at cream bg | Frontend |

---

## 9. Day 1 action list (Monday Apr 21, 2026)

Copy-paste-able morning checklist:

```
[ ]  1. Check Apple Developer Program status at developer.apple.com/account
        → If "Pending Review" past 24h, no action. If "Approved", note Team ID.
        → If "Action Required", respond immediately.

[ ]  2. Supabase Dashboard → create new project `qook-prod`
        Org: zach-personal, Region: us-east-1, Postgres 15+, tier: Free (Pro upgrade D20).
        Note: project ref, anon key, service role key.

[ ]  3. Create `qook-staging` project on Free tier (preview builds).

[ ]  4. Register Bundle ID with Apple Developer:
        developer.apple.com/account → Identifiers → + → App IDs
        Bundle ID: Explicit → com.kata.qook
        Capabilities: Sign in with Apple, Associated Domains, Push Notifications
        (Do NOT enable: IAP, HealthKit, iCloud)

[ ]  5. Buy domain: qook.app via Cloudflare Registrar ($12/yr)
        Point DNS at Vercel; host /privacy and /support stubs.

[ ]  6. cd ~/Projects && npx create-expo-app@latest qook --template blank-typescript
        cd qook && git init && git add -A
        git commit -m "chore: initial expo blank-typescript scaffold"

[ ]  7. Initialize monorepo layout:
        mkdir -p packages/shared/src/{types,domain}
        mkdir -p supabase/{migrations,functions/_shared,functions/generate-recipe,functions/generate-image,functions/generate-deck-batch,functions/warm-start-import,functions/delete-account}
        mkdir -p apps/native/{app,src/{design,components,features,services,stores,hooks,lib,types}}

[ ]  8. Install Expo + RN deps per section-frontend.md §1.2:
        bunx expo install expo-router react-native-screens react-native-safe-area-context \
          react-native-gesture-handler react-native-reanimated expo-linking expo-constants expo-status-bar
        bunx expo install expo-font expo-splash-screen
        bun add @expo-google-fonts/dm-sans @expo-google-fonts/fraunces @expo-google-fonts/jetbrains-mono
        bunx expo install expo-image expo-haptics expo-blur
        bunx expo install react-native-svg expo-linear-gradient
        bun add @supabase/supabase-js @tanstack/react-query zustand
        bunx expo install @react-native-async-storage/async-storage react-native-url-polyfill
        bunx expo install @shopify/react-native-skia
        bun add -d typescript @types/react eslint prettier eslint-config-expo simplex-noise@^4.0.3

[ ]  9. Copy seed assets from sashafood (one-time):
        mkdir -p apps/native/assets/meals-seed/v2
        cp ~/Projects/sashafood/apps/native/assets/meals-seed/v2/*.png apps/native/assets/meals-seed/v2/
        mkdir -p apps/native/assets/fonts
        # Fraunces-Bold via @expo-google-fonts, no local .ttf needed
        cp ~/Projects/sashafood/apps/native/assets/privacy-policy.html apps/native/assets/privacy-policy.html

[ ] 10. Supabase CLI:
        brew install supabase/tap/supabase
        cd ~/Projects/qook
        supabase init
        supabase link --project-ref <qook-prod-ref>
        supabase start  # verify full local stack runs in Docker

[ ] 11. Create initial migration files:
        supabase migration new init_schema
        supabase migration new rls_policies
        supabase migration new auth_triggers
        supabase migration new storage_buckets
        # Paste SQL from section-backend.md §2-§5 into each

[ ] 12. Set Edge Function secrets:
        supabase secrets set OPENROUTER_API_KEY=<key from .env in sashafood>
        supabase secrets set OPENROUTER_TEXT_MODEL=anthropic/claude-haiku-4.5
        supabase secrets set OPENROUTER_POLISH_MODEL=anthropic/claude-sonnet-4.6
        supabase secrets set OPENROUTER_IMAGE_MODEL=bytedance-seed/seedream-4.5

[ ] 13. Initialize EAS:
        npm i -g eas-cli
        eas login
        eas init  # picks up app.config.ts, creates project
        eas credentials --platform ios  # let EAS manage certs

[ ] 14. Set EAS secrets (anon keys + Sentry DSNs):
        eas secret:create --name SUPABASE_ANON_KEY_DEV --value <dev-anon>
        eas secret:create --name SUPABASE_ANON_KEY_STAGING --value <staging-anon>
        eas secret:create --name SUPABASE_ANON_KEY_PROD --value <prod-anon>
        # Sentry DSNs same pattern

[ ] 15. Commit scaffolding and push to GitHub repo qook (new, public or private).

[ ] 16. By EOD: `bun run start` → simulator boots to cream background.
        Smoke test: no crashes, fonts render if a throwaway Text component is present.
```

---

## 10. Open questions for Zach

## RESOLVED 2026-04-20 EOD

- ✅ **Seedream commercial-use licensing** — Zach's read: leaning yes. **Day 1 task: 15-min verify** OpenRouter TOS + Seedream model card commercial-use clause before running any cohort batch. Not a ship blocker.
- ✅ **Recipe edit path** — clone-on-edit confirmed. Cohort/AI rows (`user_id IS NULL`) immutable. User edits fork new row with `source='user'`, `ownerId=userId`.
- ✅ **Hard monthly AI budget: text-only live mode.** Cohort eager (48 images/wk), live gen never creates images. $64/mo at 100 testers. Hard cap $75/mo OpenRouter with 80% alert. See §6.7 + §7.2.

## Still open (not blocking Day 1)

Decisions only the product owner can make:

- **Nutritional estimates in v1 or v2?** Domain types support optional `NutritionalEstimate` from Haiku; display is hidden behind flag. Ship the field (cheap) and reveal UI post-launch, or strip from v1? (Domain §11.1.)
- **External TestFlight timing.** Plan submits D30 (May 19) — target external reviewer approval D32 (May 21) to have buffer. Acceptable or push for D28?
- **App name discoverability.** "Qook" is short but not exact-match-SEO. Keywords list (dinner, meal plan, recipes, grocery, cooking, weeknight, instacart, what to cook, food, planner) covers the real searches. Confirm.
- **Instacart Platform integration.** Not on this team's plan, but testflight-architect flagged in Risk #6 that shipping with copy-list fallback is OK if approval slips. Confirm fallback-first strategy.
- **Privacy policy text.** Sashafood's `privacy-policy.html` is 90% applicable — needs Qook-specific rebranding and hosted URL. Accept that responsibility sits with Zach to host at `qook.app/privacy`.
- **Paywall copy for the rate-limit error.** At 30 live gens/mo ceiling, user hits 429. In v1 this is a toast. In v1.1 it becomes the RevenueCat paywall — confirm we want the toast to include "upgrade coming soon" copy or stay silent.

---

## 11. Links to detail

- **Backend (Supabase, schema, RLS, Edge Fns, cron, storage):** `~/Projects/qook/docs/plan/section-backend.md`
- **Frontend (Expo scaffold, design tokens, RN primitives, routing, mock-mode):** `~/Projects/qook/docs/plan/section-frontend.md`
- **Domain (TS types, flows, normalize, deck variety, state machine):** `~/Projects/qook/docs/plan/section-domain.md`
- **AI (hybrid arch, prompts, OpenRouter wrapper, streaming, image pipeline, cost):** `~/Projects/qook/docs/plan/section-ai.md`
- **TestFlight (Apple Dev, EAS, app.config, assets, timeline, risks, launch checklist):** `~/Projects/qook/docs/plan/section-testflight.md`

---

**Summary (4 sentences):**

The five architects converged on a consistent stack — Expo + Supabase + OpenRouter with a fresh `~/Projects/qook/` repo — and a hybrid AI pattern where a Sunday pg_cron batch writes 4×12 cohort decks to CDN-fronted Storage JSON for zero-cost Tonight reads, while SSE-streamed `generate-recipe` Edge Functions handle rate-limited personalized generation. The big cross-cutting resolutions are: one `packages/shared/` workspace owning both hand-written domain TS and generated Supabase row types (with Deno Edge Functions importing via relative path); a single SHA-256 signature hash keyed on canonical recipe JSON deduping both cohort and live recipes; and save-gated live image generation (cohort eager, live lazy) to keep 100-tester OpenRouter spend under $100/mo. The critical path has seven hard gates — Apple Dev approval, Day-3 EAS smoke build, first real AI image by Day 5, full happy-path by Day 14, account deletion by Day 17, Pro upgrade by Day 20, Internal TestFlight by Day 25 — with buffer baked in Days 31-35 to absorb external-review round-trip before the Day-35 (May 24) ship date. Day 1 is a copy-pasteable 16-step checklist that provisions Supabase, registers the Bundle ID, scaffolds the Expo monorepo with `com.kata.qook` + design tokens + seed PNGs, wires EAS credentials, and verifies the simulator boots to a cream background by EOD.
