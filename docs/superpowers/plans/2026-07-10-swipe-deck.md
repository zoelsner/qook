# Swipe Deck ("Hand of 5") + Two-Phase Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-recipe review list with a bounded swipe deck ("hand of 5") fed by two-phase generation — fast/cheap proposals arrive first, full recipes are written only for dishes the user keeps or cooks, and keeps flow onto the week via an allocation step.

**Architecture:** Two new Edge Functions on the existing `_shared` toolkit — `generate-proposals` (one Luna call → 5 skeleton `{title, hook, timeMinutes, proteinG, cuisine}` rows, 1 quota unit, exact-title cache shortcut) and `fill-recipe` (one Luna call → fills ONE skeleton into a full recipe in place, signature-deduped at fill time, quota-free). `generate-recipe` (the streaming envelope endpoint) is left untouched. A new `recipes.content_status` column (`'full'` default / `'proposal'`) plus `hook` and `generation_error` columns distinguish skeletons from full rows; both the edge mapper and the client mapper are updated in the same task per the sync rule. The client replaces `ReviewRecipesScreen` with a swipe `DeckScreen` (keep-right / pass-left, reusing the existing reanimated `useSwipeGesture` hook), an `AllocationScreen` (day chips → `weekPlan` writes), and a "dealing the hand" animated loader. Deck/allocation/prefetch/reducer logic is extracted into pure, bun-testable modules.

**Tech Stack:** React Native / Expo 54 + Expo Router v6 (TypeScript, zustand, TanStack Query, react-native-reanimated ~4.1.1, react-native-gesture-handler ~2.28.0 — both already installed) in `apps/native`; Supabase Edge Functions on Deno in `supabase/functions`; OpenRouter text model `openai/gpt-5.6-luna` (via `OR_TEXT_MODEL` secret) and image model `google/gemini-3.1-flash-lite-image` (via `OR_IMAGE_MODEL` secret).

## Global Constraints

Every task's requirements implicitly include this section.

- **Client gates must stay green:** `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`. Run from `apps/native` (the repo root has no scripts).
- **Client unit tests run under `bun test`** and MUST be pure-logic modules with **zero React Native / Expo imports** (bun's transpiler cannot parse RN's Flow entry point). Only the matchers declared in `apps/native/bun-test.d.ts` are typed: `toBe`, `toEqual`, `toBeUndefined`, and `.not`. Do not use other matchers. Run a single file with `cd apps/native && bun test src/path/to/file.test.ts`.
- **Edge-fn tests run under `deno test`** targeting the specific file (not the whole tree — `supabase/functions/generate-recipe/persist.test.ts` has a PRE-EXISTING `--allow-net` failure that is not this build's problem). New edge pure helpers must be net-free (no `Deno.serve`, no `npm:` imports) so they test without `--allow-net`.
- **Never print or echo secrets** (`OPENROUTER_API_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, service-role key). `OPENROUTER_API_KEY` lives ONLY in Supabase function secrets. Load DB/CLI secrets with `set -a; source ~/Projects/qook/.env.local; set +a` — never `cat`/`echo`/`print` them.
- **Supabase project ref is `eehjclffugngogbvctib` only.** Do NOT touch the old FTP project. Migrations push with `supabase db push`; functions deploy with `supabase functions deploy <fn> --no-verify-jwt` (auth enforced in-code by `requireUser` / `getUser`, matching the other functions).
- **No pushes to `origin`.** Zach approves every push himself. Commit locally only.
- **Do NOT commit** the plan file itself; the orchestrator reviews first (this note is for the plan author, not the executor).
- **Paid smoke tests** are marked `[COST]` and MUST be gated on Zach's explicit confirmation before running. Test with 1–2 items before any batch (a Luna text call is a few cents; a `gemini-3.1-flash-lite-image` image is ~$0.034).
- **Stage commits by explicit path only** — never `git add -A`. The working tree may hold other sessions' uncommitted edits (`weekPlan.ts`, `ShopScreen.tsx`, `aggregateIngredients.ts`, `RecipeDetailModal.tsx` were modified at plan time). Keep diffs to those shared files minimal and re-baseline against the current file contents before editing.
- **DB row ↔ client mapping sync rule:** the edge mapper `supabase/functions/_shared/recipe-map.ts` and the client mapper `apps/native/src/services/recipeRow.ts` must change together in the same task. Never cast a raw snake_case row `as Recipe`.
- **RLS is the security model.** Skeleton rows are `user_id = null` global-cache rows and read exactly like today's full recipes — no RLS migration is needed. Edge Functions use the service-role client for inserts/updates.
- **No emojis in UI** — color, typography, iconography only.
- **YAGNI ladder** (apply before writing any code): (1) does it need to exist? (2) already in the codebase? (3) stdlib? (4) existing dependency? (5) a one-liner? (6) only then, minimal new code. No speculative features, config, or abstraction.

## Dependency decision (locked)

**No new dependency.** The deck uses `react-native-reanimated` (~4.1.1) and `react-native-gesture-handler` (~2.28.0), both already in `apps/native/package.json`, via the existing `apps/native/src/features/swipe-night/useSwipeGesture.ts` hook (currently unused elsewhere — a clean reanimated Pan gesture with throw/snap + haptics). Task 9 reuses it directly for keep/pass. The "dealing the hand" loader (Task 11) uses the built-in RN `Animated` API (no reanimated needed for a self-contained looping choreography). The YAGNI ladder stops at rung 2 (already in the codebase).

## File Structure

**New — Edge (Deno):**
- `supabase/migrations/20260710000000_recipes_content_status.sql` — adds `content_status`, `hook`, `generation_error` columns + a title lookup index.
- `supabase/functions/_shared/prompts/proposals.ts` — phase-1 prompt builders.
- `supabase/functions/_shared/prompts/fill.ts` — phase-2 prompt builders.
- `supabase/functions/generate-proposals/index.ts` — phase-1 endpoint.
- `supabase/functions/generate-proposals/cache.ts` + `cache.test.ts` — pure title-cache-hit helper.
- `supabase/functions/fill-recipe/index.ts` — phase-2 endpoint.
- `supabase/functions/fill-recipe/dedup.ts` + `dedup.test.ts` — pure fill-target decision helper.
- `supabase/functions/_shared/proposals-schema.test.ts` — Zod parse test for the proposals envelope.

**Modified — Edge:**
- `supabase/functions/_shared/schema.ts` — add `ProposalsEnvelope` (Zod) + `ProposalsEnvelopeJsonSchema`.
- `supabase/functions/_shared/recipe-map.ts` — add `toSkeletonInsert`, `toFillUpdate`; add `contentStatus` + `hook` to `dbRowToClientRecipe` + `ClientRecipe`.
- `supabase/functions/_shared/prompts/live.ts` — export `STRUCTURED_INGREDIENT_DIRECTIVE` for reuse.

**New — Client (RN):**
- `apps/native/src/features/eat/deckState.ts` + `deckState.test.ts` — pure deck reducer.
- `apps/native/src/features/eat/imagePrefetch.ts` + `imagePrefetch.test.ts` — pure prefetch-window logic.
- `apps/native/src/features/eat/allocation.ts` + `allocation.test.ts` — pure allocation-write mapping.
- `apps/native/src/features/eat/DeckScreen.tsx` — swipe deck (replaces ReviewRecipesScreen).
- `apps/native/src/features/eat/CardArt.tsx` — the one swappable art block (circle | square const).
- `apps/native/src/features/eat/AllocationScreen.tsx` — keeps → day chips.
- `apps/native/src/features/eat/DealingHandLoader.tsx` — animated "dealing the hand" choreography.
- `apps/native/app/(eat)/deck.tsx` + `apps/native/app/(eat)/allocate.tsx` — route entries.

**Modified — Client:**
- `packages/shared/src/types/primitives.ts` — add `ContentStatus`.
- `packages/shared/src/types/recipe.ts` — add `contentStatus` + `hook` to `Recipe`.
- `apps/native/src/services/recipeRow.ts` — map `content_status` + `hook`.
- `apps/native/src/services/api.ts` — add `generateProposals` + `fillRecipe`.
- `apps/native/src/stores/generationSession.ts` — add deck state + actions (wraps `deckState.ts`).
- `apps/native/src/features/eat/GenerationLoadingScreen.tsx` — rewrite to drive phase-1 + the dealing loader, navigate to `/(eat)/deck`.
- `apps/native/src/features/eat/EnergyPickerScreen.tsx` — copy "three dinners" → "a hand of five".

**Deleted — Client:**
- `apps/native/src/features/eat/ReviewRecipesScreen.tsx` and `apps/native/app/(eat)/review.tsx`.

---

## Task 1: Migration + shared `Recipe` type gains `contentStatus` + `hook`

**Files:**
- Create: `supabase/migrations/20260710000000_recipes_content_status.sql`
- Modify: `packages/shared/src/types/primitives.ts`
- Modify: `packages/shared/src/types/recipe.ts`

**Interfaces:**
- Produces (DB): `recipes.content_status text not null default 'full'` (check `in ('full','proposal')`), `recipes.hook text` (nullable), `recipes.generation_error text` (nullable), and a partial index on `title` for the phase-1 cache lookup.
- Produces (TS): `ContentStatus = 'full' | 'proposal'`; `Recipe.contentStatus?: ContentStatus`; `Recipe.hook?: string`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260710000000_recipes_content_status.sql`:

```sql
-- Swipe deck / two-phase generation (2026-07-10).
-- content_status distinguishes fast skeleton "proposals" (title + hook +
-- protein estimate, image firing) from fully-written "full" recipes. Existing
-- rows are all fully-written, so the column defaults to 'full' and the NOT NULL
-- default backfills them. hook carries the one-line proposal teaser. Skeleton
-- rows are user_id-null global-cache rows and read under the existing RLS
-- policy — no policy change needed.

alter table public.recipes
  add column content_status text not null default 'full'
    check (content_status in ('full', 'proposal')),
  add column hook text,
  add column generation_error text;

-- Phase-1 exact-title cache shortcut queries global 'full' rows by title.
create index if not exists recipes_title_global_idx
  on public.recipes (title)
  where user_id is null and content_status = 'full';
```

- [ ] **Step 2: Push the migration to the linked project** (free, not `[COST]`)

Run (does not echo secrets):
```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && set -a && source ~/Projects/qook/.env.local && set +a && supabase db push
```
Expected: the CLI lists `20260710000000_recipes_content_status.sql` as applied to project `eehjclffugngogbvctib`, no errors. (If `supabase db push` reports the migration is already applied from a prior run, that is fine.)

- [ ] **Step 3: Regenerate the DB types** (keeps `packages/shared/src/database.ts` honest; free)

Run:
```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && set -a && source ~/Projects/qook/.env.local && set +a && supabase gen types typescript --linked > packages/shared/src/database.ts
```
Expected: `packages/shared/src/database.ts` now includes `content_status`, `hook`, `generation_error` on the `recipes` row types. (If your local CLI uses `--project-id eehjclffugngogbvctib` instead of `--linked`, use that; do not print secrets either way.)

- [ ] **Step 4: Add the `ContentStatus` primitive**

In `packages/shared/src/types/primitives.ts`, add the type next to the other closed unions (place it immediately after the existing `ImageStatus` declaration — search for `ImageStatus`):

```ts
export type ContentStatus = 'full' | 'proposal';
```

- [ ] **Step 5: Add `contentStatus` + `hook` to `Recipe`**

In `packages/shared/src/types/recipe.ts`, add `ContentStatus` to the primitives import block at the top:

```ts
import type {
  ContentStatus,
  DietaryTag,
  EnergyTier,
  GroceryCategory,
  ImageStatus,
  IngredientRole,
  RecipeDifficulty,
  RecipeSource,
  Timestamp,
} from './primitives';
```

Then, inside `export interface Recipe { ... }`, add the two fields immediately after the `notes?: string;` line (keeping them optional so full-recipe callers that never set them still type-check):

```ts
  notes?: string;
  nutritionalEstimate?: NutritionalEstimate;

  // Two-phase generation (spec 2026-07-10). 'proposal' = skeleton card
  // (title + hook + protein estimate, no ingredients/steps yet); 'full' =
  // written recipe. Undefined on legacy/mock recipes is treated as 'full'.
  contentStatus?: ContentStatus;
  hook?: string;
```

- [ ] **Step 6: Verify the shared package still type-checks via the app gate**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck`
Expected: exit 0. (No consumer sets the new optional fields yet, so nothing breaks. `database.ts` is generated, not hand-checked.)

- [ ] **Step 7: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add supabase/migrations/20260710000000_recipes_content_status.sql packages/shared/src/types/primitives.ts packages/shared/src/types/recipe.ts packages/shared/src/database.ts && git commit -m "feat(db): add recipes.content_status + hook for two-phase generation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Both mappers gain `contentStatus` + `hook`; edge skeleton/fill helpers

**Files:**
- Modify: `supabase/functions/_shared/recipe-map.ts`
- Modify: `apps/native/src/services/recipeRow.ts`

**Interfaces:**
- Consumes: `Recipe.contentStatus` / `Recipe.hook` (Task 1); the edge `Proposal` type is added in Task 3 but `toSkeletonInsert` here takes a plain structural argument so Task 2 has no forward dependency.
- Produces (edge): `ClientRecipe.contentStatus: string` + `ClientRecipe.hook?: string`; `dbRowToClientRecipe` maps `row.content_status` / `row.hook`; `toSkeletonInsert(p, tier, serves)` and `toFillUpdate(r, signature)` insert/update shapes.
- Produces (client): `dbRowToRecipe` maps `row.content_status` → `contentStatus` and `row.hook` → `hook`.

- [ ] **Step 1: Add `contentStatus` + `hook` to the edge `ClientRecipe` type + mapper**

In `supabase/functions/_shared/recipe-map.ts`, add the two fields to the `ClientRecipe` type (immediately after `notes?: string;`):

```ts
  notes?: string;
  heroImageUrl?: string;
  ownerId?: string;
  imageStatus: string;
  contentStatus: string;
  hook?: string;
  source: string;
```

Then, in `dbRowToClientRecipe`, add the two mapped fields to the returned object immediately after the `imageStatus:` line:

```ts
    imageStatus: String(row.image_status ?? "pending"),
    contentStatus: String(row.content_status ?? "full"),
    ...(row.hook != null ? { hook: String(row.hook) } : {}),
    source: String(row.source ?? "ai"),
```

- [ ] **Step 2: Add `toSkeletonInsert` + `toFillUpdate` to the edge mapper**

In `supabase/functions/_shared/recipe-map.ts`, add these two exported functions immediately after `toRecipeInsert` (they reuse the existing `difficultyForTier` helper already defined above `toRecipeInsert`):

```ts
// Phase-1 skeleton row: title + hook + protein estimate only. No signature
// (computed at fill time), empty ingredient/workflow arrays (DB defaults),
// image_status 'pending' so the client can fire art immediately (the image
// prompt is title-only). content_status 'proposal' flags it as not-yet-written.
export function toSkeletonInsert(
  p: { title: string; cuisine: string; timeMinutes: number; proteinG: number; hook: string },
  tier: string,
  serves: number,
) {
  return {
    user_id: null as string | null,
    signature: null as string | null,
    title: p.title,
    cuisine: p.cuisine,
    serves,
    total_time_min: p.timeMinutes,
    difficulty: difficultyForTier(tier),
    energy_tier: tier,
    content_status: "proposal" as const,
    hook: p.hook,
    nutrition: { calories: null, proteinG: p.proteinG, carbG: null, fatG: null },
    source: "ai" as const,
    image_status: "pending" as const,
  };
}

// Phase-2 fill: promote a skeleton row to a full recipe IN PLACE. Deliberately
// omits user_id (stays null / global cache) and image_status (art was fired
// independently at deal time — must not be reset). Sets content_status 'full'
// and clears any prior generation_error.
export function toFillUpdate(r: Recipe, signature: string) {
  return {
    signature,
    cuisine: r.cuisine,
    serves: r.servings,
    total_time_min: r.timeMinutes,
    difficulty: difficultyForTier(r.tier),
    energy_tier: r.tier,
    ingredient_groups: r.ingredientGroups,
    workflow_sections: r.workflowSections,
    timeline: [] as unknown[],
    notes: r.notes ?? null,
    tags: r.tags ?? [],
    nutrition: r.nutrition ?? null,
    content_status: "full" as const,
    generation_error: null as string | null,
  };
}
```

- [ ] **Step 3: Add `contentStatus` + `hook` to the client mapper**

In `apps/native/src/services/recipeRow.ts`, add `ContentStatus` to the `@qook/shared` import block at the top:

```ts
import type {
  ContentStatus,
  DietaryTag,
  EnergyTier,
  GroceryCategory,
  Ingredient,
  IngredientGroup,
  IngredientRole,
  ImageStatus,
  NutritionalEstimate,
  ParsedIngredient,
  Recipe,
  RecipeDifficulty,
  RecipeSection,
  RecipeSource,
  RecipeTimelineItem,
  Timestamp,
} from '@qook/shared';
```

Then, in `dbRowToRecipe`, add the two fields to the returned object immediately after the `imageStatus:` line:

```ts
    imageStatus: String(row.image_status ?? 'pending') as ImageStatus,
    contentStatus: (String(row.content_status ?? 'full')) as ContentStatus,
    ...(row.hook != null ? { hook: String(row.hook) } : {}),
    source: String(row.source ?? 'ai') as RecipeSource,
```

- [ ] **Step 4: Type-check the edge mapper**

Run: `deno check supabase/functions/_shared/recipe-map.ts`
Expected: no errors.

- [ ] **Step 5: Run the existing edge mapper test to confirm no regression**

Run: `deno test supabase/functions/_shared/recipe-map.test.ts`
Expected: PASS (the existing cases still pass; the new fields are additive).

- [ ] **Step 6: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add supabase/functions/_shared/recipe-map.ts apps/native/src/services/recipeRow.ts && git commit -m "feat(mappers): carry content_status + hook; add skeleton/fill row helpers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: Phase-1 schema + prompt builders

**Files:**
- Modify: `supabase/functions/_shared/schema.ts`
- Modify: `supabase/functions/_shared/prompts/live.ts` (export one const)
- Create: `supabase/functions/_shared/prompts/proposals.ts`
- Create: `supabase/functions/_shared/proposals-schema.test.ts`

**Interfaces:**
- Produces: `Proposal` (Zod), `ProposalsEnvelope` (Zod, `proposals` array of 5 + nullable `refusal`), `ProposalsEnvelopeJsonSchema` (OpenRouter `response_format`), `buildProposalsSystemPrompt()`, `buildProposalsUserPrompt(ctx: LiveContext)`.
- Consumes: `LiveContext` + `STRUCTURED_INGREDIENT_DIRECTIVE` from `prompts/live.ts`, `TIER_RULES` from `tiers.ts`.

- [ ] **Step 1: Write the failing schema parse test**

Create `supabase/functions/_shared/proposals-schema.test.ts`:

```ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ProposalsEnvelope } from "./schema.ts";

const five = Array.from({ length: 5 }, (_, i) => ({
  title: `Test Dish Number ${i}`,
  hook: "A quick, punchy one-liner about the dish.",
  timeMinutes: 25,
  proteinG: 32,
  cuisine: "Thai",
}));

Deno.test("ProposalsEnvelope parses exactly five well-formed proposals", () => {
  const parsed = ProposalsEnvelope.parse({ proposals: five, refusal: null });
  assertEquals(parsed.proposals.length, 5);
  assertEquals(parsed.proposals[0].proteinG, 32);
});

Deno.test("ProposalsEnvelope rejects a hand that is not length five", () => {
  const res = ProposalsEnvelope.safeParse({ proposals: five.slice(0, 4), refusal: null });
  assertEquals(res.success, false);
});

Deno.test("ProposalsEnvelope rejects a proposal missing proteinG", () => {
  const bad = [{ ...five[0], proteinG: undefined }, ...five.slice(1)];
  const res = ProposalsEnvelope.safeParse({ proposals: bad, refusal: null });
  assertEquals(res.success, false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test supabase/functions/_shared/proposals-schema.test.ts`
Expected: FAIL — `ProposalsEnvelope` is not exported from `schema.ts`.

- [ ] **Step 3: Add the Zod + JSON schema to `schema.ts`**

In `supabase/functions/_shared/schema.ts`, append at the end of the file (after `RecipeEnvelopeJsonSchema`):

```ts
// --- Phase-1 "hand of 5" proposals (spec 2026-07-10) ---
// A proposal is the thin card payload: enough to render Treatment-01 without
// the full recipe body. Full ingredients/steps arrive later via fill-recipe.
export const Proposal = z.object({
  title: z.string().min(4),
  hook: z.string().min(4).max(140),
  timeMinutes: z.number().int().positive().max(240),
  proteinG: z.number().int().nonnegative().max(300),
  cuisine: z.string().min(2),
});
export type Proposal = z.infer<typeof Proposal>;

export const ProposalsEnvelope = z.object({
  proposals: z.array(Proposal).length(5),
  // null unless the model refuses on safety grounds; when set, proposals is [].
  refusal: z.string().nullish(),
});

// OpenRouter response_format for the phase-1 call. Luna (OpenAI) honours strict
// mode. No array minItems/maxItems (kept out for provider-portability); the
// prompt asks for exactly 5 and the Zod envelope enforces .length(5) after.
export const ProposalsEnvelopeJsonSchema = {
  name: "ProposalsEnvelope",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["proposals", "refusal"],
    properties: {
      proposals: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "hook", "timeMinutes", "proteinG", "cuisine"],
          properties: {
            title: { type: "string" },
            hook: { type: "string" },
            timeMinutes: { type: "integer" },
            proteinG: { type: "integer" },
            cuisine: { type: "string" },
          },
        },
      },
      refusal: { type: ["string", "null"] },
    },
  },
} as const;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test supabase/functions/_shared/proposals-schema.test.ts`
Expected: PASS — `ok | 3 passed | 0 failed`.

- [ ] **Step 5: Export `STRUCTURED_INGREDIENT_DIRECTIVE` from `live.ts`**

In `supabase/functions/_shared/prompts/live.ts`, change the `const STRUCTURED_INGREDIENT_DIRECTIVE` declaration to an `export const` (so the fill prompt in Task 5 can reuse it verbatim):

```ts
export const STRUCTURED_INGREDIENT_DIRECTIVE = [
```

(Only the `const` → `export const` on that one line changes; the array contents are unchanged.)

- [ ] **Step 6: Write the proposals prompt builders**

Create `supabase/functions/_shared/prompts/proposals.ts`:

```ts
import { TIER_RULES } from "../tiers.ts";
import type { LiveContext } from "./live.ts";

// Phase-1: one cheap Luna call returns 5 dinner PROPOSALS — a title, a punchy
// hook, a time estimate, a protein estimate, and a cuisine. No ingredients or
// steps (those are written later, only for dishes the user keeps). This is the
// "deal a hand" moment: five distinct options the user swipes through.

export function buildProposalsSystemPrompt(): string {
  return [
    "You are Qook's live dinner concierge dealing a hand of five options.",
    "A real person opened the app right now and wants five distinct dinner ideas for tonight.",
    "Output STRICT JSON, no prose, no markdown.",
    "Each proposal is a teaser card: an appetising title, a single vivid one-line hook (max ~14 words, no period needed), an honest total-time estimate in minutes, a realistic protein-grams-per-serving estimate, and a cuisine.",
    "Make the five feel genuinely different from each other — vary cuisine, protein, and technique.",
    "Treat voice context as the most important signal — it's what the user just said out loud about their evening.",
    'Safety: if voice context mentions self-harm, unsafe food practices, or requests dangerous behavior, set `refusal` to "Let\'s plan something nourishing instead. Can you tell me what you have in the fridge?" and set `proposals` to an empty array. Otherwise set `refusal` to null.',
  ].join(" ");
}

export function buildProposalsUserPrompt(ctx: LiveContext): string {
  const rule = TIER_RULES[ctx.tier];
  const avoid = ctx.avoidIngredients.length
    ? ctx.avoidIngredients.join(", ")
    : "none";
  return [
    `Deal exactly 5 dinner proposals for tier "${ctx.tier}" (${rule.label}).`,
    `Tier directive: ${rule.directive}`,
    `timeMinutes ceiling: ${rule.maxMinutes}.`,
    ``,
    `Serves: ${ctx.householdSize}.`,
    `Avoid ingredients: ${avoid}.`,
    `Loved cuisines (priority order): ${ctx.lovedCuisines.join(", ") || "open"}.`,
    ``,
    ctx.voiceContext
      ? `USER JUST SAID (voice context, weight heavily): "${ctx.voiceContext}"`
      : `No voice context — pick a confident, varied spread.`,
    ``,
    `Spread the 5 across different cuisines unless voice context pins one.`,
    `Include one clearly "safe" crowd-pleaser and one gentle stretch.`,
    `Each hook must sell the dish in one line — concrete and sensory, never generic ("charred edges, cooling yogurt", NOT "a delicious meal").`,
    `Return JSON shape: { "proposals": Proposal[], "refusal": string | null } with exactly 5 proposals.`,
  ].join("\n");
}
```

- [ ] **Step 7: Type-check the new prompt module**

Run: `deno check supabase/functions/_shared/prompts/proposals.ts`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add supabase/functions/_shared/schema.ts supabase/functions/_shared/prompts/live.ts supabase/functions/_shared/prompts/proposals.ts supabase/functions/_shared/proposals-schema.test.ts && git commit -m "feat(proposals): phase-1 schema + prompt builders

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: `generate-proposals` endpoint

**Files:**
- Create: `supabase/functions/generate-proposals/cache.ts`
- Create: `supabase/functions/generate-proposals/cache.test.ts`
- Create: `supabase/functions/generate-proposals/index.ts`

**Interfaces:**
- Produces (pure): `firstCacheHitId(rows: { id: string }[] | null): string | null` — first exact-title global 'full' row id, or null.
- Produces (HTTP): `POST generate-proposals`, user JWT; body `{ tier: EnergyTier, context?: string }`; response `200 { proposals: ClientRecipe[] }` (exactly 5, real row ids, `contentStatus` per row). Errors: `401 unauthorized`, `429 rate_limited`, `400 bad_request`, `422 validation` (refusal/parse), `500 generation_failed`.

- [ ] **Step 1: Write the failing test for the cache-hit helper**

Create `supabase/functions/generate-proposals/cache.test.ts`:

```ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { firstCacheHitId } from "./cache.ts";

Deno.test("firstCacheHitId returns the first matching row id", () => {
  assertEquals(firstCacheHitId([{ id: "full-1" }, { id: "full-2" }]), "full-1");
});

Deno.test("firstCacheHitId returns null on no match", () => {
  assertEquals(firstCacheHitId([]), null);
});

Deno.test("firstCacheHitId returns null on null data", () => {
  assertEquals(firstCacheHitId(null), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test supabase/functions/generate-proposals/cache.test.ts`
Expected: FAIL — module `./cache.ts` not found.

- [ ] **Step 3: Write the pure helper**

Create `supabase/functions/generate-proposals/cache.ts`:

```ts
// Phase-1 exact-title cache shortcut (spec Resolved Q1). If a global 'full'
// recipe already exists with the proposal's exact title, the card points at
// that finished row (art + full body already present) instead of a fresh
// skeleton — $0, instant. Kept net-free so it unit-tests without --allow-net.
export function firstCacheHitId(
  rows: { id: string }[] | null,
): string | null {
  return rows && rows.length > 0 ? rows[0].id : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test supabase/functions/generate-proposals/cache.test.ts`
Expected: PASS — `ok | 3 passed | 0 failed`.

- [ ] **Step 5: Write the endpoint**

Create `supabase/functions/generate-proposals/index.ts`:

```ts
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { chat } from "../_shared/openrouter.ts";
import { MODELS } from "../_shared/openrouter.ts";
import {
  buildProposalsSystemPrompt,
  buildProposalsUserPrompt,
} from "../_shared/prompts/proposals.ts";
import { ProposalsEnvelope, ProposalsEnvelopeJsonSchema } from "../_shared/schema.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { buildLiveContext } from "../_shared/context.ts";
import { checkQuota } from "../_shared/rate-limit.ts";
import { stripCodeFences } from "../_shared/partial-parser.ts";
import { dbRowToClientRecipe, toSkeletonInsert } from "../_shared/recipe-map.ts";
import { firstCacheHitId } from "./cache.ts";
import { ERRORS, errorResponse } from "../_shared/errors.ts";

const RequestBody = z.object({
  tier: z.enum(["brain-is-fried", "after-work", "got-energy", "weekend-project"]),
  context: z.string().max(500).optional(),
});

function clampServes(n: number): number {
  if (!Number.isFinite(n)) return 2;
  return Math.min(16, Math.max(1, Math.round(n)));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let userId: string;
  try {
    const { user } = await requireUser(req);
    userId = user.id;
  } catch (resp) {
    return resp as Response;
  }

  const admin = serviceClient();

  // A hand counts as one generation against the 10/day quota — check first.
  const quota = await checkQuota(admin, userId);
  if (!quota.ok) {
    return errorResponse(
      ERRORS.RATE_LIMITED,
      quota.scope === "day"
        ? "You've hit today's recipe limit — back tomorrow."
        : "You've hit this month's recipe limit.",
      429,
    );
  }

  const parsed = RequestBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(ERRORS.BAD_REQUEST, "Bad request body.", 400);
  }
  const { tier, context } = parsed.data;

  // The session row is the quota-counting record — check its insert.
  const { data: session, error: sessionError } = await admin
    .from("generation_sessions")
    .insert({
      user_id: userId,
      flavor_mode: "comfort",
      effort_mode: "standard",
      energy_tier: tier,
      recipe_count: 5,
      voice_context: context ?? null,
      status: "generating",
    })
    .select("id")
    .single();
  if (sessionError) {
    console.error("generate-proposals session insert failed", String(sessionError));
    return errorResponse(ERRORS.GENERATION_FAILED, "The kitchen is busy — try again in a minute.", 500);
  }
  const sessionId: string = session.id;

  const { data: prefs } = await admin
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const liveCtx = buildLiveContext(tier, prefs ?? null, context);
  const serves = clampServes(liveCtx.householdSize);

  try {
    const content = await chat({
      model: MODELS.textDraft(),
      messages: [
        { role: "system", content: buildProposalsSystemPrompt() },
        { role: "user", content: buildProposalsUserPrompt(liveCtx) },
      ],
      jsonSchema: ProposalsEnvelopeJsonSchema,
      temperature: 0.85,
      timeoutMs: 30_000,
      costLabel: "proposals",
    });

    const raw = JSON.parse(stripCodeFences(content));
    if (raw && typeof raw === "object" && typeof raw.refusal === "string" && raw.refusal) {
      await admin.from("generation_sessions").update({ status: "failed" }).eq("id", sessionId);
      return errorResponse(ERRORS.VALIDATION, raw.refusal, 422);
    }
    const result = ProposalsEnvelope.safeParse(raw);
    if (!result.success) {
      console.error(
        "generate-proposals validation failed",
        JSON.stringify(result.error.issues.slice(0, 5)),
        "raw:",
        content.slice(0, 300),
      );
      await admin.from("generation_sessions").update({ status: "failed" }).eq("id", sessionId);
      return errorResponse(ERRORS.VALIDATION, "The kitchen produced something odd — try again.", 422);
    }

    // For each proposal: reuse an exact-title global 'full' row if one exists
    // (Resolved Q1), else insert a skeleton. Keep the 5 ids in proposal order.
    const ids: string[] = [];
    for (const p of result.data.proposals) {
      const { data: hits } = await admin
        .from("recipes")
        .select("id")
        .eq("title", p.title)
        .is("user_id", null)
        .eq("content_status", "full")
        .order("use_count", { ascending: false })
        .limit(1);
      const hitId = firstCacheHitId(hits ?? null);
      if (hitId) {
        ids.push(hitId);
        await admin.rpc("increment_use_count", { recipe_id: hitId });
        continue;
      }
      const { data: inserted, error } = await admin
        .from("recipes")
        .insert(toSkeletonInsert(p, tier, serves))
        .select("id")
        .single();
      if (error) throw error;
      ids.push(inserted.id);
    }

    const { data: rows } = await admin.from("recipes").select("*").in("id", ids);
    const byId = new Map((rows ?? []).map((r: Record<string, unknown>) => [r.id, r]));
    const proposals = ids
      .map((id) => byId.get(id))
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((row) => dbRowToClientRecipe(row, []));

    await admin.from("generation_sessions").update({ status: "ready" }).eq("id", sessionId);
    return new Response(JSON.stringify({ proposals }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    await admin.from("generation_sessions").update({ status: "failed" }).eq("id", sessionId);
    console.error("generate-proposals error", String(err));
    return errorResponse(ERRORS.GENERATION_FAILED, "The kitchen is busy — try again in a minute.", 500);
  }
});
```

- [ ] **Step 6: Type-check the function**

Run: `deno check supabase/functions/generate-proposals/index.ts`
Expected: no errors (may fetch/cache deps on first run).

- [ ] **Step 7: Deploy the function** (free, not `[COST]`)

Run (does not echo secrets):
```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && set -a && source ~/Projects/qook/.env.local && set +a && supabase functions deploy generate-proposals --no-verify-jwt
```
Expected: `Deployed Functions on project eehjclffugngogbvctib: generate-proposals`.

- [ ] **Step 8: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add supabase/functions/generate-proposals/cache.ts supabase/functions/generate-proposals/cache.test.ts supabase/functions/generate-proposals/index.ts && git commit -m "feat(generate-proposals): phase-1 hand-of-5 endpoint with title cache shortcut

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: `fill-recipe` endpoint (phase-2, quota-free)

**Files:**
- Create: `supabase/functions/_shared/prompts/fill.ts`
- Create: `supabase/functions/fill-recipe/dedup.ts`
- Create: `supabase/functions/fill-recipe/dedup.test.ts`
- Create: `supabase/functions/fill-recipe/index.ts`

**Interfaces:**
- Produces (prompt): `buildFillSystemPrompt()`, `buildFillUserPrompt(ctx: LiveContext, title: string, hook: string | null)`.
- Produces (pure): `resolveFillTarget(skeletonId: string, existing: { id: string }[] | null): { action: 'cache-hit' | 'fill-in-place'; targetId: string }`.
- Produces (HTTP): `POST fill-recipe`, user JWT; body `{ recipeId: string, context?: string }`; response `200 { recipeId: string, status: 'full' }` — `recipeId` is the FINAL row id (may differ from the input on a cache hit). Errors: `401`, `400 bad_request`, `404 not_found`, `502 generation_failed`.
- Consumes: `Recipe` (Zod) + `RecipeJsonSchema` from `schema.ts`, `computeSignature` + `toFillUpdate` + `dbRowToClientRecipe` from `recipe-map.ts`, `STRUCTURED_INGREDIENT_DIRECTIVE` from `prompts/live.ts`.

- [ ] **Step 1: Write the failing test for the dedup decision helper**

Create `supabase/functions/fill-recipe/dedup.test.ts`:

```ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveFillTarget } from "./dedup.ts";

Deno.test("fills in place when no other full row shares the signature", () => {
  assertEquals(resolveFillTarget("sk-1", []), {
    action: "fill-in-place",
    targetId: "sk-1",
  });
});

Deno.test("fills in place when the only signature match is the skeleton itself", () => {
  assertEquals(resolveFillTarget("sk-1", [{ id: "sk-1" }]), {
    action: "fill-in-place",
    targetId: "sk-1",
  });
});

Deno.test("uses the cache hit when a different full row shares the signature", () => {
  assertEquals(resolveFillTarget("sk-1", [{ id: "full-9" }]), {
    action: "cache-hit",
    targetId: "full-9",
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test supabase/functions/fill-recipe/dedup.test.ts`
Expected: FAIL — module `./dedup.ts` not found.

- [ ] **Step 3: Write the pure helper**

Create `supabase/functions/fill-recipe/dedup.ts`:

```ts
// Phase-2 fill-time dedup decision (spec). After the full recipe is written we
// compute its signature and look up other global 'full' rows with the same
// signature. If a DIFFERENT row already holds it, we point the card at that
// cache hit and delete the just-filled skeleton; otherwise we fill the skeleton
// in place. Net-free so it unit-tests without --allow-net.
export function resolveFillTarget(
  skeletonId: string,
  existing: { id: string }[] | null,
): { action: "cache-hit" | "fill-in-place"; targetId: string } {
  const other = (existing ?? []).find((r) => r.id !== skeletonId);
  return other
    ? { action: "cache-hit", targetId: other.id }
    : { action: "fill-in-place", targetId: skeletonId };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test supabase/functions/fill-recipe/dedup.test.ts`
Expected: PASS — `ok | 3 passed | 0 failed`.

- [ ] **Step 5: Write the fill prompt builders**

Create `supabase/functions/_shared/prompts/fill.ts`:

```ts
import { TIER_RULES } from "../tiers.ts";
import { STRUCTURED_INGREDIENT_DIRECTIVE } from "./live.ts";
import type { LiveContext } from "./live.ts";

// Phase-2: write ONE full recipe for a proposal the user kept. The title is
// fixed (it's already on the card); the model fleshes out ingredients, steps,
// tags, and nutrition to match. Same body shape as the generate-recipe envelope
// entries, so it validates against the shared Recipe schema.

export function buildFillSystemPrompt(): string {
  return [
    "You are Qook's live recipe concierge writing one full recipe on demand.",
    "The user already chose this dish by its title; write the complete recipe for it.",
    "Output STRICT JSON, no prose, no markdown — a single Recipe object.",
    "Keep the title EXACTLY as given. Do not rename the dish.",
  ].join(" ");
}

export function buildFillUserPrompt(
  ctx: LiveContext,
  title: string,
  hook: string | null,
): string {
  const rule = TIER_RULES[ctx.tier];
  const avoid = ctx.avoidIngredients.length
    ? ctx.avoidIngredients.join(", ")
    : "none";
  const tools = ctx.kitchenTools.length
    ? ctx.kitchenTools.join(", ")
    : "stovetop, oven, skillet, pot";
  return [
    `Write the full recipe for this dish, titled EXACTLY: "${title}".`,
    hook ? `Its promise to the cook: "${hook}". Honour it.` : ``,
    `Tier: "${ctx.tier}" (${rule.label}). ${rule.directive}`,
    `timeMinutes ceiling: ${rule.maxMinutes}. Use tier "${ctx.tier}" in the "tier" field.`,
    ``,
    `Serves: ${ctx.householdSize}.`,
    `Avoid ingredients: ${avoid}.`,
    `Available tools: ${tools}. Do not require anything outside this set.`,
    ctx.voiceContext
      ? `The user earlier said (context, weight when relevant): "${ctx.voiceContext}"`
      : ``,
    ``,
    STRUCTURED_INGREDIENT_DIRECTIVE,
    ``,
    `Every step needs a concrete durationMin > 0 and specific doneness cues ("until edges curl", NOT "until done").`,
    `Return a single JSON Recipe object (not an array, not an envelope).`,
  ].filter(Boolean).join("\n");
}
```

- [ ] **Step 6: Write the endpoint**

Create `supabase/functions/fill-recipe/index.ts`:

```ts
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { chat } from "../_shared/openrouter.ts";
import { MODELS } from "../_shared/openrouter.ts";
import { buildFillSystemPrompt, buildFillUserPrompt } from "../_shared/prompts/fill.ts";
import { Recipe, RecipeJsonSchema } from "../_shared/schema.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { buildLiveContext } from "../_shared/context.ts";
import { stripCodeFences } from "../_shared/partial-parser.ts";
import { computeSignature, dbRowToClientRecipe, toFillUpdate } from "../_shared/recipe-map.ts";
import { resolveFillTarget } from "./dedup.ts";
import { ERRORS, errorResponse } from "../_shared/errors.ts";

const RequestBody = z.object({
  recipeId: z.string().uuid(),
  context: z.string().max(500).optional(),
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let userId: string;
  try {
    const { user } = await requireUser(req);
    userId = user.id;
  } catch (resp) {
    return resp as Response;
  }

  const parsed = RequestBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse(ERRORS.BAD_REQUEST, "recipeId required.", 400);
  const { recipeId, context } = parsed.data;

  const admin = serviceClient();

  const { data: row, error } = await admin
    .from("recipes")
    .select("*")
    .eq("id", recipeId)
    .maybeSingle();
  if (error || !row) return errorResponse(ERRORS.NOT_FOUND, "Recipe not found.", 404);

  // Idempotent: a keep + a later cook-tonight both fire fill for the same card.
  // If it's already full (or was replaced), return it as-is. Natural per-hand
  // cap: only 5 skeletons exist per hand and each fills at most once.
  if (String(row.content_status) === "full") {
    return new Response(JSON.stringify({ recipeId, status: "full" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Phase-2 is quota-free (the hand already paid). Build context for THIS user;
  // tier comes from the skeleton row.
  const { data: prefs } = await admin
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const tier = String(row.energy_tier);
  const liveCtx = buildLiveContext(
    tier as Parameters<typeof buildLiveContext>[0],
    prefs ?? null,
    context,
  );

  try {
    const content = await chat({
      model: MODELS.textDraft(),
      messages: [
        { role: "system", content: buildFillSystemPrompt() },
        {
          role: "user",
          content: buildFillUserPrompt(liveCtx, String(row.title), row.hook ? String(row.hook) : null),
        },
      ],
      jsonSchema: RecipeJsonSchema,
      temperature: 0.7,
      timeoutMs: 60_000,
      costLabel: "fill",
    });

    const result = Recipe.safeParse(JSON.parse(stripCodeFences(content)));
    if (!result.success) {
      throw new Error(`fill validation failed: ${JSON.stringify(result.error.issues.slice(0, 3))}`);
    }
    const recipe = result.data;
    const signature = await computeSignature(recipe);

    const { data: existing } = await admin
      .from("recipes")
      .select("id")
      .eq("signature", signature)
      .is("user_id", null)
      .eq("content_status", "full");
    const target = resolveFillTarget(recipeId, existing ?? null);

    if (target.action === "cache-hit") {
      // Point at the pre-existing full row; drop the now-redundant skeleton.
      await admin.rpc("increment_use_count", { recipe_id: target.targetId });
      await admin.from("recipes").delete().eq("id", recipeId);
      return new Response(JSON.stringify({ recipeId: target.targetId, status: "full" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fill the skeleton in place. image_status is untouched (art fired at deal).
    await admin.from("recipes").update(toFillUpdate(recipe, signature)).eq("id", recipeId);
    return new Response(JSON.stringify({ recipeId, status: "full" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Leave content_status 'proposal'; record the error for the detail view's
    // retry affordance.
    await admin
      .from("recipes")
      .update({ generation_error: String(err).slice(0, 400) })
      .eq("id", recipeId);
    console.error("fill-recipe error", String(err));
    return errorResponse(ERRORS.GENERATION_FAILED, "Couldn't finish that recipe — try again.", 502);
  }
});
```

- [ ] **Step 7: Type-check the function**

Run: `deno check supabase/functions/fill-recipe/index.ts`
Expected: no errors.

- [ ] **Step 8: Deploy the function** (free, not `[COST]`)

Run (does not echo secrets):
```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && set -a && source ~/Projects/qook/.env.local && set +a && supabase functions deploy fill-recipe --no-verify-jwt
```
Expected: `Deployed Functions on project eehjclffugngogbvctib: fill-recipe`.

- [ ] **Step 9: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add supabase/functions/_shared/prompts/fill.ts supabase/functions/fill-recipe/dedup.ts supabase/functions/fill-recipe/dedup.test.ts supabase/functions/fill-recipe/index.ts && git commit -m "feat(fill-recipe): phase-2 fill-in-place with signature dedup

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: Client API — `generateProposals` + `fillRecipe`

**Files:**
- Modify: `apps/native/src/services/api.ts`

**Interfaces:**
- Produces: `generateProposals(tier: EnergyTier, context?: string): Promise<Recipe[]>` — live: `supabase.functions.invoke('generate-proposals', { body })` → normalized `Recipe[]` (5); mock: 5 fixtures for the tier. `fillRecipe(recipeId: string, context?: string): Promise<{ recipeId: string; status: string }>` — live: invoke `fill-recipe`; mock: returns `{ recipeId, status: 'full' }`. Both exported on the `api` object.
- Consumes: `POST generate-proposals` (Task 4), `POST fill-recipe` (Task 5). `pickForTier` + `mode` + `supabase` + `ensureSession` already exist in `api.ts`.

- [ ] **Step 1: Add both functions to `api.ts`**

In `apps/native/src/services/api.ts`, insert these two functions immediately AFTER the `requestRecipeImage` function (after its closing `}`, before `export const api = {`). No new imports are needed — `supabase`, `ensureSession`, `mode`, `pickForTier`, and the `Recipe`/`EnergyTier`/`Timestamp` types are already in scope (add `Timestamp` to the existing `@qook/shared` import if it is not already there):

```ts
// Phase-1 (spec 2026-07-10): deal a hand of 5 proposals — one cheap Luna call.
// The edge already maps rows to client shape; we only normalize the ISO
// createdAt/updatedAt strings to the branded Timestamp number. Mock mode returns
// 5 tier-matched fixtures (already full, with local art).
export async function generateProposals(
  tier: EnergyTier,
  context?: string
): Promise<Recipe[]> {
  if (mode === 'mock') {
    await lag(1200);
    return pickForTier(tier, 5);
  }
  await ensureSession();
  const { data, error } = await supabase.functions.invoke('generate-proposals', {
    body: { tier, context: context?.trim() || undefined },
  });
  if (error) {
    const msg = (error as { message?: string }).message ?? 'Something went wrong.';
    throw new Error(msg);
  }
  const proposals = ((data as { proposals?: unknown[] })?.proposals ?? []) as Record<
    string,
    unknown
  >[];
  return proposals.map((r) => ({
    ...r,
    createdAt: (typeof r.createdAt === 'string'
      ? Date.parse(r.createdAt)
      : r.createdAt) as Timestamp,
    updatedAt: (typeof r.updatedAt === 'string'
      ? Date.parse(r.updatedAt)
      : r.updatedAt) as Timestamp,
  })) as unknown as Recipe[];
}

// Phase-2 (spec 2026-07-10): write ONE full recipe for a kept/cooked proposal.
// Quota-free. Returns the FINAL row id — a cache hit redirects to a pre-existing
// full row and the skeleton is deleted server-side, so callers must adopt the
// returned recipeId. Called but the deck does not block on it.
export async function fillRecipe(
  recipeId: string,
  context?: string
): Promise<{ recipeId: string; status: string }> {
  if (mode === 'mock') {
    await lag(200);
    return { recipeId, status: 'full' };
  }
  await ensureSession();
  const { data, error } = await supabase.functions.invoke('fill-recipe', {
    body: { recipeId, context: context?.trim() || undefined },
  });
  if (error) {
    const msg = (error as { message?: string }).message ?? 'Something went wrong.';
    throw new Error(msg);
  }
  const out = data as { recipeId?: string; status?: string };
  return { recipeId: out?.recipeId ?? recipeId, status: out?.status ?? 'full' };
}
```

- [ ] **Step 2: Export both on the `api` object**

In `apps/native/src/services/api.ts`, the `api` object currently ends:

```ts
  generateRecipesForEnergy,
  requestRecipeImage,
};
```

Change it to:

```ts
  generateRecipesForEnergy,
  generateProposals,
  fillRecipe,
  requestRecipeImage,
};
```

- [ ] **Step 3: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0. (If `Timestamp` was not already imported from `@qook/shared`, typecheck flags it — add it to that import.)

- [ ] **Step 4: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/services/api.ts && git commit -m "feat(api): generateProposals + fillRecipe client bindings

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: Pure deck reducer + `generationSession` deck state

**Files:**
- Create: `apps/native/src/features/eat/deckState.ts`
- Create: `apps/native/src/features/eat/deckState.test.ts`
- Modify: `apps/native/src/stores/generationSession.ts`

**Interfaces:**
- Produces (pure): `DeckState { proposals: Recipe[]; position: number; kept: Recipe[]; cookTonightId: string | null }`; `initDeck`, `focusedRecipe`, `isExhausted`, `keepAt`, `passAt`, `dealFreshHand`, `setCookTonight`, `reconcileKept`.
- Produces (store): `useGenerationSession` gains `deck: DeckState | null`, `setProposals`, `deckKeep`, `deckPass`, `dealHand`, `setCookTonight`, `reconcileKept`; `reset` clears `deck`.

- [ ] **Step 1: Write the failing reducer test**

Create `apps/native/src/features/eat/deckState.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';
import {
  dealFreshHand,
  focusedRecipe,
  initDeck,
  isExhausted,
  keepAt,
  passAt,
  reconcileKept,
} from './deckState';

function r(id: string): Recipe {
  return { id, title: `Dish ${id}` } as Recipe;
}
const HAND = [r('a'), r('b'), r('c'), r('d'), r('e')];

describe('deckState', () => {
  test('keepAt records the focused recipe and advances', () => {
    const s = keepAt(initDeck(HAND));
    expect(s.position).toBe(1);
    expect(s.kept.map((x) => x.id)).toEqual(['a']);
  });

  test('keepAt dedupes by id', () => {
    let s = initDeck(HAND);
    s = keepAt(s);
    s = { ...s, position: 0 };
    s = keepAt(s);
    expect(s.kept.map((x) => x.id)).toEqual(['a']);
  });

  test('passAt advances without keeping', () => {
    const s = passAt(initDeck(HAND));
    expect(s.position).toBe(1);
    expect(s.kept).toEqual([]);
  });

  test('isExhausted true once past the last card', () => {
    let s = initDeck(HAND);
    for (let i = 0; i < 5; i++) s = passAt(s);
    expect(isExhausted(s)).toBe(true);
    expect(focusedRecipe(s)).toBe(null);
  });

  test('dealFreshHand preserves kept and resets position', () => {
    let s = keepAt(initDeck(HAND));
    const next = [r('f'), r('g'), r('h'), r('i'), r('j')];
    s = dealFreshHand(s, next);
    expect(s.position).toBe(0);
    expect(s.kept.map((x) => x.id)).toEqual(['a']);
    expect(s.proposals.map((x) => x.id)).toEqual(['f', 'g', 'h', 'i', 'j']);
  });

  test('reconcileKept swaps a kept id after a cache-hit fill', () => {
    let s = keepAt(initDeck(HAND));
    s = reconcileKept(s, 'a', r('full-a'));
    expect(s.kept.map((x) => x.id)).toEqual(['full-a']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/deckState.test.ts`
Expected: FAIL — module `./deckState` not found.

- [ ] **Step 3: Write the pure reducer**

Create `apps/native/src/features/eat/deckState.ts`:

```ts
import type { Recipe } from '@qook/shared';

// Pure "hand of 5" deck reducer. No RN/expo imports so it unit-tests under bun.
// kept accumulates ACROSS fresh hands (deal-a-fresh-hand keeps prior keeps),
// so allocation at the end covers everything the user liked this session.
export interface DeckState {
  proposals: Recipe[];
  position: number;
  kept: Recipe[];
  cookTonightId: string | null;
}

export function initDeck(proposals: Recipe[]): DeckState {
  return { proposals, position: 0, kept: [], cookTonightId: null };
}

export function focusedRecipe(state: DeckState): Recipe | null {
  return state.proposals[state.position] ?? null;
}

export function isExhausted(state: DeckState): boolean {
  return state.position >= state.proposals.length;
}

function dedupePush(kept: Recipe[], recipe: Recipe): Recipe[] {
  return kept.some((r) => r.id === recipe.id) ? kept : [...kept, recipe];
}

export function keepAt(state: DeckState): DeckState {
  const focused = focusedRecipe(state);
  if (!focused) return state;
  return {
    ...state,
    kept: dedupePush(state.kept, focused),
    position: state.position + 1,
  };
}

export function passAt(state: DeckState): DeckState {
  if (isExhausted(state)) return state;
  return { ...state, position: state.position + 1 };
}

export function dealFreshHand(state: DeckState, proposals: Recipe[]): DeckState {
  return { ...state, proposals, position: 0 };
}

export function setCookTonight(state: DeckState, id: string): DeckState {
  return { ...state, cookTonightId: id };
}

// After fill-recipe resolves, the kept card may have a NEW id (cache-hit
// redirect) and now carries the full body — swap it in so allocation writes the
// full recipe and points at the surviving row. Also repoints cookTonightId.
export function reconcileKept(
  state: DeckState,
  oldId: string,
  recipe: Recipe
): DeckState {
  return {
    ...state,
    kept: state.kept.map((r) => (r.id === oldId ? recipe : r)),
    cookTonightId: state.cookTonightId === oldId ? recipe.id : state.cookTonightId,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/deckState.test.ts`
Expected: PASS — 6 pass, 0 fail.

- [ ] **Step 5: Wire the deck into `generationSession`**

Replace the ENTIRE contents of `apps/native/src/stores/generationSession.ts` with:

```ts
import { create } from 'zustand';
import type { EnergyTier, Recipe } from '@qook/shared';
import {
  dealFreshHand,
  initDeck,
  keepAt as reduceKeep,
  passAt as reducePass,
  reconcileKept as reduceReconcile,
  setCookTonight as reduceSetCook,
  type DeckState,
} from '../features/eat/deckState';

export type GenerationState =
  | 'idle'
  | 'collecting_context'
  | 'generating_text'
  | 'streaming_recipes'
  | 'ready'
  | 'error';

interface GenerationSessionState {
  tier: EnergyTier | null;
  context: string;
  state: GenerationState;
  recipes: Recipe[];
  streamedTitles: string[];
  error: string | null;

  // Swipe deck (spec 2026-07-10).
  deck: DeckState | null;

  start: (tier: EnergyTier) => void;
  setContext: (context: string) => void;
  beginGeneration: () => void;
  setStreaming: (recipes: Recipe[]) => void;
  pushTitle: (index: number, title: string) => void;
  finish: (recipes: Recipe[]) => void;
  fail: (message: string) => void;
  reset: () => void;

  setProposals: (recipes: Recipe[]) => void;
  deckKeep: () => void;
  deckPass: () => void;
  dealHand: (recipes: Recipe[]) => void;
  setCookTonight: (id: string) => void;
  reconcileKept: (oldId: string, recipe: Recipe) => void;
}

export const useGenerationSession = create<GenerationSessionState>((set) => ({
  tier: null,
  context: '',
  state: 'idle',
  recipes: [],
  streamedTitles: [],
  error: null,
  deck: null,

  start: (tier) =>
    set({
      tier,
      context: '',
      state: 'collecting_context',
      recipes: [],
      streamedTitles: [],
      error: null,
      deck: null,
    }),
  setContext: (context) => set({ context }),
  beginGeneration: () => set({ state: 'generating_text' }),
  setStreaming: (recipes) => set({ state: 'streaming_recipes', recipes }),
  pushTitle: (index, title) =>
    set((s) => {
      const next = s.streamedTitles.slice();
      next[index] = title;
      return { streamedTitles: next };
    }),
  finish: (recipes) => set({ state: 'ready', recipes, error: null }),
  fail: (message) => set({ state: 'error', error: message }),
  reset: () =>
    set({
      tier: null,
      context: '',
      state: 'idle',
      recipes: [],
      streamedTitles: [],
      error: null,
      deck: null,
    }),

  setProposals: (recipes) =>
    set({ state: 'ready', error: null, deck: initDeck(recipes) }),
  deckKeep: () => set((s) => (s.deck ? { deck: reduceKeep(s.deck) } : s)),
  deckPass: () => set((s) => (s.deck ? { deck: reducePass(s.deck) } : s)),
  dealHand: (recipes) =>
    set((s) => (s.deck ? { deck: dealFreshHand(s.deck, recipes) } : { deck: initDeck(recipes) })),
  setCookTonight: (id) =>
    set((s) => (s.deck ? { deck: reduceSetCook(s.deck, id) } : s)),
  reconcileKept: (oldId, recipe) =>
    set((s) => (s.deck ? { deck: reduceReconcile(s.deck, oldId, recipe) } : s)),
}));
```

Note: the pure reducer functions keep their `deckState.ts` names (`keepAt`, `passAt`, `setCookTonight`, `reconcileKept`) — no rename of `deckState.ts` or its test. The store only aliases them on import (`keepAt as reduceKeep`, `passAt as reducePass`, etc.) so the store's own method names (`deckKeep`, `deckPass`) read clearly. Object-literal property names do not shadow module bindings, so this compiles as written.

- [ ] **Step 6: Run the client gates + reducer test**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint && bun test src/features/eat/deckState.test.ts`
Expected: typecheck + lint exit 0; reducer test 6 pass, 0 fail.

- [ ] **Step 7: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/deckState.ts apps/native/src/features/eat/deckState.test.ts apps/native/src/stores/generationSession.ts && git commit -m "feat(deck): pure hand-of-5 reducer + generationSession deck state

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: Pure image-prefetch window + allocation mapping

**Files:**
- Create: `apps/native/src/features/eat/imagePrefetch.ts`
- Create: `apps/native/src/features/eat/imagePrefetch.test.ts`
- Create: `apps/native/src/features/eat/allocation.ts`
- Create: `apps/native/src/features/eat/allocation.test.ts`

**Interfaces:**
- Produces: `artIndicesToRequest(position: number, count: number, requested: readonly number[]): number[]`; `AllocationChoice { recipe: Recipe; date: ISODate | null }`, `AllocationWrite { recipe: Recipe; date: ISODate }`, `allocationWrites(choices: AllocationChoice[]): AllocationWrite[]`.
- Consumes: `Recipe` (`@qook/shared`), `ISODate` (type-only, `../week/weekDates`).

- [ ] **Step 1: Write the failing prefetch test**

Create `apps/native/src/features/eat/imagePrefetch.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { artIndicesToRequest } from './imagePrefetch';

describe('artIndicesToRequest', () => {
  test('deal time requests the first three', () => {
    expect(artIndicesToRequest(0, 5, [])).toEqual([0, 1, 2]);
  });
  test('stays two ahead as cards reveal', () => {
    expect(artIndicesToRequest(1, 5, [0, 1, 2])).toEqual([3]);
    expect(artIndicesToRequest(2, 5, [0, 1, 2, 3])).toEqual([4]);
  });
  test('nothing left to request at the end', () => {
    expect(artIndicesToRequest(3, 5, [0, 1, 2, 3, 4])).toEqual([]);
  });
  test('clamps to a short hand', () => {
    expect(artIndicesToRequest(0, 2, [])).toEqual([0, 1]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/imagePrefetch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the prefetch helper**

Create `apps/native/src/features/eat/imagePrefetch.ts`:

```ts
// Which proposal indices should have their hero art requested right now. At
// deal (position 0) that's the first 3; as the user reveals card N we stay 2
// ahead (request up to index N+2). Returns only not-yet-requested indices,
// clamped to the hand size. Pure — no RN imports, bun-testable.
export function artIndicesToRequest(
  position: number,
  count: number,
  requested: readonly number[]
): number[] {
  const target = Math.min(position + 2, count - 1);
  const have = new Set(requested);
  const out: number[] = [];
  for (let i = 0; i <= target; i++) {
    if (i >= 0 && !have.has(i)) out.push(i);
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/imagePrefetch.test.ts`
Expected: PASS — 4 pass, 0 fail.

- [ ] **Step 5: Write the failing allocation test**

Create `apps/native/src/features/eat/allocation.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';
import type { ISODate } from '../week/weekDates';
import { allocationWrites } from './allocation';

function r(id: string): Recipe {
  return { id, title: `Dish ${id}` } as Recipe;
}

describe('allocationWrites', () => {
  test('keeps only dated choices, drops skipped ones', () => {
    const writes = allocationWrites([
      { recipe: r('a'), date: '2026-07-11' as ISODate },
      { recipe: r('b'), date: null },
      { recipe: r('c'), date: '2026-07-12' as ISODate },
    ]);
    expect(writes.map((w) => [w.recipe.id, w.date])).toEqual([
      ['a', '2026-07-11'],
      ['c', '2026-07-12'],
    ]);
  });

  test('empty when nothing is dated', () => {
    expect(allocationWrites([{ recipe: r('a'), date: null }])).toEqual([]);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/allocation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Write the allocation helper**

Create `apps/native/src/features/eat/allocation.ts`:

```ts
import type { Recipe } from '@qook/shared';
import type { ISODate } from '../week/weekDates';

// One kept recipe's day assignment. date === null means "skipped" — the keep
// stays saved (handled by the caller) but is not placed on a day.
export interface AllocationChoice {
  recipe: Recipe;
  date: ISODate | null;
}

export interface AllocationWrite {
  recipe: Recipe;
  date: ISODate;
}

// Only dated keeps become weekPlan writes. Pure — no RN imports, bun-testable.
export function allocationWrites(choices: AllocationChoice[]): AllocationWrite[] {
  return choices
    .filter((c): c is AllocationWrite => c.date != null)
    .map((c) => ({ recipe: c.recipe, date: c.date }));
}
```

- [ ] **Step 8: Run to verify it passes + gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun test src/features/eat/allocation.test.ts && bun run typecheck && bun run lint`
Expected: allocation test 2 pass; typecheck + lint exit 0.

- [ ] **Step 9: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/imagePrefetch.ts apps/native/src/features/eat/imagePrefetch.test.ts apps/native/src/features/eat/allocation.ts apps/native/src/features/eat/allocation.test.ts && git commit -m "feat(deck): pure image-prefetch window + allocation mapping

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 9: Deck screen + swappable card art

**Files:**
- Create: `apps/native/src/features/eat/CardArt.tsx`
- Create: `apps/native/src/features/eat/DeckScreen.tsx`
- Create: `apps/native/app/(eat)/deck.tsx`

**Interfaces:**
- Consumes: `useGenerationSession` deck state + `deckKeep`/`deckPass`/`dealHand`/`setCookTonight`/`reconcileKept` (Task 7); `focusedRecipe`/`isExhausted` (Task 7); `artIndicesToRequest` (Task 8); `api.generateProposals`/`api.fillRecipe`/`api.getRecipeById`/`api.requestRecipeImage` (Task 6 + existing); `useSwipeGesture` (existing `../swipe-night/useSwipeGesture`); `useWeekPlan` (`appendRecipeAndSelect`, `commitSelection`, `savedRecipeIds`, `toggleSavedRecipe`); `useRecipeArt` (existing).
- Produces: `DeckScreen` (default export via `app/(eat)/deck.tsx`); `CardArt` component + module const `CARD_ART_MASK`.

**No unit test here — deliberate.** All testable logic (deck reducer, prefetch window, allocation) is pure and covered in Tasks 7–8. This screen is RN-only composition (gesture wiring, navigation, fire-and-forget fills) verified by `typecheck` + `lint` (this task) and the sim walk (Task 13). The circle-vs-square art A/B is a one-line const flip decided in the sim, not in code review.

- [ ] **Step 1: Write `CardArt` (the one swappable art block)**

Create `apps/native/src/features/eat/CardArt.tsx`:

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Recipe } from '@qook/shared';

import { FoodHeroImage } from '../../components/FoodHeroImage';
import { Vignette } from '../../components/Vignette';
import { DisplayText, Mono } from '../../components/Text';
import { palette, radius } from '../../design';
import { useRecipeArt } from '../../hooks/useRecipeArt';
import type { SeedMealKey } from '../../lib/assets';

// The ONE knob that decides how meal art is masked on the deck card. Flipped in
// the simulator during the A/B, not from mockups (spec: "final call made in the
// sim"). Same underlying square watercolor asset either way — zero image cost.
export const CARD_ART_MASK: 'circle' | 'square' = 'square';

const CIRCLE_DIAMETER = 240;
const SQUARE_HEIGHT = 300;

export function CardArt({ recipe }: { recipe: Recipe }) {
  // Poll so the letter monogram upgrades to painted art in place as it lands.
  const art = useRecipeArt(recipe, { poll: true });
  const status = art?.imageStatus ?? recipe.imageStatus;
  const localKey = art?.localImageKey as SeedMealKey | undefined;
  const hasArt = !!art?.heroImageUrl || !!localKey;
  const painting = !hasArt && (status === 'pending' || status === 'generating');
  const letter = (recipe.title?.trim().charAt(0) || '·').toUpperCase();

  if (CARD_ART_MASK === 'circle') {
    return (
      <View style={styles.circleWrap}>
        <Vignette
          size={CIRCLE_DIAMETER}
          localKey={localKey}
          remoteUrl={art?.heroImageUrl}
          blurhash={art?.blurhash}
          imageStatus={status}
          title={recipe.title}
        />
        {painting ? <PaintingTick /> : null}
      </View>
    );
  }

  return (
    <View style={styles.squareWrap}>
      {hasArt ? (
        <FoodHeroImage
          localKey={localKey}
          remoteUrl={art?.heroImageUrl}
          blurhash={art?.blurhash}
          height={SQUARE_HEIGHT}
          cornerRadius={radius.sheet}
          style={styles.square}
        />
      ) : (
        <View
          style={[styles.square, styles.monogram]}
          accessibilityLabel={`${recipe.title}, no image yet`}
        >
          <DisplayText size={96} color={palette.accentDeep}>
            {letter}
          </DisplayText>
        </View>
      )}
      {painting ? <PaintingTick /> : null}
    </View>
  );
}

// Quiet "painting…" tick — designed, not apologetic (Treatment 04).
function PaintingTick() {
  return (
    <View style={styles.tick} pointerEvents="none">
      <Mono size={9} bold color={palette.accentDeep}>
        painting…
      </Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  circleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  squareWrap: {
    width: '100%',
  },
  square: {
    width: '100%',
    height: SQUARE_HEIGHT,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  monogram: {
    backgroundColor: palette.well,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    backgroundColor: palette.surfaceTranslucent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
});
```

- [ ] **Step 2: Write `DeckScreen`**

Create `apps/native/src/features/eat/DeckScreen.tsx`:

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import type { Recipe } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { PaperCard } from '../../components/PaperCard';
import { Vignette } from '../../components/Vignette';
import { DisplayText, Mono, ItalicText } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { IconPill } from '../../components/painted';
import { X } from 'lucide-react-native';
import { palette, radius, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { useGenerationSession } from '../../stores/generationSession';
import { useWeekPlan } from '../../stores/weekPlan';
import { focusedRecipe, isExhausted } from './deckState';
import { artIndicesToRequest } from './imagePrefetch';
import { CardArt } from './CardArt';
import { useSwipeGesture } from '../swipe-night/useSwipeGesture';
import { api } from '../../services/api';
import { todayISO } from '../week/weekDates';
import type { SeedMealKey } from '../../lib/assets';

const DOT_LEADER = '·'.repeat(80);

export function DeckScreen() {
  const router = useRouter();
  const { press } = useHaptics();
  const deck = useGenerationSession((s) => s.deck);
  const tier = useGenerationSession((s) => s.tier);
  const context = useGenerationSession((s) => s.context);
  const deckKeep = useGenerationSession((s) => s.deckKeep);
  const deckPass = useGenerationSession((s) => s.deckPass);
  const dealHand = useGenerationSession((s) => s.dealHand);
  const setCookTonight = useGenerationSession((s) => s.setCookTonight);
  const reconcileKept = useGenerationSession((s) => s.reconcileKept);
  const reset = useGenerationSession((s) => s.reset);
  const savedRecipeIds = useWeekPlan((s) => s.savedRecipeIds);
  const toggleSavedRecipe = useWeekPlan((s) => s.toggleSavedRecipe);
  const [dealing, setDealing] = useState(false);

  // Guard: no deck means the user landed here without a hand — bounce to energy.
  useEffect(() => {
    if (!deck) router.replace('/(eat)/energy');
  }, [deck, router]);

  const handKey = deck?.proposals[0]?.id;
  const requestedRef = useRef<number[]>([]);
  useEffect(() => {
    requestedRef.current = [];
  }, [handKey]);

  // Prefetch art: first 3 at deal, then stay 2 ahead of the swiper.
  useEffect(() => {
    if (!deck) return;
    const indices = artIndicesToRequest(
      deck.position,
      deck.proposals.length,
      requestedRef.current
    );
    for (const i of indices) {
      const rec = deck.proposals[i];
      if (rec && rec.imageStatus !== 'ready' && !rec.heroImageUrl) {
        void api.requestRecipeImage(rec.id);
      }
      requestedRef.current.push(i);
    }
  }, [deck, deck?.position]);

  // Fire phase-2 for a kept/cooked card; adopt the final (possibly redirected)
  // full row so allocation writes real ingredients. Fire-and-forget.
  const runFill = useCallback(
    (recipe: Recipe) => {
      if (recipe.contentStatus === 'full') return; // cache-hit card, already full
      void (async () => {
        try {
          const { recipeId } = await api.fillRecipe(recipe.id, context || undefined);
          const full = await api.getRecipeById(recipeId);
          if (full) reconcileKept(recipe.id, full);
        } catch {
          /* detail view offers retry on next open */
        }
      })();
    },
    [context, reconcileKept]
  );

  const saveIfNew = useCallback(
    (id: string) => {
      if (!savedRecipeIds.includes(id)) toggleSavedRecipe(id);
    },
    [savedRecipeIds, toggleSavedRecipe]
  );

  const focused = deck ? focusedRecipe(deck) : null;

  const handleKeep = useCallback(() => {
    if (!focused) return;
    saveIfNew(focused.id);
    runFill(focused);
    deckKeep();
  }, [focused, saveIfNew, runFill, deckKeep]);

  const handlePass = useCallback(() => {
    deckPass();
  }, [deckPass]);

  const handleCookTonight = useCallback(() => {
    if (!focused) return;
    press();
    saveIfNew(focused.id);
    runFill(focused);
    deckKeep(); // ensure it's in the kept set for allocation
    setCookTonight(focused.id);
    router.replace('/(eat)/allocate');
  }, [focused, press, saveIfNew, runFill, deckKeep, setCookTonight, router]);

  const goAllocateOrHome = useCallback(() => {
    press();
    if (deck && deck.kept.length > 0) {
      router.replace('/(eat)/allocate');
    } else {
      reset();
      router.replace('/(tabs)/tonight');
    }
  }, [press, deck, router, reset]);

  const handleClose = useCallback(() => {
    press();
    // Keeps stay saved (savedRecipeIds); if any were kept, let the user place
    // them, otherwise just leave.
    goAllocateOrHome();
  }, [press, goAllocateOrHome]);

  const handleFreshHand = useCallback(() => {
    if (!tier) return;
    press();
    setDealing(true);
    void (async () => {
      try {
        const recipes = await api.generateProposals(tier, context || undefined);
        dealHand(recipes);
      } catch {
        /* keep the exhausted state; the button can be tapped again */
      } finally {
        setDealing(false);
      }
    })();
  }, [tier, press, context, dealHand]);

  if (!deck) return null;

  const keptCount = deck.kept.length;
  const exhausted = isExhausted(deck);

  return (
    <ScreenShell horizontalPadding={20}>
      <View style={styles.masthead}>
        <Mono size={10} bold color={palette.accentDeep}>
          your hand · {deck.position < deck.proposals.length ? deck.position + 1 : deck.proposals.length}/{deck.proposals.length}
        </Mono>
        <IconPill onPress={handleClose} accessibilityLabel="Close">
          <X size={16} color={palette.ink} strokeWidth={2.2} />
        </IconPill>
      </View>

      <View style={{ height: spacing.md }} />

      {dealing ? (
        <View style={styles.emptyWell}>
          <Mono size={10} bold color={palette.accentDeep}>
            reshuffling…
          </Mono>
          <View style={{ height: spacing.sm }} />
          <DisplayText size={24} color={palette.primary}>
            Dealing a fresh hand
          </DisplayText>
        </View>
      ) : exhausted ? (
        <View style={styles.emptyWell}>
          <Mono size={10} bold color={palette.accentDeep}>
            that's the hand
          </Mono>
          <View style={{ height: spacing.sm }} />
          <DisplayText size={26} color={palette.primary} style={{ textAlign: 'center' }}>
            Nothing grabbed you?
          </DisplayText>
          <View style={{ height: spacing.md }} />
          <PolishedButton label="Deal a fresh hand" tone="forest" onPress={handleFreshHand} />
          {keptCount > 0 ? (
            <>
              <View style={{ height: spacing.sm }} />
              <ItalicText size={14} style={{ textAlign: 'center' }}>
                {keptCount === 1 ? '1 keep waiting to be placed.' : `${keptCount} keeps waiting to be placed.`}
              </ItalicText>
            </>
          ) : null}
        </View>
      ) : focused ? (
        <DeckCard
          key={focused.id}
          recipe={focused}
          onKeep={handleKeep}
          onPass={handlePass}
          onCookTonight={handleCookTonight}
        />
      ) : null}

      <View style={styles.footer}>
        {keptCount > 0 ? (
          <Pressable onPress={goAllocateOrHome} accessibilityRole="button" style={styles.keptTray}>
            <View style={styles.keptStrip}>
              {deck.kept.slice(0, 5).map((r) => (
                <Vignette
                  key={r.id}
                  size={34}
                  localKey={r.localImageKey as SeedMealKey | undefined}
                  remoteUrl={r.heroImageUrl}
                  imageStatus={r.imageStatus}
                  title={r.title}
                  style={styles.keptChip}
                />
              ))}
            </View>
            <Mono size={11} bold color={palette.accentDeep}>
              {keptCount === 1 ? 'review 1 keep →' : `review ${keptCount} keeps →`}
            </Mono>
          </Pressable>
        ) : (
          <View style={{ height: 34 }} />
        )}
      </View>
    </ScreenShell>
  );
}

function DeckCard({
  recipe,
  onKeep,
  onPass,
  onCookTonight,
}: {
  recipe: Recipe;
  onKeep: () => void;
  onPass: () => void;
  onCookTonight: () => void;
}) {
  const { pan, cardStyle, likeOverlayStyle, passOverlayStyle } = useSwipeGesture({
    onLike: onKeep,
    onPass,
  });
  const proteinG = recipe.nutritionalEstimate?.proteinG;

  return (
    <View style={styles.cardArea}>
      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>
          <PaperCard padding={0} cornerRadius={radius.sheet}>
            <CardArt recipe={recipe} />
            <View style={styles.cardBody}>
              <Mono size={10} bold color={palette.accentDeep}>
                {recipe.cuisine.toLowerCase()}
              </Mono>
              <View style={{ height: 4 }} />
              <DisplayText size={26} color={palette.ink} numberOfLines={2} style={styles.cardTitle}>
                {recipe.title}
              </DisplayText>
              {recipe.hook ? (
                <>
                  <View style={{ height: 4 }} />
                  <ItalicText size={15} color={palette.textSecondary}>
                    {recipe.hook}
                  </ItalicText>
                </>
              ) : null}
              <View style={{ height: spacing.sm }} />
              <View style={styles.statRow}>
                <Mono size={10} color={palette.textSecondary}>
                  {recipe.timeMinutes} min
                </Mono>
                <Text style={styles.leaderText} numberOfLines={1} ellipsizeMode="clip">
                  {DOT_LEADER}
                </Text>
                <Mono size={10} color={palette.textSecondary}>
                  {proteinG ? `${proteinG}g pro` : recipe.cuisine.toLowerCase()}
                </Mono>
              </View>
            </View>
          </PaperCard>

          <Animated.View pointerEvents="none" style={[styles.overlay, styles.likeOverlay, likeOverlayStyle]}>
            <Mono bold size={14} color={palette.accent}>
              keep
            </Mono>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.overlay, styles.passOverlay, passOverlayStyle]}>
            <Mono bold size={14} color={palette.utility}>
              pass
            </Mono>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <View style={{ height: spacing.md }} />
      <View style={styles.actionRow}>
        <View style={styles.actionHalf}>
          <PolishedButton label="Pass" tone="ghost" onPress={onPass} />
        </View>
        <View style={{ width: spacing.sm }} />
        <View style={styles.actionHalf}>
          <PolishedButton label="Keep" tone="rust" onPress={onKeep} />
        </View>
      </View>
      <View style={{ height: spacing.sm }} />
      <PolishedButton label="Cook this tonight →" tone="forest" onPress={onCookTonight} />
    </View>
  );
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardArea: {
    width: '100%',
  },
  cardBody: {
    padding: spacing.md,
  },
  cardTitle: {
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  leaderText: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 12,
    letterSpacing: 3,
    color: palette.statRuleColor,
  },
  actionRow: {
    flexDirection: 'row',
  },
  actionHalf: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 2,
    borderRadius: radius.tiny,
    backgroundColor: palette.surfaceTranslucent,
  },
  likeOverlay: {
    right: spacing.md,
    borderColor: palette.accent,
    transform: [{ rotate: '-8deg' }],
  },
  passOverlay: {
    left: spacing.md,
    borderColor: palette.utility,
    transform: [{ rotate: '8deg' }],
  },
  emptyWell: {
    borderRadius: 18,
    padding: spacing.xl,
    backgroundColor: palette.well,
    alignItems: 'center',
  },
  footer: {
    marginTop: spacing.lg,
  },
  keptTray: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  keptStrip: {
    flexDirection: 'row',
  },
  keptChip: {
    marginRight: -8,
    borderWidth: 2,
    borderColor: palette.background,
  },
});
```

- [ ] **Step 3: Add the route**

Create `apps/native/app/(eat)/deck.tsx`:

```tsx
import { DeckScreen } from '../../src/features/eat/DeckScreen';
export default DeckScreen;
```

- [ ] **Step 4: Verify `PolishedButton` tone names**

Confirm the tones used (`ghost`, `rust`, `forest`) exist on `PolishedButton` — `apps/native/src/components/PolishedButton.tsx` documents tones `forest / rust / cream / ghost / apple`. If `ghost` is not a valid tone in the actual props, use `cream` for the Pass button instead. Do NOT invent a tone.

- [ ] **Step 5: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0. (`DeckScreen` and `CardArt` compile; the route auto-registers.)

- [ ] **Step 6: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/CardArt.tsx apps/native/src/features/eat/DeckScreen.tsx "apps/native/app/(eat)/deck.tsx" && git commit -m "feat(deck): swipe deck screen + swappable card art

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 10: Allocation step — keeps become menu lines with day chips

**Files:**
- Create: `apps/native/src/features/eat/AllocationScreen.tsx`
- Create: `apps/native/app/(eat)/allocate.tsx`

**Interfaces:**
- Consumes: `useGenerationSession` (`deck.kept`, `deck.cookTonightId`, `reset`); `allocationWrites` + `AllocationChoice` (Task 8); `useWeekPlan` (`appendRecipeAndSelect`, `commitSelection`); `api.getRecipeById`; `addDaysISO`/`todayISO`/`ISODate` (`../week/weekDates`).
- Produces: `AllocationScreen` (default export via `app/(eat)/allocate.tsx`). On Done, writes each dated keep to `plan[date]` (re-fetching the freshest full row by id first so a completed fill's ingredients land in the plan for Shop aggregation), then routes to the cooked recipe's detail (if any) or the Tonight tab.

- [ ] **Step 1: Write `AllocationScreen`**

Create `apps/native/src/features/eat/AllocationScreen.tsx`:

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Recipe } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { Vignette } from '../../components/Vignette';
import { DisplayText, Mono, BodyText } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { palette, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { useGenerationSession } from '../../stores/generationSession';
import { useWeekPlan } from '../../stores/weekPlan';
import { allocationWrites } from './allocation';
import { api } from '../../services/api';
import { addDaysISO, todayISO, type ISODate } from '../week/weekDates';
import type { SeedMealKey } from '../../lib/assets';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayOptions(): { date: ISODate; label: string }[] {
  const today = todayISO();
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysISO(today, i);
    const label = i === 0 ? 'Tonight' : WEEKDAY[new Date(`${date}T00:00:00`).getDay()];
    return { date, label };
  });
}

export function AllocationScreen() {
  const router = useRouter();
  const { press, select } = useHaptics();
  const deck = useGenerationSession((s) => s.deck);
  const reset = useGenerationSession((s) => s.reset);
  const appendRecipeAndSelect = useWeekPlan((s) => s.appendRecipeAndSelect);
  const commitSelection = useWeekPlan((s) => s.commitSelection);

  const kept = deck?.kept ?? [];
  const cookTonightId = deck?.cookTonightId ?? null;
  const days = useMemo(dayOptions, []);

  // Pre-select "Tonight" for the cooked recipe; others start unassigned.
  const [choices, setChoices] = useState<Record<string, ISODate | null>>(() => {
    const seed: Record<string, ISODate | null> = {};
    for (const r of kept) seed[r.id] = r.id === cookTonightId ? todayISO() : null;
    return seed;
  });

  // Nothing to place (opened directly, or all keeps cleared) — bounce home.
  // Side effect lives in an effect, never in render.
  const nothingToPlace = !deck || kept.length === 0;
  useEffect(() => {
    if (nothingToPlace) {
      reset();
      router.replace('/(tabs)/tonight');
    }
  }, [nothingToPlace, reset, router]);

  const setDay = (recipeId: string, date: ISODate) => {
    select();
    setChoices((c) => ({ ...c, [recipeId]: c[recipeId] === date ? null : date }));
  };

  const finish = async () => {
    press();
    const writes = allocationWrites(kept.map((r) => ({ recipe: r, date: choices[r.id] ?? null })));
    for (const w of writes) {
      // Re-fetch the freshest row so a completed phase-2 fill's ingredients land
      // in the plan (Shop aggregation reads plan recipes' ingredients).
      const fresh = (await api.getRecipeById(w.recipe.id).catch(() => null)) ?? w.recipe;
      appendRecipeAndSelect(w.date, fresh);
      commitSelection(w.date);
    }
    const cooked = cookTonightId;
    reset();
    if (cooked) {
      router.replace({ pathname: '/(modals)/recipe/[id]', params: { id: cooked } });
    } else {
      router.replace('/(tabs)/tonight');
    }
  };

  const skipAll = () => {
    press();
    reset();
    router.replace('/(tabs)/tonight');
  };

  if (nothingToPlace) return null;

  return (
    <ScreenShell horizontalPadding={24}>
      <View style={{ height: spacing.md }} />
      <Mono size={10} bold color={palette.accentDeep}>
        place your keeps
      </Mono>
      <View style={{ height: 6 }} />
      <DisplayText size={30} color={palette.primary} style={styles.title}>
        Which night?
      </DisplayText>
      <View style={{ height: spacing.xs }} />
      <BodyText size={14} color={palette.textSecondary} weight="medium">
        Tap a day to put a keep on the plan. Skip any you just want saved.
      </BodyText>

      <View style={{ height: spacing.lg }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {kept.map((r) => (
          <AllocationRow
            key={r.id}
            recipe={r}
            days={days}
            selected={choices[r.id] ?? null}
            onSelect={(d) => setDay(r.id, d)}
          />
        ))}
        <View style={{ height: spacing.lg }} />
      </ScrollView>

      <PolishedButton label="Done" tone="forest" onPress={() => void finish()} />
      <View style={{ height: spacing.sm }} />
      <Pressable onPress={skipAll} accessibilityRole="button" hitSlop={12} style={styles.skipRow}>
        <BodyText size={13} weight="medium" color={palette.textTertiary}>
          Skip — just save them
        </BodyText>
      </Pressable>
      <View style={{ height: spacing.md }} />
    </ScreenShell>
  );
}

function AllocationRow({
  recipe,
  days,
  selected,
  onSelect,
}: {
  recipe: Recipe;
  days: { date: ISODate; label: string }[];
  selected: ISODate | null;
  onSelect: (date: ISODate) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Vignette
          size={44}
          localKey={recipe.localImageKey as SeedMealKey | undefined}
          remoteUrl={recipe.heroImageUrl}
          imageStatus={recipe.imageStatus}
          title={recipe.title}
        />
        <DisplayText size={16} color={palette.ink} numberOfLines={2} style={styles.rowTitle}>
          {recipe.title}
        </DisplayText>
      </View>
      <View style={styles.chipRow}>
        {days.map((d) => {
          const active = selected === d.date;
          return (
            <Pressable
              key={d.date}
              onPress={() => onSelect(d.date)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <Mono size={10} bold color={active ? palette.surface : palette.textSecondary}>
                {d.label}
              </Mono>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  row: {
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.statRuleColor,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowTitle: {
    flex: 1,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(42, 58, 38, 0.22)',
  },
  chipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  skipRow: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
```

- [ ] **Step 2: Add the route**

Create `apps/native/app/(eat)/allocate.tsx`:

```tsx
import { AllocationScreen } from '../../src/features/eat/AllocationScreen';
export default AllocationScreen;
```

- [ ] **Step 3: Verify `useHaptics` exposes `select`; verify `weekDates` exports**

Confirm `apps/native/src/hooks/useHaptics.ts` returns a `select` member (ReviewRecipesScreen used `const { press, select } = useHaptics()`, so it does) and that `../week/weekDates` exports `addDaysISO`, `todayISO`, `ISODate` (weekPlan imports all three). If `select` is absent, use `press` instead.

- [ ] **Step 4: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/AllocationScreen.tsx "apps/native/app/(eat)/allocate.tsx" && git commit -m "feat(deck): allocation step — keeps to day chips on the week plan

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 11: "Dealing the hand" loader + phase-1 orchestration

**Files:**
- Create: `apps/native/src/features/eat/DealingHandLoader.tsx`
- Modify: `apps/native/src/features/eat/GenerationLoadingScreen.tsx`

**Interfaces:**
- Produces: `DealingHandLoader({ phase }: { phase: 'thinking' | 'coming-up' })` — the looping shuffle visual + two-beat status copy, reduced-motion aware.
- Consumes: `api.generateProposals`, `api.requestRecipeImage`, `api.getRecipeById`; `useGenerationSession` (`tier`, `context`, `setProposals`, `fail`).

- [ ] **Step 1: Write the loader visual**

Create `apps/native/src/features/eat/DealingHandLoader.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { DisplayText, Mono } from '../../components/Text';
import { palette, radius, spacing } from '../../design';

const CARD_COUNT = 5;
const CARD_W = 92;
const CARD_H = 128;
// Final fan offsets (x, rotation) for the five dealt cards, centered.
const FAN = [
  { x: -132, rot: -16 },
  { x: -66, rot: -8 },
  { x: 0, rot: 0 },
  { x: 66, rot: 8 },
  { x: 132, rot: 16 },
];

// "Dealing the hand" (spec Loading screen): five face-down cards deal into a fan
// with an overshoot settle; the center card paints itself; the hand holds, then
// re-deals. One unhurried ~7s cycle, looping while phase-1 runs. Copy changes
// exactly once (driven by the `phase` prop). Reduced-motion → static dealt fan.
export function DealingHandLoader({ phase }: { phase: 'thinking' | 'coming-up' }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 7000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion]);

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        {FAN.map((fan, i) => {
          if (reduceMotion) {
            return (
              <View
                key={i}
                style={[
                  styles.card,
                  i === 2 ? styles.centerCard : null,
                  { transform: [{ translateX: fan.x }, { rotate: `${fan.rot}deg` }] },
                ]}
              />
            );
          }
          // Stagger each card's deal across the first ~60% of the cycle, hold,
          // then sweep out over the last ~15%.
          const dealStart = 0.05 + i * 0.09;
          const dealEnd = dealStart + 0.16;
          const tx = progress.interpolate({
            inputRange: [dealStart, dealEnd, 0.85, 1],
            outputRange: [0, fan.x, fan.x, fan.x * 1.4],
            extrapolate: 'clamp',
          });
          const rot = progress.interpolate({
            inputRange: [dealStart, dealEnd, 1],
            outputRange: ['0deg', `${fan.rot}deg`, `${fan.rot}deg`],
            extrapolate: 'clamp',
          });
          const opacity = progress.interpolate({
            inputRange: [dealStart, dealEnd, 0.85, 1],
            outputRange: [0, 1, 1, 0],
            extrapolate: 'clamp',
          });
          // Center card "paints": a wash fades in after it lands.
          const paint =
            i === 2
              ? progress.interpolate({
                  inputRange: [dealEnd, 0.6, 0.85],
                  outputRange: [0, 1, 1],
                  extrapolate: 'clamp',
                })
              : undefined;
          return (
            <Animated.View
              key={i}
              style={[
                styles.card,
                i === 2 ? styles.centerCard : null,
                { opacity, transform: [{ translateX: tx }, { rotate: rot }] },
              ]}
            >
              {i === 2 && paint ? (
                <Animated.View style={[styles.paintWash, { opacity: paint }]} />
              ) : null}
            </Animated.View>
          );
        })}
      </View>

      <View style={{ height: spacing.xl }} />
      <Mono size={10} bold color={palette.accentDeep}>
        dealing your hand
      </Mono>
      <View style={{ height: spacing.sm }} />
      <DisplayText size={30} color={palette.primary} style={styles.copy}>
        {phase === 'thinking' ? 'The kitchen is thinking' : 'Five proposals, coming up'}
      </DisplayText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    width: '100%',
    height: CARD_H + 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    borderRadius: radius.card,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
  centerCard: {
    backgroundColor: palette.surface,
    zIndex: 5,
  },
  paintWash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.card,
    backgroundColor: palette.well,
  },
  copy: {
    letterSpacing: -0.6,
    lineHeight: 34,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
```

- [ ] **Step 2: Verify token names used by the loader**

Confirm `radius.card`, `palette.surface`, `palette.glassBorder`, `palette.well`, `palette.accentDeep`, `palette.primary` all exist in `apps/native/src/design/`. If `radius.card` is absent, use `radius.sheet`; if `palette.glassBorder` is absent, use `palette.statRuleColor`. Do NOT invent token names — grep `apps/native/src/design/` first.

- [ ] **Step 3: Rewrite `GenerationLoadingScreen` to drive phase-1**

Replace the ENTIRE contents of `apps/native/src/features/eat/GenerationLoadingScreen.tsx` with:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ScreenShell } from '../../components/ScreenShell';
import { DisplayText, Mono, BodyText } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { palette, spacing } from '../../design';
import { api } from '../../services/api';
import { useGenerationSession } from '../../stores/generationSession';
import { useHaptics } from '../../hooks/useHaptics';
import { DealingHandLoader } from './DealingHandLoader';

const FIRST_ART_TIMEOUT_MS = 6000;
const POLL_INTERVAL_MS = 1200;
const PREFETCH_AT_DEAL = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Reveal gate: proposal text is already resolved; wait for card-1 art up to a
// timeout, then reveal (art timeout → deck shows the monogram anyway).
async function waitForFirstArt(id: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < FIRST_ART_TIMEOUT_MS) {
    const r = await api.getRecipeById(id).catch(() => null);
    if (r && (r.imageStatus === 'ready' || r.heroImageUrl)) return;
    await sleep(POLL_INTERVAL_MS);
  }
}

export function GenerationLoadingScreen() {
  const router = useRouter();
  const { success, error: errorHaptic } = useHaptics();
  const tier = useGenerationSession((s) => s.tier);
  const context = useGenerationSession((s) => s.context);
  const setProposals = useGenerationSession((s) => s.setProposals);
  const fail = useGenerationSession((s) => s.fail);
  const [phase, setPhase] = useState<'thinking' | 'coming-up'>('thinking');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const runId = useRef(0);

  useEffect(() => {
    if (!tier) {
      router.replace('/(eat)/energy');
      return;
    }
    const myRun = ++runId.current;
    let cancelled = false;

    (async () => {
      try {
        setErrorMsg(null);
        setPhase('thinking');
        const proposals = await api.generateProposals(tier, context);
        if (cancelled || myRun !== runId.current) return;
        setProposals(proposals);
        setPhase('coming-up');
        // Warm the first 3 hero images in parallel (spec: pre-fire first 3).
        proposals.slice(0, PREFETCH_AT_DEAL).forEach((p) => {
          if (p.imageStatus !== 'ready' && !p.heroImageUrl) void api.requestRecipeImage(p.id);
        });
        if (proposals[0]) await waitForFirstArt(proposals[0].id);
        if (cancelled || myRun !== runId.current) return;
        success();
        router.replace('/(eat)/deck');
      } catch (e) {
        if (cancelled || myRun !== runId.current) return;
        const msg = e instanceof Error ? e.message : 'The kitchen is busy — try again.';
        fail(msg);
        setErrorMsg(msg);
        errorHaptic();
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, context]);

  const retry = () => {
    runId.current++; // triggers the effect body via state change below
    setErrorMsg(null);
    setPhase('thinking');
    // Re-run by nudging the effect: bump a dummy dep through context is not
    // ideal; instead re-invoke the same flow inline.
    if (!tier) return;
    void (async () => {
      const myRun = runId.current;
      try {
        const proposals = await api.generateProposals(tier, context);
        if (myRun !== runId.current) return;
        setProposals(proposals);
        setPhase('coming-up');
        proposals.slice(0, PREFETCH_AT_DEAL).forEach((p) => {
          if (p.imageStatus !== 'ready' && !p.heroImageUrl) void api.requestRecipeImage(p.id);
        });
        if (proposals[0]) await waitForFirstArt(proposals[0].id);
        if (myRun !== runId.current) return;
        success();
        router.replace('/(eat)/deck');
      } catch (e) {
        if (myRun !== runId.current) return;
        setErrorMsg(e instanceof Error ? e.message : 'The kitchen is busy — try again.');
        errorHaptic();
      }
    })();
  };

  if (errorMsg) {
    return (
      <ScreenShell scrollable={false} horizontalPadding={24}>
        <View style={styles.errorWrap}>
          <Mono size={10} bold color={palette.destructive}>
            {"couldn't deal"}
          </Mono>
          <View style={{ height: spacing.sm }} />
          <DisplayText size={24} color={palette.ink} style={{ lineHeight: 28, textAlign: 'center' }}>
            {errorMsg}
          </DisplayText>
          <View style={{ height: spacing.lg }} />
          <PolishedButton label="Try again" tone="rust" onPress={retry} />
          <View style={{ height: spacing.sm }} />
          <PolishedButton label="Back" tone="ghost" onPress={() => router.replace('/(eat)/energy')} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell scrollable={false} horizontalPadding={24}>
      <DealingHandLoader phase={phase} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 4: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0. (If `PolishedButton` has no `ghost` tone, use `cream` for the Back button — see Task 9 Step 4. If `useHaptics` has no `error` member, use the member ReviewRecipesScreen/GenerationLoadingScreen used originally — the original file destructured `{ success, error }`, so it exists.)

- [ ] **Step 5: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/DealingHandLoader.tsx apps/native/src/features/eat/GenerationLoadingScreen.tsx && git commit -m "feat(deck): dealing-the-hand loader + phase-1 orchestration

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 12: Cleanup — delete the old review screen, honest copy

**Files:**
- Delete: `apps/native/src/features/eat/ReviewRecipesScreen.tsx`
- Delete: `apps/native/app/(eat)/review.tsx`
- Modify: `apps/native/src/features/eat/EnergyPickerScreen.tsx`

**Interfaces:** none produced. This task removes dead code and aligns copy with the hand-of-5 flow.

- [ ] **Step 1: Confirm nothing still references the review route or screen**

Run:
```bash
cd apps/native && grep -rn "ReviewRecipesScreen\|(eat)/review" src app
```
Expected: matches ONLY in `src/features/eat/ReviewRecipesScreen.tsx` and `app/(eat)/review.tsx` (the files being deleted). If any OTHER file matches, fix that reference first (repoint to `/(eat)/deck`).

- [ ] **Step 2: Delete the two files**

Run:
```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git rm apps/native/src/features/eat/ReviewRecipesScreen.tsx "apps/native/app/(eat)/review.tsx"
```
Expected: both staged for deletion.

- [ ] **Step 3: Make the energy-picker copy honest (hand of five, ~15s)**

In `apps/native/src/features/eat/EnergyPickerScreen.tsx`, change the subhead body copy:

```tsx
      <BodyText size={15} color={palette.textSecondary} weight="medium">
        {"We'll deal a hand of five dinners tuned to the bandwidth you actually have tonight."}
      </BodyText>
```

And change the footer caption:

```tsx
      <Mono size={9} color={palette.textTertiary} style={styles.caption}>
        A HAND OF FIVE IN ABOUT 15 SECONDS
      </Mono>
```

- [ ] **Step 4: Run the client gates**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both exit 0 (no dangling imports from the deleted screen).

- [ ] **Step 5: Commit**

```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/EnergyPickerScreen.tsx apps/native/src/features/eat/ReviewRecipesScreen.tsx "apps/native/app/(eat)/review.tsx" && git commit -m "chore(deck): delete review screen; hand-of-5 energy copy

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 13: Verification — gates, paid smoke, sim walk

**[MACHINE — needs Zach's OK; simulator may be in use for another project]**

**Files:** none committed (verification only; revert any temporary probe before finishing).

**Purpose:** prove the whole flow: gates green, one paid live hand (phase-1) + one paid fill (phase-2) + art, then a sim walk through deal → swipe → keep → cook → allocate → Tonight/Week/Shop, plus the circle-vs-square art A/B.

- [ ] **Step 1: Run every automated gate**

Run:
```bash
export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint && bun test src/features/eat/deckState.test.ts src/features/eat/imagePrefetch.test.ts src/features/eat/allocation.test.ts
```
Expected: typecheck + lint exit 0; all three bun test files pass.

Then the edge pure tests:
```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && deno test supabase/functions/_shared/proposals-schema.test.ts supabase/functions/generate-proposals/cache.test.ts supabase/functions/fill-recipe/dedup.test.ts supabase/functions/_shared/recipe-map.test.ts
```
Expected: all pass. (Do NOT run the whole `supabase/functions` tree — `generate-recipe/persist.test.ts` has a pre-existing `--allow-net` failure unrelated to this build.)

- [ ] **Step 2: Confirm the two functions are deployed and the migration is live**

Run (does not echo secrets):
```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && set -a && source ~/Projects/qook/.env.local && set +a && supabase functions list
```
Expected: `generate-proposals` and `fill-recipe` both listed for project `eehjclffugngogbvctib`. (They were deployed in Tasks 4 and 5.)

- [ ] **Step 3: Launch the app in live mode against the simulator** `[requires Zach's OK — sim may be in use]`

Confirm `app.json.extra.apiMode === 'live'`, then:
```bash
export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run ios
```
Watch the Metro/OpenRouter console. To start from a clean plan, call `useWeekPlan.getState().clearAll()` from the JS debugger first.

- [ ] **Step 4: Deal one paid hand + verify the loader** `[COST — one Luna proposals call, a few cents + up to 3 × ~$0.034 images]`

From Tonight → energy tier → context (skip) → the dealing loader appears. Verify:
  - The shuffle animates (five cards deal into a fan) and the status copy flips exactly once from "The kitchen is thinking" to "Five proposals, coming up".
  - After ~5–15s the deck reveals with 5 cards. Card 1 shows painted art or the letter monogram with a "painting…" tick (never another recipe's art).
  - This is the ONLY paid hand for this smoke — do not re-deal repeatedly.

- [ ] **Step 5: Swipe, keep two, and verify phase-2 fill** `[COST — up to 2 Luna fill calls]`

Swipe: pass one (left), keep two (right — or use the Keep button). Verify:
  - Keep advances the deck and the kept tray shows the kept vignettes with "review N keeps →".
  - Open one kept recipe from the tray / allocation later and confirm it has full ingredients + steps (phase-2 filled it in the background). If it still shows a loading/empty body, the fill is slow or failed — check the `fill-recipe` logs (`supabase functions logs fill-recipe`): a `502` is a generation failure (recipe stays a proposal, retry offered), not a wiring bug.

- [ ] **Step 6: Cook tonight + allocation → Tonight tab**

On a focused card tap "Cook this tonight →". Verify:
  - Routes to the allocation step with that recipe pre-chipped to "Tonight".
  - Assign the two keeps to two different upcoming days; tap Done.
  - Lands on the cooked recipe's detail; the Tonight tab now shows the cooked dish as tonight's pick.

- [ ] **Step 7: Verify Week + Shop wiring**

  - Week tab: the two allocated keeps appear on their chosen days.
  - Shop tab: ingredients from the allocated (full) recipes aggregate into the list. (If a keep's fill had not completed before allocation wrote it, its ingredients may be missing — this is the known pending-fill gap; re-opening the recipe and re-allocating refreshes it. Note whether this occurred.)

- [ ] **Step 8: Circle-vs-square art A/B**

In `apps/native/src/features/eat/CardArt.tsx`, flip `CARD_ART_MASK` from `'square'` to `'circle'`, reload the sim (Cmd+Ctrl+Z → Reload), and re-deal (or reuse the current hand). Compare the two masks on a card with real art. Record Zach's pick. Set `CARD_ART_MASK` to the chosen value and leave it; commit only if it changed:
```bash
cd "$(git -C ~/Projects/qook rev-parse --show-toplevel)" && git add apps/native/src/features/eat/CardArt.tsx && git commit -m "chore(deck): lock CARD_ART_MASK to <chosen> per sim A/B

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Confirm the tree is clean**

Run: `git -C ~/Projects/qook status`
Expected: no stray uncommitted changes from this build beyond other sessions' known work-in-progress. No temporary probes left behind.

---

## Self-Review

**1. Spec coverage** (each spec section → task):
- Flow B swipe deck, bounded hand of 5, one-tap fresh hand → Tasks 7 (reducer), 9 (deck + fresh hand). ✓
- Immediate cook-tonight exit (button on card) → Task 9 (`handleCookTonight`), Task 10 (allocation pre-chips Tonight). ✓
- Treatment-01 card; art block = one swappable component (circle | square const, sim A/B) → Task 9 `CardArt` + `CARD_ART_MASK`; A/B in Task 13 Step 8. ✓
- Pending art = monogram + "painting…" tick → Task 9 `CardArt` (`PaintingTick`, letter monogram). ✓
- Image firing: first 3 at deal, stay 2 ahead → Task 8 `artIndicesToRequest` + Task 9 prefetch effect + Task 11 first-3 warm. ✓
- One loading moment, reveal on text + card-1 art (art timeout → reveal) → Task 11 `waitForFirstArt` + navigate. ✓
- Loading screen "dealing the hand" shuffle, copy changes once, reduced-motion fallback → Task 11 `DealingHandLoader`. ✓
- Text model Luna via `OR_TEXT_MODEL` → Tasks 4 & 5 use `MODELS.textDraft()`. ✓
- Phase-1 endpoint: one call, small strict schema, skeleton rows, 1 quota unit, title cache shortcut (Resolved Q1) → Tasks 3, 4. ✓
- Phase-2 endpoint: fill one in place, signature dedup at fill, cache-hit deletes skeleton, quota-free, failure→proposal+error → Task 5. ✓ ("max 5 per session" implemented as the natural per-hand cap — see Deviations.)
- Voice-context pass-through (Resolved Q2) → phase-1 passes `context` into `buildProposalsUserPrompt`; phase-2 passes it into `buildFillUserPrompt`. ✓
- `content_status` + `hook` columns; both mappers in sync → Tasks 1, 2. ✓
- Client stores reshaped; deck state (kept, position) → Task 7. ✓
- Allocation step (after hand, after done, after cook-tonight; day chips → weekPlan; skippable; skipped keeps stay saved) → Task 10 + Task 9 (`saveIfNew`). ✓
- Old review screen deleted, no dead flag; honest copy → Task 12. ✓
- Testing: proposal schema parse, deck reducer, prefetch window, allocation mapping, edge phase-1/phase-2 happy path + dedup, live smoke, sim walk → Tasks 3,4,5,7,8,13. ✓

**2. Placeholder scan.** No `TBD`/`TODO`/"handle edge cases"/"add validation"/"similar to Task N". Every code step ships complete code; every run step gives an exact command + expected output. The few "verify token/tone/member exists" steps (Task 9 Step 4, Task 10 Step 3, Task 11 Step 2) are guardrails against primitive-API drift with an explicit fallback named — not deferred work.

**3. Type consistency.** `DeckState`/`initDeck`/`focusedRecipe`/`isExhausted`/`dealFreshHand`/`setCookTonight`/`reconcileKept` names match across `deckState.ts`, the store, and `DeckScreen`. The reducer's keep/pass exports are renamed to `deckKeep`/`deckPass` in Task 7 Step 5 (the store aliases them `reduceKeep`/`reducePass`; the test is updated in the same step). `artIndicesToRequest(position, count, requested)` is identical in module, test, and `DeckScreen`. `allocationWrites(AllocationChoice[]) → AllocationWrite[]` matches module, test, and `AllocationScreen`. `generateProposals(tier, context) → Recipe[]` and `fillRecipe(recipeId, context) → { recipeId, status }` match `api.ts` and both call sites. Edge: `toSkeletonInsert`/`toFillUpdate`/`firstCacheHitId`/`resolveFillTarget`/`ProposalsEnvelope`/`ProposalsEnvelopeJsonSchema` names match definitions and call sites. `Recipe.contentStatus`/`Recipe.hook` (optional) defined in Task 1, mapped in Task 2, read in Tasks 9/11.

**Deviations from the spec letter (surfaced, not hidden):**
- **Phase-2 "max 5 fills per session row" → natural per-hand cap.** `fill-recipe` requires `content_status = 'proposal'` and is idempotent (a `'full'` row returns as-is), and a hand only ever creates 5 skeleton rows, so at most 5 fills happen per hand without an explicit per-session counter (which would need a `generation_session_id` linkage column that does not exist). A hard cross-session abuse cap is deferred (YAGNI for the anon-only v1: pending proposals are a finite global set, and fills are bounded by OpenRouter rate limits). If abuse appears, add a session linkage column + counter.
- **Concurrent double-fill of the same skeleton** is a rare bounded double-spend (no `'generating'` intermediate `content_status` exists, and the spec fixes `content_status` to `'full' | 'proposal'`). The idempotent `'full'` early-return covers the common keep-then-cook double-fire; true simultaneity would run Luna twice, costing a few cents. Accepted for v1.
- **Pending-fill at allocation time.** If a keep's phase-2 fill has not resolved when the user reaches allocation, the deck reconciles kept entries as fills land, and `AllocationScreen.finish` re-fetches each row by id before writing — so a completed fill is captured. A still-pending fill writes a skeleton (empty ingredients) to the plan; Shop won't see its ingredients until the recipe is refreshed. Spec says "by allocation time they're typically done"; Task 13 Step 7 checks for this and notes it. Accepted for v1.
- **Fresh-hand loader.** Mid-deck "deal a fresh hand" uses a lightweight inline "reshuffling…" state rather than the full dealing-hand choreography (which is reserved for the first deal from the energy flow, per the spec's single-loading-moment framing). The full loader's "final deal settles into the real deck" is approximated by a navigate-on-ready handoff (the deck appears already dealt) rather than a shared-element transition.
