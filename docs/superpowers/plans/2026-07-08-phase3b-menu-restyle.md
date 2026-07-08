# Phase 3b — Menu Restyle + Carried Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the four carried backend/cleanup items from the Phase 3a final review, then restyle the five live screens into the approved "Menu" visual system (spec §1).

**Architecture:** Two ordered parts. **Part A** (Tasks 1–3) is non-visual and fully gate-verifiable — it runs while the simulator is unavailable: retry-on-open for failed images, an AbortController timeout on the image fetch, comment corrections, and a dead-allocation cleanup in ScreenShell. **Part B** (Tasks 4–12) builds the Menu design tokens and shared components first (`well` token, `MenuRow`, `Vignette` with the §6 cream-letter fallback, `EnergyChip`), then restyles screens in spec order (Tonight → Week → Shop → Find dinner → Recipe page), then executes the §1.4 deletions. **Task 13** is one batched machine-gated simulator walk that also clears the deferred Phase 3a Task 4 checks.

**Tech Stack:** React Native / Expo (TypeScript, zustand, TanStack Query, expo-router, react-native-svg) in `apps/native`; Supabase Edge Functions on Deno in `supabase/functions`; OpenRouter (`google/gemini-3.1-flash-image`).

## Global Constraints

Every task's requirements implicitly include this section.

- **Client gates must stay green (the bar for every task):** `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`.
- **No new unit tests in this phase, by design.** `bun` CANNOT import react-native/expo modules, so every Part B change (all RN components/screens) is unverifiable by unit test — its bar is typecheck + lint + the Task 13 sim-walk, matching the phase3a precedent. Part A touches one pure helper contract only if it changes (it does not — see Task 1), so `supabase/functions/generate-image/lock.test.ts` (3 tests) is left as-is. Do NOT stand up a client test runner (out of scope, disproportionate).
- **Never run the whole deno test tree.** `supabase/functions/generate-recipe/persist.test.ts` has a PRE-EXISTING `--allow-net` failure unrelated to this phase. If you must run a deno test, target the specific file.
- **Edge-function deploy** (Task 1 only): load secrets without echoing them, then deploy. Secrets live in `~/Projects/qook/.env.local`. Exact pattern:
  `set -a; source ~/Projects/qook/.env.local; set +a; supabase functions deploy generate-image --no-verify-jwt`
  Run from the worktree root (`~/Projects/qook-phase2`, linked to project `eehjclffugngogbvctib`). `--no-verify-jwt` is correct — auth is enforced in-code by `requireUser`. NEVER `cat`/`echo` `OPENROUTER_API_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, or the service-role key.
- **Garden palette (spec §1.1), verbatim:** cream `#FBF7EE` (ground) · well `#F1E9D9` (the live thing only) · forest `#2A3A26` (ink/primary) · rust `#C36A48` (accent/kicker/brushstroke/chip) · prussian `#3D5469` (rare utility). Type: Fraunces Bold display / Fraunces Italic asides / DM Sans body / JetBrains Mono kickers+values. Stat rows = 15px body label + mono value.
- **One-job rules (spec §1.2), enforce on every screen:** brushstroke under the screen title ONLY; at most one `ProteinChip` per screen; the beige `well` marks the single live thing; `EnergyChip` exists ONLY on the energy picker; at most one italic aside per screen; art budget = a full-bleed painting ONLY on the recipe page (everywhere else, circular `Vignette`).
- **No new dependencies.** Fonts already ship and load in `app/_layout.tsx` (`Fraunces_700Bold`, `Fraunces_500Medium_Italic`, DM Sans, JetBrains Mono) — do NOT add font packages. `react-native-svg` is already a dependency.
- **Stage commits by explicit path only** — never `git add -A`. This worktree (`~/Projects/qook-phase2`, branch `phase3a-wiring`) shares a tree with a live session holding UNCOMMITTED edits to `apps/native/package.json`, `apps/native/bun-test.d.ts`, `apps/native/src/services/streamEventRouter.test.ts`, and `deno.lock`. NEVER stage/commit/revert/touch those four. If new commits appear mid-work, ignore them and keep committing your one file set per task.
- **Merge-conflict expectation:** other sessions in the MAIN checkout (`~/Projects/qook`) hold uncommitted edits to `ShopScreen.tsx`, `RecipeDetailModal.tsx`, `weekPlan.ts`, `aggregateIngredients.ts`, `shoppingShare.ts`. This plan restyles `ShopScreen.tsx` and `RecipeDetailModal.tsx` (unavoidable) but does NOT touch the other three. Keep every diff in the two shared files as tight as the restyle allows — a conflict on merge is expected and accepted.
- **Out of scope:** image-library regen (Phase 4), auth (Phase 5), any `generate-recipe` change, navigation restructure. The `swipe-night/` archive stays (unrouted) — Task 12 only swaps its deleted-component imports.
- **YAGNI ladder** (apply before writing any code): (1) needs to exist? (2) already in the codebase? (3) stdlib? (4) existing dependency? (5) a one-liner? (6) only then, minimal new code.

## File Structure

**Part A (non-visual):**
- Modify `supabase/functions/generate-image/index.ts` — widen the atomic lock to `IN ('pending','failed')`; add a 60s AbortController timeout on the OpenRouter fetch; correct the `requireUser` cost-bound comment. `lock.ts`/`lock.test.ts` unchanged (helper contract is identical).
- Modify `apps/native/src/features/recipe/RecipeDetailModal.tsx` — fire `api.requestRecipeImage` on open when `imageStatus === 'failed'` (retry-on-open, no polling).
- Modify `apps/native/src/services/api.ts` — correct the `requestRecipeImage` cost/behavior comment.
- Modify `apps/native/src/components/ScreenShell.tsx` — stop building the `content` wrapper on the non-scrollable path.

**Part B tokens/components (built first, consumed by screens):**
- Modify `apps/native/src/design/colors.ts` — add `well`; set the cream ground to `#FBF7EE`.
- Modify `apps/native/src/design/typography.ts` — add `displayItalic` family token.
- Modify `apps/native/src/components/Text.tsx` — add `ItalicText` (rust Fraunces-italic aside).
- Create `apps/native/src/components/MenuRow.tsx` — dot-leader row (label · dotted leader · mono value).
- Create `apps/native/src/components/Vignette.tsx` — circular art crop + §6 cream-letter fallback.
- Modify `apps/native/src/components/ProteinChip.tsx` — add the `mini` size preset (Week today-card).
- Create `apps/native/src/components/SquareCheckbox.tsx` — hand-drawn square checkbox (Task 9; consumed by Shop + Recipe), replacing `PaintedCheckbox`.
- Create `apps/native/src/components/EnergyChip.tsx` — chunky pressed-shadow chip (Task 10; energy picker ONLY).

**Part B screens:**
- Modify `apps/native/src/features/tonight/TonightScreen.tsx`
- Modify `apps/native/src/features/week/WeekScreen.tsx` and `apps/native/src/features/week/DayRow.tsx`
- Modify `apps/native/src/features/shop/ShopScreen.tsx`
- Modify `apps/native/src/features/eat/EnergyPickerScreen.tsx`, `apps/native/src/components/EnergyPicker.tsx`, `apps/native/src/features/eat/ReviewRecipesScreen.tsx`
- Modify `apps/native/src/features/recipe/RecipeDetailModal.tsx`

**Part B deletions (§1.4):**
- Delete `apps/native/src/components/WashBackground.tsx`, `apps/native/src/components/painted/PaintedButton.tsx`, `apps/native/src/components/painted/PaintedCheckbox.tsx`; prune `apps/native/src/components/painted/index.ts` and the 7 dead exports in `apps/native/src/components/painted/Icon.tsx`; rewire `apps/native/src/features/swipe-night/SwipeNightScreen.tsx` to `PolishedButton`.

---

## Task 1: [PART A] generate-image — retry lock + fetch timeout + comment fix

**Files:**
- Modify: `supabase/functions/generate-image/index.ts`
- (Unchanged, do not touch: `supabase/functions/generate-image/lock.ts`, `supabase/functions/generate-image/lock.test.ts` — `lockOutcome()` still maps returned-rows → `claimed | skip`; widening the UPDATE's WHERE clause does not change that contract.)

**Interfaces:**
- Produces (behavior): a `POST generate-image` for a recipe whose `image_status` is `'failed'` now re-acquires the lock and regenerates; `'generating'`/`'ready'` still no-op. A stalled OpenRouter fetch aborts at 60s and the existing catch marks `image_status: 'failed'`.

- [ ] **Step 1: Widen the atomic lock to re-claim failed rows**

In `supabase/functions/generate-image/index.ts`, the lock block currently reads:

```ts
  // Atomic double-spend guard: exactly one caller flips pending → generating.
  // Repeat saves / duplicate fires and cross-user saves of the same global
  // recipe find status != 'pending' and no-op without paying again.
  const { data: locked, error: lockError } = await admin
    .from("recipes")
    .update({ image_status: "generating" })
    .eq("id", recipeId)
    .eq("image_status", "pending")
    .select("id");
```

Replace with (widen `.eq(...,"pending")` → `.in(..., ["pending","failed"])` and update the comment):

```ts
  // Atomic double-spend guard: exactly one caller flips pending|failed →
  // generating. Repeat saves / duplicate fires / cross-user saves of the same
  // global recipe find status NOT IN ('pending','failed') and no-op without
  // paying again. 'failed' is included so retry-on-open (spec §6) re-generates
  // an image that previously errored; 'ready'/'generating' still no-op.
  const { data: locked, error: lockError } = await admin
    .from("recipes")
    .update({ image_status: "generating" })
    .eq("id", recipeId)
    .in("image_status", ["pending", "failed"])
    .select("id");
```

- [ ] **Step 2: Add a 60s abort timeout on the OpenRouter image fetch**

Still in `index.ts`, the generation fetch currently reads:

```ts
    const resp = await fetch(OR_ENDPOINT, {
      method: "POST",
      headers: orHeaders(),
      body: JSON.stringify({
```

Add a `signal` so a hung connection cannot strand `image_status='generating'` until the platform wall-clock kill. 60s is comfortably above observed ~19s generations; on timeout `fetch` throws `TimeoutError`, which the existing `catch` at the bottom already maps to `image_status: 'failed'`:

```ts
    const resp = await fetch(OR_ENDPOINT, {
      method: "POST",
      // 60s hard cap: observed generations run ~19s; a hung fetch must not
      // strand image_status='generating'. On abort the catch below marks 'failed'.
      signal: AbortSignal.timeout(60_000),
      headers: orHeaders(),
      body: JSON.stringify({
```

- [ ] **Step 3: Correct the `requireUser` cost-bound comment**

The comment above `await requireUser(req);` currently ends:

```ts
  // control is instead the once-only atomic lock below, bounded by the
  // per-user generation quota (spec §10).
```

The real bound is not a per-user quota — it is one image per recipe *ever*, times the global count of pending/failed recipes. Replace those two lines with:

```ts
  // control is instead the atomic lock below: at most one paid generation per
  // recipe row ever (retry-on-open only re-fires the 'failed' state), so the
  // spend ceiling is the global pending/failed recipe count × ~6.8¢ — NOT a
  // per-user quota.
```

- [ ] **Step 4: Typecheck the edge function locally (no network)**

Run: `cd ~/Projects/qook-phase2/supabase/functions && deno check generate-image/index.ts`
Expected: no type errors. (Do NOT run `deno test` across the tree — see Global Constraints.)

- [ ] **Step 5: Deploy the function**

Run (from `~/Projects/qook-phase2`, secrets never echoed):
`set -a; source ~/Projects/qook/.env.local; set +a; supabase functions deploy generate-image --no-verify-jwt`
Expected: `Deployed Functions on project eehjclffugngogbvctib: generate-image`.

- [ ] **Step 6: Commit**

```bash
cd ~/Projects/qook-phase2 && git add supabase/functions/generate-image/index.ts && git commit -m "feat(generate-image): retry-on-open lock, 60s fetch timeout, cost-comment fix"
```

---

## Task 2: [PART A] Retry-on-open client fire + api.ts comment fix

**Files:**
- Modify: `apps/native/src/features/recipe/RecipeDetailModal.tsx`
- Modify: `apps/native/src/services/api.ts`

**Interfaces:**
- Consumes: `api.requestRecipeImage(recipeId: string): Promise<void>` (exists; mock no-op / live `functions.invoke`) and `recipe.imageStatus: ImageStatus` (`'pending'|'generating'|'ready'|'failed'`, required field on `Recipe`).

- [ ] **Step 1: Fire the image request on open when the prior attempt failed**

In `apps/native/src/features/recipe/RecipeDetailModal.tsx`, line 1 currently imports only `useState`:

```tsx
import React, { useState } from 'react';
```

Change to add `useEffect`:

```tsx
import React, { useEffect, useState } from 'react';
```

Then, immediately after the `useQuery` block that defines `recipe` (the `const { data: recipe, isLoading } = useQuery({...})` ending at line 48), add the retry-on-open effect. It re-fires the existing save-gated request exactly once when a recipe opens in the `'failed'` state; the server lock (Task 1) makes a duplicate fire a cheap no-op, so no client dedup/polling is needed:

```tsx
  // Retry-on-open (spec §6): if the previous image attempt failed, re-request
  // once when the recipe opens. The server's pending|failed→generating lock
  // makes duplicate fires cheap no-ops, so no polling/dedup is needed here.
  useEffect(() => {
    if (recipe?.imageStatus === 'failed') {
      void api.requestRecipeImage(recipeId);
    }
  }, [recipe?.imageStatus, recipeId]);
```

(`api` is already imported at line 31; leave the save-transition fire at line 123 as-is.)

- [ ] **Step 2: Correct the `requestRecipeImage` comment in api.ts**

In `apps/native/src/services/api.ts`, the doc comment above `export async function requestRecipeImage` (lines 199–204) overstates the bound and predates retry-on-open. Replace the whole comment block with:

```ts
// Save-gated hero art (Zach 2026-07-07: fire on save, not on cook-commit).
// Called but NOT awaited. The server's atomic pending|failed→generating lock
// means at most one paid generation per recipe row ever (retry-on-open only
// re-fires a 'failed' row), so the spend ceiling is the global pending/failed
// recipe count × ~6.8¢ — NOT a per-user quota. The client needs no dedup or
// polling: image_status is re-read on next open, and a 'failed' open re-fires
// this once (spec §6). No-op in mock mode: fixture recipes have no DB row.
```

- [ ] **Step 3: Gate**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both pass, no errors.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/qook-phase2 && git add apps/native/src/features/recipe/RecipeDetailModal.tsx apps/native/src/services/api.ts && git commit -m "feat(recipe): retry image request on open when prior attempt failed"
```

---

## Task 3: [PART A] ScreenShell — drop the dead `content` allocation

**Files:**
- Modify: `apps/native/src/components/ScreenShell.tsx`

`content` is built unconditionally but consumed only by the scrollable branch; the non-scrollable branch already renders `children` directly. Move the allocation inside the branch that uses it so nothing dead is built.

- [ ] **Step 1: Inline `content` into the scrollable branch**

Current (lines 18–47):

```tsx
  const insets = useSafeAreaInsets();
  const content = (
    <View style={{ paddingHorizontal: horizontalPadding }}>{children}</View>
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {scrollable ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: spacing.lg,
              paddingBottom: screen.bottom + insets.bottom,
            }}
            {...scrollProps}
          >
            {content}
          </ScrollView>
        ) : (
```

Replace down to `{content}` with (drop the `const content`, render the wrapper inline in the ScrollView):

```tsx
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {scrollable ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: spacing.lg,
              paddingBottom: screen.bottom + insets.bottom,
            }}
            {...scrollProps}
          >
            <View style={{ paddingHorizontal: horizontalPadding }}>{children}</View>
          </ScrollView>
        ) : (
```

Leave the non-scrollable branch (the `styles.fill` View and its comment) exactly as-is.

- [ ] **Step 2: Gate**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/qook-phase2 && git add apps/native/src/components/ScreenShell.tsx && git commit -m "refactor(ScreenShell): build content wrapper only on the scrollable path"
```

---

## Task 4: [PART B] Design tokens — `well`, cream ground, italic aside

**Files:**
- Modify: `apps/native/src/design/colors.ts`
- Modify: `apps/native/src/design/typography.ts`
- Modify: `apps/native/src/components/Text.tsx`

**Interfaces:**
- Produces: `palette.well` (`#F1E9D9`); `palette.background` becomes cream `#FBF7EE`; `fontFamily.displayItalic` (`'Fraunces_500Medium_Italic'`); `ItalicText` component (rust Fraunces-italic aside).

- [ ] **Step 1: Add `well` and align the cream ground**

In `apps/native/src/design/colors.ts`, the grounds block (lines 7–12) currently reads:

```ts
  // Grounds — lightened ~20% toward white for a quieter / airier feel
  background: '#FCF9F1',
  surface: '#FFFCF6',
```

Replace those three lines with (set the ground to the spec's confirmed cream and add the well; keep `surface` for existing cards until each screen restyle retires it):

```ts
  // Grounds — cream is the Menu ground on every screen (spec §1.1).
  background: '#FBF7EE',
  // "Alive right now" surface: today's card, selected proposal, shop dock.
  // Never decoration (spec §1.1 one-job rule).
  well: '#F1E9D9',
  surface: '#FFFCF6',
```

(`palette.utility` is already `#3D5469` = prussian; no change needed.)

- [ ] **Step 2: Add the italic display family token**

In `apps/native/src/design/typography.ts`, the `fontFamily` object currently ends:

```ts
  monoRegular: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_700Bold',
} as const;
```

Add `displayItalic` (the family is already loaded in `app/_layout.tsx`):

```ts
  monoRegular: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_700Bold',
  displayItalic: 'Fraunces_500Medium_Italic',
} as const;
```

- [ ] **Step 3: Add the `ItalicText` aside component**

In `apps/native/src/components/Text.tsx`, add an `italic` style to the `StyleSheet.create` block (after the `mono` style):

```ts
  italic: {
    fontFamily: fontFamily.displayItalic,
    color: palette.accent,
    includeFontPadding: false,
  },
```

Then append the component at the end of the file (reuses `DisplayTextProps`; defaults to rust accent per spec "rust-toned Fraunces italic"):

```tsx
// Italic aside — one per screen max (spec §1.2). Rust Fraunces italic.
export function ItalicText({
  size = typeScale.bodyMD,
  color,
  style,
  ...rest
}: DisplayTextProps) {
  return (
    <Text
      style={[
        styles.italic,
        { fontSize: size, lineHeight: Math.round(size * 1.4) },
        color ? { color } : null,
        style,
      ]}
      {...rest}
    />
  );
}
```

- [ ] **Step 4: Gate**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/qook-phase2 && git add apps/native/src/design/colors.ts apps/native/src/design/typography.ts apps/native/src/components/Text.tsx && git commit -m "feat(design): add well token, cream ground, ItalicText aside"
```

---

## Task 5: [PART B] MenuRow component (dot-leader)

**Files:**
- Create: `apps/native/src/components/MenuRow.tsx`

**Interfaces:**
- Produces: `MenuRow({ label, value, labelColor?, valueColor?, style? })` — the system's workhorse row: `label` (15px DM Sans) · dotted leader · `value` (13px JetBrains Mono). Consumed by Tonight stats, Week summary, Shop rows, Recipe stats/ingredients.

- [ ] **Step 1: Write the component**

Create `apps/native/src/components/MenuRow.tsx`:

```tsx
import React from 'react';
import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { palette } from '../design';
import { BodyText, Mono } from './Text';

export interface MenuRowProps {
  label: string;
  value: string;
  labelColor?: string;
  valueColor?: string;
  style?: StyleProp<ViewStyle>;
}

// Dot-leader row (spec §1.2): label · dotted leader · mono value. 15px body
// label, mono value. The dotted leader fills the gap and hangs on the baseline.
export function MenuRow({
  label,
  value,
  labelColor = palette.ink,
  valueColor = palette.textSecondary,
  style,
}: MenuRowProps) {
  return (
    <View style={[styles.row, style]}>
      <BodyText size={15} weight="medium" color={labelColor} numberOfLines={1} style={styles.label}>
        {label}
      </BodyText>
      <View style={styles.leader} />
      <Mono size={13} color={valueColor} style={styles.value}>
        {value}
      </Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 7,
  },
  label: {
    flexShrink: 1,
  },
  leader: {
    flex: 1,
    marginHorizontal: 8,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderStyle: 'dotted',
    borderColor: palette.statRuleColor,
  },
  value: {
    flexShrink: 0,
    letterSpacing: 0.4,
  },
});
```

- [ ] **Step 2: Gate**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both pass. (Visual baseline alignment of the dotted leader is confirmed in Task 13; if it rides high/low, adjust `styles.leader.marginBottom` only.)

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/qook-phase2 && git add apps/native/src/components/MenuRow.tsx && git commit -m "feat(components): add MenuRow dot-leader row"
```

---

## Task 6: [PART B] Vignette component (+ §6 letter fallback) and ProteinChip `mini`

**Files:**
- Create: `apps/native/src/components/Vignette.tsx`
- Modify: `apps/native/src/components/ProteinChip.tsx`

**Interfaces:**
- Produces: `Vignette({ size, localKey?, remoteUrl?, blurhash?, imageStatus?, title?, style? })` — circular art crop; renders a cream circle with the dish's first letter (Fraunces) when there is no real art OR `imageStatus === 'failed'` (spec §6). Consumed by Tonight (114px hero, 52px list), Week (52px), Find dinner (58px proposals).
- Produces: `ProteinChip` gains size `'mini'` (40px box) alongside `'sm' | 'md' | 'lg'`.

- [ ] **Step 1: Write the Vignette component**

Create `apps/native/src/components/Vignette.tsx`:

```tsx
import React from 'react';
import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import type { ImageStatus } from '@qook/shared';
import { FoodHeroImage } from './FoodHeroImage';
import { DisplayText } from './Text';
import { palette } from '../design';
import type { SeedMealKey } from '../lib/assets';

export interface VignetteProps {
  size: number;
  localKey?: SeedMealKey;
  remoteUrl?: string;
  blurhash?: string;
  imageStatus?: ImageStatus;
  title?: string;
  style?: StyleProp<ViewStyle>;
}

// Circular art crop — how meal art appears on every surface except the recipe
// page (spec §1.2). No real art, or a failed generation → cream circle with the
// dish's first letter in Fraunces (spec §6); retry-on-open is handled by the
// recipe modal, not here.
export function Vignette({
  size,
  localKey,
  remoteUrl,
  blurhash,
  imageStatus,
  title,
  style,
}: VignetteProps) {
  const hasArt = !!remoteUrl || !!localKey;
  const showLetter = !hasArt || imageStatus === 'failed';
  const radius = size / 2;

  if (showLetter) {
    const letter = (title?.trim().charAt(0) || '·').toUpperCase();
    return (
      <View
        style={[
          { width: size, height: size, borderRadius: radius },
          styles.letterWrap,
          style,
        ]}
        accessibilityLabel={title ? `${title}, no image yet` : 'no image yet'}
      >
        <DisplayText size={Math.round(size * 0.42)} color={palette.accentDeep}>
          {letter}
        </DisplayText>
      </View>
    );
  }

  return (
    <View style={[{ width: size, height: size, borderRadius: radius }, styles.crop, style]}>
      <FoodHeroImage
        localKey={localKey}
        remoteUrl={remoteUrl}
        blurhash={blurhash}
        width={size}
        height={size}
        cornerRadius={radius}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  crop: {
    overflow: 'hidden',
  },
  letterWrap: {
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
});
```

- [ ] **Step 2: Add the `mini` ProteinChip preset**

In `apps/native/src/components/ProteinChip.tsx`, the size type (line 7) currently reads:

```ts
export type ProteinChipSize = 'sm' | 'md' | 'lg';
```

Change to:

```ts
export type ProteinChipSize = 'mini' | 'sm' | 'md' | 'lg';
```

Then in `SIZE_PRESETS` (lines 22–29), add the `mini` entry at the top of the object:

```ts
  mini: { box: 40, number: 15, kicker: 6, kickerTop: 1, strokeWidth: 1.5 },
  sm: { box: 52, number: 20, kicker: 8, kickerTop: 1, strokeWidth: 1.8 },
```

- [ ] **Step 3: Gate**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/qook-phase2 && git add apps/native/src/components/Vignette.tsx apps/native/src/components/ProteinChip.tsx && git commit -m "feat(components): add Vignette (letter fallback) and ProteinChip mini size"
```

---

## Task 7: [PART B] Tonight screen restyle

**Files:**
- Modify: `apps/native/src/features/tonight/TonightScreen.tsx`

**Spec §1.3 (Tonight):** masthead (`qook` + date), kicker, title + brushstroke, 114px vignette with a small ProteinChip tucked under-left, stat MenuRows (Active time / Serves / Cuisine), bordered CTA, italic aside, "Also on the menu" rows with 52px vignettes + dot leaders. One-job budget on this screen: one ProteinChip (the hero), one brushstroke (the title), one italic aside, no full-bleed painting.

- [ ] **Step 1: Swap imports**

At the top of `TonightScreen.tsx`, replace the `FoodHeroImage` import with the new primitives and add `ItalicText` + `ProteinChip`:

```tsx
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { Vignette } from '../../components/Vignette';
import { MenuRow } from '../../components/MenuRow';
import { ProteinChip } from '../../components/ProteinChip';
import { BodyText, DisplayText, Mono, ItalicText } from '../../components/Text';
```

Remove the now-unused `import { FoodHeroImage } from '../../components/FoodHeroImage';` and the `import type { SeedMealKey } from '../../lib/assets';` if no longer referenced (the Vignette takes `localKey` as `string`-compatible `SeedMealKey`; keep the `SeedMealKey` import and pass `pick.localImageKey as SeedMealKey | undefined` to `Vignette`).

- [ ] **Step 2: Add the `qook` masthead above the kicker**

In `TonightHeader`, before the `styles.kickerRow` View, add a masthead line (brand + today's date). Insert at the top of the returned `<View style={styles.headerBlock}>`:

```tsx
      <View style={styles.masthead}>
        <DisplayText size={20} color={palette.ink}>qook</DisplayText>
        <Mono size={10} color={palette.textSecondary}>
          {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
        </Mono>
      </View>
      <View style={{ height: spacing.md }} />
```

Add to the stylesheet:

```ts
  masthead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
```

- [ ] **Step 3: Rebuild the populated hero as a 114px vignette + stat MenuRows + bordered CTA + aside**

Replace the entire `HeroPopulated` component body (lines 171–219) with:

```tsx
function HeroPopulated({
  pick,
  onOpen,
}: {
  pick: Recipe;
  onOpen: () => void;
}) {
  const protein = pick.nutritionalEstimate?.proteinG;
  return (
    <View style={styles.heroWell}>
      <View style={styles.heroArtRow}>
        <View>
          <Vignette
            size={114}
            localKey={pick.localImageKey as SeedMealKey | undefined}
            remoteUrl={pick.heroImageUrl}
            blurhash={pick.blurhash}
            imageStatus={pick.imageStatus}
            title={pick.title}
          />
          {protein != null ? (
            <ProteinChip proteinG={protein} size="sm" style={styles.heroProtein} />
          ) : null}
        </View>
        <View style={styles.heroTitleCol}>
          <DisplayText size={30} color={palette.ink} style={styles.heroTitle}>
            {pick.title}
          </DisplayText>
        </View>
      </View>

      <View style={{ height: spacing.md }} />
      <MenuRow label="Active time" value={`${pick.timeMinutes} min`} />
      <MenuRow label="Serves" value={String(pick.servings)} />
      <MenuRow label="Cuisine" value={pick.cuisine} />

      <View style={{ height: spacing.md }} />
      <PolishedButton
        label="Cook tonight"
        tone="ghost"
        onPress={onOpen}
        trailingIcon={<ArrowRight size={14} color={palette.primary} />}
      />
      <View style={{ height: spacing.sm }} />
      <ItalicText size={14} style={styles.heroAside}>
        Tonight&rsquo;s pick — you&rsquo;re one tap from the stove.
      </ItalicText>
    </View>
  );
}
```

Add to the stylesheet (and remove the now-dead `heroCard`, `heroCtaRow`, `readyChip`, `readyDot` styles):

```ts
  heroWell: {
    borderRadius: 18,
    padding: spacing.lg,
    backgroundColor: palette.well,
  },
  heroArtRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  heroProtein: {
    position: 'absolute',
    left: -6,
    bottom: -6,
  },
  heroTitleCol: {
    flex: 1,
    justifyContent: 'center',
  },
  heroAside: {
    textAlign: 'left',
  },
```

Note: the ghost-tone CTA is the spec's "bordered CTA"; the beige `heroWell` is this screen's single live thing.

- [ ] **Step 4: Rebuild "More picks" as "Also on the menu" vignette + dot-leader rows**

Replace the `MorePicks` component body (lines 221–282) with 52px vignette rows carrying a dot leader (label = title, value = `min`). The kicker text becomes "ALSO ON THE MENU":

```tsx
function MorePicks({
  picks,
  onSpotlight,
}: {
  picks: { recipe: Recipe; idx: number }[];
  onSpotlight: (idx: number) => void;
}) {
  return (
    <View>
      <View style={{ height: spacing.xl }} />
      <Mono size={10} bold color={palette.accentDeep}>
        ALSO ON THE MENU
      </Mono>
      <View style={{ height: spacing.sm }} />
      {picks.map(({ recipe, idx }) => (
        <Pressable
          key={recipe.id}
          onPress={() => onSpotlight(idx)}
          style={styles.menuRowPress}
          accessibilityRole="button"
          accessibilityLabel={`Spotlight ${recipe.title}`}
        >
          <Vignette
            size={52}
            localKey={recipe.localImageKey as SeedMealKey | undefined}
            remoteUrl={recipe.heroImageUrl}
            blurhash={recipe.blurhash}
            imageStatus={recipe.imageStatus}
            title={recipe.title}
          />
          <View style={styles.menuRowLeader}>
            <MenuRow label={recipe.title} value={`${recipe.timeMinutes} min`} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}
```

Add to the stylesheet (and remove the dead `morePicksHeader`, `morePicksHint`, `morePicksRow`, `morePickCard`, `morePickThumb`, `morePickTitle` styles):

```ts
  menuRowPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 6,
  },
  menuRowLeader: {
    flex: 1,
  },
```

Leave `TonightHeader` (kicker + title + brushstroke), `HeroEmpty`, `UpcomingStrip`, and `RecentCooks` structurally as-is (they already read as menu-lines); only their `fontFamily` import for `morePicksHint` is being removed — verify no remaining reference to `fontFamily` after the edit and drop the `import { fontFamily } from '../../design/typography';` line if now unused.

- [ ] **Step 5: Gate**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both pass. Resolve any unused-import lint error by deleting the offending import.

- [ ] **Step 6: Commit**

```bash
cd ~/Projects/qook-phase2 && git add apps/native/src/features/tonight/TonightScreen.tsx && git commit -m "feat(tonight): Menu restyle — vignette hero, stat MenuRows, also-on-the-menu rows"
```

---

## Task 8: [PART B] Week screen restyle (WeekScreen + DayRow)

**Files:**
- Modify: `apps/native/src/features/week/DayRow.tsx`
- Modify: `apps/native/src/features/week/WeekScreen.tsx`

**Spec §1.3 (Week):** days as menu lines — today = beige-well card (52px vignette, title, mini ProteinChip); populated day = name + pick line; empty = the existing 15/30/45 chips (ghost). CTA already "names the next action" and long-press-to-clear already exists (verified in `DayRow.onClearDay`). One-job budget: the single beige `well` is the today card; the single ProteinChip is `mini` on the today card; brushstroke stays under the title only.

- [ ] **Step 1: Add today-card art + mini ProteinChip to the populated DayRow**

In `apps/native/src/features/week/DayRow.tsx`, add imports:

```tsx
import { Vignette } from '../../components/Vignette';
import { ProteinChip } from '../../components/ProteinChip';
import type { SeedMealKey } from '../../lib/assets';
```

In the populated branch (`if (pick) { return (<Pressable ...>`), give the *today* row the beige-well treatment with a 52px vignette and a `mini` ProteinChip. Replace the populated `<Pressable ...>` opening and its `styles.pickArea` block so the row is:

```tsx
      <Pressable
        onPress={() => onOpenRecipe(pick.id)}
        onLongPress={onClearDay}
        delayLongPress={400}
        style={[styles.row, isToday(date) ? styles.todayRow : null]}
        accessibilityRole="button"
        accessibilityLabel={`${weekday}: ${pick.title}. Long-press to clear.`}
      >
        <View style={styles.dayLabel}>
          {isToday(date) ? <View style={styles.todayDot} /> : <View style={styles.todayDotSpacer} />}
          <Mono size={12} bold color={palette.ink}>
            {weekday}
          </Mono>
        </View>
        {isToday(date) ? (
          <Vignette
            size={52}
            localKey={pick.localImageKey as SeedMealKey | undefined}
            remoteUrl={pick.heroImageUrl}
            blurhash={pick.blurhash}
            imageStatus={pick.imageStatus}
            title={pick.title}
          />
        ) : null}
        <View style={styles.pickArea}>
          <BodyText size={14} weight="semi" color={palette.ink} numberOfLines={1}>
            {pick.title}
          </BodyText>
          <Mono size={10} color={palette.textSecondary}>
            {pick.cuisine} · {pick.timeMinutes} min
          </Mono>
        </View>
        {isToday(date) && pick.nutritionalEstimate?.proteinG != null ? (
          <ProteinChip proteinG={pick.nutritionalEstimate.proteinG} size="mini" />
        ) : null}
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            select();
            swapPick(date);
          }}
          hitSlop={10}
          style={styles.swapBtn}
          accessibilityLabel="Swap to another pick for this day"
        >
          <RefreshCw size={16} color={palette.accentDeep} strokeWidth={2} />
        </Pressable>
        <ChevronRight size={16} color={palette.textTertiary} strokeWidth={2} />
      </Pressable>
```

(This drops the protein text that was concatenated into the mono line — it now lives in the ProteinChip on the today row only; non-today rows keep the compact `cuisine · min` line.)

Add to the stylesheet:

```ts
  todayRow: {
    backgroundColor: palette.well,
    borderRadius: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 0,
    marginVertical: 4,
  },
```

- [ ] **Step 2: WeekScreen — retire the white card border in favor of the cream ground**

In `apps/native/src/features/week/WeekScreen.tsx`, the day list currently sits in a bordered white `styles.card`. Soften it to sit on the cream ground (remove the `surface` fill + border so the beige today-row reads as the live thing). Change `styles.card` (lines 206–212):

```ts
  card: {
    maxHeight: 380,
    borderRadius: 22,
  },
```

Leave the rest of WeekScreen (kicker, title + brushstroke, summary line, action-naming CTA) as-is — it already matches the menu-line direction.

- [ ] **Step 3: Gate**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/qook-phase2 && git add apps/native/src/features/week/DayRow.tsx apps/native/src/features/week/WeekScreen.tsx && git commit -m "feat(week): Menu restyle — today beige-well card with vignette and mini protein"
```

---

## Task 9: [PART B] Shop screen restyle + SquareCheckbox component

**Files:**
- Create: `apps/native/src/components/SquareCheckbox.tsx`
- Modify: `apps/native/src/features/shop/ShopScreen.tsx`

**Spec §1.3 (Shop):** category kickers, grocery MenuRows with hand-drawn square checkboxes (checked = filled + strikethrough), Instacart dock in a beige `well` with copy "Your list, ready to check out." One-job budget: the beige `well` is the dock; no ProteinChip, no vignette, no italic aside here. This is a shared/merge-conflict file — keep the diff tight.

- [ ] **Step 1: Create the hand-drawn square checkbox (replaces PaintedCheckbox)**

Create `apps/native/src/components/SquareCheckbox.tsx`. It reuses the hand-drawn square path from `ProteinChip` so the checkbox reads as the same drawn hand:

```tsx
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { palette } from '../design';

export interface SquareCheckboxProps {
  checked: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// Hand-drawn square checkbox (spec §1.4, replaces PaintedCheckbox). Same baked
// wobble path as ProteinChip. Checked = rust fill + a drawn check.
const BAKED_SQUARE =
  'M 8.4 4.6 C 18 3.8, 30 4.3, 40.5 3.9 C 52 4.1, 62.5 4.4, 66 5.1 C 67.7 14, 68.2 26, 67.6 38 C 68.1 50, 67.9 60, 66.6 66 C 56.5 67.6, 44 67.3, 32 67.8 C 20 67.5, 10.5 67.9, 5.8 66.4 C 4.6 55, 4.3 44, 4.7 32 C 4.3 22, 4.7 12.5, 5.6 5.4 C 6.1 5.1, 7.1 4.8, 8.4 4.6 Z';
const CHECK_PATH = 'M 20 38 L 32 50 L 52 24';

export function SquareCheckbox({ checked, size = 22, style }: SquareCheckboxProps) {
  return (
    <View style={[{ width: size, height: size }, style]} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <Svg width={size} height={size} viewBox="0 0 72 72" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path
          d={BAKED_SQUARE}
          stroke={palette.accentDeep}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={checked ? palette.accent : 'none'}
        />
        {checked ? (
          <Path d={CHECK_PATH} stroke={palette.surface} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ) : null}
      </Svg>
    </View>
  );
}
```

- [ ] **Step 2: Swap Shop's rows to MenuRow-style with SquareCheckbox**

In `apps/native/src/features/shop/ShopScreen.tsx`, replace the import `import { PaintedCheckbox } from '../../components/painted';` with:

```tsx
import { SquareCheckbox } from '../../components/SquareCheckbox';
```

In `ShopRow`, replace `<PaintedCheckbox checked={checked} size={22} />` (line 257) with `<SquareCheckbox checked={checked} size={22} />`. The row already renders name + strikethrough-on-check + quantity, which satisfies the grocery-MenuRow rule; leave the rest of `ShopRow` as-is.

- [ ] **Step 3: Move the Instacart dock into a beige well with the spec copy**

In `ShopDock`, change the dock container to the beige `well` and set the dock title/subtitle to the spec copy. Replace the `styles.dock` `backgroundColor: palette.surface` with `palette.well`:

```ts
  dock: {
    borderRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: palette.well,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
    shadowColor: '#2A3A26',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
  },
```

And change the dock subtitle (line 325–327) from `{remaining} items left · delivered via Instacart` to the spec copy:

```tsx
          <BodyText size={13} color={palette.textSecondary} weight="medium">
            Your list, ready to check out.
          </BodyText>
```

Leave the `EST $` block, the `Shop with Instacart` CTA (already disabled at `remaining === 0`, satisfying spec §2.4), and the copy/share/AmazonFresh fallback row as-is.

- [ ] **Step 4: Gate**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/qook-phase2 && git add apps/native/src/components/SquareCheckbox.tsx apps/native/src/features/shop/ShopScreen.tsx && git commit -m "feat(shop): Menu restyle — square checkboxes and beige-well Instacart dock"
```

---

## Task 10: [PART B] Find dinner restyle — EnergyChip + energy picker + proposals

**Files:**
- Create: `apps/native/src/components/EnergyChip.tsx`
- Modify: `apps/native/src/components/EnergyPicker.tsx`
- Modify: `apps/native/src/features/eat/ReviewRecipesScreen.tsx`

**Spec §1.3 (Find dinner):** kicker, "How much energy?" title, chunky chips (the app's single toy, `EnergyChip`, energy picker ONLY), "The kitchen proposes" — 3 proposal rows with 58px vignettes; the selected proposal sits in a beige `well`; CTA names the pick; aside "swaps are free — try another." `EnergyPickerScreen.tsx` already has kicker + title + brushstroke + intro copy — leave that shell; only its `EnergyPicker` body changes.

- [ ] **Step 1: Create the EnergyChip (chunky pressed-shadow chip)**

Create `apps/native/src/components/EnergyChip.tsx`:

```tsx
import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { palette } from '../design';
import { DisplayText, Mono } from './Text';

export interface EnergyChipProps {
  minutes: number;
  tierWord: string;
  active: boolean;
  color: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

// Chunky pressed-shadow chip — the app's single toy (spec §1.2), energy picker
// ONLY. A colored base sits under the face; pressing sinks the face onto it.
export function EnergyChip({ minutes, tierWord, active, color, onPress, style }: EnergyChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${minutes} minutes, ${tierWord}`}
      style={[styles.wrap, style]}
    >
      {({ pressed }) => (
        <View style={[styles.base, { backgroundColor: active ? color : palette.glassBorder }]}>
          <View
            style={[
              styles.face,
              active
                ? { backgroundColor: color, borderColor: color }
                : { backgroundColor: palette.surface, borderColor: palette.glassBorder },
              { transform: [{ translateY: pressed ? 4 : 0 }] },
            ]}
          >
            <DisplayText size={30} color={active ? palette.surface : palette.ink} style={styles.number}>
              {minutes}
            </DisplayText>
            <Mono size={9} bold color={active ? palette.surface : palette.textTertiary} style={styles.word}>
              {tierWord}
            </Mono>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  base: { borderRadius: 18, paddingBottom: 4 },
  face: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  number: { letterSpacing: -1, lineHeight: 32 },
  word: { letterSpacing: 1 },
});
```

- [ ] **Step 2: Rebuild EnergyPicker as a row of EnergyChips**

In `apps/native/src/components/EnergyPicker.tsx`, replace the vertical radio-row stack. Swap the body of the map to render `EnergyChip` in a horizontal row. Replace the whole returned `<View style={styles.stack}>...</View>` with:

```tsx
  return (
    <View style={styles.row}>
      {ENERGY_TIERS.map((tier) => {
        const active = value === tier;
        const colors = energyTierColors(tier);
        return (
          <EnergyChip
            key={tier}
            minutes={ENERGY_TIER_MINUTES[tier].value}
            tierWord={ENERGY_TIER_MINUTES[tier].qualifier.toUpperCase()}
            active={active}
            color={colors.text}
            onPress={() => {
              if (tier !== value) {
                void select();
                onChange(tier);
              }
            }}
          />
        );
      })}
    </View>
  );
```

Add `import { EnergyChip } from './EnergyChip';` at the top; replace the entire `StyleSheet.create({...})` with just:

```ts
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
```

Remove the now-unused imports on the old rows (`BodyText`, `radius`, and any label constant no longer referenced) — let lint tell you which; delete exactly those.

- [ ] **Step 3: Rebuild ReviewRecipesScreen as "The kitchen proposes" — 3 vignette rows, selected in a well**

In `apps/native/src/features/eat/ReviewRecipesScreen.tsx`, the current single-card preview shows only `recipes[pickIdx]` with a full-bleed `FoodHeroImage`. Replace it with three tappable proposal rows (58px vignette + title/meta), the selected one wrapped in a beige `well`, a CTA that names the pick, and one italic aside. Swap imports first: remove `FoodHeroImage`, add:

```tsx
import { Vignette } from '../../components/Vignette';
import { BodyText, DisplayText, Mono, ItalicText } from '../../components/Text';
```

Replace the render branch that begins `!pick ? null : (` and its `<>...</>` (lines 115–172) with:

```tsx
        <>
          <Mono size={10} bold color={palette.accentDeep}>
            THE KITCHEN PROPOSES
          </Mono>
          <View style={{ height: spacing.sm }} />
          {recipes.map((r, i) => {
            const selected = i === pickIdx;
            return (
              <Pressable
                key={r.id}
                onPress={() => {
                  if (i !== pickIdx) { select(); setPickIdx(i); }
                }}
                style={[styles.proposalRow, selected ? styles.proposalSelected : null]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${r.title}${selected ? ', selected' : ''}`}
              >
                <Vignette
                  size={58}
                  localKey={r.localImageKey as SeedMealKey | undefined}
                  remoteUrl={r.heroImageUrl}
                  blurhash={r.blurhash}
                  imageStatus={r.imageStatus}
                  title={r.title}
                />
                <View style={styles.proposalText}>
                  <DisplayText size={19} color={palette.ink} numberOfLines={1} style={styles.proposalTitle}>
                    {r.title}
                  </DisplayText>
                  <Mono size={10} color={palette.textSecondary} numberOfLines={1}>
                    {r.cuisine} · {r.timeMinutes} min · serves {r.servings}
                  </Mono>
                </View>
              </Pressable>
            );
          })}
          <View style={{ height: spacing.lg }} />
          <PolishedButton
            label={`Cook the ${firstWord(pick.title)} →`}
            tone="forest"
            onPress={handleCook}
          />
          <View style={{ height: spacing.sm }} />
          <ItalicText size={14} style={{ textAlign: 'center' }}>
            swaps are free — try another.
          </ItalicText>
        </>
```

Add a tiny local helper above the `styles` block (kept inline — YAGNI; it names the pick in the CTA):

```tsx
function firstWord(title: string): string {
  return title.trim().split(/\s+/)[0]?.toLowerCase() || 'this';
}
```

Add to the stylesheet (and remove the dead `card`/`cardTitle` styles):

```ts
  proposalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 16,
  },
  proposalSelected: {
    backgroundColor: palette.well,
  },
  proposalText: {
    flex: 1,
    gap: 2,
  },
  proposalTitle: {
    letterSpacing: -0.3,
    lineHeight: 22,
  },
```

The old `handleSwap` and the "Try another" pressable are superseded by tapping a proposal row; delete `handleSwap` and its `Try another` pressable (they no longer render). Keep `handleCook`, `handleRegenerate`, `handleClose`, and the error branch as-is.

- [ ] **Step 4: Gate**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both pass. Delete any import/function flagged unused.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/qook-phase2 && git add apps/native/src/components/EnergyChip.tsx apps/native/src/components/EnergyPicker.tsx apps/native/src/features/eat/ReviewRecipesScreen.tsx && git commit -m "feat(eat): Menu restyle — chunky EnergyChips and beige-well proposal rows"
```

---

## Task 11: [PART B] Recipe page restyle (RecipeDetailModal)

**Files:**
- Modify: `apps/native/src/features/recipe/RecipeDetailModal.tsx`

**Spec §1.3 (Recipe page):** full-bleed painting top (THE payoff — this is the only screen with a full-bleed image; the current `FoodHeroImage` at `cornerRadius={0}` already is this), kicker (tier · cuisine), title + brushstroke + a default ProteinChip beside it, stat MenuRows, INGREDIENTS as MenuRows with the square checkbox, THE MOVES with Fraunces numerals, "Add all to list →" CTA. §6: if the hero image failed, show the cream-letter fallback in the hero slot. One-job budget: one ProteinChip (beside the title), one brushstroke (under the title). This is a shared/merge-conflict file — keep the diff scoped to these regions.

- [ ] **Step 1: Swap imports**

Add the Menu primitives and drop `PaintedCheckbox`:

```tsx
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { MenuRow } from '../../components/MenuRow';
import { ProteinChip } from '../../components/ProteinChip';
import { SquareCheckbox } from '../../components/SquareCheckbox';
```

In the existing `from '../../components/painted'` import, remove `PaintedCheckbox` (keep `PaintedDivider`, `IconPill`, `GlassChip`, `IconCookingSteam`).

- [ ] **Step 2: Full-bleed hero with §6 letter fallback**

In `RecipeBody`, the hero currently always renders `FoodHeroImage`. Guard it so a failed generation shows the cream-letter payoff instead of the default fixture image. Replace the `<View style={styles.hero}>...</View>` block (lines 171–180) with:

```tsx
      <View style={styles.hero}>
        {recipe.imageStatus === 'failed' ? (
          <View style={[styles.heroImage, styles.heroLetter]}>
            <DisplayText size={140} color={palette.accentDeep}>
              {(recipe.title.trim().charAt(0) || '·').toUpperCase()}
            </DisplayText>
          </View>
        ) : (
          <FoodHeroImage
            localKey={recipe.localImageKey as SeedMealKey | undefined}
            remoteUrl={recipe.heroImageUrl}
            blurhash={recipe.blurhash}
            height={340}
            cornerRadius={0}
            style={styles.heroImage}
          />
        )}
      </View>
```

Add to the stylesheet:

```ts
  heroLetter: {
    backgroundColor: palette.well,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

- [ ] **Step 3: Title block — kicker (tier · cuisine), title + brushstroke + ProteinChip beside it**

Replace the `styles.titleBlock` View (lines 182–199), which currently uses two `GlassChip`s and a bare title, with a mono kicker, and a title row that carries a brushstroke under the title and a default ProteinChip to its right:

```tsx
      <View style={styles.titleBlock}>
        <Mono size={10} bold color={palette.accentDeep}>
          {ENERGY_TIER_SUBTITLE[recipe.tier].toUpperCase()} · {recipe.cuisine.toUpperCase()}
        </Mono>
        <View style={styles.titleRow}>
          <View style={styles.titleCol}>
            <DisplayText size={34} style={styles.title}>
              {recipe.title}
            </DisplayText>
            <BrushstrokeUnderline
              width={200}
              color={palette.accent}
              strokeWidth={2.6}
              style={styles.titleUnderline}
            />
          </View>
          {recipe.nutritionalEstimate?.proteinG != null ? (
            <ProteinChip proteinG={recipe.nutritionalEstimate.proteinG} size="md" />
          ) : null}
        </View>
      </View>
```

Add to the stylesheet (and remove the dead `chipRow` and `tierDot` styles):

```ts
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titleCol: {
    flex: 1,
  },
  titleUnderline: {
    marginTop: 4,
  },
```

- [ ] **Step 4: Stats as MenuRows**

Replace the centered `styles.statsRow` block (lines 201–216) — which uses `Stat`/`statRule` columns — with stacked MenuRows. Protein now lives in the ProteinChip (Step 3), so drop it from the stats:

```tsx
      <View style={styles.statsSection}>
        <MenuRow label="Active time" value={`${recipe.timeMinutes} min`} />
        <MenuRow label="Serves" value={String(recipe.servings)} />
        <MenuRow label="Ingredients" value={String(ingredientCount)} />
      </View>
```

Add to the stylesheet:

```ts
  statsSection: {
    marginTop: spacing.lg,
    paddingHorizontal: 24,
  },
```

The `Stat` component and the `statsRow`/`stat`/`statValue`/`statLabel`/`statRule` styles become dead — delete the `Stat` function (lines 351–362) and those styles.

- [ ] **Step 5: Ingredients use the square checkbox**

In `IngredientRow`, replace `<PaintedCheckbox checked={checked} size={22} />` (line 383) with `<SquareCheckbox checked={checked} size={22} />`. The row already renders name + strikethrough-on-check + quantity (the ingredient MenuRow). Leave the rest of `IngredientRow` as-is.

- [ ] **Step 6: "THE MOVES" section header with Fraunces numerals**

The steps section header (lines 254–260) currently reads `steps`. Change the kicker text to the spec's "THE MOVES"; the step numbers already render `String(idx + 1).padStart(2, '0')` inside `Mono` — switch those to Fraunces numerals (`DisplayText`) per spec. In the step header row (lines 268–271), replace:

```tsx
                <Mono size={11} bold color={palette.accent}>
                  {String(idx + 1).padStart(2, '0')}
                </Mono>
```

with:

```tsx
                <DisplayText size={22} color={palette.accent} style={styles.moveNumeral}>
                  {String(idx + 1).padStart(2, '0')}
                </DisplayText>
```

and change the section kicker text from `steps` to `the moves`. Add to the stylesheet:

```ts
  moveNumeral: {
    letterSpacing: -0.5,
    lineHeight: 24,
  },
```

- [ ] **Step 7: Gate**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both pass. Delete any import/style flagged unused (e.g. `GlassChip` if no longer referenced).

- [ ] **Step 8: Commit**

```bash
cd ~/Projects/qook-phase2 && git add apps/native/src/features/recipe/RecipeDetailModal.tsx && git commit -m "feat(recipe): Menu restyle — kicker, brushstroke+protein title, MenuRow stats, THE MOVES numerals"
```

---

## Task 12: [PART B] §1.4 deletions — WashBackground, PaintedButton, PaintedCheckbox, dead Icon exports

**Files:**
- Delete: `apps/native/src/components/WashBackground.tsx`
- Delete: `apps/native/src/components/painted/PaintedButton.tsx`
- Delete: `apps/native/src/components/painted/PaintedCheckbox.tsx`
- Modify: `apps/native/src/components/painted/index.ts`
- Modify: `apps/native/src/components/painted/Icon.tsx`
- Modify: `apps/native/src/features/swipe-night/SwipeNightScreen.tsx`

**Verified usage (grep):** `WashBackground` is referenced only by its own file (dead). `PaintedButton` is imported only by the unrouted `swipe-night` archive. `PaintedCheckbox` is imported only by `ShopScreen`/`RecipeDetailModal`, both migrated to `SquareCheckbox` in Tasks 9/11. Of the 13 `Icon.tsx` named exports, 7 are unused everywhere: `IconClose`, `IconBookmark`, `IconShare`, `IconHeart`, `IconPaintedHeart`, `IconRefresh`, `IconArrowRight`. The other 6 (`IconCookingSteam`, `IconTabTonight`, `IconTabWeek`, `IconTabShop`, `IconTabMore`, `IconApple`) are used by the tab bar / recipe dock / sign-in and STAY (removing them is a navigation/functional change, out of scope).

**RESOLVED AMBIGUITY:** spec §1.4 says "painted `Icon.tsx` named exports" but §1.4 also keeps the `swipe-night` archive, and the tab bar depends on the `IconTab*` exports. A wholesale deletion would break navigation (out of scope). This task therefore deletes only the 7 provably-dead exports and keeps the 6 functional ones. Flagged for Zach below.

- [ ] **Step 1: Rewire the swipe-night archive off PaintedButton**

In `apps/native/src/features/swipe-night/SwipeNightScreen.tsx`, change the painted import (lines 8–11) to keep only `PaintedDivider`, and add `PolishedButton`:

```tsx
import { PaintedDivider } from '../../components/painted';
import { PolishedButton } from '../../components/PolishedButton';
```

Replace the two `<PaintedButton .../>` usages with `PolishedButton` (drop the `size="md"` prop, which `PolishedButton` does not take; preserve labels/tones/handlers/icon):

The "Save" button becomes:

```tsx
          <PolishedButton
            label="Save"
            tone="forest"
            onPress={() => {
              select();
              handleLike();
            }}
            leadingIcon={<Heart size={14} color={palette.surface} fill={palette.surface} />}
            style={{ flex: 1 }}
          />
```

The "Shuffle again" button becomes:

```tsx
      <PolishedButton label="Shuffle again" tone="rust" onPress={onReset} />
```

- [ ] **Step 2: Delete the three dead component files**

```bash
cd ~/Projects/qook-phase2 && git rm apps/native/src/components/WashBackground.tsx apps/native/src/components/painted/PaintedButton.tsx apps/native/src/components/painted/PaintedCheckbox.tsx
```

- [ ] **Step 3: Prune painted/index.ts**

In `apps/native/src/components/painted/index.ts`, remove the `PaintedButton` and `PaintedCheckbox`/`PaintedRadio` export lines and their `export type` lines, and remove the 7 dead icon names from the `export { ... } from './Icon';` list. The Icon export block becomes exactly:

```ts
export {
  IconCookingSteam,
  IconTabTonight,
  IconTabWeek,
  IconTabShop,
  IconTabMore,
  IconApple,
} from './Icon';
export type { IconProps } from './Icon';
```

Leave the `PaintedDivider`, `PaintedArcSpinner`, and `IconPill`/`GlassChip` exports intact.

- [ ] **Step 4: Delete the 7 dead functions from Icon.tsx**

In `apps/native/src/components/painted/Icon.tsx`, delete the function definitions for `IconClose`, `IconBookmark`, `IconShare`, `IconHeart`, `IconPaintedHeart`, `IconRefresh`, `IconArrowRight`. Keep `IconProps`, `IconCookingSteam`, `IconTabTonight`, `IconTabWeek`, `IconTabShop`, `IconTabMore`, `IconApple`, and any shared imports still referenced by the survivors.

- [ ] **Step 5: Gate**

Run: `export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`
Expected: both pass — no dangling imports of the deleted symbols anywhere.

- [ ] **Step 6: Commit**

```bash
cd ~/Projects/qook-phase2 && git add apps/native/src/components/painted/index.ts apps/native/src/components/painted/Icon.tsx apps/native/src/features/swipe-night/SwipeNightScreen.tsx && git commit -m "chore: delete WashBackground/PaintedButton/PaintedCheckbox and 7 dead Icon exports (spec 1.4)"
```

(The `git rm` from Step 2 is staged already; it rides into this commit — confirm with `git status` that only the intended paths are staged before committing.)

---

## Task 13: [MACHINE] Batched simulator walk

**[MACHINE — needs Zach + simulator; also covers the deferred Phase 3a Task 4 checks: loading-screen text visible, save→image E2E ~7–15¢, Instacart dock handoff]**

This is the single visual/interactive verification for all of Part B plus the three checks deferred from Phase 3a Task 4. It requires Zach and the iOS simulator; do NOT run it unattended, and gate the paid image call on Zach's explicit OK.

- [ ] **Step 1: Preconditions**

Confirm gates are green on the branch head (`export PATH="$HOME/.local/bin:$PATH" && cd apps/native && bun run typecheck && bun run lint`) and that `apps/native` runs in `live` mode (`Constants.expoConfig.extra.apiMode === 'live'`). Launch the iOS simulator build and watch the Metro/console log.

- [ ] **Step 2: Deferred Phase 3a checks**
  - **Loading-screen text:** start a Find-dinner flow; confirm `GenerationLoadingScreen` shows "Cooking up ideas…" and the streamed titles (the ScreenShell fix must render text, not a height-0 box).
  - **save→image E2E [COST — get Zach's OK first, ~7–15¢]:** save a recipe; confirm the console logs an `or_cost` image line and the hero image appears on next open. Then, with a recipe left in `'failed'` state, re-open it and confirm retry-on-open re-fires (a fresh image request logs; image eventually appears).
  - **Instacart dock handoff:** on Shop with items, tap "Shop with Instacart" and confirm the handoff opens.

- [ ] **Step 3: Menu per-screen verification against spec §1.3 / one-job rules (§1.2)**
  - **Tonight:** `qook`+date masthead; kicker; title + brushstroke (only there); 114px vignette with a small ProteinChip under-left; Active time / Serves / Cuisine as dot-leader MenuRows; bordered (ghost) CTA; exactly one italic aside; "Also on the menu" rows with 52px vignettes + dot leaders. Confirm exactly one ProteinChip and one brushstroke on screen.
  - **Week:** today row is a beige-`well` card with a 52px vignette + mini ProteinChip; other days are menu lines / ghost 15-30-45 chips; long-press a populated day → "Clear this day?"; CTA names the next action.
  - **Shop:** category kickers; grocery rows with hand-drawn square checkboxes (checked = rust fill + strikethrough); Instacart dock in a beige `well` reading "Your list, ready to check out."; dock disabled at zero unchecked.
  - **Find dinner:** chunky `EnergyChip`s that visibly sink on press (and appear on NO other screen); "The kitchen proposes" 3 rows with 58px vignettes; the selected proposal sits in a beige `well`; CTA names the pick ("Cook the … →"); aside "swaps are free — try another."
  - **Recipe page:** full-bleed painting at top (the ONLY full-bleed image in the app); kicker (tier · cuisine); title + brushstroke + default ProteinChip beside it; stat MenuRows; INGREDIENTS as MenuRows with square checkboxes; THE MOVES with Fraunces numerals; "Add all to list →". Force a `'failed'` recipe and confirm the hero shows the cream-letter fallback (spec §6).
  - **Cross-screen:** the beige `well` marks exactly one live thing per screen; no leftover watercolor `WashBackground`; no `PaintedButton`/`PaintedCheckbox` visuals remain.

- [ ] **Step 4: Record the result**

Report pass/fail per screen to Zach with screenshots. File any visual nits (e.g. dot-leader baseline, vignette letter sizing) as follow-ups; only spec-rule violations block. No commit in this task (verification only).

---

## Self-Review

**1. Spec coverage.**
- §1.1 tokens (cream/well/forest/rust/prussian) → Task 4 (`well`, cream ground; prussian already `palette.utility`). ✓
- §1.2 components — MenuRow → Task 5; Vignette → Task 6; ProteinChip (`ProteinSquare`) reused + `mini` → Task 6; BrushstrokeUnderline (exists) → used, unchanged; EnergyChip → Task 10; ItalicText aside → Task 4; SquareCheckbox → Task 9. One-job rules enforced per screen + Task 13. ✓
- §1.3 per-screen: Tonight → Task 7; Week → Task 8; Shop → Task 9; Find dinner → Task 10; Recipe → Task 11. ✓
- §1.4 deletions → Task 12. ✓
- §6 image-fail letter vignette + retry-on-open → Vignette (Task 6), recipe hero fallback (Task 11), retry-on-open client+lock (Tasks 1–2). ✓
- Carried cleanup: retry lock + timeout + comments (Task 1–2), ScreenShell dead alloc (Task 3). ✓
- Deferred Phase 3a Task 4 checks → Task 13. ✓

**2. Placeholder scan.** Screen tasks quote exact current line anchors and give complete replacement JSX + styles; new components are full files. The only "let lint tell you which import to delete" instructions are bounded, deterministic cleanups after a specified edit, not open-ended work. No TBD/TODO. The `swipe-night` rewire uses the exact current props read from the file.

**3. Type consistency.** `Vignette` props (`size`, `localKey`, `remoteUrl`, `blurhash`, `imageStatus`, `title`) are used identically in Tasks 7/8/10. `ProteinChip` size `'mini'` added in Task 6 is consumed in Task 8; `'sm'` (Tonight), `'md'` (Recipe) are existing. `MenuRow({label,value})` signature is consistent across Tasks 5/7/8/11. `SquareCheckbox({checked,size})` created in Task 9, reused in Task 11. `EnergyChip({minutes,tierWord,active,color,onPress})` created and consumed in Task 10. `ItalicText` (Task 4) consumed in Tasks 7/10. `palette.well` (Task 4) consumed in Tasks 7/8/9/10/11.

**Resolved spec ambiguities (flag for Zach):**
- Spec's `ProteinSquare` == the existing `ProteinChip` (hand-drawn square, protein grams). Kept the existing name to avoid a rename ripple (YAGNI); sizes map default→`md`, small→`sm`, mini→new `mini`.
- Cream ground: code shipped `#FCF9F1` (a deliberate ~20%-lightened variant); spec §1.1 says `#FBF7EE`. Task 4 aligns to spec — a subtle global warm/deepening shift, trivially revertible.
- §1.4 "Icon.tsx named exports" deletion scoped to the 7 provably-dead exports; the 6 used by navigation/sign-in stay (removing them is out-of-scope navigation work).

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-08-phase3b-menu-restyle.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks. Run Part A (Tasks 1–3) first while the simulator is unavailable, then Part B tokens/components (4–6) before any screen task, then screens (7–11), then deletions (12), then the machine-gated walk (13) with Zach.
2. **Inline Execution** — execute in this session with checkpoints.

Which approach?
