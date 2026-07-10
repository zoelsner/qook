# Qook finish line

**Written:** 2026-07-10  
**Purpose:** the current source of truth for getting the July revival from a convincing simulator demo to a safe TestFlight build. Older April backlogs are reference material, not the execution queue.

## Current state

- The core loop works against live Supabase: choose energy/context → generate 3 recipes → review → commit one to Tonight/Week → derive Shop → open recipe/cook.
- Recipe text, image generation, Storage, shopping-share fallback, and delete-account Edge Functions are deployed.
- Phase 3b's Menu visual system is in code.
- Generated-art linking was repaired on 2026-07-10. Missing art no longer impersonates another meal; pending records refresh until their own image is ready.
- Latest real timing: recipes ~34s; images another ~11–22s in parallel; all art ~54s from the original tap.
- Supabase remains the backend. Do not migrate to Convex to solve UI reactivity; use bounded polling now and Supabase Realtime later if scale warrants it.

## P0 — TestFlight blockers

### 1. Real identity, session upgrade, and account deletion

- Replace the local-flag `SignInScreen` Apple stub with Supabase Sign in with Apple.
- Decide whether email/password is required for the first external build or can follow Apple.
- Preserve or deliberately migrate the anonymous user's plan/preferences when the account is linked.
- Enable the More → Delete account row, add a destructive confirmation, invoke the deployed `delete-account` function, clear local stores, and return to auth.
- Acceptance: sign in, relaunch, session persists; delete account removes remote data and local state and cannot be undone accidentally.

### 2. Legal, support, and truthful links

- Provision the actual domain or choose real hosted URLs before enabling Privacy/Terms/Feedback.
- The bundled privacy policy currently contains `privacy@qook.app`; do not ship that address unless it exists.
- Remove or disable the recipe share URL until `https://qook.app/r/<slug>` resolves to a real page.
- Add the App Store privacy-policy and support URLs to the release checklist.

### 3. EAS/TestFlight release plumbing

- Add and review `eas.json`; confirm Apple team, bundle ID, credentials, capabilities, and production environment values.
- Produce a development build on a physical iPhone, then a production archive.
- Audit privacy manifest/API declarations, icons, splash, version/build numbers, export compliance, and App Store metadata.
- Run the complete happy path on a physical device and non-development network before submission.

### 4. AI spend and anonymous-abuse decision

- Current behavior generates 3 images per session: about `$0.204` before text cost.
- With the current 10-session daily quota, theoretical image exposure is about `$2.04` per user/day; anonymous identities are mintable.
- Choose one before external TestFlight:
  1. keep proposal-time art and tighten signup/rate controls;
  2. generate only the selected meal (lowest cost);
  3. generate the spotlight immediately and the other two on demand (best compromise).
- Add an operational cost/error view or alert so image failures and spend are visible without opening Supabase logs.

### 5. Data-contract cleanup

- `getRecipeById` uses the snake_case → client mapper; audit every other recipe read and remove remaining raw `as Recipe` casts, especially `getTonightPlan` and `getSwipeFeed` before those paths are relied on.
- Keep edge and client recipe mappers covered by the same representative fixture.
- Decide whether saved IDs and week-plan snapshots remain local-only after real auth or sync to Supabase.

## P1 — product completeness

### Honest generation UX

- Replace “about 10 seconds” with copy that matches the measured ~34-second recipe result.
- Treat text and art as two stages: “Drafting dinners” followed by “Painting the menu.”
- Let users review recipe titles/details as soon as text is ready; artwork fills progressively with neutral placeholders.
- Add clear retry/offline states and a visible failure message instead of relying only on development logs.

### Bookmarks need a destination

- The bookmark currently persists `savedRecipeIds`, but no live screen consumes that list.
- Either add a compact “Saved recipes” section under More/Cookbook, or remove the bookmark from v1. A control that cannot retrieve its result is unfinished.

### Cooking mode

- Turn the existing ingredient checklist and steps into a focused cook view: one step at a time, optional timers, keep-awake behavior, and large tap targets.
- Preserve the current serving scaler and checked-state persistence.

### Feedback and learning

- After cooking, ask one lightweight question: “Make again?”, “Too much work?”, or “Not our thing?”
- Store this as structured feedback and use it in later prompts. This is more valuable than adding more preference questions up front.

### Reliability and release quality

- Add Sentry or equivalent client/Edge observability, with PII-safe generation diagnostics.
- Test VoiceOver labels, Dynamic Type, reduced motion, offline/reconnect, background/foreground during generation, and interrupted image downloads.
- Add regression coverage around recipe mapping, image lifecycle, anonymous→real-account migration, deletion, and week-plan persistence.

## Fable brief: what to redesign

Use Fable as a visual-state design tool, not as the source of backend behavior. Keep the four-tab information architecture and the Menu tokens unless a product decision explicitly changes them.

Design these exact states before polishing extra screens:

1. Tonight empty / generating / ready / generation failed.
2. Review with three text-ready meals and images arriving independently.
3. Recipe detail with art pending, ready, and failed—never substitute unrelated food.
4. Week with empty days, generating days, and committed picks.
5. Shop empty, populated, checked, share success, and share failure.
6. Auth, account-linking, destructive deletion confirmation, and deleted state.
7. Offline/reconnecting banner and recoverable API error.

For every Fable screen, annotate the real data source, loading state, error state, and primary action. Do not introduce fake URLs, unsupported account features, or new navigation destinations without an implementation task.

## High-leverage ideas after the blockers

1. **Why this dinner:** one sentence under each proposal explaining the match—time, preferred protein, cuisine, or ingredient overlap. It makes the AI feel intentional.
2. **Pantry rescue:** a quick “use these first” field for 2–5 ingredients. Feed it into the existing context prompt rather than building inventory management.
3. **Leftover-aware week:** prefer ingredient overlap across adjacent days and label the reuse (“cilantro carries into Thursday”). This strengthens both Week and Shop.
4. **Household handoff:** share the committed week and grocery list with one partner. Start with a simple invite/read-write model; avoid a full social system.
5. **Cook feedback loop:** learn from completed meals and skips, then surface “because you liked…” explanations.
6. **Progressive art budget:** generate the chosen/spotlight meal first, then let the user request alternates. This improves perceived speed while protecting image spend.

## Recommended order

1. Decide image timing/cost policy and correct generation-time copy.
2. Real Apple auth + anonymous-session upgrade.
3. Account deletion UI and end-to-end verification.
4. Legal/support URLs and share-link truthfulness.
5. EAS development build on a physical iPhone.
6. Fix remaining recipe-row casts and add mapping tests.
7. Give bookmarks a destination or remove them.
8. Use Fable for the seven state families above, then implement only the approved deltas.
9. Accessibility, observability, offline/retry, and full release regression.
10. Production archive → internal TestFlight → feedback loop → external TestFlight.

## Explicitly later

- Convex migration.
- RevenueCat/paywall.
- Full pantry inventory and barcode scanning.
- Social feed or public recipe marketplace.
- Instacart partner/API integration beyond the honest search/share fallback.
- Cohort cron/batch system unless live-generation cost or latency proves it necessary.
