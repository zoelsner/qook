# Phase 3a — Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the two already-deployed-but-uncalled backend capabilities (save-gated hero-image generation, Instacart list hand-off) real in-app call sites, and verify the ScreenShell loading-text fix in the simulator.

**Architecture:** This is a wiring-only phase, not a feature phase. (1) `generate-image` currently only authenticates a service-key capability probe, so the app cannot call it — we make it *also* accept a normal signed-in user (including the pre-Phase-5 anonymous session) and add a single atomic `pending → generating` UPDATE as the double-spend cost guard. The client fires the image request, unawaited, only when the user *saves* a recipe. (2) The Shop dock's "Shop with Instacart" button calls the local search-URL helper instead of the deployed `shopping-share` edge function; we point it at the existing `createInstacartShoppingList` client function (keyless search-fallback is the primary, expected path). (3) A machine-gated simulator walk verifies loading-screen text renders and the save → image pipeline works end-to-end.

**Tech Stack:** React Native / Expo (TypeScript, zustand, TanStack Query, expo-router) in `apps/native`; Supabase Edge Functions on Deno in `supabase/functions`; OpenRouter (`google/gemini-3.1-flash-image`) for image generation.

## Global Constraints

Every task's requirements implicitly include this section.

- **Client gates must stay green:** `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`.
- **Edge-fn tests run under `deno test`** in `supabase/functions`. NOTE: `supabase/functions/generate-recipe/persist.test.ts` has a PRE-EXISTING failure requiring `--allow-net` — that is not this phase's problem. Run new deno tests by targeting the specific file, not the whole tree.
- **bun CANNOT import react-native/expo modules.** Any client-side unit test must be a pure-logic extraction with zero RN/expo imports. (This phase adds no client test — see Task 2 rationale — so this constraint only bounds future work here.)
- **Never print or echo secrets** (`OPENROUTER_API_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, service-role key). Secrets live in `~/Projects/qook/.env.local`. Load them into the shell with `set -a; source ~/Projects/qook/.env.local; set +a` — never `cat`/`echo` them.
- **Function deploys** run from the worktree (already linked to project `eehjclffugngogbvctib`, ref confirmed in `supabase/.temp/project-ref`): `supabase functions deploy <fn> --no-verify-jwt`. `--no-verify-jwt` is correct here — auth is enforced in-code by `requireUser`, matching `shopping-share`.
- **Paid smoke tests** are marked `[COST]` and MUST be gated on Zach's explicit confirmation before running.
- **Stage commits by explicit path only** — never `git add -A`. This worktree shares files with two other uncommitted work sessions in the MAIN checkout (`~/Projects/qook`); DO NOT touch that checkout.
- **Merge-conflict expectation:** the two other sessions have uncommitted edits to `apps/native/src/lib/shoppingShare.ts`, `ShopScreen.tsx`, `aggregateIngredients.ts`, `weekPlan.ts`, `RecipeDetailModal.tsx` in the MAIN checkout. This plan edits `ShopScreen.tsx` and `RecipeDetailModal.tsx` and does NOT touch the other three. Keep every diff in those two shared files as small as possible — a conflict on merge is expected and accepted; a small diff is trivial to resolve.
- **Out of scope:** no `generate-recipe` changes, no Anthropic structured-outputs / streaming changes, no polling infrastructure (spec §6 is "retry on next open", not poll).
- **YAGNI ladder** (apply before writing any code): (1) does it need to exist? (2) already in the codebase? (3) stdlib? (4) existing dependency? (5) a one-liner? (6) only then, minimal new code. No speculative features, config, or abstraction.

## File Structure

- **Modify** `supabase/functions/generate-image/index.ts` — swap the service-key capability probe for `requireUser`; add the atomic `pending → generating` lock; 404 on missing recipe; no-op (200) when the lock is not acquired.
- **Create** `supabase/functions/generate-image/lock.ts` — pure `lockOutcome()` guard (no `Deno.serve`, no npm imports → unit-testable net-free).
- **Create** `supabase/functions/generate-image/lock.test.ts` — deno unit test for `lockOutcome()`.
- **Modify** `apps/native/src/services/api.ts` — add `requestRecipeImage(recipeId)` (mock no-op / live `functions.invoke`) and export it on the `api` object.
- **Modify** `apps/native/src/features/recipe/RecipeDetailModal.tsx` — fire `api.requestRecipeImage` on the save transition (not on unsave).
- **Modify** `apps/native/src/features/shop/ShopScreen.tsx` — dock "Shop with Instacart" → `createInstacartShoppingList`.

---

## Task 1: generate-image accepts a user JWT + atomic double-spend lock

**Files:**
- Create: `supabase/functions/generate-image/lock.ts`
- Test: `supabase/functions/generate-image/lock.test.ts`
- Modify: `supabase/functions/generate-image/index.ts`

**Interfaces:**
- Produces: `lockOutcome(updatedRows: { id: string }[] | null): "claimed" | "skip"` — maps the conditional UPDATE's returned rows to a control decision. Consumed by `index.ts`.
- Produces (HTTP): `POST generate-image` now authenticates any signed-in user via `Authorization: Bearer <jwt>`; body `{ recipeId: string }`; responses — `200 {ok:true,path}` (generated), `200 {ok:true,skipped:true}` (lock not acquired: already generating/ready/failed), `400 bad_request` (no recipeId), `401 unauthorized` (no/invalid user), `404 not_found` (recipe row missing), `502 image_failed` (generation error).

- [ ] **Step 1: Write the failing test for the lock guard**

Create `supabase/functions/generate-image/lock.test.ts`:

```ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { lockOutcome } from "./lock.ts";

Deno.test("lockOutcome claims when the conditional update matched a pending row", () => {
  assertEquals(lockOutcome([{ id: "r1" }]), "claimed");
});

Deno.test("lockOutcome skips when no row matched (already generating/ready/failed)", () => {
  assertEquals(lockOutcome([]), "skip");
});

Deno.test("lockOutcome skips when the update returned null data", () => {
  assertEquals(lockOutcome(null), "skip");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd ~/Projects/qook-phase2 && deno test supabase/functions/generate-image/lock.test.ts`
Expected: FAIL — `Module not found "file:///.../generate-image/lock.ts"`.

- [ ] **Step 3: Write the minimal lock guard**

Create `supabase/functions/generate-image/lock.ts`:

```ts
// Cost-control double-spend guard. The conditional UPDATE ... WHERE
// image_status = 'pending' is atomic in Postgres: exactly one caller flips a
// given recipe out of 'pending', so only that caller pays for generation.
// This maps the update's returned rows to a control decision. Kept in its own
// module (no Deno.serve, no npm imports) so it unit-tests under `deno test`
// without --allow-net.
export function lockOutcome(
  updatedRows: { id: string }[] | null,
): "claimed" | "skip" {
  return updatedRows && updatedRows.length > 0 ? "claimed" : "skip";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ~/Projects/qook-phase2 && deno test supabase/functions/generate-image/lock.test.ts`
Expected: PASS — `ok | 3 passed | 0 failed`.

- [ ] **Step 5: Rewrite `index.ts` to use `requireUser` + the lock**

Replace the ENTIRE contents of `supabase/functions/generate-image/index.ts` with:

```ts
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { buildImagePrompt } from "../_shared/prompts/image.ts";
import { CANON_IMAGE_DATA_URL } from "../_shared/assets/canon-b64.ts";
import { MODELS, OR_ENDPOINT, orHeaders } from "../_shared/openrouter.ts";
import { ERRORS, errorResponse } from "../_shared/errors.ts";
import { lockOutcome } from "./lock.ts";

const IMAGE_PRICE_USD = 0.068; // google/gemini-3.1-flash-image, spec §3

// Storage path and the DB's image_storage_path must agree with the actual
// bytes' MIME type — hardcoding .png silently wrote mismatched extensions
// for jpeg/webp responses.
function extensionForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

function extractImageBytes(json: unknown): { bytes: Uint8Array; mime: string } {
  // deno-lint-ignore no-explicit-any
  const msg = (json as any)?.choices?.[0]?.message;
  const first = Array.isArray(msg?.images) ? msg.images[0] : null;
  const url = first?.image_url?.url ?? first?.url ?? null;
  if (!url || typeof url !== "string") throw new Error("no image url in response");
  if (url.startsWith("data:")) {
    const [header, b64] = url.split(",");
    const mime = header.match(/data:([^;]+)/)?.[1] ?? "image/png";
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return { bytes, mime };
  }
  throw new Error("non-data image url; expected inline b64");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Save-gated client call: any signed-in user (including the pre-Phase-5
  // anonymous session) may request art for a recipe they saved. "Saved" is a
  // client-local zustand set with no server representation (recipes are global
  // cache rows with user_id null), so it cannot be verified here. The cost
  // control is instead the once-only atomic lock below, bounded by the
  // per-user generation quota (spec §10).
  try {
    await requireUser(req);
  } catch (resp) {
    return resp as Response;
  }

  const { recipeId } = (await req.json().catch(() => ({}))) as {
    recipeId?: string;
  };
  if (!recipeId) {
    return errorResponse(ERRORS.BAD_REQUEST, "recipeId required.", 400);
  }

  const admin = serviceClient();

  // Fetch prompt inputs first so a genuinely missing recipe is a clean 404
  // (distinct from the "already claimed" no-op below).
  const { data: row, error } = await admin
    .from("recipes")
    .select("id, title, ingredient_groups")
    .eq("id", recipeId)
    .single();
  if (error || !row) {
    return errorResponse(ERRORS.NOT_FOUND, "Recipe not found.", 404);
  }

  // Atomic double-spend guard: exactly one caller flips pending → generating.
  // Repeat saves / duplicate fires and cross-user saves of the same global
  // recipe find status != 'pending' and no-op without paying again.
  const { data: locked } = await admin
    .from("recipes")
    .update({ image_status: "generating" })
    .eq("id", recipeId)
    .eq("image_status", "pending")
    .select("id");
  if (lockOutcome(locked) === "skip") {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt = buildImagePrompt({
    title: row.title as string,
    ingredientGroups: row.ingredient_groups,
  });

  try {
    const resp = await fetch(OR_ENDPOINT, {
      method: "POST",
      headers: orHeaders(),
      body: JSON.stringify({
        model: MODELS.image(),
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: CANON_IMAGE_DATA_URL } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`image gen ${resp.status}: ${await resp.text()}`);
    const json = await resp.json();
    const { bytes, mime } = extractImageBytes(json);

    const path = `${recipeId}.${extensionForMime(mime)}`;
    const up = await admin.storage.from("meal-images").upload(path, bytes, {
      contentType: mime,
      upsert: true,
      cacheControl: "31536000",
    });
    if (up.error) throw up.error;

    await admin.from("recipes").update({
      image_status: "ready",
      image_storage_path: path,
      image_updated_at: new Date().toISOString(),
      last_image_prompt: prompt,
    }).eq("id", recipeId);

    console.log(
      JSON.stringify({
        tag: "or_cost",
        label: "image",
        model: MODELS.image(),
        usd: IMAGE_PRICE_USD,
      }),
    );
    return new Response(JSON.stringify({ ok: true, path }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    await admin.from("recipes").update({
      image_status: "failed",
      image_error: String(err).slice(0, 400),
    }).eq("id", recipeId);
    console.error("generate-image error", String(err));
    // Client renders letter-vignette on failed status (restyle plan, spec §6).
    return errorResponse(ERRORS.IMAGE_FAILED, "Image generation failed.", 502);
  }
});
```

Note the deletions from the previous version: the `npm:@supabase/supabase-js` `createClient` import, the `x-internal-secret` capability probe, and the unconditional `update({ image_status: "generating" })`. The service-key probe path had no caller (confirmed by grep — nothing invokes `generate-image` internally), so removing it is a YAGNI clean-up, not a behavior loss.

- [ ] **Step 6: Type-check the function**

Run: `cd ~/Projects/qook-phase2 && deno check supabase/functions/generate-image/index.ts`
Expected: no errors. (May fetch/cache npm + std deps on first run; that is fine.)

- [ ] **Step 7: Re-run the lock test to confirm still green**

Run: `cd ~/Projects/qook-phase2 && deno test supabase/functions/generate-image/lock.test.ts`
Expected: PASS — `ok | 3 passed | 0 failed`.

- [ ] **Step 8: Deploy the updated function** (free, not `[COST]`)

Run (does not echo secrets):
```bash
cd ~/Projects/qook-phase2 && set -a && source ~/Projects/qook/.env.local && set +a && supabase functions deploy generate-image --no-verify-jwt
```
Expected: `Deployed Functions on project eehjclffugngogbvctib: generate-image`.

- [ ] **Step 9: Commit**

```bash
cd ~/Projects/qook-phase2 && git add supabase/functions/generate-image/lock.ts supabase/functions/generate-image/lock.test.ts supabase/functions/generate-image/index.ts && git commit -m "feat(generate-image): accept user JWT + atomic pending→generating cost lock

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Client fires the image request on recipe save

**Files:**
- Modify: `apps/native/src/services/api.ts`
- Modify: `apps/native/src/features/recipe/RecipeDetailModal.tsx`

**Interfaces:**
- Consumes: `POST generate-image` from Task 1 (`{ recipeId }`, user JWT).
- Produces: `requestRecipeImage(recipeId: string): Promise<void>` exported on the `api` object. No-op in mock mode; in live mode fires `supabase.functions.invoke('generate-image', { body: { recipeId } })` unawaited-and-swallowed.

**No unit test in this task — deliberate.** The only new client logic is a mode gate (`mode === 'mock'` → return) and a save-transition check (`!saved`). There is no client test runner in this repo (no `.test.*` under `apps/`, no `bun test` script, no jest), and `api.ts` transitively imports expo-constants / RN so it cannot be bun/deno-tested. Standing up a client test runner (plus the tsconfig/eslint churn `bun:test` types would require) to pin a two-term boolean is disproportionate to the risk — a mock-mode misfire is a caught no-op, and an unsave misfire hits the server lock and no-ops. The money-guard that *is* worth a test (`lockOutcome`) is covered in Task 1. This wiring is verified by `typecheck` + `lint` (this task) and the live save→image E2E (Task 4).

- [ ] **Step 1: Add `requestRecipeImage` to `api.ts`**

In `apps/native/src/services/api.ts`, insert this function immediately AFTER the `generateRecipesForEnergy` function (after its closing `}` on the line before `export const api = {`). `supabase` and `ensureSession` are already imported at the top of the file (line 8), so no import change is needed:

```ts
// Save-gated hero art (spec §10 budget; Zach 2026-07-07: fire on save, not on
// cook-commit). Called but NOT awaited when the user saves a recipe. The
// server's atomic pending→generating lock makes repeat/duplicate/cross-user
// calls cheap no-ops, so the client needs no dedup or polling — image_status
// is simply re-read on next open (spec §6). No-op in mock mode: fixture
// recipes have no DB row, so a request would 404.
export async function requestRecipeImage(recipeId: string): Promise<void> {
  if (mode === 'mock') return;
  try {
    await ensureSession();
    await supabase.functions.invoke('generate-image', { body: { recipeId } });
  } catch {
    /* fire-and-forget — a failed request just leaves image_status untouched */
  }
}
```

- [ ] **Step 2: Export it on the `api` object**

In `apps/native/src/services/api.ts`, the `api` object currently ends:

```ts
  getGroceries,
  toggleGrocery,
  generateRecipesForEnergy,
};
```

Change it to add the new function:

```ts
  getGroceries,
  toggleGrocery,
  generateRecipesForEnergy,
  requestRecipeImage,
};
```

- [ ] **Step 3: Fire on the save transition in `RecipeDetailModal.tsx`**

In `apps/native/src/features/recipe/RecipeDetailModal.tsx`, the save `IconPill`'s `onPress` currently reads:

```tsx
              onPress={() => {
                press();
                toggleSavedRecipe(recipeId);
              }}
```

Change it to (fire only when this press is a *save*, using the pre-toggle `saved` value from line 52; `api` is already imported at line 31):

```tsx
              onPress={() => {
                press();
                if (!saved) void api.requestRecipeImage(recipeId);
                toggleSavedRecipe(recipeId);
              }}
```

- [ ] **Step 4: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd ~/Projects/qook-phase2/apps/native && bun run typecheck && bun run lint`
Expected: both exit 0, no errors.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/qook-phase2 && git add apps/native/src/services/api.ts apps/native/src/features/recipe/RecipeDetailModal.tsx && git commit -m "feat(client): fire save-gated image request on recipe save

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: Wire the Shop dock to the Instacart edge function

**Files:**
- Modify: `apps/native/src/features/shop/ShopScreen.tsx`

**Interfaces:**
- Consumes: `createInstacartShoppingList(items: GroceryItem[]): Promise<void>` — already exists in `apps/native/src/lib/shoppingShare.ts`. It guards the empty list, invokes `shopping-share`, opens `data.url` on success (keyless search-fallback is the expected primary path since Instacart Connect applications are closed), and falls back to `openInstacart` if the edge fn is unreachable.

**Do NOT edit `shoppingShare.ts`.** The function already does everything needed; another session has uncommitted edits there and touching it multiplies merge conflicts.

- [ ] **Step 1: Swap the import**

In `apps/native/src/features/shop/ShopScreen.tsx`, the import block currently reads:

```tsx
import {
  copyList,
  openAmazonFresh,
  openInstacart,
  shareList,
} from '../../lib/shoppingShare';
```

`openInstacart` is only used by the dock's Shop button (about to change), so replace it with `createInstacartShoppingList`:

```tsx
import {
  copyList,
  createInstacartShoppingList,
  openAmazonFresh,
  shareList,
} from '../../lib/shoppingShare';
```

- [ ] **Step 2: Point the dock CTA at the edge function**

In the same file, the dock's `onShop` currently reads:

```tsx
            onShop={() => {
              press();
              openInstacart(uncheckedGrocery);
            }}
```

Change it to (the dock only renders when `totalItems > 0` and is `disabled` when `remaining === 0`, and `createInstacartShoppingList` re-guards the empty list, so no new guard is needed):

```tsx
            onShop={() => {
              press();
              void createInstacartShoppingList(uncheckedGrocery);
            }}
```

- [ ] **Step 3: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd ~/Projects/qook-phase2/apps/native && bun run typecheck && bun run lint`
Expected: both exit 0, no errors. (In particular, `openInstacart` must no longer be reported as an unused import.)

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/qook-phase2 && git add apps/native/src/features/shop/ShopScreen.tsx && git commit -m "feat(shop): wire Instacart dock to shopping-share edge function

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: Simulator verification — loading text + save→image E2E

**[MACHINE — needs Zach's OK, simulator in use for another project]**
**[COST ~7–15¢ — one live recipe generation + one image; do NOT run without Zach's explicit confirmation]**

**Files:** none committed by this task except the temporary log removal (Step 6). Requires Tasks 1–3 merged and `generate-image` deployed (Task 1 Step 8).

**Purpose:** (a) confirm the ScreenShell fix (commit `7f6e8a9`) makes `GenerationLoadingScreen` text render — pre-fix its `flex:1` wrapper resolved to height 0, so the static "Cooking up ideas…" title and the streamed titles had no layout box; (b) confirm the save→image pipeline works end to end; (c) confirm the Instacart dock hand-off opens.

- [ ] **Step 1: Add a temporary decisive-check log**

In `apps/native/src/features/eat/GenerationLoadingScreen.tsx`, add an `onLayout` to the wrapper `View` (the `<View style={styles.wrapper}>` around line 68):

```tsx
      <View
        style={styles.wrapper}
        onLayout={(e) =>
          console.log('LOADING_WRAPPER_H', e.nativeEvent.layout.height)
        }
      >
```

- [ ] **Step 2: Launch the app in live mode against the simulator**

Confirm `apps/native` runs in `live` mode (`Constants.expoConfig.extra.apiMode === 'live'`), then start the iOS simulator build. Watch the Metro/console log.

- [ ] **Step 3: Trigger a generation and verify loading text + wrapper height** `[COST — this is the paid recipe generation]`

From the Eat/Tonight flow, pick an energy tier to start a live generation. On `GenerationLoadingScreen`, verify:
  - Static heading "Cooking up ideas…" is visible (Fraunces display).
  - Streamed recipe titles appear beneath the spinner as they arrive (or the stage label before the first title).
  - The `LOADING_WRAPPER_H` log prints a value ~full-screen height (roughly > 400 on a modern iPhone sim), NOT `0`. `0` would mean the ScreenShell fix regressed.

- [ ] **Step 4: Save a recipe and verify the image pipeline** `[COST — this is the paid ~7¢ image]`

Open one generated recipe (`RecipeDetailModal`), tap the bookmark (Save). No spinner should appear — the request is fire-and-forget. Wait ~7–17s, then navigate away and reopen the same recipe (forces a `react-query` re-read of `heroImageUrl` / `image_status`). Verify the painted hero image now renders. If it instead shows the cream-circle letter vignette, check the `generate-image` logs — a `502` means OpenRouter generation failed (spec §6 behavior, not a wiring bug); a `401`/`404` means the wiring or lock is wrong.

- [ ] **Step 5: Verify the Instacart dock hand-off** (no cost)

Go to the Shop tab with at least one recipe's ingredients aggregated. Tap "Shop with Instacart". Verify it opens an Instacart URL (expected `source: "search_fallback"` since no `INSTACART_IDP_KEY` is configured — a pre-filled `instacart.com/store/s?k=...` search page). It must not dead-end.

- [ ] **Step 6: Remove the temporary log and commit the cleanup**

Revert the `onLayout` added in Step 1 (restore `<View style={styles.wrapper}>`). Then:

Run: `export PATH="$HOME/.local/bin:$PATH" && cd ~/Projects/qook-phase2/apps/native && bun run typecheck && bun run lint`
Expected: both exit 0.

```bash
cd ~/Projects/qook-phase2 && git add apps/native/src/features/eat/GenerationLoadingScreen.tsx && git commit -m "chore: remove temporary loading-wrapper onLayout probe

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(If Step 1's edit was never left in the tree because you reverted before committing anything, this commit is a no-op — skip it. `git status` should be clean at the end either way.)

---

## Self-Review

**1. Spec coverage.**
- Spec §1.3 (Shop Instacart dock) → Task 3 wires the dock CTA to `shopping-share`. ✓
- Spec §6 (image failure = cream circle + first letter, retry on next open) → server returns `502` and sets `image_status: 'failed'` on failure; the client renders the vignette on non-ready status and re-reads on next open; no polling added. Task 4 Step 4 verifies. ✓
- Spec §10 (save-gated Gemini images, ~7¢, per-user quota bound) → the atomic `pending → generating` lock (Task 1) plus fire-on-save-only (Task 2) is the cost control; worst case is bounded by the existing generation quota. ✓
- Spec §8 note ("v1 paints on cook-commit") is explicitly superseded by Zach's 2026-07-07 save-gated decision — recorded in the `requestRecipeImage` comment. ✓
- ScreenShell fix verification → Task 4 Steps 1–3 with the height-0 decisive check. ✓

**2. Placeholder scan.** No `TBD`/`TODO`/"handle edge cases"/"add validation"/"similar to Task N". Every code step shows complete code; every run step shows the exact command and expected output. ✓

**3. Type consistency.** `lockOutcome` signature is identical in Task 1's Interfaces block, `lock.ts`, `lock.test.ts`, and its call site in `index.ts` (`lockOutcome(locked) === "skip"`). `requestRecipeImage(recipeId: string): Promise<void>` is consistent across `api.ts`, the `api` object, and the `RecipeDetailModal` call site (`api.requestRecipeImage(recipeId)`). `createInstacartShoppingList(items: GroceryItem[])` matches the existing `shoppingShare.ts` signature and the `uncheckedGrocery: GroceryItem[]` argument in `ShopScreen.tsx`. ✓

**Known limitation (surfaced, not fixed here):** the lock accepts only `pending`, so a recipe whose image generation `failed` will not re-generate on a subsequent save (it stays `failed` → vignette). In this phase the client fires only on save, and there is no re-fire-on-open, so widening the lock to `failed` would be dead capability (YAGNI). When the restyle phase adds retry-on-open, widen the lock's `WHERE image_status IN ('pending','failed')` then.
