# Domain Architecture — Qook Fresh Build

**Owner:** domain-architect
**Target ship:** 2026-05-24 TestFlight
**Repo:** `~/Projects/qook/`
**Stack:** Expo + Supabase (Postgres + Edge Functions), React Query, Zustand

This document defines the TypeScript domain layer: types, flows, normalization rules, state machines, and the ordered build plan. It assumes the backend architect owns the SQL schema shape, the AI architect owns prompt construction and LLM calls, and the frontend architect owns screens. This doc owns the **language of the app**.

---

## 1. TypeScript Domain Models

All types live under `packages/shared/src/types/` (shared between Expo client and Edge Functions). Database row types come from `src/services/supabase/database.types.ts` (generated via `supabase gen types typescript`) — **we never hand-duplicate them**. Domain types extend or refine generated row types by:
- Renaming fields (`snake_case` → `camelCase` via a mapper at service boundary).
- Narrowing unions (e.g. `status: string` → `status: GenerationStatus`).
- Adding derived client-side fields.

### 1.1 Primitive enums & literals

```ts
// packages/shared/src/types/primitives.ts

export type EnergyTier =
  | 'brain-is-fried'   // ≤ 15 min active
  | 'after-work'       // ≤ 30 min active
  | 'got-energy'       // ≤ 45 min active
  | 'weekend-project'; // > 45 min active

export type RecipeDifficulty = 'Easy' | 'Medium' | 'Advanced';
export type IngredientRole = 'main' | 'side' | 'sauce' | 'garnish' | 'other';
export type GroceryCategory = 'Produce' | 'Dairy' | 'Pantry' | 'Protein' | 'Frozen' | 'Bakery' | 'Other';
export type RecipeSource = 'cohort' | 'live' | 'user' | 'fallback';
export type ImageStatus = 'pending' | 'generating' | 'ready' | 'failed';
export type UnitSystem = 'imperial' | 'metric';
export type DietaryTag = 'vegan' | 'vegetarian' | 'pescatarian' | 'gluten-free' | 'dairy-free' | 'nut-free' | 'low-carb' | 'high-protein';
export type PreferenceState = 'like' | 'love' | 'exclude';

export type ISODate = string & { readonly __iso: unique symbol };
export type Timestamp = number & { readonly __ts: unique symbol };
```

### 1.2 Recipe

```ts
// packages/shared/src/types/recipe.ts
import type {
  EnergyTier, RecipeDifficulty, IngredientRole, RecipeSource,
  ImageStatus, DietaryTag, Timestamp, GroceryCategory,
} from './primitives';

export interface Ingredient {
  item: string;              // "chicken thighs, bone-in"
  quantity?: string;         // "1 1/2 cups"
  notes?: string;            // "at room temp"
  parsed?: ParsedIngredient; // filled by normalizer
}

export interface ParsedIngredient {
  canonicalKey: string;       // "chicken thigh" — lowercase, singular
  name: string;               // "Chicken Thigh" — display
  quantityAmount?: number;
  quantityUnit?: string;
  quantityText?: string;
  category: GroceryCategory;
  optional?: boolean;
  substitutes?: string[];     // ["olive oil"], future
}

export interface IngredientGroup {
  title: string;             // "Main", "Sauce", "For serving"
  role: IngredientRole;
  items: Ingredient[];
}

export interface RecipeStep {
  instruction: string;        // 2-3 sentences max for 'standard' effort
  durationMin: number;        // always > 0, passive wait not counted
  requires?: string[];
  produces?: string[];
}

export interface RecipeSection {
  title: string;              // "Sear the chicken"
  objective: string;          // one-line goal
  steps: RecipeStep[];
}

export interface RecipeTimelineItem {
  atMin: number;
  instruction: string;
  sectionTitle: string;
}

export interface NutritionalEstimate {
  calories?: number;  // per serving
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  source: 'ai-estimate' | 'computed' | 'missing';
}

export interface Recipe {
  id: string;                 // Supabase uuid
  slug: string;               // deterministic kebab-case from title + short hash
  signature: string;          // SHA-256 of canonical content — dedupe key

  title: string;
  cuisine: string;            // validated against CUISINE_TO_TOP_LEVEL_GROUP
  tier: EnergyTier;
  tags: string[];
  dietaryTags: DietaryTag[];

  timeMinutes: number;        // active hands-on
  servings: number;
  difficulty: RecipeDifficulty;

  ingredients: IngredientGroup[];
  steps: RecipeSection[];
  timeline: RecipeTimelineItem[];

  notes?: string;             // 1-2 sentence blurb, NOT tips
  nutritionalEstimate?: NutritionalEstimate;

  heroImageUrl?: string;
  imageStatus: ImageStatus;

  source: RecipeSource;
  ownerId?: string;           // null for cohort recipes

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Minimal shape for lists — avoid over-fetching. */
export type RecipeCard = Pick<
  Recipe,
  | 'id' | 'slug' | 'title' | 'cuisine' | 'tier'
  | 'timeMinutes' | 'servings' | 'difficulty'
  | 'heroImageUrl' | 'imageStatus' | 'dietaryTags'
> & { teaser?: string };
```

### 1.3 Decks

```ts
// packages/shared/src/types/deck.ts
import type { EnergyTier, ISODate, Timestamp } from './primitives';

/** Shared, server-curated cohort deck. One per (weekNumber, tier). */
export interface CohortDeck {
  id: string;
  weekNumber: number;         // ISO week (1..53)
  weekStartDate: ISODate;     // Sunday
  tier: EnergyTier;
  recipeIds: string[];        // always 12
  assetManifest: string[];    // parallel image URLs for prefetch
  generatedAt: Timestamp;
  version: number;            // bumped if cron re-runs in same week
}

/** User's weekly Swipe Night deck. Derived from CohortDeck + live gen. */
export interface WeeklyDeck {
  id: string;
  userId: string;
  weekStartDate: ISODate;
  tier: EnergyTier;
  state: 'generating' | 'ready' | 'expired' | 'failed';
  expiresAt: Timestamp;
  origin: 'cohort' | 'live-blend' | 'live-full';
  voiceContext?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DeckItem {
  id: string;
  deckId: string;
  recipeId: string;
  order: number;              // 0..11
  userChoice: 'swiped-in' | 'swiped-out' | 'tbd';
  decidedAt?: Timestamp;
  planDayLabel?: number;      // 0=Mon..6=Sun, null until assigned
}
```

### 1.4 Grocery

```ts
// packages/shared/src/types/grocery.ts
import type { GroceryCategory, Timestamp } from './primitives';

export interface GroceryItem {
  id: string;
  userId: string;
  canonicalKey: string;       // shares namespace with ParsedIngredient
  name: string;
  quantityAmount?: number;
  quantityUnit?: string;
  quantityText?: string;
  category: GroceryCategory;
  checked: boolean;
  source: 'manual' | 'recipe_import';
  sourceRecipeTitles?: string[];
  sourceRecipeIds?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Transient — lives only as long as the preview session. */
export interface GroceryImportPreview {
  id: string;
  userId: string;
  sessionId: string;
  previewFingerprint: string;
  llmApplied: boolean;
  items: AggregatedGroceryItem[];
  createdAt: Timestamp;
}

export interface AggregatedGroceryItem {
  previewItemId: string;
  canonicalKey: string;
  name: string;
  quantityAmount?: number;
  quantityUnit?: string;
  quantityText?: string;
  category: GroceryCategory;
  recipeCount: number;
  sourceLines: string[];       // recipe titles for "used in 2 recipes" chip
}
```

### 1.5 User

```ts
// packages/shared/src/types/user.ts
import type { EnergyTier, PreferenceState, UnitSystem, DietaryTag, Timestamp } from './primitives';

export interface User {
  id: string;                // Supabase auth uuid
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  hasCompletedOnboarding: boolean;
  firstDeckGeneratedAt?: Timestamp;
  aiDataConsentAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastSeenAt: Timestamp;
}

export interface Preference {
  name: string;
  state: PreferenceState;
}

export interface UserPreferences {
  userId: string;
  householdSize: number;           // default 2
  unitSystem: UnitSystem;          // default 'imperial'
  cuisines: Preference[];
  proteinPriorities: Preference[];
  avoidIngredients: string[];      // e.g. ['peanut', 'shellfish']
  cookingTools: string[];          // ['wok', 'instant pot', 'air fryer']
  dietaryConstraints: DietaryTag[];
  defaultTier: EnergyTier;
  generationDay: number;           // 0=Sun..6=Sat
  updatedAt: Timestamp;
}

/** Backs the Saved tab. */
export interface UserSavedRecipe {
  id: string;
  userId: string;
  recipeId: string;
  savedAt: Timestamp;
  lastServedAt?: Timestamp;   // for variety algo
  timesCooked: number;
}
```

### 1.6 Generation sessions

```ts
// packages/shared/src/types/generation.ts
import type { EnergyTier, Timestamp } from './primitives';

export type GenerationStatus =
  | 'idle'
  | 'collecting_context'
  | 'generating_text'
  | 'generating_images'
  | 'ready'
  | 'error';

export interface GenerationSession {
  id: string;
  userId: string;
  tier: EnergyTier;
  context?: string;           // text or transcribed voice
  requestedCount: number;     // 3 for Eat, 12 for Swipe Night live-full
  status: GenerationStatus;
  errorMessage?: string;
  recipeIds: string[];
  startedAt: Timestamp;
  completedAt?: Timestamp;
}

export interface GenerationItem {
  id: string;
  sessionId: string;
  slotIndex: number;          // 0..(requestedCount-1)
  status: 'pending' | 'generating' | 'ready' | 'failed' | 'skipped';
  plannedCuisine?: string;    // from recipePlanner
  plannedProtein?: string;
  recipeId?: string;          // when ready
  errorMessage?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 1.7 Barrel file

```ts
// packages/shared/src/types/index.ts
export * from './primitives';
export * from './recipe';
export * from './deck';
export * from './grocery';
export * from './user';
export * from './generation';
```

---

## 2. Core Flows

### 2.1 Cohort consumption — "Tonight"

**Goal:** User opens the app, sees 3 curated recipes, zero AI calls fired on-device.

```
User opens app
  → useUser() → OK (auth resolved)
  → useTonightPicks(userId, tier) → React Query
      ↓
      Edge Fn: GET /tonight?tier=<tier>
        1. Fetch active CohortDeck for (currentIsoWeek, user.tier)
        2. Fetch user.savedRecipes filtered by lastServedAt > 7 days ago
        3. Fetch user.preferences.cuisines (weights)
        4. Run Deck Variety Algorithm (§5) → pick 3
        5. UPDATE user_saved_recipes SET lastServedAt=now() for chosen 3
        6. Return [RecipeCard × 3]
      ↓
  → Tonight screen renders cards
  → Image.prefetch(heroImageUrl) for all 3
  → Tap → /recipe/[slug] modal
```

**Files:**
- `apps/native/app/(tabs)/tonight.tsx`
- `apps/native/hooks/useTonightPicks.ts`
- `apps/native/services/api/decks.ts`
- `supabase/functions/tonight/index.ts`
- `packages/shared/src/domain/deckVariety.ts`

**Cache:** `staleTime: 30min`. Invalidate on recipe save/unsave.

### 2.2 Live generation — "Eat"

**Goal:** 3 fresh recipes, streaming in.

```
User taps "Generate fresh"
  → /eat/energy-picker — choose tier
  → /eat/context — (optional) hold-to-record voice → Whisper Edge Fn → transcript
  → Tap "Generate"
      ↓
  → POST /generate-session { tier, context, count: 3 }
      Edge Fn creates GenerationSession(status='generating_text')
      Returns sessionId < 400ms
      ↓
  → Client: useGenerationSession(sessionId) → Supabase Realtime
      channel: `generation_sessions:id=eq.<sessionId>`
  → Edge Fn dispatches 3 parallel slot workers:
      - buildRecipeSlots() plans cuisine+protein (deterministic, seeded)
      - Per slot:
          a. Haiku 4.5 draft prompt → JSON
          b. (optional) Sonnet 4.6 polish if draft is shaky
          c. normalizeRecipeOption() → validate
          d. INSERT recipes; UPDATE generation_items.recipeId + status='ready'
          e. Fire-and-forget generate-image
  → Client reacts per Realtime event:
      - slot N ready → render card
      - image ready → swap placeholder for real
  → All items ready → session.status='ready'
  → Swipe on cards to save → INSERT user_saved_recipes
```

**Files:**
- `apps/native/app/eat.tsx`, `apps/native/app/eat-review.tsx`
- `apps/native/hooks/useGenerationSession.ts`
- `supabase/functions/generate-session/`, `generate-recipe/`, `generate-image/`
- `packages/shared/src/domain/recipeNormalize.ts`

**Failure handling:** Per-slot failure marked `status='failed'`, surfaced as retry card. Session stays `ready` with ≥1 success.

### 2.3 Swipe Night

**Goal:** 12-card deck, pick 3-5 per week.

```
User opens Swipe Night
  → Has WeeklyDeck for currentSunday?
      NO  → Seed:
              - Cohort deck for tier exists? → clone recipeIds into DeckItems (origin='cohort')
              - Else → live-full generation (12 recipes, expensive)
      YES → Use it
  → SwipeDeck screen renders 12 cards
  → Right swipe → DeckItem.userChoice='swiped-in', decidedAt=now()
  → Left swipe → DeckItem.userChoice='swiped-out', decidedAt=now()
  → Zustand tracks position (not persisted until commit)
  → ≥3 swipe-ins OR all 12 done → "Build your week" review
  → Drag picks to day slots → DeckItem.planDayLabel = 0..6
  → "Add to grocery" → Grocery flow
```

**Cohort vs live-full split:** 80% hit cohort path. `origin='live-full'` only on explicit "Regenerate" or pre-Sunday-cron.

**Files:**
- `apps/native/app/swipe-night.tsx`
- `apps/native/hooks/useWeeklyDeck.ts`
- `apps/native/components/SwipeCard.tsx`
- `apps/native/stores/swipeDeckStore.ts`
- `supabase/functions/seed-deck/index.ts`

### 2.4 Grocery

```
Tap "Add to grocery" from deck/meal-plan
  → Collect ingredientGroups from selected recipes
  → Flatten → RecipeIngredientLine[] { item, quantity, notes, recipeTitle, recipeId }
  → Deterministic pass (client, offline-safe):
       aggregateIngredientLines():
         - parseAmountAndUnit
         - normalizeIngredientName → canonicalKey
         - inferCategory
         - group by (canonicalKey, unit-family)
         - sum compatible units (1 tbsp + 1 tsp → 4 tsp)
  → Preview screen, AggregatedGroceryItem[] grouped by category
  → [Optional] LLM pass:
       POST /grocery-normalize → Sonnet 4.6 cleans names/categories
       Compare previewFingerprint — if changed, diff toast
  → "Add all" → batch INSERT grocery_items
  → Shop tab, sectioned, swipe-to-check-off
```

**Files:**
- `apps/native/app/ingredients-review.tsx`
- `apps/native/app/(tabs)/shop.tsx`
- `apps/native/services/api/grocery.ts`
- `supabase/functions/grocery-normalize/index.ts`
- `packages/shared/src/domain/groceryNormalize.ts`

### 2.5 Onboarding

```
SignUp → AuthCallback → /onboarding/_layout
  1. /onboarding/household — household size (1, 2, 3+, 5+)
  2. /onboarding/cuisines — like/love/exclude on top 12 cuisines
       Derive proteinPriorities[] via CUISINE_TO_PROTEINS (seed 'like').
  3. /onboarding/avoid — chips + free-text "anything else?"
  4. /onboarding/tier — default energy tier
  5. /onboarding/seed — "Preparing your first deck…"
       POST /seed-first-deck:
         1. Lookup CohortDeck for (currentWeek, tier)
         2. Clone into WeeklyDeck
         3. Clone recipeIds into DeckItems (userChoice='tbd')
         4. user.hasCompletedOnboarding = true
       Prefetch 3 hero images
  → /(tabs)/tonight — welcome overlay on first visit
```

---

## 3. Asset Pipeline

### 3.1 Warm-start import (one-time)

Script: `apps/native/scripts/import-seed-cohort.ts`

```
For each of 24 PNGs at apps/native/assets/meals-seed/v2/:
  1. Parse filename → recipe metadata (manifest JSON from v1)
  2. Upload to Supabase Storage: meal-images/seed/<slug>.png
  3. Build Recipe row: source='cohort', imageStatus='ready', heroImageUrl=<public>
  4. INSERT recipes
Build 4 CohortDecks for currentWeek × 4 tiers:
  - Split 24 by deriveEnergyTier(recipe.timeMinutes)
  - Pad each tier to 12 by repeating
```

Run **once** to bootstrap, then cohorts generate weekly.

### 3.2 Live image generation

Trigger: any new recipe row with `imageStatus='pending'`. Explicit call from `generate-recipe` (not DB trigger — explicit cost control).

1. Build prompt: `"Warm watercolor illustration of [title], [cuisine] cuisine, cream and rust palette, top-down plate view."`
2. OpenRouter → `bytedance-seed/seedream-4.5` at 1:1, ~$0.04
3. Download bytes → upload `meal-images/generated/<recipeId>.png`
4. `UPDATE recipes SET heroImageUrl=<url>, imageStatus='ready'`

Client subscribed via Realtime, shimmer swaps for real.

**Budget guard:** Check `user.imagesGeneratedThisMonth` (free tier cap 30/month, past that → paywall).

### 3.3 Cohort weekly batch

Cron: Sunday 00:00 UTC, `supabase/functions/generate-cohort-decks/index.ts`.

```
For each tier:
  For slot 0..11:
    1. buildRecipeSlots() seeded by `${week}-${tier}-${slot}`
    2. Haiku draft → (optional polish) → normalize → INSERT
    3. Fire generate-image
  Write CohortDeck row
```

**Cost/week:** 48 text × $0.01 ≈ $0.48 + 48 images × $0.04 ≈ $1.92 = **~$2.40** (amortized across all users).

### 3.4 Fallback placeholder

While image generates:
- Cream `#FAF5EC` card, subtle paper-texture SVG overlay
- Title in Fraunces Bold
- Soft rust `#C36A48` pill showing timeMinutes

Component: `apps/native/components/RecipePlaceholder.tsx`

---

## 4. Recipe Normalization Rules

Port from `/Users/zach/Projects/sashafood/packages/convex/convex/lib/recipeNormalize.ts` and `groceryNormalize.ts` → `packages/shared/src/domain/`.

### 4.1 Ingredient parsing

Input: `{ item, quantity, notes }`. Output: `ParsedIngredient`.

1. Parse `quantity` via regex: `/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(\.\d+)?)\s*([a-zA-Z]+)?(?:\s+|$)(.*)$/` → `{ amount, unitRaw, remainder }`
2. Look up `unitRaw` in `UNIT_ALIASES` (tsp/teaspoon → 'tsp'). Unknown unit word → part of ingredient name.
3. Remainder → `normalizeIngredientName`:
   - Lowercase, strip parens + punctuation
   - Drop descriptors (fresh, large, chopped, minced…)
   - Singularize (tomatoes → tomato; asparagus → asparagus — don't strip `-us`)
4. Join → `canonicalKey`. Title-case → `name`.
5. `inferCategory(canonicalKey)` — **Pantry before Protein** so "chicken broth" hits Pantry. First-match wins.

### 4.2 Unit normalization

Aliases: tsp/tbsp/cup/oz/lb/g/kg/ml/l/clove/can/bunch/onion.

Families:
- `volume_tsp`: tsp=1, tbsp=3, cup=48
- `volume_ml`: ml=1, l=1000
- `weight_g`: g=1, kg=1000
- `weight_oz`: oz=1, lb=16

### 4.3 Category tagging

7 buckets: Produce, Dairy, Pantry, Protein, Frozen, Bakery, Other. Evaluation order matters (Pantry before Protein). First-match wins.

### 4.4 Tier assignment

```ts
export function deriveEnergyTier(activeMinutes: number): EnergyTier {
  if (activeMinutes <= 15) return 'brain-is-fried';
  if (activeMinutes <= 30) return 'after-work';
  if (activeMinutes <= 45) return 'got-energy';
  return 'weekend-project';
}
```

Active minutes = sum of `step.durationMin`. Passive waits **not counted** per prompt rules.

### 4.5 Tag extraction

**Cuisine:** LLM emits directly. Validate against `CUISINE_TO_TOP_LEVEL_GROUP`. Unknown → "International" + log.

**Dietary tags:** Post-hoc `inferDietaryTags(recipe)`:
- No animal products → `vegetarian`/`vegan`
- No gluten markers → `gluten-free`
- No dairy markers → `dairy-free`
- No nut keywords → `nut-free`

Best-effort — `review_needed` flag if ambiguous. **Not a market claim** — filter signal only.

### 4.6 Tool availability

Port `listUnavailableToolsMentioned` + `TOOL_ALIASES`. If recipe mentions a tool not in `UserPreferences.cookingTools`, **reject** at live-gen time. Cohort path: filter client-side with same rule (retain in DB for users who own the tool).

---

## 5. Deck Variety Algorithm

```ts
// packages/shared/src/domain/deckVariety.ts

export interface TonightPickInput {
  cohortRecipeIds: string[];                         // 12
  recipes: Record<string, RecipeCard>;
  userPreferences: UserPreferences;
  recentlyServed: Array<{ recipeId: string; lastServedAt: Timestamp }>;
  saveHistory: UserSavedRecipe[];
  nowMs: number;
}

export function pickTonight(input: TonightPickInput): RecipeCard[] {
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const recentlyServedSet = new Set(
    input.recentlyServed
      .filter((r) => input.nowMs - r.lastServedAt < SEVEN_DAYS)
      .map((r) => r.recipeId),
  );

  // 1. Candidates minus last-7-day repeats
  let candidates = input.cohortRecipeIds
    .map((id) => input.recipes[id])
    .filter((r): r is RecipeCard => !!r && !recentlyServedSet.has(r.id));

  if (candidates.length < 3) {
    candidates = input.cohortRecipeIds.map((id) => input.recipes[id]).filter(Boolean);
  }

  // 2. Score by preferences + save history
  const cuisineWeight = new Map<string, number>();
  for (const pref of input.userPreferences.cuisines) {
    cuisineWeight.set(pref.name, pref.state === 'love' ? 3 : pref.state === 'like' ? 1 : -10);
  }
  const savedCuisineHistogram = new Map<string, number>();
  for (const saved of input.saveHistory) {
    const r = input.recipes[saved.recipeId];
    if (!r) continue;
    savedCuisineHistogram.set(r.cuisine, (savedCuisineHistogram.get(r.cuisine) ?? 0) + 1);
  }

  const scored = candidates.map((r) => {
    const prefScore = cuisineWeight.get(r.cuisine) ?? 0;
    const affinityScore = (savedCuisineHistogram.get(r.cuisine) ?? 0) * 0.5;
    return { r, score: prefScore + affinityScore + Math.random() * 0.3 };
  });
  scored.sort((a, b) => b.score - a.score);

  // 3. Greedy pick 3 with cuisine spread
  const picks: RecipeCard[] = [];
  const usedCuisines = new Set<string>();
  for (const { r } of scored) {
    if (picks.length >= 3) break;
    if (usedCuisines.has(r.cuisine) && picks.length > 0) continue;
    picks.push(r);
    usedCuisines.add(r.cuisine);
  }

  // 4. Relaxed fallback
  if (picks.length < 3) {
    for (const { r } of scored) {
      if (picks.length >= 3) break;
      if (picks.some((p) => p.id === r.id)) continue;
      picks.push(r);
    }
  }
  return picks;
}
```

**Signal order:**
1. Exclude last-7-days repeats (hard filter).
2. Cuisine preference (`love`=+3, `like`=+1, `exclude`=-10 hard).
3. Save history affinity (+0.5 per prior save in cuisine).
4. Small randomization (+0..0.3).
5. Cuisine spread enforced greedily.

**Fallbacks:** Relax 7-day window, then allow cuisine dupes.

---

## 6. Shared Types Package Layout

```
packages/shared/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types/
    │   ├── index.ts         # barrel
    │   ├── primitives.ts
    │   ├── recipe.ts
    │   ├── deck.ts
    │   ├── grocery.ts
    │   ├── user.ts
    │   └── generation.ts
    └── domain/
        ├── recipeNormalize.ts
        ├── recipeTaxonomy.ts
        ├── groceryNormalize.ts
        ├── deckVariety.ts
        ├── energyTier.ts
        ├── dietaryTags.ts
        └── signature.ts     # SHA-256 recipe dedupe hash
```

`apps/native/` and `supabase/functions/` both depend on `@qook/shared`. Any type change is a breaking contract — PR checklist requires running migration script.

**Supabase-generated types:** `apps/native/services/supabase/database.types.ts` is row source of truth. Mappers at `apps/native/services/supabase/mappers/` (one per table). **Never cast rows directly to domain types** — always go through a mapper.

---

## 7. State Management

### 7.1 React Query (server state)

Query keys:
```
['user', userId]
['preferences', userId]
['tonight', userId, tier]
['cohort-deck', weekNumber, tier]
['weekly-deck', userId, weekStartDate]
['recipe', recipeId]
['saved-recipes', userId]
['grocery-items', userId]
['generation-session', sessionId]
```

**Invalidation:**
- Save/unsave recipe → invalidate `['saved-recipes', userId]` + `['tonight', userId]`
- Preferences update → invalidate `['tonight', userId]` + `['weekly-deck', userId]`
- Grocery checkoff → optimistic update, no refetch

**Stale times:**
- `['recipe', id]`: Infinity (cohort recipes are immutable)
- `['tonight', userId]`: 30min
- `['weekly-deck', userId]`: 24h
- `['generation-session', id]`: 0 (realtime)

### 7.2 Zustand (client UX state)

```
stores/swipeDeckStore.ts:
  currentIndex, pendingSwipes[], commit(), reset()

stores/generationStore.ts:
  voiceTranscriptDraft, activeSessionId, setTranscript(), startSession()

stores/uiStore.ts:
  bottomSheetOpen, activeTab, toastQueue
```

**Rule:** Survive app restart → React Query or AsyncStorage. Zustand = in-session UX only.

---

## 8. Generation State Machine

```
            ┌────────┐
            │  idle  │
            └───┬────┘
                │ user taps Generate
                ▼
      ┌─────────────────────┐
      │ collecting_context  │◄── (optional) voice recording
      └──────────┬──────────┘
                 │ context ready
                 ▼
      ┌─────────────────────┐
      │  generating_text    │ ← LLM draft + polish for N slots
      └──────────┬──────────┘
                 │ ≥1 slot success
                 ▼
      ┌─────────────────────┐
      │ generating_images   │ ← images arrive async via Realtime
      └──────────┬──────────┘
                 │ all images done OR 30s timeout
                 ▼
            ┌────────┐
            │ ready  │
            └────────┘

Any → error on: OpenRouter auth failure, all slots failed, user cancel.
```

| State | Screen | UI |
|---|---|---|
| `idle` | /eat | Tier picker + Generate CTA |
| `collecting_context` | /eat/context | Mic button, waveform |
| `generating_text` | /eat-review | 3 skeleton cards + shimmer |
| `generating_images` | /eat-review | 3 cards with title + placeholder |
| `ready` | /eat-review | 3 full cards, swipe enabled |
| `error` | /eat-review | Error card + retry, surviving cards usable |

**Cancel:** User leaves mid-gen → session runs server-side (tokens already paid). Recipes save with `source='live'`, `ownerId=userId` — visible in Saved next visit.

---

## 9. Data Migration from Sashafood

**Decision: Fresh start. No migration.**

Rationale:
- User count near zero (< 10 TestFlight testers).
- Convex schema uses `v.any()` for recipe content — strict migration needs per-row parsing.
- Image storage IDs are Convex-specific — re-upload anyway.
- Clerk → Supabase auth = re-auth flow for every user regardless.

**What we keep:** 24 Seedream PNGs at `apps/native/assets/meals-seed/v2/` (§3.1 warm-start).

**What we don't migrate:** user accounts, generated recipes, decks, saved recipes, groceries, gen history. Hand-export on request if any TestFlight user needs data.

---

## 10. Ordered Build Plan

### Week 1 — Skeleton & auth

Types: `User`, `UserPreferences`, `Preference`, primitives.

Files:
- `packages/shared/src/types/primitives.ts`, `user.ts`
- `apps/native/services/supabase/mappers/user.ts`
- Onboarding flow (§2.5), all 5 screens
- Seed a manual CohortDeck with 6 hand-entered recipes for demo

Outcome: Sign up, onboard, see hardcoded cohort.

### Week 2 — Recipe domain & cohort consumption

Types: `Recipe`, `Ingredient`, `RecipeStep`, `IngredientGroup`, `NutritionalEstimate`, `CohortDeck`, `WeeklyDeck`, `DeckItem`, `UserSavedRecipe`.

Files:
- `packages/shared/src/types/recipe.ts`, `deck.ts`
- `packages/shared/src/domain/recipeNormalize.ts` (full port)
- `packages/shared/src/domain/recipeTaxonomy.ts`
- `packages/shared/src/domain/deckVariety.ts`
- `packages/shared/src/domain/energyTier.ts`, `signature.ts`
- `apps/native/scripts/import-seed-cohort.ts`
- `apps/native/app/(tabs)/tonight.tsx`
- `supabase/functions/tonight/index.ts`
- `apps/native/app/recipe/[slug].tsx`

Outcome: Real Tonight picks from cohort; recipe detail view.

### Week 3 — Live generation & grocery

Types: `GenerationSession`, `GenerationItem`, `GenerationStatus`, `GroceryItem`, `GroceryImportPreview`, `AggregatedGroceryItem`.

Files:
- `packages/shared/src/types/generation.ts`, `grocery.ts`
- `packages/shared/src/domain/groceryNormalize.ts` (full port)
- `packages/shared/src/domain/dietaryTags.ts`
- `supabase/functions/generate-session/`, `generate-recipe/`, `generate-image/`, `grocery-normalize/`
- `apps/native/app/eat.tsx`, `/eat-review.tsx`, `/ingredients-review.tsx`, `(tabs)/shop.tsx`
- `apps/native/stores/swipeDeckStore.ts`, `generationStore.ts`

Outcome: Eat + Shop + Swipe Night working end-to-end.

### Week 4 — Cron, polish, TestFlight prep

- `supabase/functions/generate-cohort-decks/index.ts` + cron
- Saved/Cookbook, Settings wired
- Error/empty/offline states
- TestFlight submission

No new types — package frozen after week 3.

---

## 11. Open Questions & Risks

**Open questions (resolve before week 2):**

1. **Nutritional estimates in v1?** Type defined but LLM estimates are low-confidence. Recommend: ship field, hide UI behind feature flag; display only if `source === 'computed'`. Owner: frontend-architect.
2. **Recipe edits:** cohort recipes are shared (`ownerId=null`). User tweaks = clone-on-edit? Recommend: yes, set `source='user'`, `ownerId=userId`. Owner: backend-architect.
3. **Multi-user household:** schema is single-user. Household partners get separate decks in v1. Add `householdId` FK in v2. Flag for v2.
4. **Seedream commercial-use licensing** for shipped product. Owner: Zach.

**Cross-cutting deps:**

- **backend-architect:** SQL schema matches domain types one-to-one after snake_case. Any type change → regen `database.types.ts` + update mappers in lockstep.
- **ai-architect:** Prompt builder outputs JSON matching `Recipe` exactly. `ingredientGroups` role enum change → prompt update. Normalization is last defense against malformed LLM — strict, returns `null` not guess.
- **frontend-architect:** `RecipeCard` is minimal shape for lists. Don't fetch full `Recipe` until detail. Need more card fields → request expansion, don't hydrate full.
- **testflight-architect:** Fresh-start §9 → no user data carry-over tests. Warm-start §3.1 import script must be idempotent (runs once staging, once prod).

**Risks:**

- **Cohort deck staleness:** Sunday cron fails silently → same decks two weeks. Need observability alert.
- **Live generation latency:** P95 3-recipe Eat < 30s. Per-slot workers let slots resolve independently — client must render partial success.
- **Grocery LLM regression:** LLM-normalize step is optional (feature flag). Fallback to deterministic-only if it mis-merges (e.g. olive oil + sesame oil → oil). Preview fingerprint logs deltas — review week in prod before trusting.
- **Signature collisions:** Two users generate similar recipes → same hash. Good for dedupe. BUT cohort recipe signature matching user live-gen must NOT overwrite cohort row. Insert path: `INSERT ... ON CONFLICT (signature) DO NOTHING RETURNING id` — never upsert.

---

## Summary (3 sentences)

The plan defines 11 core TypeScript domain models (Recipe, CohortDeck/WeeklyDeck, GroceryItem, UserPreferences, GenerationSession, etc.) living in a `packages/shared/` workspace, a deterministic deck-variety algorithm that picks 3 Tonight recipes from a 12-card cohort while enforcing 7-day no-repeats and cuisine spread, and a 5-state generation state machine tying together Supabase Realtime updates to per-slot text + image workers. It ports the existing Convex `recipeNormalize.ts` and `groceryNormalize.ts` verbatim into the shared package, reuses the 24 Seedream PNGs as a warm-start cohort pool, and calls a fresh-start (no user data migration). Build order is strictly phased: Week 1 (user/auth), Week 2 (recipe + cohort Tonight flow), Week 3 (live gen + grocery + swipe night), Week 4 (cron + polish) — with types frozen after Week 3 and every downstream type change gated on regenerating Supabase types and mappers in lockstep.
