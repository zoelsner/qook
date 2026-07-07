# Phase 0 + Phase 1 — Protect the Work & Trust Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect the ~30 uncommitted files on `main` (toolchain + git identity + logical commits + push), then wire the five audit "trust fixes" so no recipe/shop affordance is dead UI.

**Architecture:** Phase 0 is pure ops: install `bun`, configure git identity, commit the working tree in four logical groups, push. Phase 1 edits five existing files in `apps/native` — each change reuses an existing store action, RN API, or design token; no new abstractions. State that must survive reload (`savedRecipeIds`) rides the existing `weekPlan` zustand `persist` store (version bumped 2 → 3).

**Tech Stack:** Expo 54 + TypeScript, bun workspaces (`apps/*`, `packages/*`), zustand v5 + `persist` v2 (AsyncStorage), React Native `Share`/`Alert`, lucide-react-native icons, ESLint, `tsc --noEmit`.

## Global Constraints

- **No test framework exists.** The accepted pattern is throwaway assertion scripts under `scripts/` run with `bun run scripts/<name>.ts` (they `process.exit(1)` on failure), plus `bun run typecheck` and `bun run lint` as the green bar. Every task gates on typecheck + lint.
- **Gate commands run from `apps/native`** — there are NO root-level `typecheck`/`lint` scripts (`/Users/zachoelsner/Projects/qook/package.json` has an empty/absent `scripts` block). Run gates as: `bun --cwd apps/native run typecheck` and `bun --cwd apps/native run lint`. (Agent shells reset cwd between calls; always pass `--cwd apps/native` or use an absolute path — never rely on a prior `cd`.)
- **Never `git add -A`.** Stage only the explicit paths named in each commit step. The tree may hold unrelated work-in-progress.
- **Repo root is `/Users/zachoelsner/Projects/qook`.** All `git` commands run there (use `git -C /Users/zachoelsner/Projects/qook …`).
- **`Recipe` type** lives at `packages/shared/src/types/recipe.ts`, re-exported as `@qook/shared`. Every recipe object has a stable `id: string`.
- **`weekPlan` store** is `apps/native/src/stores/weekPlan.ts`: zustand v5 `create()(persist(...))`, `name: 'qook.weekPlan.v1'`, `version: 2`, `partialize: (s) => ({ plan: s.plan })`, custom `merge`. Existing actions: `setEnergy`, `clearEnergy`, `setRecipes`, `setPickIndex`, `swapPick`, `commitSelection`, `appendRecipeAndSelect(date, recipe)`, `clearDay(date)`, `clearFuture`, `clearAll`. `clearDay(date: ISODate)` deletes the whole day entry.
- **Design tokens** come from `../../design` (`palette`, `spacing`, `screen`, `typeScale`). Do not hardcode colors that already exist as tokens.
- **NAME COLLISION (critical):** `RecipeDetailModal.tsx` line 27 already imports `Share` from `lucide-react-native` (the icon). The RN `Share` API MUST be imported under a different name (`import { Share as RNShare } from 'react-native'`). Using the bare `Share` identifier for the API will either shadow the icon or fail to compile.

---

### Task 1: Install bun and configure git identity

Phase 0 ops prerequisite. Without bun, no gate command runs; without git identity, commits are attributed to `zachoelsner@Mac-85.lan`.

**Files:** none (machine + git config only).

- [ ] **Step 1: Confirm bun is absent**

Run: `command -v bun || echo "NO BUN"`
Expected: `NO BUN`

- [ ] **Step 2: Install bun via the official installer**

Run: `curl -fsSL https://bun.sh/install | bash`
Expected: installer prints `bun was installed successfully` and a line like `Added "~/.bun/bin" to $PATH`. (If `curl` is blocked, fall back to `brew install oven-sh/bun/bun`.)

- [ ] **Step 3: Make bun available in this shell**

Run: `export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bun --version`
Expected: a version string (e.g. `1.x.x`). If `bun` is still not found, open a fresh shell (the installer appended the PATH export to the shell profile) and re-run `bun --version`.

- [ ] **Step 4: Configure git identity (global)**

```bash
git config --global user.name "Zach Oelsner"
git config --global user.email "zachoelsner@gmail.com"
```

- [ ] **Step 5: Verify git identity**

Run: `git config --global user.name && git config --global user.email`
Expected:
```
Zach Oelsner
zachoelsner@gmail.com
```

- [ ] **Step 6: Install workspace dependencies**

Run: `bun install --cwd /Users/zachoelsner/Projects/qook`
Expected: bun resolves and links the workspace; ends with `Done` / no error. A `bun.lockb` may be created — it is gitignored (`.gitignore` lists `bun.lockb`), so it will not appear in `git status`.

- [ ] **Step 7: Verify both gates pass on the current (uncommitted) tree**

Run: `bun --cwd /Users/zachoelsner/Projects/qook/apps/native run typecheck`
Expected: no output / exits 0 (tsc emits nothing on success).

Run: `bun --cwd /Users/zachoelsner/Projects/qook/apps/native run lint`
Expected: eslint exits 0 with no errors. (If pre-existing warnings appear, note them but do not fix unrelated files — the bar is "no new errors introduced.")

No commit in this task — it configures the machine, not the repo.

---

### Task 2: Commit the working tree in four logical groups

Commit the ~16 modified + ~14 untracked files as four themed commits, then push. Verify groupings against the actual diffs before staging. **Never `git add -A`.**

**Files:** all currently-uncommitted files under `/Users/zachoelsner/Projects/qook` (see `git status --short`).

**Decision — the 40 MB PDF:** `docs/meals/catalog.pdf` is **40 MB** (`ls -la docs/meals/`). Committing a 40 MB binary to a plain git repo is a mistake (permanent history bloat; no git-lfs configured). **Do not commit `catalog.pdf`.** Add it to `.gitignore` instead and commit only the text `catalog.html`. If Zach wants the PDF versioned later, that is a separate git-lfs decision.

**Decision — `.tmp/`:** There is currently **no `.tmp/` directory and no tracked `tmp` files** (`git ls-files | grep -i tmp` returns nothing). The brief's ".tmp must be gitignored not committed" concern is therefore moot for this tree. As a cheap safeguard, add a `.tmp/` line to `.gitignore` in the docs/scripts commit so a future scratch dir is never staged.

- [ ] **Step 1: Snapshot the current state**

Run: `git -C /Users/zachoelsner/Projects/qook status --short`
Expected (order may vary): 16 ` M` modified files and untracked entries including `apps/native/app/generation.tsx`, `app/household.tsx`, `app/preferences.tsx`, `src/components/ProteinChip.tsx`, `src/features/more/GenerationScreen.tsx`, `HouseholdScreen.tsx`, `PreferencesScreen.tsx`, `SettingsHeader.tsx`, `SettingsPrimitives.tsx`, `src/stores/prefs.ts`, `docs/meals/`, `docs/plan/AUDIT-2026-04-23.md`, `docs/plan/NEXT-SESSION.md`, `packages/shared/src/domain/categorizeIngredient.ts`, `scripts/generate-meal-catalog.ts`.

- [ ] **Step 2: Spot-check the diffs before grouping**

Run: `git -C /Users/zachoelsner/Projects/qook diff --stat`
Then per ambiguous file: `git -C /Users/zachoelsner/Projects/qook diff apps/native/app.json` etc.
Expected: `app.json` shows only splash/adaptive-icon `backgroundColor` `#FAF5EC → #FCF9F1`; confirms it belongs in the "misc screen/token" group, not prefs or shop. If any file's diff clearly belongs in a different group than prescribed below, move it and note the change.

- [ ] **Step 3: Gitignore the 40 MB PDF and the scratch dir**

Edit `/Users/zachoelsner/Projects/qook/.gitignore` — append this block at the end of the file (after the existing `# OS` / `Thumbs.db` block):

```gitignore
# Large binaries (regenerated from catalog.html; too big for plain git)
docs/meals/catalog.pdf

# Scratch
.tmp/
```

- [ ] **Step 4: Verify the PDF is now ignored**

Run: `git -C /Users/zachoelsner/Projects/qook status --short docs/meals/`
Expected: shows `docs/meals/` as containing `catalog.html` only (git lists the untracked dir; `catalog.pdf` must NOT appear once ignored — confirm with `git -C /Users/zachoelsner/Projects/qook check-ignore docs/meals/catalog.pdf`, which should echo the path).

- [ ] **Step 5: Commit (a) — prefs system**

```bash
cd /Users/zachoelsner/Projects/qook
git add apps/native/src/stores/prefs.ts \
        apps/native/app/preferences.tsx \
        apps/native/app/household.tsx \
        apps/native/app/generation.tsx \
        apps/native/src/features/more/PreferencesScreen.tsx \
        apps/native/src/features/more/HouseholdScreen.tsx \
        apps/native/src/features/more/GenerationScreen.tsx \
        apps/native/src/features/more/SettingsHeader.tsx \
        apps/native/src/features/more/SettingsPrimitives.tsx \
        apps/native/src/features/more/MoreScreen.tsx
git commit -m "$(cat <<'EOF'
feat(prefs): add preferences/household/generation settings system

More tab now routes to Preferences, Household, and Generation screens
backed by a persisted prefs store, with shared settings primitives.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
Expected: commit succeeds; `git status --short` no longer lists those paths.

*(Note: `MoreScreen.tsx` is `M` (modified) — the audit rewrote it to wire these routes, so it belongs with the prefs system. If `git diff` shows `MoreScreen.tsx` is instead dominated by unrelated changes, move it to group (c) — but per audit §1 "More tab" it is the prefs entry point.)*

- [ ] **Step 6: Commit (b) — shop categorizer**

```bash
cd /Users/zachoelsner/Projects/qook
git add packages/shared/src/domain/categorizeIngredient.ts \
        packages/shared/src/domain/index.ts \
        apps/native/src/features/shop/aggregateIngredients.ts \
        apps/native/src/features/shop/ShopScreen.tsx
git commit -m "$(cat <<'EOF'
feat(shop): ingredient categorizer with regex safety net

Adds categorizeIngredient() (re-exported from @qook/shared), wires it
into aggregateIngredients as the runtime fallback when parsed.category
is missing, and groups the Shop list by category.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
Expected: commit succeeds.

- [ ] **Step 7: Commit (c) — protein chip, fixtures, tokens, remaining screens**

```bash
cd /Users/zachoelsner/Projects/qook
git add apps/native/src/components/ProteinChip.tsx \
        apps/native/src/services/fixtures/recipes.ts \
        apps/native/src/stores/weekPlan.ts \
        apps/native/app.json \
        apps/native/src/design/spacing.ts \
        apps/native/src/components/FloatingTabBar.tsx \
        apps/native/src/features/auth/SignInScreen.tsx \
        apps/native/src/features/eat/ReviewRecipesScreen.tsx \
        apps/native/src/features/onboarding/OnboardingScreen.tsx \
        apps/native/src/features/recipe/RecipeDetailModal.tsx \
        apps/native/src/features/tonight/TonightScreen.tsx \
        apps/native/src/features/week/DayRow.tsx
git commit -m "$(cat <<'EOF'
feat(ui): ProteinChip, fixture refresh, spacing + screen polish

Adds the ProteinChip component, refreshes recipe fixtures (nutritional
estimates), and applies spacing/token and screen-level tweaks across
tonight, week, recipe, eat, auth, and onboarding.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
Expected: commit succeeds. (This commits `RecipeDetailModal.tsx` / `DayRow.tsx` / `ShopScreen.tsx`'s *current* state; Phase 1 modifies them on top with fresh commits.)

- [ ] **Step 8: Commit (d) — docs + scripts**

```bash
cd /Users/zachoelsner/Projects/qook
git add CLAUDE.md \
        docs/meals/catalog.html \
        docs/plan/AUDIT-2026-04-23.md \
        docs/plan/NEXT-SESSION.md \
        scripts/generate-meal-catalog.ts \
        .gitignore
git commit -m "$(cat <<'EOF'
docs: add audit, next-session notes, meal catalog + generator

Includes the 2026-04-23 fresh-eye audit, next-session plan, the meal
catalog HTML + its generator script, CLAUDE.md updates, and gitignores
the 40 MB catalog.pdf and a .tmp scratch dir.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
Expected: commit succeeds.

- [ ] **Step 9: Confirm the tree is clean except for intentionally-ignored files**

Run: `git -C /Users/zachoelsner/Projects/qook status --short`
Expected: empty output (no `catalog.pdf`, no leftover `??` or ` M` entries). If anything remains, inspect it — do not blanket-add.

- [ ] **Step 10: Push main to origin**

Run: `git -C /Users/zachoelsner/Projects/qook push origin main`
Expected: push succeeds to `https://github.com/zoelsner/qook.git`. (If the remote has commits you lack, `git pull --rebase origin main` first, re-run gates, then push. Never force-push.)

---

### Task 3: Persist the Save button (savedRecipeIds in weekPlan)

Wire the recipe modal's Save button (`RecipeDetailModal.tsx:96-109`, currently a local `useState(false)`) to a persisted `savedRecipeIds: string[]` in the `weekPlan` store, so a saved recipe survives reload.

**Files:**
- Modify: `apps/native/src/stores/weekPlan.ts`
- Modify: `apps/native/src/features/recipe/RecipeDetailModal.tsx:1,49,96-109`
- Test (throwaway): `scripts/test-saved-recipes.ts`

**Interfaces:**
- Produces (weekPlan store): new state field `savedRecipeIds: string[]` and new action `toggleSavedRecipe: (id: string) => void`. Persist `version` bumps `2 → 3`; `partialize` now returns `{ plan, savedRecipeIds }`.
- Consumes (modal): `useWeekPlan((s) => s.savedRecipeIds)`, `useWeekPlan((s) => s.toggleSavedRecipe)`.

**Design decision:** `savedRecipeIds` lives in `weekPlan` (not a new store) because the spec §2.1 and audit §6.1 both name `weekPlan` explicitly, and it already owns per-user persisted recipe state with a working `merge`. A separate favorites store would duplicate the hydration gate and persistence wiring for one `string[]`.

- [ ] **Step 1: Write the failing assertion script**

Create `/Users/zachoelsner/Projects/qook/scripts/test-saved-recipes.ts`:

```ts
// Throwaway assertion: toggleSavedRecipe adds then removes an id.
// Run: bun run scripts/test-saved-recipes.ts
import { useWeekPlan } from '../apps/native/src/stores/weekPlan';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const { toggleSavedRecipe } = useWeekPlan.getState();

assert(useWeekPlan.getState().savedRecipeIds.length === 0, 'starts empty');

toggleSavedRecipe('recipe-abc');
assert(
  useWeekPlan.getState().savedRecipeIds.includes('recipe-abc'),
  'adds id on first toggle',
);

toggleSavedRecipe('recipe-abc');
assert(
  !useWeekPlan.getState().savedRecipeIds.includes('recipe-abc'),
  'removes id on second toggle',
);

console.log('PASS: saved-recipes toggle');
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `bun run /Users/zachoelsner/Projects/qook/scripts/test-saved-recipes.ts`
Expected: FAIL — a TypeError / `undefined is not a function` on `toggleSavedRecipe`, or a crash because `savedRecipeIds` does not exist yet. (AsyncStorage is a no-op under bun; that's fine — the state slice is what we assert.)

- [ ] **Step 3: Add the state field + action to the store interface**

In `apps/native/src/stores/weekPlan.ts`, edit the `WeekPlanState` interface — add the field and action (place them right after `hasHydrated: boolean;`):

```ts
interface WeekPlanState {
  plan: Record<ISODate, DayPlan>;
  savedRecipeIds: string[];
  hasHydrated: boolean;

  setEnergy: (date: ISODate, tier: EnergyTier) => void;
  clearEnergy: (date: ISODate) => void;
  setRecipes: (date: ISODate, recipes: Recipe[]) => void;
  setPickIndex: (date: ISODate, idx: number) => void;
  swapPick: (date: ISODate) => void;
  commitSelection: (date: ISODate) => void;
  appendRecipeAndSelect: (date: ISODate, recipe: Recipe) => void;
  toggleSavedRecipe: (id: string) => void;
  clearDay: (date: ISODate) => void;
  clearFuture: () => void;
  clearAll: () => void;

  _setHydrated: () => void;
}
```

- [ ] **Step 4: Initialize the field and implement the action**

In the `create()(persist((set, get) => ({ ... })))` body, add the initial value next to `plan: {}` and the action next to `appendRecipeAndSelect`:

Change the top of the store object from:
```ts
      plan: {},
      hasHydrated: false,
```
to:
```ts
      plan: {},
      savedRecipeIds: [],
      hasHydrated: false,
```

And add this action immediately after the `appendRecipeAndSelect` implementation's closing `},` (before `clearDay:`):

```ts
      toggleSavedRecipe: (id) =>
        set((state) => ({
          savedRecipeIds: state.savedRecipeIds.includes(id)
            ? state.savedRecipeIds.filter((x) => x !== id)
            : [...state.savedRecipeIds, id],
        })),
```

- [ ] **Step 5: Bump persist version and persist the new field**

In the persist options object, change `version: 2,` to `version: 3,` and update the comment + `partialize`:

```ts
      name: 'qook.weekPlan.v1',
      storage: createJSONStorage(() => AsyncStorage),
      // v3 (2026-07-06): added savedRecipeIds. Bumping discards v2 caches so
      // rehydration starts with an empty saved list rather than an undefined
      // field. Safe to bump any time the persisted shape changes.
      version: 3,
      partialize: (state) => ({
        plan: state.plan,
        savedRecipeIds: state.savedRecipeIds,
      }),
```

Then update the custom `merge` so a persisted `savedRecipeIds` is restored (the current `merge` spreads `persistedState` over `currentState`, which already carries `savedRecipeIds` through — but make it explicit and undefined-safe). Replace the `merge` body's `return` with:

```ts
        const persistedSaved =
          (persistedState as Partial<WeekPlanState> | undefined)?.savedRecipeIds ?? [];

        return {
          ...currentState,
          ...(persistedState as object),
          plan: mergedPlan,
          savedRecipeIds: persistedSaved,
        };
```

- [ ] **Step 6: Run the assertion script — expect PASS**

Run: `bun run /Users/zachoelsner/Projects/qook/scripts/test-saved-recipes.ts`
Expected: `PASS: saved-recipes toggle`

- [ ] **Step 7: Wire the modal Save button to the store**

In `apps/native/src/features/recipe/RecipeDetailModal.tsx`:

Delete the local saved state — change line 49 from:
```ts
  const [saved, setSaved] = useState(false);
```
to (remove it entirely; keep `checkedIds` state on the next line intact):
```ts
  const savedRecipeIds = useWeekPlan((s) => s.savedRecipeIds);
  const toggleSavedRecipe = useWeekPlan((s) => s.toggleSavedRecipe);
  const saved = savedRecipeIds.includes(recipeId);
```

Then change the Save `IconPill`'s `onPress` (lines 96-101) from:
```tsx
            <IconPill
              onPress={() => {
                press();
                setSaved((s) => !s);
              }}
              accessibilityLabel="Save recipe"
            >
```
to:
```tsx
            <IconPill
              onPress={() => {
                press();
                toggleSavedRecipe(recipeId);
              }}
              accessibilityLabel={saved ? 'Unsave recipe' : 'Save recipe'}
            >
```

*(The `Bookmark` fill already reads `saved ? palette.ink : 'transparent'`, so it now reflects persisted state. `useState` may still be imported for `checkedIds` — leave the import.)*

- [ ] **Step 8: Run gates**

Run: `bun --cwd /Users/zachoelsner/Projects/qook/apps/native run typecheck`
Expected: exits 0, no output.

Run: `bun --cwd /Users/zachoelsner/Projects/qook/apps/native run lint`
Expected: exits 0. (If lint flags `useState` as unused, confirm `checkedIds` still uses it — it does, so no change needed.)

- [ ] **Step 9: Commit**

```bash
cd /Users/zachoelsner/Projects/qook
git add apps/native/src/stores/weekPlan.ts \
        apps/native/src/features/recipe/RecipeDetailModal.tsx \
        scripts/test-saved-recipes.ts
git commit -m "$(cat <<'EOF'
feat(recipe): persist Save button to weekPlan.savedRecipeIds

Save now toggles a persisted savedRecipeIds array (persist v3) instead
of local useState, so a saved recipe survives reload.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire the Share button to the RN Share API

The Share `IconPill` (`RecipeDetailModal.tsx:110-112`) currently only fires a haptic. Wire it to `Share.share()` with the recipe title + a placeholder URL.

**Files:**
- Modify: `apps/native/src/features/recipe/RecipeDetailModal.tsx:1-7,27,110-112`

**Interfaces:**
- Consumes: `recipe` (already in scope in `RecipeDetailModal`), RN `Share` API imported as `RNShare`.

**Critical:** `Share` from `lucide-react-native` is already imported (line 27) as the icon. Import the RN API as `RNShare` to avoid the collision (see Global Constraints).

- [ ] **Step 1: Import the RN Share API under an alias**

In `apps/native/src/features/recipe/RecipeDetailModal.tsx`, the top RN import block (lines 2-7) is:
```ts
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
```
Change it to add `Share as RNShare`:
```ts
import {
  Pressable,
  ScrollView,
  Share as RNShare,
  StyleSheet,
  View,
} from 'react-native';
```
*(Leave line 27 `import { X, Bookmark, Share } from 'lucide-react-native';` unchanged — that `Share` stays the icon.)*

- [ ] **Step 2: Add a share handler in the component body**

In `RecipeDetailModal`, add this handler next to `onCookTonight` (after its closing `};`, before the `return`):

```ts
  const onShare = async () => {
    if (!recipe) return;
    tap();
    try {
      await RNShare.share({
        title: recipe.title,
        message: `${recipe.title} — cooked with Qook\nhttps://qook.app/r/${recipe.slug}`,
      });
    } catch {
      /* user dismissed the share sheet */
    }
  };
```
*(`recipe.slug` is a required `string` on `Recipe` — see `packages/shared/src/types/recipe.ts:70`. The URL is an intentional placeholder per spec §2.2.)*

- [ ] **Step 3: Wire the Share IconPill onPress**

Change the Share `IconPill` (lines 110-112) from:
```tsx
            <IconPill onPress={() => tap()} accessibilityLabel="Share recipe">
              <Share size={16} color={palette.ink} strokeWidth={1.8} />
            </IconPill>
```
to:
```tsx
            <IconPill onPress={onShare} accessibilityLabel="Share recipe">
              <Share size={16} color={palette.ink} strokeWidth={1.8} />
            </IconPill>
```
*(The `<Share …>` inside is still the lucide icon — unchanged.)*

- [ ] **Step 4: Run gates**

Run: `bun --cwd /Users/zachoelsner/Projects/qook/apps/native run typecheck`
Expected: exits 0, no output.

Run: `bun --cwd /Users/zachoelsner/Projects/qook/apps/native run lint`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/zachoelsner/Projects/qook
git add apps/native/src/features/recipe/RecipeDetailModal.tsx
git commit -m "$(cat <<'EOF'
feat(recipe): wire Share button to RN Share API

Share now opens the native share sheet with the recipe title and a
placeholder qook.app URL (imported as RNShare to avoid colliding with
the lucide Share icon).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wire "Add all to list" to fork the recipe into the week plan

The "Add all to list" `Pressable` (`RecipeDetailModal.tsx:196-205`) has no `onPress`. Wire it to slot the recipe into the week plan so the Shop tab aggregates its ingredients.

**Files:**
- Modify: `apps/native/src/features/recipe/RecipeDetailModal.tsx:52,~63,196-205`

**Interfaces:**
- Consumes: `appendRecipeAndSelect` (already selected in the modal at line 52), `todayISO()` (already imported line 33), `useRouter().push`.

**Design decision (mechanism):** `aggregateIngredients` (`apps/native/src/features/shop/aggregateIngredients.ts:29-37`) only reads `day.recipes[day.pickIndex]` for every `date >= todayISO()`. The only existing store action that lands a recipe as an active pick on a given date is `appendRecipeAndSelect(date, recipe)`. So "Add all to list" calls `appendRecipeAndSelect(todayISO(), recipe)` — the same mechanism `onCookTonight` uses.

Trade-off I chose and why: the audit §6.1 suggested a "temp day," but no temp-day action exists, and inventing a far-future sentinel date would leave orphaned persistent state that Shop keeps aggregating with no cleanup path (Week only renders `upcomingDays(7)`, so the phantom day would be invisible-but-permanent). Reusing `appendRecipeAndSelect(today)` is minimal, matches an existing pattern, and is honest: the recipe is added to today and Shop picks it up. Its only side effect — it also becomes today's active pick — is acceptable for a v1 trust fix and mirrors "Cook tonight." After adding, we route the user to the Shop tab so the outcome is visible (the payoff of the button's label). This is a deliberate deviation from the audit's literal "temp day" wording; flagged for review.

- [ ] **Step 1: Add the handler in the component body**

In `RecipeDetailModal`, add next to `onCookTonight` (after `onShare` from Task 4, before `return`):

```ts
  const onAddAllToList = () => {
    if (!recipe) return;
    press();
    appendRecipeAndSelect(todayISO(), recipe);
    router.push('/(tabs)/shop');
  };
```
*(`appendRecipeAndSelect`, `router`, `press`, `todayISO` are all already in scope — lines 52, 41, 42, 33.)*

- [ ] **Step 2: Pass the handler down to RecipeBody**

`RecipeBody` currently receives `recipe`, `checkedIds`, `onToggleIngredient`. Add an `onAddAll` prop.

Change the `<RecipeBody … />` call (lines 79-87) from:
```tsx
          <RecipeBody
            recipe={recipe}
            checkedIds={checkedIds}
            onToggleIngredient={(id) => {
              select();
              setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
            }}
          />
```
to:
```tsx
          <RecipeBody
            recipe={recipe}
            checkedIds={checkedIds}
            onToggleIngredient={(id) => {
              select();
              setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
            }}
            onAddAll={onAddAllToList}
          />
```

- [ ] **Step 3: Accept the prop in RecipeBody and wire the Pressable**

Change the `RecipeBody` signature (lines 128-136) from:
```tsx
function RecipeBody({
  recipe,
  checkedIds,
  onToggleIngredient,
}: {
  recipe: Recipe;
  checkedIds: Record<string, boolean>;
  onToggleIngredient: (id: string) => void;
}) {
```
to:
```tsx
function RecipeBody({
  recipe,
  checkedIds,
  onToggleIngredient,
  onAddAll,
}: {
  recipe: Recipe;
  checkedIds: Record<string, boolean>;
  onToggleIngredient: (id: string) => void;
  onAddAll: () => void;
}) {
```

Then wire the "Add all to list" `Pressable` (lines 196-205) from:
```tsx
          <Pressable hitSlop={6}>
            <BodyText
              size={12}
              weight="semi"
              color={palette.primary}
              style={styles.sectionAction}
            >
              Add all to list
            </BodyText>
          </Pressable>
```
to:
```tsx
          <Pressable hitSlop={6} onPress={onAddAll} accessibilityRole="button">
            <BodyText
              size={12}
              weight="semi"
              color={palette.primary}
              style={styles.sectionAction}
            >
              Add all to list
            </BodyText>
          </Pressable>
```

- [ ] **Step 4: Run gates**

Run: `bun --cwd /Users/zachoelsner/Projects/qook/apps/native run typecheck`
Expected: exits 0, no output.

Run: `bun --cwd /Users/zachoelsner/Projects/qook/apps/native run lint`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/zachoelsner/Projects/qook
git add apps/native/src/features/recipe/RecipeDetailModal.tsx
git commit -m "$(cat <<'EOF'
feat(recipe): wire "Add all to list" to fork recipe into week plan

Adds the recipe to today via appendRecipeAndSelect so the Shop tab
aggregates its ingredients, then routes to Shop so the result is
visible. Reuses the existing action rather than a sentinel temp day
(no orphan-state cleanup path).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Guard the Shop dock empty / all-checked state

When every row is checked (`remaining === 0`), the "Shop with Instacart" button (`ShopScreen.tsx:339-345`) already passes `disabled`, and `openInstacart([])` early-returns silently (`shoppingShare.ts:44-46`) — a tap does nothing visible. Verify + harden: the button must read visually disabled (it does, via `PolishedButton` opacity 0.55 — see below), and `openInstacart`/`shareList`/`copyList` must never fire on an empty list.

**Files:**
- Modify: `apps/native/src/lib/shoppingShare.ts:44-53`
- Verify (no change expected): `apps/native/src/components/PolishedButton.tsx:44` and `ShopScreen.tsx:339-345`

**Verification finding (already correct):** `PolishedButton` applies `{ opacity: disabled ? 0.55 : 1 }` to its wrap (`PolishedButton.tsx:44`) and passes `disabled` to the inner `Pressable` (line 50). `ShopScreen` passes `disabled={remaining === 0}` (line 176/343) and only mounts the dock when `totalItems > 0` (line 170). So the visual-disabled state IS wired. The remaining gap is the silent no-op path in `openInstacart` (the audit's exact concern, `shoppingShare.ts:46`) — make it defensive with a user-visible toast so a tap on a stale-disabled state is never a dead tap.

- [ ] **Step 1: Write the failing assertion script**

Create `/Users/zachoelsner/Projects/qook/scripts/test-shop-empty-guard.ts`:

```ts
// Throwaway assertion: openInstacart on an empty list must not build a URL.
// We stub Linking.openURL to record whether it was called.
// Run: bun run scripts/test-shop-empty-guard.ts
import { Linking } from 'react-native';
import { openInstacart } from '../apps/native/src/lib/shoppingShare';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

let opened: string | null = null;
// @ts-expect-error test stub
Linking.openURL = async (url: string) => {
  opened = url;
};

openInstacart([]);
assert(opened === null, 'empty list does not open any URL');

console.log('PASS: shop empty guard');
```

- [ ] **Step 2: Run it — should already PASS (documents current behavior)**

Run: `bun run /Users/zachoelsner/Projects/qook/scripts/test-shop-empty-guard.ts`
Expected: `PASS: shop empty guard` — `openInstacart` already early-returns on empty (`if (!q) return;`). This script pins that contract so the toast change in Step 3 does not regress it.

*(If it FAILs because `react-native` cannot import under bun, replace the import with a direct minimal stub: define a local `openInstacart` copy is NOT allowed — instead skip the Linking stub and assert on the guard by passing `[]` and confirming no throw. Prefer the stub; only fall back if the RN import errors.)*

- [ ] **Step 3: Add a user-visible empty guard to the share helpers**

In `apps/native/src/lib/shoppingShare.ts`, change `openInstacart` (lines 44-53) from:
```ts
export function openInstacart(items: GroceryItem[]) {
  const q = formatSearchQuery(items);
  if (!q) return;
```
to:
```ts
export function openInstacart(items: GroceryItem[]) {
  const q = formatSearchQuery(items);
  if (!q) {
    Alert.alert('Nothing to shop yet', 'Check off fewer items or add a recipe to your week.');
    return;
  }
```
*(`Alert` is already imported at line 1: `import { Alert, Linking, Share } from 'react-native';`.)*

Apply the same guard to `openAmazonFresh` (lines 55-57) — change:
```ts
export function openAmazonFresh(items: GroceryItem[]) {
  const q = formatSearchQuery(items);
  if (!q) return;
```
to:
```ts
export function openAmazonFresh(items: GroceryItem[]) {
  const q = formatSearchQuery(items);
  if (!q) {
    Alert.alert('Nothing to shop yet', 'Check off fewer items or add a recipe to your week.');
    return;
  }
```

- [ ] **Step 4: Re-run the assertion script**

Run: `bun run /Users/zachoelsner/Projects/qook/scripts/test-shop-empty-guard.ts`
Expected: `PASS: shop empty guard` (the guard still returns before building a URL; the Alert is a no-op stub under bun / does not call `Linking.openURL`).

- [ ] **Step 5: Run gates**

Run: `bun --cwd /Users/zachoelsner/Projects/qook/apps/native run typecheck`
Expected: exits 0, no output.

Run: `bun --cwd /Users/zachoelsner/Projects/qook/apps/native run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/zachoelsner/Projects/qook
git add apps/native/src/lib/shoppingShare.ts \
        scripts/test-shop-empty-guard.ts
git commit -m "$(cat <<'EOF'
fix(shop): user-visible guard when store handoff has no items

openInstacart/openAmazonFresh now show a "Nothing to shop yet" alert
instead of a silent no-op. PolishedButton disabled styling verified
(opacity 0.55 on wrap) — no change needed.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Long-press a populated Week day to clear it

Add a long-press on a populated `DayRow` (`DayRow.tsx:53-92`, the `pick` branch) → `Alert.alert` confirm → `clearDay(date)`.

**Files:**
- Modify: `apps/native/src/features/week/DayRow.tsx:4,29-31,53-60`

**Interfaces:**
- Consumes: `clearDay(date: ISODate)` from `weekPlan` store (deletes the whole day entry — verified `weekPlan.ts:147-152`), RN `Alert`.

- [ ] **Step 1: Import Alert**

In `apps/native/src/features/week/DayRow.tsx`, change line 4 from:
```ts
import { Pressable, StyleSheet, View } from 'react-native';
```
to:
```ts
import { Alert, Pressable, StyleSheet, View } from 'react-native';
```

- [ ] **Step 2: Select the clearDay action**

In the `DayRow` component body, add next to the other store selectors (after `const swapPick = useWeekPlan((state) => state.swapPick);`, line 30):
```ts
  const clearDay = useWeekPlan((state) => state.clearDay);
```

- [ ] **Step 3: Add the confirm-and-clear handler**

In the `DayRow` body (before the `if (pick)` block, after `const pick = activePickFor(day);`, line ~39), add:
```ts
  const onClearDay = () => {
    if (!pick) return;
    tap();
    Alert.alert(
      'Clear this day?',
      `Remove "${pick.title}" from ${weekday}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => clearDay(date) },
      ],
    );
  };
```
*(`tap`, `weekday`, `pick`, `date` are all in scope. `clearDay` is added in Step 2.)*

- [ ] **Step 4: Wire onLongPress on the populated-day Pressable**

Change the populated-day `Pressable` (lines 54-60) from:
```tsx
      <Pressable
        onPress={() => onOpenRecipe(pick.id)}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={`${weekday}: ${pick.title}`}
      >
```
to:
```tsx
      <Pressable
        onPress={() => onOpenRecipe(pick.id)}
        onLongPress={onClearDay}
        delayLongPress={400}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={`${weekday}: ${pick.title}. Long-press to clear.`}
      >
```

- [ ] **Step 5: Run gates**

Run: `bun --cwd /Users/zachoelsner/Projects/qook/apps/native run typecheck`
Expected: exits 0, no output.

Run: `bun --cwd /Users/zachoelsner/Projects/qook/apps/native run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/zachoelsner/Projects/qook
git add apps/native/src/features/week/DayRow.tsx
git commit -m "$(cat <<'EOF'
feat(week): long-press a populated day to clear it

Long-pressing a day with a pick opens a destructive Alert confirm that
calls clearDay(date) — closes the audit's "no way to clear a pick from
Week" gap.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Sim-walk verification of all five fixes

Manual verification in the iOS simulator. No code changes; this task confirms the five trust fixes behave correctly end-to-end and both gates are green on the final tree.

**Files:** none.

- [ ] **Step 1: Final gate sweep**

Run: `bun --cwd /Users/zachoelsner/Projects/qook/apps/native run typecheck`
Expected: exits 0, no output.

Run: `bun --cwd /Users/zachoelsner/Projects/qook/apps/native run lint`
Expected: exits 0.

Run: `git -C /Users/zachoelsner/Projects/qook status --short`
Expected: empty (all Phase 1 work committed).

- [ ] **Step 2: Launch the app**

Run: `bun --cwd /Users/zachoelsner/Projects/qook/apps/native run ios`
Expected: Metro bundles, the iOS simulator boots the app to the Tonight (or onboarding) screen. Leave it running for the checklist.

- [ ] **Step 3: Manual checklist — walk each fix**

Verify each, checking the box only after you observe the behavior in the sim:

- [ ] **Save persists** — Open any recipe (Tonight hero → Cook tonight, or a Week pick). Tap the bookmark; it fills. Close the modal and reopen the *same* recipe → bookmark is still filled. Cmd+R (reload) → still filled. (Confirms `savedRecipeIds` persisted.)
- [ ] **Share opens the sheet** — In a recipe, tap the share icon → the native iOS share sheet appears with the recipe title and a `https://qook.app/r/<slug>` line. Dismiss it → no crash.
- [ ] **Add all to list** — In a recipe, tap "Add all to list" → the app navigates to the Shop tab and the recipe's ingredients appear in the aggregated list under their categories.
- [ ] **Shop empty guard** — On the Shop tab, check off every row. The "Shop with Instacart" button dims (opacity ~0.55) and does not react to taps. (Optional: temporarily flip the `disabled` off in a scratch build and tap with all checked → "Nothing to shop yet" alert appears — not required if the button is provably inert.)
- [ ] **Week long-press clear** — On the Week tab, long-press a day that has a pick (~0.4s) → "Clear this day?" alert. Tap **Clear** → the day reverts to empty energy chips. Long-press again + **Cancel** → the pick stays.

- [ ] **Step 4: Report result**

If any checklist item fails, capture the symptom, return to the owning task (3–7), fix, re-run that task's gates, re-commit, and re-run this sim-walk. If all five pass, Phase 0 + Phase 1 are done.

---

## Self-Review

**1. Spec coverage.** Spec §8 Phase 0: bun install (Task 1) ✓, git identity (Task 1) ✓, commit ~30 files in groups (Task 2) ✓, push (Task 2) ✓. Spec §2 / audit §6.1 trust fixes: Save→savedRecipeIds (Task 3) ✓, Share→RN API (Task 4) ✓, Add-all-to-list fork (Task 5) ✓, Shop dock empty guard + PolishedButton disabled verify (Task 6) ✓, Week long-press clear (Task 7) ✓. Sim-walk of all five (Task 8) ✓. No spec requirement in scope is unmapped.

**2. Placeholder scan.** No "TBD/TODO/handle edge cases/similar to Task N" — every code step shows complete code. The one intentional literal placeholder is the share URL (`https://qook.app/r/<slug>`), which the spec §2.2 explicitly calls a "placeholder URL."

**3. Type consistency.** `savedRecipeIds: string[]` and `toggleSavedRecipe(id: string)` are declared once (Task 3) and consumed with matching names/types in the modal (Task 3 Step 7). `clearDay(date: ISODate)` matches the store signature. `appendRecipeAndSelect(todayISO(), recipe)` matches `(date: ISODate, recipe: Recipe)`. `recipe.slug` and `recipe.title` are real `string` fields on `Recipe`. `RNShare` alias avoids the confirmed `Share` icon collision. Gate command form (`bun --cwd apps/native run …`) is used consistently because no root script exists.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-06-phase01-protect-and-trust.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks. Note: Task 2 (commits) and Tasks 3–7 (edits) touch the same files, so run them **serially**, not in parallel.

**2. Inline Execution** — execute tasks in this session with checkpoints.
