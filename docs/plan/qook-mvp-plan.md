# Qook MVP Execution Plan — Tonight Dashboard + Week Planner + Shop Derivation

**Status:** Ready for execution. Two adversarial review passes complete.
**Companion doc:** [qook-mvp-design-decisions.md](./qook-mvp-design-decisions.md) — product thesis, design system, rationale.

## Implementation handoff status (2026-04-22, Opus completion pass)

All 10 moves are now implemented in the working tree. Typecheck and lint are clean. Sim walk is pending manual verification on-device.

### Complete

- **Move 1** — 4-tab shell: `Tonight / Week / Shop / More`. IconTabTonight/Week simplified for 22px, Saved icon removed, swipe-night route deleted (component folder kept as archival per design-decisions doc).
- **Move 2** — `src/features/week/weekDates.ts` with local civil-date helpers (never `toISOString().slice(0, 10)`).
- **Move 3** — `useWeekPlan` (persisted, hydration-guarded via `hasHydrated` + custom `merge` + `onRehydrateStorage`) and `useBatchSession` (ephemeral, per-date status tracking). Stores expose selectors `activePickFor`, `recentSelectedDays`, `taggedFutureOrTodayDays`, and `pendingOrFailedDates`.
- **Move 4** — `EnergyPicker` minutes-first: tier label as small-caps kicker, minutes as DisplayText hero (36), "min or less / or more" inline. `ENERGY_TIER_MINUTES` const added to `src/types/energy.ts`.
- **Move 5** — `ReviewRecipesScreen` rewritten pick-one: single 320px hero, "Cook tonight" commits `setRecipes + setPickIndex + commitSelection(today)` then lands on Recipe Modal. "Try another" cycles pickIdx locally without regeneration. Regenerate icon still triggers a fresh draft.
- **Move 6** — CTA copy refresh applied in `EnergyPickerScreen` (See dinner ideas) + `ContextStep` (Find tonight's dinner / Use this, find dinner / Skip — surprise me). Tonight's copy handled by Move 8 rewrite.
- **Move 7** — Week screen: tag-day chips (15/30/45), resumable batch draft (flips status back to `drafting` on retry so UI renders), inline per-day title + swap icon once drafted. Hydration-gated CTA. Calls `api.generateRecipesForEnergy` directly; no `generationSession` coupling.
- **Move 8** — Tonight dashboard: hero populated (pick recipe + Cook now + Try another) vs empty ("What's for dinner?" + Find tonight's dinner), Upcoming strip (next 3 days, tap populated → modal, tap untagged → Week tab), Recent cooks (past `selectedAt`, newest first). Gated on `hasHydrated` to avoid empty-state flash.
- **Move 9** — Shop derivation: `aggregateIngredients` handles `IngredientGroup[]` nested shape via `flatMap(g => g.items)`, dedupes on `parsed.canonicalKey` (fallback to lowercased `item`), surfaces `category` from `parsed?.category`. ShopScreen reads from `useWeekPlan`, groups by `GroceryCategory`, has empty state linking to Week, preserves Instacart/copy/share via a `ShopItem → GroceryItem` adapter.
- **Move 10** — Recipe Modal "Cook tonight" dock wired to `appendRecipeAndSelect(today, recipe)` → non-destructive (appends if new, moves pickIndex if already present), marks `selectedAt`, routes back to Tonight. Button reads "Cooking tonight ✓" and disables when the open recipe is already today's active pick.

### Verification

- `bun run typecheck` — clean
- `bun run lint` — clean (single array-type warning fixed)
- **Sim walk on-device still pending.** Run the end-to-end verification block at the bottom of this doc. Particular cross-checks:
  - Hydration gate: cold-launch Tonight with a stored pick should NOT flash the empty state.
  - Batch resume: fail mid-draft (toggle airplane mode mid-way), tap Resume → only pending/failed days re-run, not the successful ones.
  - Non-destructive modal cook: open a recent-cooks recipe, tap "Cook tonight" → Tonight hero updates to that recipe AND the prior drafted trio is preserved (swap cycle grows by 1 if the recipe was new to `weekPlan[today].recipes`).
  - Local date math: set device clock to 11:45pm and change to 12:15am — confirm the day label and hero rollover on local midnight, not UTC.

### Artifacts of the partial Codex pass that are now superseded

- The older fixture-backed `ShopScreen` using `api.getGroceries()` is fully replaced by weekPlan derivation. The old `api.getGroceries`/`toggleGrocery` exports still exist on `services/api.ts` but are no longer called from Shop; leaving them for now since removing touches mock fixtures out of scope.
- `getTonightPlan` still exists on the API surface but Tonight no longer calls it. Keep for future server-driven hydration (per design-decisions doc "Reasons to not touch").
- `apps/native/.expo/types/router.d.ts` was hand-patched to reflect the `saved → week` rename and the `swipe-night` deletion. Next `expo start` will regenerate this file cleanly; the patch is cosmetic for typecheck continuity only.

---

## Context

End-to-end MVP product loop in one coherent pass:

- **Tonight = dashboard**: today's hero pick + upcoming planned days + recent cooked meals. Not just "tonight's recipe" — you can look forward (Week is feeding your dinners) and look back (meals you've actually cooked, one tap from becoming tonight again).
- **Week = energy-map planner**: tag upcoming days with 15/30/45-minute chips, batch-draft real recipes for all tagged days, swap per day inline. Week IS its own review surface — no separate review screen.
- **Shop = derived list**: aggregates ingredients across `weekPlan` entries that are today-or-future and not yet marked cooked.
- **More = settings drawer**: unchanged.
- **Saved disappears as a top-nav concept** — history lives inside Tonight, sourced from `weekPlan` entries with `selectedAt` on past dates.

**One unified store** (`useWeekPlan`, persisted via AsyncStorage) powers all four tabs. Tonight reads from it. Week writes to it. Shop aggregates from it. Recipe Modal can append to it.

This plan addresses both Codex adversarial review passes (see [qook-mvp-design-decisions.md § Codex findings](./qook-mvp-design-decisions.md#codex-review-history)).

---

## Locked architectural decisions

Every decision here is a "why" payoff in the companion design-decisions doc. Short-form:

- **`generationSession` stays single-target (Tonight's flow only).** Week uses its own orchestrator.
- **Batch orchestration via `batchDraft(dates, options)`** — a standalone async function + ephemeral `batchSession` store. Resumable: tracks per-date success/failure, retry defaults to only missing/failed dates.
- **`useWeekPlan` persisted** via `zustand/middleware/persist` + `AsyncStorage`. Hydration-guarded (`hasHydrated` flag, interactive actions deferred until rehydrate completes; custom `merge` preserves in-memory writes).
- **`selectedAt` ≠ `cookedAt`**. Selection happens when a recipe is assigned to a date. Cooking is a separate explicit mark (deferred to v1.1; for v1 we treat past-dated `selectedAt` entries as "cooked"). Shop includes today-and-future regardless of `selectedAt`.
- **Non-destructive "Cook this tonight"** from Recipe Modal: appends recipe to existing `weekPlan[today].recipes` and sets `pickIndex` to its position. Never overwrites the existing trio.
- **Local civil dates only**. `weekDates.ts` uses `getFullYear/getMonth/getDate`, never `toISOString().slice(0, 10)`.
- **Tab icons simplified for 22px.** Verified on-device before merging Move 1.
- **`ingredients` is `IngredientGroup[]`**, not flat. Shop aggregator uses `recipe.ingredients.flatMap(g => g.items)` and dedupes by `parsed?.canonicalKey` with fallback to lowercased `item`.

---

## Data model (final)

### `useWeekPlan` — persisted, hydration-guarded

```ts
export interface DayPlan {
  energy?: EnergyTier;
  recipes?: Recipe[];          // populated after generation
  pickIndex?: number;          // which recipes[i] is the active pick; default 0
  selectedAt?: string;         // ISO timestamp when user committed a pick for this day
  cookedAt?: string;           // RESERVED for v1.1 explicit cook-confirm; unused in v1 logic
}

interface WeekPlanState {
  plan: Record<ISODate, DayPlan>;
  hasHydrated: boolean;

  setEnergy: (date: ISODate, tier: EnergyTier) => void;
  clearEnergy: (date: ISODate) => void;
  setRecipes: (date: ISODate, recipes: Recipe[]) => void;
  setPickIndex: (date: ISODate, idx: number) => void;
  swapPick: (date: ISODate) => void;
  commitSelection: (date: ISODate) => void;  // sets selectedAt = now, idempotent
  appendRecipeAndSelect: (date: ISODate, recipe: Recipe) => void;  // non-destructive
  clearDay: (date: ISODate) => void;
  clearFuture: () => void;                    // wipes dates > today; preserves today + past
  clearAll: () => void;                       // nuke

  _setHydrated: () => void;                   // internal, called from onRehydrateStorage
}
```

### `useBatchSession` — ephemeral, not persisted

```ts
export type PerDateStatus = 'pending' | 'in-progress' | 'success' | 'error';

interface BatchSessionState {
  total: number;
  completed: number;
  currentDate: ISODate | null;
  perDate: Record<ISODate, PerDateStatus>;   // resumability tracking
  status: 'idle' | 'drafting' | 'done' | 'error';
  error: string | null;

  begin: (dates: ISODate[]) => void;
  setDate: (date: ISODate, status: PerDateStatus) => void;
  complete: () => void;
  fail: (msg: string) => void;
  reset: () => void;
}
```

### `useGenerationSession` — unchanged

Tonight's single-shot session. No `forDate`. No multi-target logic. Stays exactly as it exists today.

---

## Move order

1. **Tab bar → 4 tabs, simplified icons**
2. **Local date utilities** (`src/features/week/weekDates.ts`)
3. **`weekPlan` store** (persisted, hydration-guarded) + **`batchSession` store**
4. **EnergyPicker minutes-first**
5. **Review: pick-one + Swap, writes to `weekPlan[today]`**
6. **CTA copy refresh**
7. **Week screen**: tag, batch draft (resumable), inline per-day swap
8. **Tonight dashboard rewrite**: hero + upcoming + recent
9. **Shop**: read from `weekPlan`, aggregate `IngredientGroup[]` with dedupe
10. **Recipe Modal**: non-destructive "Cook this tonight"

Each move is independently verifiable. Moves 1–6 are Tonight-flow polish; 7–10 wire the dashboard loop.

---

## Move 1 — Tab bar to 4 tabs, simpler 22px icons

**Files**
- `apps/native/app/(tabs)/_layout.tsx` (edit)
- `apps/native/app/(tabs)/swipe-night.tsx` → rename to `week.tsx` (edit contents)
- `apps/native/app/(tabs)/saved.tsx` (DELETE)
- `apps/native/src/components/FloatingTabBar.tsx` (edit)
- `apps/native/src/components/painted/Icon.tsx` (edit)
- `apps/native/src/components/painted/index.ts` (edit exports)

### `app/(tabs)/_layout.tsx`

Replace with:
```tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '../../src/components/FloatingTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="tonight" options={{ title: 'Tonight' }} />
      <Tabs.Screen name="week" options={{ title: 'Week' }} />
      <Tabs.Screen name="shop" options={{ title: 'Shop' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
```

### `app/(tabs)/week.tsx` (renamed from `swipe-night.tsx`)

Interim stub until Move 7:
```tsx
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WashBackground } from '../../src/components/WashBackground';
import { DisplayText, Mono } from '../../src/components/Text';
import { palette, spacing } from '../../src/design';

export default function WeekRoute() {
  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <WashBackground />
      <SafeAreaView style={{ flex: 1, padding: spacing.xl }} edges={['top']}>
        <Mono size={10} bold color={palette.accentDeep}>PLAN</Mono>
        <View style={{ height: spacing.sm }} />
        <DisplayText size={38} color={palette.primary}>This week.</DisplayText>
      </SafeAreaView>
    </View>
  );
}
```

After Move 7 lands, replace with:
```tsx
import React from 'react';
import { WeekScreen } from '../../src/features/week/WeekScreen';
export default function WeekRoute() { return <WeekScreen />; }
```

### `app/(tabs)/saved.tsx` — delete entirely

### `src/components/FloatingTabBar.tsx`

Four precise edits:

1. Replace the `TabName` type:
```ts
type TabName = 'tonight' | 'week' | 'shop' | 'more';
```

2. Replace the `LABELS` const:
```ts
const LABELS: Record<TabName, string> = {
  tonight: 'Tonight',
  week: 'Week',
  shop: 'Shop',
  more: 'More',
};
```

3. Replace the imports from `./painted`:
```ts
import {
  IconTabTonight,
  IconTabWeek,
  IconTabShop,
  IconTabMore,
} from './painted';
```

4. Replace the `TabIcon` switch:
```tsx
function TabIcon({ name, focused }: { name: TabName; focused: boolean }) {
  const tint = focused ? palette.accent : palette.textSecondary;
  switch (name) {
    case 'tonight': return <IconTabTonight color={tint} />;
    case 'week':    return <IconTabWeek color={tint} />;
    case 'shop':    return <IconTabShop color={tint} />;
    case 'more':    return <IconTabMore color={tint} />;
    default:        return null;
  }
}
```

### `src/components/painted/Icon.tsx`

The file already imports `Svg, Path, Rect, Circle` from `react-native-svg`. No new imports needed.

**1. Replace `IconTabTonight` body** (currently a filled droplet at lines 156–169). Keep the function signature and outer `<Svg>` wrapper. Replace the Path children with a simple bowl + 2 steam ticks (stroke-only, better for 22px than a tiny filled droplet):

```tsx
export function IconTabTonight({ size = 22, color = palette.accent }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11 H 21" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Path
        d="M4 11 Q 4 18, 12 18 Q 20 18, 20 11"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M10 4 V 8" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Path d="M14 4 V 8" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}
```

**2. Rename `IconTabSwipe` → `IconTabWeek`** (lines 171–192). Replace both the function name and the body:

```tsx
export function IconTabWeek({ size = 22, color = palette.textSecondary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3.5}
        y={4.5}
        width={17}
        height={16}
        rx={2.5}
        stroke={color}
        strokeWidth={1.9}
        fill="none"
      />
      <Path d="M8 2.5 V 6.5" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Path d="M16 2.5 V 6.5" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Path d="M3.5 10 H 20.5" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}
```

**3. Delete `IconTabSaved`** (lines 215–228) entirely.

**4. `IconTabShop` and `IconTabMore`** — leave unchanged.

### `src/components/painted/index.ts`

Currently exports `IconTabTonight`, `IconTabSwipe`, `IconTabShop`, `IconTabSaved`, `IconTabMore`. Change the named re-export block so it reads:
```ts
export {
  ...  // keep non-tab exports above this
  IconTabTonight,
  IconTabWeek,
  IconTabShop,
  IconTabMore,
  ...
} from './Icon';
```
(Remove `IconTabSwipe`, remove `IconTabSaved`, add `IconTabWeek`.)

### Dangling reference sweep

```bash
cd /Users/zach/Projects/qook
rg "IconTabSaved|IconTabSwipe|'swipe-night'|\"swipe-night\"|'saved'" apps/native/
```
Only the files edited above should match. Anything else is a dangling reference.

### Verification

- `bun run typecheck` and `bun run lint` clean.
- iOS sim: tab bar reads `Tonight · Week · Shop · More`. **Legibility check at 22px on physical device or sim** — Tonight's bowl+steam reads clearly; Week's calendar-rect reads clearly; active (rust) vs inactive (textSecondary) tints both differentiate without muddying.
- Tapping Week shows the interim stub.
- Tonight tab still renders (no breakage from the icon swap).

---

## Move 2 — Local date utilities

**File (new):** `apps/native/src/features/week/weekDates.ts`

```ts
// apps/native/src/features/week/weekDates.ts
//
// Local civil-date helpers for Week + Tonight dashboard.
// CRITICAL: never use Date.prototype.toISOString() for day keys — that's
// UTC and will drift a full day for US users in the evening. All math is
// done via getFullYear/getMonth/getDate on a local Date.

export type ISODate = string; // 'YYYY-MM-DD' in local time

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatLocal(d: Date): ISODate {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayISO(): ISODate {
  return formatLocal(new Date());
}

export function addDaysISO(iso: ISODate, days: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days); // month 0-indexed in JS Date
  return formatLocal(dt);
}

export function upcomingDays(count: number, fromIso = todayISO()): ISODate[] {
  return Array.from({ length: count }, (_, i) => addDaysISO(fromIso, i));
}

const WEEKDAY_SHORT = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const MONTH_SHORT = new Intl.DateTimeFormat('en-US', { month: 'short' });

export interface FormattedDay {
  weekday: string;  // 'TUE'
  month: string;    // 'APR'
  day: number;      // 22
  isoDate: ISODate;
}

export function formatDayShort(iso: ISODate): FormattedDay {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    weekday: WEEKDAY_SHORT.format(dt).toUpperCase(),
    month: MONTH_SHORT.format(dt).toUpperCase(),
    day: dt.getDate(),
    isoDate: iso,
  };
}

export function isToday(iso: ISODate): boolean {
  return iso === todayISO();
}

export function isFuture(iso: ISODate): boolean {
  return iso > todayISO();
}

export function isPast(iso: ISODate): boolean {
  return iso < todayISO();
}
```

**DST safety note:** `new Date(y, m - 1, d + days)` is DST-safe in JS because the constructor normalizes the date object through local-time interpretation. Days crossing spring-forward / fall-back boundaries produce correct sequential local civil dates.

### Verification

- `bun run typecheck` clean.
- No sim test needed; this is consumed by later moves.

---

## Move 3 — `weekPlan` store (persisted, hydration-guarded) + `batchSession` store

**Files (new)**
- `apps/native/src/stores/weekPlan.ts`
- `apps/native/src/stores/batchSession.ts`

### `src/stores/weekPlan.ts`

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EnergyTier, Recipe } from '@qook/shared';
import { todayISO, type ISODate } from '../features/week/weekDates';

export interface DayPlan {
  energy?: EnergyTier;
  recipes?: Recipe[];
  pickIndex?: number;
  selectedAt?: string;
  cookedAt?: string; // reserved for v1.1 explicit cook-confirm; unused in v1 logic
}

interface WeekPlanState {
  plan: Record<ISODate, DayPlan>;
  hasHydrated: boolean;

  setEnergy: (date: ISODate, tier: EnergyTier) => void;
  clearEnergy: (date: ISODate) => void;
  setRecipes: (date: ISODate, recipes: Recipe[]) => void;
  setPickIndex: (date: ISODate, idx: number) => void;
  swapPick: (date: ISODate) => void;
  commitSelection: (date: ISODate) => void;
  appendRecipeAndSelect: (date: ISODate, recipe: Recipe) => void;
  clearDay: (date: ISODate) => void;
  clearFuture: () => void;
  clearAll: () => void;

  _setHydrated: () => void;
}

export const useWeekPlan = create<WeekPlanState>()(
  persist(
    (set, get) => ({
      plan: {},
      hasHydrated: false,

      setEnergy: (date, energy) =>
        set((s) => ({
          plan: { ...s.plan, [date]: { ...s.plan[date], energy } },
        })),

      clearEnergy: (date) =>
        set((s) => {
          const next = { ...(s.plan[date] ?? {}) };
          delete next.energy;
          return { plan: { ...s.plan, [date]: next } };
        }),

      setRecipes: (date, recipes) =>
        set((s) => ({
          plan: {
            ...s.plan,
            [date]: { ...s.plan[date], recipes, pickIndex: 0 },
          },
        })),

      setPickIndex: (date, pickIndex) =>
        set((s) => ({
          plan: { ...s.plan, [date]: { ...s.plan[date], pickIndex } },
        })),

      swapPick: (date) => {
        const day = get().plan[date];
        if (!day?.recipes?.length) return;
        const next = ((day.pickIndex ?? 0) + 1) % day.recipes.length;
        set((s) => ({
          plan: { ...s.plan, [date]: { ...s.plan[date], pickIndex: next } },
        }));
      },

      commitSelection: (date) =>
        set((s) => ({
          plan: {
            ...s.plan,
            [date]: { ...s.plan[date], selectedAt: new Date().toISOString() },
          },
        })),

      // Non-destructive: if date has no recipes, set [recipe] fresh.
      // If date already has recipes and this recipe isn't in the list, append it.
      // If already in the list, just update pickIndex to point at it.
      // Always bumps selectedAt.
      appendRecipeAndSelect: (date, recipe) => {
        const existing = get().plan[date];
        if (!existing?.recipes?.length) {
          set((s) => ({
            plan: {
              ...s.plan,
              [date]: {
                ...s.plan[date],
                recipes: [recipe],
                pickIndex: 0,
                selectedAt: new Date().toISOString(),
              },
            },
          }));
          return;
        }
        const idx = existing.recipes.findIndex((r) => r.id === recipe.id);
        if (idx >= 0) {
          set((s) => ({
            plan: {
              ...s.plan,
              [date]: {
                ...s.plan[date],
                pickIndex: idx,
                selectedAt: new Date().toISOString(),
              },
            },
          }));
        } else {
          const merged = [...existing.recipes, recipe];
          set((s) => ({
            plan: {
              ...s.plan,
              [date]: {
                ...s.plan[date],
                recipes: merged,
                pickIndex: merged.length - 1,
                selectedAt: new Date().toISOString(),
              },
            },
          }));
        }
      },

      clearDay: (date) =>
        set((s) => {
          const next = { ...s.plan };
          delete next[date];
          return { plan: next };
        }),

      // Wipes future dates (> today). Today and past are preserved.
      // "Reset my week plan but don't touch tonight or history."
      clearFuture: () => {
        const today = todayISO();
        set((s) => {
          const next: Record<ISODate, DayPlan> = {};
          for (const [date, day] of Object.entries(s.plan)) {
            if (date <= today) next[date] = day;
          }
          return { plan: next };
        });
      },

      clearAll: () => set({ plan: {} }),

      _setHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: 'qook.weekPlan.v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Only persist `plan`. hasHydrated is runtime-only.
      partialize: (s) => ({ plan: s.plan }) as Partial<WeekPlanState>,
      // Merge: preserve any in-memory writes that happened during the hydration window.
      merge: (persistedUnknown, current) => {
        const persisted = (persistedUnknown as Partial<WeekPlanState>) ?? {};
        const persistedPlan = persisted.plan ?? {};
        const mergedPlan: Record<ISODate, DayPlan> = { ...persistedPlan };
        // Any writes the app made before hydration are in current.plan — overlay them.
        for (const [date, day] of Object.entries(current.plan)) {
          mergedPlan[date] = { ...mergedPlan[date], ...day };
        }
        return { ...current, plan: mergedPlan };
      },
      onRehydrateStorage: () => (state) => {
        // Fires after rehydration (or error). Flip the flag so UI can render.
        state?._setHydrated();
      },
    },
  ),
);

// Selectors
export function taggedFutureOrTodayDays(
  plan: Record<ISODate, DayPlan>,
  todayIso: ISODate,
): ISODate[] {
  return Object.keys(plan)
    .filter((d) => d >= todayIso && plan[d]?.energy != null)
    .sort();
}

export function recentSelectedDays(
  plan: Record<ISODate, DayPlan>,
  todayIso: ISODate,
  limit: number,
): ISODate[] {
  return Object.keys(plan)
    .filter((d) => d < todayIso && plan[d]?.selectedAt != null && plan[d]?.recipes?.length)
    .sort((a, b) => (a < b ? 1 : -1)) // newest first
    .slice(0, limit);
}

export function activePickFor(day: DayPlan | undefined): Recipe | null {
  if (!day?.recipes?.length) return null;
  return day.recipes[day.pickIndex ?? 0] ?? null;
}
```

### `src/stores/batchSession.ts`

```ts
import { create } from 'zustand';
import type { ISODate } from '../features/week/weekDates';

export type PerDateStatus = 'pending' | 'in-progress' | 'success' | 'error';

interface BatchSessionState {
  total: number;
  completed: number;
  currentDate: ISODate | null;
  perDate: Record<ISODate, PerDateStatus>;
  status: 'idle' | 'drafting' | 'done' | 'error';
  error: string | null;

  begin: (dates: ISODate[]) => void;
  setDate: (date: ISODate, status: PerDateStatus) => void;
  complete: () => void;
  fail: (msg: string) => void;
  reset: () => void;
}

export const useBatchSession = create<BatchSessionState>((set, get) => ({
  total: 0,
  completed: 0,
  currentDate: null,
  perDate: {},
  status: 'idle',
  error: null,

  begin: (dates) => {
    const perDate: Record<ISODate, PerDateStatus> = {};
    for (const d of dates) perDate[d] = 'pending';
    set({
      total: dates.length,
      completed: 0,
      currentDate: null,
      perDate,
      status: 'drafting',
      error: null,
    });
  },

  setDate: (date, status) => {
    const prev = get();
    const nextPerDate = { ...prev.perDate, [date]: status };
    const completed = Object.values(nextPerDate).filter(
      (s) => s === 'success' || s === 'error',
    ).length;
    set({
      perDate: nextPerDate,
      completed,
      currentDate: status === 'in-progress' ? date : prev.currentDate,
    });
  },

  complete: () => set({ status: 'done', currentDate: null }),
  fail: (error) => set({ status: 'error', error }),
  reset: () =>
    set({
      total: 0,
      completed: 0,
      currentDate: null,
      perDate: {},
      status: 'idle',
      error: null,
    }),
}));

export function pendingOrFailedDates(
  perDate: Record<ISODate, PerDateStatus>,
): ISODate[] {
  return Object.entries(perDate)
    .filter(([, s]) => s === 'pending' || s === 'error')
    .map(([d]) => d)
    .sort();
}
```

### Verification

- `bun run typecheck` clean.
- Hot reload works. No UI consumers yet.

---

## Move 4 — EnergyPicker minutes-first

**Files**
- `apps/native/src/types/energy.ts` (add `ENERGY_TIER_MINUTES`)
- `apps/native/src/components/EnergyPicker.tsx` (row body rewrite)

### `src/types/energy.ts`

Add below the existing exports:
```ts
export const ENERGY_TIER_MINUTES: Record<
  EnergyTier,
  { value: number; qualifier: 'or less' | 'or more' }
> = {
  'brain-is-fried':  { value: 15, qualifier: 'or less' },
  'after-work':      { value: 30, qualifier: 'or less' },
  'got-energy':      { value: 45, qualifier: 'or less' },
  'weekend-project': { value: 60, qualifier: 'or more' },
};
```

### `src/components/EnergyPicker.tsx`

Update imports:
```ts
import { BodyText, DisplayText, Mono } from './Text';
import {
  energyTierColors,
  ENERGY_TIERS,
  ENERGY_TIER_LABEL,
  ENERGY_TIER_MINUTES,
  type EnergyTier,
} from '../types/energy';
```

Replace the labels block:
```tsx
<View style={styles.labels}>
  <Mono
    size={10}
    bold
    color={active ? colors.text : palette.textTertiary}
    style={styles.kicker}
  >
    {ENERGY_TIER_LABEL[tier]}
  </Mono>
  <View style={styles.minutesRow}>
    <DisplayText
      size={36}
      color={active ? colors.text : palette.ink}
      style={styles.minutesValue}
    >
      {ENERGY_TIER_MINUTES[tier].value}
    </DisplayText>
    <BodyText
      size={13}
      weight="medium"
      color={active ? colors.text : palette.textTertiary}
    >
      min {ENERGY_TIER_MINUTES[tier].qualifier}
    </BodyText>
  </View>
</View>
```

Add to the `StyleSheet.create`:
```ts
kicker: { letterSpacing: 1.2, marginBottom: 2 },
minutesRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
minutesValue: { letterSpacing: -1.5, lineHeight: 38 },
```

Keep the existing dot, radio, row container, active bg/border swap. Row gets slightly taller — that's fine.

### Verification

Sim: Tonight empty → "Find tonight's dinner" → Energy. Each row shows `15 / 30 / 45 / 60` as hero in Fraunces, tier name above in tiny caps, "min or less / or more" beside the number. Haptics + active-state swap still work.

---

## Move 5 — Review: pick-one + Swap, writes to `weekPlan[today]` via `appendRecipeAndSelect`

**File:** `apps/native/src/features/eat/ReviewRecipesScreen.tsx` (full rewrite)

Replace the file:

```tsx
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { FoodHeroImage } from '../../components/FoodHeroImage';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PaintedButton, IconPill } from '../../components/painted';
import { X, ArrowRight, RefreshCw } from 'lucide-react-native';
import { palette, spacing } from '../../design';
import { ENERGY_TIER_LABEL } from '../../types/energy';
import { useHaptics } from '../../hooks/useHaptics';
import { useGenerationSession } from '../../stores/generationSession';
import { useWeekPlan } from '../../stores/weekPlan';
import { todayISO } from '../week/weekDates';
import type { SeedMealKey } from '../../lib/assets';

export function ReviewRecipesScreen() {
  const router = useRouter();
  const { press, select } = useHaptics();
  const tier = useGenerationSession((s) => s.tier);
  const recipes = useGenerationSession((s) => s.recipes);
  const sessionState = useGenerationSession((s) => s.state);
  const errorMsg = useGenerationSession((s) => s.error);
  const start = useGenerationSession((s) => s.start);
  const reset = useGenerationSession((s) => s.reset);
  const setRecipes = useWeekPlan((s) => s.setRecipes);
  const setPickIndex = useWeekPlan((s) => s.setPickIndex);
  const commitSelection = useWeekPlan((s) => s.commitSelection);
  const [pickIdx, setPickIdx] = useState(0);

  const handleClose = () => { press(); reset(); router.back(); };

  const handleRegenerate = () => {
    if (!tier) return;
    press();
    setPickIdx(0);
    start(tier);
    router.replace('/(eat)/loading');
  };

  const handleSwap = () => {
    if (recipes.length === 0) return;
    select();
    setPickIdx((i) => (i + 1) % recipes.length);
  };

  const handleCook = () => {
    const pick = recipes[pickIdx];
    if (!pick) return;
    press();
    const today = todayISO();
    // Replace today's draft with this fresh set — Tonight's flow is the
    // authoritative way to set today's plan from scratch.
    setRecipes(today, recipes);
    setPickIndex(today, pickIdx);
    commitSelection(today);
    reset();
    router.replace({ pathname: '/(modals)/recipe/[id]', params: { id: pick.id } });
  };

  const pick = recipes[pickIdx];

  return (
    <ScreenShell horizontalPadding={24}>
      <View style={styles.topBar}>
        <IconPill onPress={handleClose} accessibilityLabel="Close">
          <X size={16} color={palette.ink} strokeWidth={2.2} />
        </IconPill>
        <IconPill
          onPress={handleRegenerate}
          accessibilityLabel="Regenerate"
          disabled={!tier}
        >
          <RefreshCw size={18} color={palette.primary} strokeWidth={2} />
        </IconPill>
      </View>
      <View style={{ height: spacing.md }} />

      <View style={styles.header}>
        <View style={styles.kickerRow}>
          <Mono size={10} bold color={palette.accentDeep}>review</Mono>
          <View style={styles.kickerDot} />
          <Mono size={10} color={palette.textSecondary}>
            {tier ? ENERGY_TIER_LABEL[tier].toUpperCase() : '—'} · pick {pickIdx + 1} of {recipes.length}
          </Mono>
        </View>
        <View style={styles.displayTitleWrap}>
          <DisplayText size={38} color={palette.primary} style={styles.displayTitle}>
            Tonight's pick.
          </DisplayText>
          <BrushstrokeUnderline
            width={240}
            color={palette.accent}
            strokeWidth={2.4}
            style={styles.displayUnderline}
          />
        </View>
      </View>

      <View style={{ height: spacing.md }} />

      {sessionState === 'error' ? (
        <ErrorState message={errorMsg ?? 'Something went sideways.'} onRetry={handleRegenerate} />
      ) : !pick ? null : (
        <>
          <View style={styles.card}>
            <FoodHeroImage
              localKey={pick.localImageKey as SeedMealKey | undefined}
              remoteUrl={pick.heroImageUrl}
              blurhash={pick.blurhash}
              height={320}
              cornerRadius={22}
              style={{ width: '100%', height: 320 }}
            />
          </View>
          <View style={{ height: spacing.md }} />
          <DisplayText size={32} color={palette.ink} style={styles.cardTitle}>
            {pick.title}
          </DisplayText>
          <View style={{ height: 4 }} />
          <Mono size={11} color={palette.textSecondary}>
            {pick.cuisine} · {pick.timeMinutes} min · serves {pick.servings}
          </Mono>
          {pick.notes ? (
            <>
              <View style={{ height: spacing.sm }} />
              <BodyText size={14} color={palette.textSecondary} weight="medium" numberOfLines={3}>
                {pick.notes}
              </BodyText>
            </>
          ) : null}
          <View style={{ height: spacing.lg }} />
          <PaintedButton
            label="Cook tonight"
            size="lg"
            tone="forest"
            onPress={handleCook}
            trailingIcon={<ArrowRight size={14} color={palette.surface} />}
            fullWidth
          />
          <View style={{ height: spacing.sm + 2 }} />
          <Pressable
            hitSlop={6}
            onPress={handleSwap}
            style={{ alignSelf: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="Try another"
          >
            <BodyText size={13} weight="semi" color={palette.textSecondary}>
              Try another
            </BodyText>
          </Pressable>
        </>
      )}
    </ScreenShell>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorCard}>
      <Mono size={10} bold color={palette.destructive}>{"couldn't draft"}</Mono>
      <View style={{ height: spacing.xs }} />
      <DisplayText size={22} color={palette.ink} style={{ letterSpacing: -0.5, lineHeight: 26 }}>
        {message}
      </DisplayText>
      <View style={{ height: spacing.md }} />
      <PaintedButton label="Try again" size="md" tone="rust" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between' },
  header: { gap: 6 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kickerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.textSecondary },
  displayTitleWrap: { position: 'relative', alignSelf: 'flex-start' },
  displayTitle: { letterSpacing: -1.2, lineHeight: 42 },
  displayUnderline: { position: 'absolute', left: -6, bottom: -8 },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
  cardTitle: { letterSpacing: -0.5, lineHeight: 36 },
  errorCard: {
    borderRadius: 22,
    padding: spacing.lg,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
});
```

**Why this is safe:** Tonight's flow is the authoritative "set today's plan from scratch" path. Users entering the flow explicitly chose to draft, so overwriting `weekPlan[today].recipes` with the new draft trio is expected. The non-destructive behavior is reserved for the Recipe Modal's "Cook this tonight" (Move 10).

### Verification

- Tonight empty → EnergyPicker → Context (skip) → Loading → Review.
- One hero at 320px. Swap cycles through the 3 drafted recipes.
- Cook tonight commits recipes + pickIndex + selectedAt → lands on Recipe Modal for the chosen recipe.
- Regenerate icon resets `pickIdx` to 0 and kicks a fresh generation.
- Back to Tonight → hero shows the committed pick.

---

## Move 6 — CTA copy refresh

Flat string edits. No structural changes. Tonight's file is rewritten in Move 8; this move only touches EnergyPickerScreen and ContextStep.

### `src/features/eat/EnergyPickerScreen.tsx`

Change:
```tsx
<PaintedButton label="Draft three recipes" ...>
```
to:
```tsx
<PaintedButton label="See dinner ideas" ...>
```

### `src/features/eat/ContextStep.tsx`

PaintedButton label expression:
```tsx
label={trimmed.length > 0 ? 'Use this, find dinner' : "Find tonight's dinner"}
```

Skip-row label:
```tsx
<BodyText size={13} weight="medium" color={palette.textTertiary}>
  Skip — surprise me
</BodyText>
```

### Verification

Walk the flow: no "draft" / "generate" language on user-facing CTAs.

---

## Move 7 — Week screen: tag, batch draft (resumable), inline per-day swap

**Files (new)**
- `apps/native/src/features/week/batchDraft.ts`
- `apps/native/src/features/week/DayRow.tsx`
- `apps/native/src/features/week/WeekScreen.tsx`
- `apps/native/app/(tabs)/week.tsx` (edit — swap stub for real import)

### `src/features/week/batchDraft.ts`

Resumable orchestrator. Retries only pending/failed dates by default.

```ts
// apps/native/src/features/week/batchDraft.ts
//
// Sequential per-day draft orchestrator. Drives `batchSession` progress and
// writes results into `weekPlan`. Uses `useGenerationSession` zero times
// — Tonight's session is independent.
//
// Resumable: on error, preserves successful days and only re-runs pending
// or failed dates on retry (unless callers pass { redraftAll: true }).

import { api } from '../../services/api';
import { useWeekPlan } from '../../stores/weekPlan';
import { useBatchSession, pendingOrFailedDates } from '../../stores/batchSession';
import type { ISODate } from './weekDates';

export interface BatchDraftOptions {
  /** When true, overwrites successful days. Default false. */
  redraftAll?: boolean;
}

export async function batchDraft(
  dates: ISODate[],
  options: BatchDraftOptions = {},
): Promise<void> {
  if (dates.length === 0) return;

  const { redraftAll = false } = options;
  const batch = useBatchSession.getState();
  const week = useWeekPlan.getState();

  // Determine the actual target set.
  let targets: ISODate[];
  if (redraftAll) {
    targets = dates.slice();
  } else {
    const existingPerDate = batch.perDate;
    const hasExistingBatch = Object.keys(existingPerDate).length > 0;
    if (hasExistingBatch) {
      // Resume: only retry pending/failed dates from prior batch.
      targets = pendingOrFailedDates(existingPerDate);
    } else {
      // Fresh batch: skip dates that already have recipes from a prior successful batch.
      targets = dates.filter((date) => {
        const day = week.plan[date];
        return !day?.recipes?.length;
      });
    }
  }

  if (targets.length === 0) {
    // Nothing to do — mark the batch as done so UI transitions.
    batch.complete();
    return;
  }

  // If starting fresh, initialize perDate tracking.
  if (Object.keys(batch.perDate).length === 0 || redraftAll) {
    batch.begin(dates);
    for (const d of dates) {
      if (!targets.includes(d)) {
        batch.setDate(d, 'success'); // pre-existing, count as success
      }
    }
  }

  for (const date of targets) {
    const energy = useWeekPlan.getState().plan[date]?.energy;
    if (!energy) {
      batch.setDate(date, 'success'); // no-op, skip
      continue;
    }
    batch.setDate(date, 'in-progress');
    try {
      const recipes = await api.generateRecipesForEnergy(energy);
      useWeekPlan.getState().setRecipes(date, recipes);
      batch.setDate(date, 'success');
    } catch (err: any) {
      batch.setDate(date, 'error');
      batch.fail(err?.message ?? 'Draft failed');
      return;
    }
  }

  batch.complete();
}
```

### `src/features/week/DayRow.tsx`

```tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { EnergyTier } from '@qook/shared';
import { palette } from '../../design';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { useHaptics } from '../../hooks/useHaptics';
import { useWeekPlan, activePickFor } from '../../stores/weekPlan';
import { formatDayShort, isToday, type ISODate } from './weekDates';
import { RefreshCw, ChevronRight } from 'lucide-react-native';

const WEEK_TIERS: Array<{ tier: EnergyTier; minutes: number }> = [
  { tier: 'brain-is-fried', minutes: 15 },
  { tier: 'after-work',     minutes: 30 },
  { tier: 'got-energy',     minutes: 45 },
];

const TIER_BG: Record<EnergyTier, string> = {
  'brain-is-fried':  palette.utility,     // prussian
  'after-work':      palette.accent,      // rust
  'got-energy':      '#7A8568',           // sage
  'weekend-project': palette.primary,     // forest (not used in Week's 3-tier scale)
};

export function DayRow({
  date,
  onOpenRecipe,
}: {
  date: ISODate;
  onOpenRecipe: (recipeId: string) => void;
}) {
  const { tap, select } = useHaptics();
  const setEnergy = useWeekPlan((s) => s.setEnergy);
  const clearEnergy = useWeekPlan((s) => s.clearEnergy);
  const swapPick = useWeekPlan((s) => s.swapPick);
  const day = useWeekPlan((s) => s.plan[date]);

  const { weekday } = formatDayShort(date);
  const todayFlag = isToday(date);
  const activeTier = day?.energy;
  const pick = activePickFor(day);

  const onChipPress = (tier: EnergyTier) => {
    if (activeTier === tier) { tap(); clearEnergy(date); }
    else { select(); setEnergy(date, tier); }
  };

  if (pick) {
    return (
      <Pressable
        onPress={() => onOpenRecipe(pick.id)}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={`${weekday}: ${pick.title}`}
      >
        <View style={styles.dayLabel}>
          {todayFlag ? <View style={styles.todayDot} /> : <View style={styles.todayDotSpacer} />}
          <Mono size={12} bold color={palette.ink}>{weekday}</Mono>
        </View>
        <View style={styles.pickArea}>
          <BodyText size={14} weight="semi" color={palette.ink} numberOfLines={1}>
            {pick.title}
          </BodyText>
          <Mono size={10} color={palette.textSecondary}>
            {pick.timeMinutes} min · {pick.cuisine}
          </Mono>
        </View>
        <Pressable
          onPress={(e) => { e.stopPropagation(); select(); swapPick(date); }}
          hitSlop={10}
          style={styles.swapBtn}
          accessibilityLabel="Swap to another pick for this day"
        >
          <RefreshCw size={16} color={palette.accentDeep} strokeWidth={2} />
        </Pressable>
        <ChevronRight size={16} color={palette.textTertiary} strokeWidth={2} />
      </Pressable>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.dayLabel}>
        {todayFlag ? <View style={styles.todayDot} /> : <View style={styles.todayDotSpacer} />}
        <Mono size={12} bold color={palette.ink}>{weekday}</Mono>
      </View>
      <View style={styles.chips}>
        {WEEK_TIERS.map(({ tier, minutes }) => {
          const active = activeTier === tier;
          const tierColor = TIER_BG[tier];
          return (
            <Pressable
              key={tier}
              onPress={() => onChipPress(tier)}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: tierColor, borderColor: tierColor }
                  : styles.chipInactive,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${minutes} minutes`}
              accessibilityState={{ selected: active }}
            >
              <DisplayText
                size={19}
                color={active ? palette.surface : palette.textTertiary}
                style={styles.chipNumber}
              >
                {minutes}
              </DisplayText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(42, 58, 38, 0.08)',
  },
  dayLabel: {
    width: 78,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.accent },
  todayDotSpacer: { width: 6, height: 6 },
  chips: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  chip: {
    width: 78,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipInactive: { backgroundColor: palette.surface, borderColor: palette.glassBorder },
  chipNumber: { letterSpacing: -0.4, lineHeight: 22 },
  pickArea: { flex: 1, gap: 2 },
  swapBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: palette.surfaceTranslucent,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
});
```

### `src/features/week/WeekScreen.tsx`

```tsx
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PaintedButton } from '../../components/painted';
import { ArrowRight } from 'lucide-react-native';
import { palette, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import {
  useWeekPlan,
  taggedFutureOrTodayDays,
} from '../../stores/weekPlan';
import { useBatchSession } from '../../stores/batchSession';
import { DayRow } from './DayRow';
import { batchDraft } from './batchDraft';
import {
  upcomingDays,
  formatDayShort,
  todayISO,
} from './weekDates';

export function WeekScreen() {
  const router = useRouter();
  const { press, tap } = useHaptics();
  const plan = useWeekPlan((s) => s.plan);
  const hasHydrated = useWeekPlan((s) => s.hasHydrated);
  const clearFuture = useWeekPlan((s) => s.clearFuture);
  const batch = useBatchSession();
  const todayIso = todayISO();
  const days = upcomingDays(7, todayIso);
  const tagged = taggedFutureOrTodayDays(plan, todayIso);
  const rangeKicker = (() => {
    const first = formatDayShort(days[0]);
    const last = formatDayShort(days[days.length - 1]);
    return `${first.month} ${first.day} — ${last.month} ${last.day}`;
  })();

  const onDraft = async () => {
    if (!hasHydrated || tagged.length === 0) return;
    press();
    // Fresh batch (clears prior state). Don't force-redraft existing.
    useBatchSession.getState().reset();
    await batchDraft(tagged);
  };

  const onRetry = async () => {
    // Resume — batchDraft naturally targets only pending/failed.
    press();
    await batchDraft(tagged);
  };

  const onOpenRecipe = (recipeId: string) => {
    press();
    router.push({ pathname: '/(modals)/recipe/[id]', params: { id: recipeId } });
  };

  const onClearFuture = () => {
    tap();
    clearFuture();
    useBatchSession.getState().reset();
  };

  const drafting = batch.status === 'drafting';
  const failed = batch.status === 'error';

  return (
    <ScreenShell horizontalPadding={24} scrollable={false}>
      <View style={styles.header}>
        <View style={styles.kickerRow}>
          <Mono size={10} bold color={palette.accentDeep}>PLAN</Mono>
          <View style={styles.kickerDot} />
          <Mono size={10} color={palette.textSecondary}>{rangeKicker}</Mono>
        </View>
        <View style={styles.titleWrap}>
          <DisplayText size={38} color={palette.primary} style={styles.title}>
            This week.
          </DisplayText>
          <BrushstrokeUnderline
            width={200}
            color={palette.accent}
            strokeWidth={2.4}
            style={styles.displayUnderline}
          />
        </View>
      </View>

      <View style={{ height: spacing.md }} />
      <BodyText size={15} color={palette.textSecondary} weight="medium">
        Tap a time on the nights you'll cook. Scroll for the rest.
      </BodyText>

      <View style={{ height: spacing.lg }} />

      <View style={styles.card}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 4 }}
        >
          {days.map((date) => (
            <DayRow key={date} date={date} onOpenRecipe={onOpenRecipe} />
          ))}
        </ScrollView>
      </View>

      <View style={{ height: spacing.md }} />

      <View style={styles.summary}>
        <View style={styles.summaryLeft}>
          <Mono size={10} bold color={palette.primary}>
            {tagged.length} NIGHTS SET
          </Mono>
          <View style={styles.kickerDot} />
          <Mono size={10} color={palette.textSecondary}>scroll for more</Mono>
        </View>
        <Pressable hitSlop={6} onPress={onClearFuture}>
          <BodyText size={12} weight="medium" color={palette.accentDeep}>
            Clear future
          </BodyText>
        </Pressable>
      </View>

      <View style={{ height: spacing.sm }} />

      {!hasHydrated ? (
        <PaintedButton
          label="Loading..."
          size="lg"
          tone="forest"
          onPress={() => undefined}
          disabled
          fullWidth
        />
      ) : drafting ? (
        <View style={styles.draftingCard}>
          <ActivityIndicator size="small" color={palette.primary} />
          <View style={{ height: spacing.xs }} />
          <BodyText size={13} weight="semi" color={palette.ink}>
            Drafting {batch.completed + 1} of {batch.total}
            {batch.currentDate ? ` · ${formatDayShort(batch.currentDate).weekday}` : ''}
          </BodyText>
        </View>
      ) : failed ? (
        <PaintedButton
          label="Resume draft"
          size="lg"
          tone="rust"
          onPress={onRetry}
          fullWidth
        />
      ) : (
        <PaintedButton
          label={tagged.length === 0 ? 'Tag a night to start' : `Draft ${tagged.length} dinners`}
          size="lg"
          tone="forest"
          onPress={onDraft}
          disabled={tagged.length === 0}
          trailingIcon={tagged.length > 0 ? <ArrowRight size={14} color={palette.surface} /> : undefined}
          fullWidth
        />
      )}
      <View style={{ height: spacing.xs + 2 }} />
      <BodyText
        size={12}
        weight="medium"
        color={palette.textTertiary}
        style={{ textAlign: 'center' }}
      >
        About 15 seconds · one shopping list at the end
      </BodyText>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kickerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.textSecondary },
  titleWrap: { position: 'relative', alignSelf: 'flex-start' },
  title: { letterSpacing: -1.2, lineHeight: 42 },
  displayUnderline: { position: 'absolute', left: -6, bottom: -8 },
  card: {
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
    maxHeight: 380,
  },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  draftingCard: {
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
});
```

### `app/(tabs)/week.tsx` — final import

```tsx
import React from 'react';
import { WeekScreen } from '../../src/features/week/WeekScreen';
export default function WeekRoute() { return <WeekScreen />; }
```

### Verification

- Sim: Week. Tag TUE 30, WED 15, THU 45. CTA `Draft 3 dinners`.
- Tap Draft → drafting card shows "Drafting 1 of 3 · TUE" then 2/3, 3/3. Rows swap to recipe cards as they complete.
- Simulate a failure (e.g. toggle apiMode to live without supabase, or throw in mock): "Resume draft" button appears. Tap → `batchDraft` re-runs only pending/failed dates (successful days are NOT regenerated).
- Force-kill + relaunch: plan persists (recipes + picks on each day).
- Tap Clear future → future days wipe, today + past remain.
- First-launch (cold): CTA shows "Loading..." disabled until `hasHydrated` flips, then becomes interactive with the correct tagged count.

---

## Move 8 — Tonight dashboard: hero + upcoming + recent

**File:** `apps/native/src/features/tonight/TonightScreen.tsx` (full rewrite)

The existing file uses `useQuery + api.getTonightPlan()` — that call + `@tanstack/react-query` usage are replaced by direct `useWeekPlan` selectors. `getTonightPlan` stays in `api.ts` untouched (other surfaces may use it).

```tsx
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Recipe } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { FoodHeroImage } from '../../components/FoodHeroImage';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PaintedButton } from '../../components/painted';
import { ArrowRight, ChevronRight } from 'lucide-react-native';
import { palette, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import {
  useWeekPlan,
  activePickFor,
  recentSelectedDays,
} from '../../stores/weekPlan';
import {
  todayISO,
  upcomingDays,
  formatDayShort,
  type ISODate,
} from '../week/weekDates';
import type { SeedMealKey } from '../../lib/assets';

export function TonightScreen() {
  const router = useRouter();
  const { press, select } = useHaptics();
  const plan = useWeekPlan((s) => s.plan);
  const hasHydrated = useWeekPlan((s) => s.hasHydrated);
  const swapPick = useWeekPlan((s) => s.swapPick);

  const today = todayISO();
  const todayPlan = plan[today];
  const todayPick = activePickFor(todayPlan);
  const upcoming = upcomingDays(4, today).slice(1); // next 3 days after today
  const recent = recentSelectedDays(plan, today, 5);

  const onFindDinner = () => { press(); router.push('/(eat)/energy'); };
  const onOpenRecipe = (recipeId: string) => {
    press();
    router.push({ pathname: '/(modals)/recipe/[id]', params: { id: recipeId } });
  };
  const onSwapToday = () => {
    if (!todayPlan?.recipes?.length) return;
    select();
    swapPick(today);
  };
  const onOpenWeek = () => { press(); router.push('/(tabs)/week'); };

  // Gate interactive actions until hydration completes.
  if (!hasHydrated) {
    return (
      <ScreenShell horizontalPadding={24}>
        <Mono size={10} bold color={palette.accentDeep}>TONIGHT</Mono>
        <View style={{ height: spacing.sm }} />
        <DisplayText size={38} color={palette.primary} style={{ letterSpacing: -1.2, lineHeight: 42 }}>
          Loading…
        </DisplayText>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell horizontalPadding={24}>
      {todayPick ? (
        <HeroPopulated
          pick={todayPick}
          todayIso={today}
          onOpen={() => onOpenRecipe(todayPick.id)}
          onSwap={onSwapToday}
        />
      ) : (
        <HeroEmpty onFind={onFindDinner} />
      )}

      <View style={{ height: spacing.xl }} />
      <UpcomingStrip days={upcoming} plan={plan} onOpenRecipe={onOpenRecipe} onOpenWeek={onOpenWeek} />

      <View style={{ height: spacing.xl }} />
      <RecentCooks days={recent} plan={plan} onOpenRecipe={onOpenRecipe} />
    </ScreenShell>
  );
}

function HeroEmpty({ onFind }: { onFind: () => void }) {
  return (
    <View>
      <Mono size={10} bold color={palette.accentDeep}>TONIGHT</Mono>
      <View style={{ height: spacing.xs }} />
      <View style={styles.titleWrap}>
        <DisplayText size={40} color={palette.primary} style={styles.title}>
          What's for dinner?
        </DisplayText>
        <BrushstrokeUnderline
          width={260}
          color={palette.accent}
          strokeWidth={2.4}
          style={styles.underline}
        />
      </View>
      <View style={{ height: spacing.lg }} />
      <View style={styles.emptyCard}>
        <BodyText size={15} color={palette.textSecondary} weight="medium">
          Tell us your energy, we'll draft three dinners in about 10 seconds.
        </BodyText>
        <View style={{ height: spacing.md }} />
        <PaintedButton
          label="Find tonight's dinner"
          size="lg"
          tone="forest"
          onPress={onFind}
          trailingIcon={<ArrowRight size={14} color={palette.surface} />}
          fullWidth
        />
      </View>
    </View>
  );
}

function HeroPopulated({
  pick,
  todayIso,
  onOpen,
  onSwap,
}: {
  pick: Recipe;
  todayIso: ISODate;
  onOpen: () => void;
  onSwap: () => void;
}) {
  const { weekday, month, day } = formatDayShort(todayIso);
  return (
    <View>
      <Mono size={10} bold color={palette.accentDeep}>TONIGHT · {weekday} {month} {day}</Mono>
      <View style={{ height: spacing.sm }} />
      <View style={styles.heroCard}>
        <FoodHeroImage
          localKey={pick.localImageKey as SeedMealKey | undefined}
          remoteUrl={pick.heroImageUrl}
          blurhash={pick.blurhash}
          height={260}
          cornerRadius={22}
          style={{ width: '100%', height: 260 }}
        />
      </View>
      <View style={{ height: spacing.md }} />
      <DisplayText size={32} color={palette.ink} style={styles.heroTitle}>
        {pick.title}
      </DisplayText>
      <View style={{ height: 4 }} />
      <Mono size={11} color={palette.textSecondary}>
        {pick.cuisine} · {pick.timeMinutes} min · serves {pick.servings}
      </Mono>
      <View style={{ height: spacing.md }} />
      <PaintedButton
        label="Cook now"
        size="lg"
        tone="forest"
        onPress={onOpen}
        trailingIcon={<ArrowRight size={14} color={palette.surface} />}
        fullWidth
      />
      <View style={{ height: spacing.sm }} />
      <Pressable hitSlop={6} onPress={onSwap} style={{ alignSelf: 'center' }}>
        <BodyText size={13} weight="semi" color={palette.textSecondary}>
          Try another
        </BodyText>
      </Pressable>
    </View>
  );
}

function UpcomingStrip({
  days,
  plan,
  onOpenRecipe,
  onOpenWeek,
}: {
  days: ISODate[];
  plan: Record<ISODate, import('../../stores/weekPlan').DayPlan>;
  onOpenRecipe: (id: string) => void;
  onOpenWeek: () => void;
}) {
  const anyPlanned = days.some((d) => plan[d]?.energy || plan[d]?.recipes?.length);
  if (!anyPlanned) return null;

  return (
    <View>
      <Mono size={10} bold color={palette.accentDeep}>UPCOMING</Mono>
      <View style={{ height: spacing.sm }} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10 }}
      >
        {days.map((date) => {
          const day = plan[date];
          const pick = activePickFor(day);
          const { weekday, month, day: d } = formatDayShort(date);
          return (
            <Pressable
              key={date}
              onPress={() => (pick ? onOpenRecipe(pick.id) : onOpenWeek())}
              style={styles.upcomingCard}
              accessibilityRole="button"
              accessibilityLabel={`${weekday}: ${pick?.title ?? (day?.energy ? 'tagged, not drafted' : 'no plans')}`}
            >
              <Mono size={9} bold color={palette.accentDeep}>
                {weekday} · {month} {d}
              </Mono>
              <View style={{ height: spacing.xs }} />
              {pick ? (
                <>
                  <View style={styles.upcomingThumb}>
                    <FoodHeroImage
                      localKey={pick.localImageKey as SeedMealKey | undefined}
                      remoteUrl={pick.heroImageUrl}
                      blurhash={pick.blurhash}
                      height={72}
                      cornerRadius={10}
                      style={{ width: '100%', height: 72 }}
                    />
                  </View>
                  <View style={{ height: spacing.xs }} />
                  <BodyText size={12} weight="semi" color={palette.ink} numberOfLines={2}>
                    {pick.title}
                  </BodyText>
                </>
              ) : day?.energy ? (
                <BodyText size={12} weight="medium" color={palette.textSecondary} numberOfLines={2}>
                  tagged · not drafted yet
                </BodyText>
              ) : (
                <BodyText size={12} weight="medium" color={palette.textTertiary} numberOfLines={2}>
                  no plans
                </BodyText>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function RecentCooks({
  days,
  plan,
  onOpenRecipe,
}: {
  days: ISODate[];
  plan: Record<ISODate, import('../../stores/weekPlan').DayPlan>;
  onOpenRecipe: (id: string) => void;
}) {
  if (days.length === 0) return null;

  return (
    <View>
      <Mono size={10} bold color={palette.accentDeep}>YOU'VE COOKED</Mono>
      <View style={{ height: spacing.sm }} />
      <View style={styles.recentList}>
        {days.map((date) => {
          const pick = activePickFor(plan[date]);
          if (!pick) return null;
          const { weekday, month, day: d } = formatDayShort(date);
          return (
            <Pressable
              key={date}
              onPress={() => onOpenRecipe(pick.id)}
              style={styles.recentRow}
              accessibilityRole="button"
              accessibilityLabel={`${weekday}: ${pick.title}`}
            >
              <View style={{ flex: 1 }}>
                <Mono size={9} color={palette.textSecondary}>
                  {weekday} · {month} {d}
                </Mono>
                <View style={{ height: 2 }} />
                <BodyText size={14} weight="semi" color={palette.ink} numberOfLines={1}>
                  {pick.title}
                </BodyText>
              </View>
              <ChevronRight size={16} color={palette.textTertiary} strokeWidth={2} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleWrap: { position: 'relative', alignSelf: 'flex-start' },
  title: { letterSpacing: -1.2, lineHeight: 44 },
  underline: { position: 'absolute', left: -6, bottom: -10 },
  emptyCard: {
    borderRadius: 22,
    padding: spacing.lg,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
  heroCard: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
  heroTitle: { letterSpacing: -0.5, lineHeight: 36 },
  upcomingCard: {
    width: 132,
    padding: spacing.sm + 2,
    borderRadius: 14,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
  upcomingThumb: { borderRadius: 10, overflow: 'hidden' },
  recentList: {
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
    paddingHorizontal: spacing.md,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(42, 58, 38, 0.08)',
  },
});
```

### Verification

- Fresh install: Tonight hero "What's for dinner?" + CTA. No Upcoming. No Recent.
- Complete Tonight flow → Cook tonight → hero populates. "Cook now" opens Recipe Modal. "Try another" cycles.
- Tag Week + draft → back to Tonight → Upcoming strip shows next 3 days.
- Force-kill + relaunch → hero + upcoming + recent all survive (weekPlan persisted).
- Cold-launch momentary state: `hasHydrated: false` → shows "Loading…" header, no empty CTA flashes before rehydrate.
- After next day rolls over (manually clear today's entry in dev), Tonight's hero falls back to empty; yesterday's pick appears in Recent cooks (because it has `selectedAt` on a past date).

---

## Move 9 — Shop: read from `weekPlan`, `IngredientGroup[]`-aware aggregation

**Files**
- `apps/native/src/features/shop/aggregateIngredients.ts` (new)
- `apps/native/src/features/shop/ShopScreen.tsx` (rewrite — read current file first)

### `src/features/shop/aggregateIngredients.ts`

Handles the real nested `IngredientGroup[] → Ingredient[]` shape.

```ts
// apps/native/src/features/shop/aggregateIngredients.ts
//
// Flattens weekPlan[date].recipes[pickIndex].ingredients (IngredientGroup[])
// into a deduped list for Shop. Uses parsed.canonicalKey when available,
// falls back to lowercased raw item string.

import type { DayPlan } from '../../stores/weekPlan';
import type { ISODate } from '../week/weekDates';

export interface ShopItem {
  key: string;
  name: string;
  quantities: string[];      // raw quantity strings, one per source recipe
  recipeCount: number;
  recipeTitles: string[];    // which recipes call for this
}

export function aggregateIngredients(
  plan: Record<ISODate, DayPlan>,
  todayIso: ISODate,
): ShopItem[] {
  const map = new Map<string, ShopItem>();

  for (const [date, day] of Object.entries(plan)) {
    // Include today AND future. Past is irrelevant for shopping.
    if (date < todayIso) continue;

    const pick = day.recipes?.[day.pickIndex ?? 0];
    if (!pick?.ingredients?.length) continue;

    // IngredientGroup[] → Ingredient[] flat list
    const flatIngredients = pick.ingredients.flatMap((g) => g.items ?? []);

    for (const ing of flatIngredients) {
      const rawName = (ing.item ?? '').trim();
      if (!rawName) continue;

      const key = ing.parsed?.canonicalKey ?? rawName.toLowerCase();
      const displayName = ing.parsed?.name ?? rawName;
      const quantityStr = ing.quantity?.trim() || '';

      const existing = map.get(key);
      if (existing) {
        if (quantityStr) existing.quantities.push(quantityStr);
        existing.recipeCount += 1;
        if (!existing.recipeTitles.includes(pick.title)) {
          existing.recipeTitles.push(pick.title);
        }
      } else {
        map.set(key, {
          key,
          name: displayName,
          quantities: quantityStr ? [quantityStr] : [],
          recipeCount: 1,
          recipeTitles: [pick.title],
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/**
 * Human-readable quantity summary for a ShopItem.
 * Does NOT attempt unit arithmetic in v1 — just joins distinct quantity strings.
 */
export function formatQuantity(item: ShopItem): string {
  if (item.quantities.length === 0) return 'to taste';
  if (item.quantities.length === 1) return item.quantities[0];
  // multiple: dedupe distinct strings, join with +
  const distinct = Array.from(new Set(item.quantities));
  if (distinct.length === 1) return `${distinct[0]} (×${item.recipeCount})`;
  return distinct.join(' + ');
}
```

### `src/features/shop/ShopScreen.tsx`

**Before rewriting, read the current file** (`apps/native/src/features/shop/ShopScreen.tsx`). Preserve the screen's visual frame (ScreenShell, header, kicker). Replace the data source with `aggregateIngredients(plan, todayISO())`.

Skeleton shape (adjust to match the existing visual style):

```tsx
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PaintedButton } from '../../components/painted';
import { Check } from 'lucide-react-native';
import { palette, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { useWeekPlan } from '../../stores/weekPlan';
import { todayISO } from '../week/weekDates';
import {
  aggregateIngredients,
  formatQuantity,
  type ShopItem,
} from './aggregateIngredients';

export function ShopScreen() {
  const { tap, success } = useHaptics();
  const plan = useWeekPlan((s) => s.plan);
  const hasHydrated = useWeekPlan((s) => s.hasHydrated);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const items: ShopItem[] = useMemo(
    () => (hasHydrated ? aggregateIngredients(plan, todayISO()) : []),
    [plan, hasHydrated],
  );

  const toggle = (key: string) => {
    tap();
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyList = async () => {
    if (items.length === 0) return;
    const text = items
      .map((i) => `• ${i.name} — ${formatQuantity(i)}`)
      .join('\n');
    await Clipboard.setStringAsync(text);
    success();
  };

  return (
    <ScreenShell horizontalPadding={24}>
      <Mono size={10} bold color={palette.accentDeep}>SHOP</Mono>
      <View style={{ height: spacing.sm }} />
      <View style={{ position: 'relative', alignSelf: 'flex-start' }}>
        <DisplayText size={38} color={palette.primary} style={{ letterSpacing: -1.2, lineHeight: 42 }}>
          Your list.
        </DisplayText>
        <BrushstrokeUnderline
          width={180}
          color={palette.accent}
          strokeWidth={2.4}
          style={{ position: 'absolute', left: -6, bottom: -8 }}
        />
      </View>

      <View style={{ height: spacing.md }} />
      <BodyText size={14} color={palette.textSecondary} weight="medium">
        Aggregated from your planned meals. Check items off as you shop.
      </BodyText>

      <View style={{ height: spacing.lg }} />

      {!hasHydrated ? (
        <Mono size={12} color={palette.textTertiary}>loading…</Mono>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Mono size={10} bold color={palette.accentDeep}>EMPTY</Mono>
          <View style={{ height: spacing.xs }} />
          <DisplayText size={22} color={palette.ink} style={{ letterSpacing: -0.5, lineHeight: 26 }}>
            No planned meals yet.
          </DisplayText>
          <View style={{ height: spacing.sm }} />
          <BodyText size={14} color={palette.textSecondary} weight="medium">
            Tag nights in Week and draft dinners — the shopping list builds itself.
          </BodyText>
        </View>
      ) : (
        <>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {items.map((item) => {
              const on = !!checked[item.key];
              return (
                <Pressable
                  key={item.key}
                  onPress={() => toggle(item.key)}
                  style={styles.row}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <View style={[styles.checkbox, on ? styles.checkboxOn : styles.checkboxOff]}>
                    {on ? <Check size={12} color={palette.surface} strokeWidth={3} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <BodyText
                      size={14}
                      weight="semi"
                      color={on ? palette.textTertiary : palette.ink}
                      style={on ? { textDecorationLine: 'line-through' } : undefined}
                    >
                      {item.name}
                    </BodyText>
                    <Mono size={10} color={palette.textSecondary}>
                      {formatQuantity(item)} · {item.recipeTitles.join(', ')}
                    </Mono>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ height: spacing.md }} />
          <PaintedButton
            label="Copy list"
            size="lg"
            tone="forest"
            onPress={copyList}
            fullWidth
          />
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 520 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(42, 58, 38, 0.08)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  checkboxOff: { borderColor: palette.glassBorder, backgroundColor: 'transparent' },
  checkboxOn: { borderColor: palette.primary, backgroundColor: palette.primary },
  empty: {
    borderRadius: 22,
    padding: spacing.lg,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
});
```

**Note on `Clipboard`:** Import is `import * as Clipboard from 'expo-clipboard';` — confirm the package is installed (`cd apps/native && grep expo-clipboard package.json`). If not, `bun add expo-clipboard` in `apps/native/`.

### Verification

- Empty weekPlan → empty state card on Shop.
- Plan a few days in Week → Shop list shows aggregated ingredients, sorted alphabetically.
- Checkboxes toggle (ephemeral, reset on app relaunch — documented).
- "Copy list" copies plaintext; paste elsewhere confirms.
- A recipe listing the same ingredient twice shows combined quantity string.

---

## Move 10 — Recipe Modal: non-destructive "Cook this tonight"

**File:** `apps/native/src/features/recipe/RecipeDetailModal.tsx` (edit)

Read the current file first. Find the primary action area / bottom dock. Add a "Cook this tonight" button visible when the viewed recipe is NOT already today's active pick.

Imports to add:
```ts
import { useWeekPlan, activePickFor } from '../../stores/weekPlan';
import { todayISO } from '../week/weekDates';
import { useHaptics } from '../../hooks/useHaptics';
import { useRouter } from 'expo-router';
```

In-component:
```tsx
const router = useRouter();
const { press } = useHaptics();
const plan = useWeekPlan((s) => s.plan);
const hasHydrated = useWeekPlan((s) => s.hasHydrated);
const appendRecipeAndSelect = useWeekPlan((s) => s.appendRecipeAndSelect);

const today = todayISO();
const todayPick = activePickFor(plan[today]);
const isAlreadyTonightsPick = todayPick?.id === recipe.id;

const onCookThisTonight = () => {
  if (!recipe || !hasHydrated) return;
  press();
  appendRecipeAndSelect(today, recipe);
  router.replace('/(tabs)/tonight');
};
```

In JSX, conditionally render (near the primary CTA area, e.g. the "Cook tonight" dock):
```tsx
{!isAlreadyTonightsPick && hasHydrated ? (
  <PaintedButton
    label="Cook this tonight"
    size="md"
    tone="forest"
    onPress={onCookThisTonight}
    trailingIcon={<ArrowRight size={14} color={palette.surface} />}
    fullWidth
  />
) : null}
```

**What this guarantees:**
- If today has no plan: sets `recipes: [recipe]`, pickIndex 0, selectedAt now.
- If today has a drafted trio not containing this recipe: appends recipe (trio becomes 4-long), pickIndex points to index 3. User can still cycle back via "Try another" on Tonight hero.
- If today's plan already contains this recipe at some index: just moves pickIndex to that index. No duplication.
- Never destroys existing recipes.

### Verification

- Open a recipe from Recent cooks (or any upcoming card) → "Cook this tonight" button visible.
- Tap → Tonight tab opens, hero shows that recipe.
- Tap "Try another" on Tonight hero → cycles through all recipes (original trio + the appended one).
- Reopen the same recipe from Tonight's hero → button is hidden (already today's pick).
- Hit it before `hasHydrated` flips → button is hidden. Nothing lost.

---

## Critical files

| Path | Move | Action |
|---|---|---|
| `apps/native/app/(tabs)/_layout.tsx` | 1 | Edit — 4 screens |
| `apps/native/app/(tabs)/week.tsx` | 1, 7 | Rename from swipe-night.tsx; stub then real import |
| `apps/native/app/(tabs)/saved.tsx` | 1 | Delete |
| `apps/native/src/components/FloatingTabBar.tsx` | 1 | Edit — TabName/LABELS/switch/imports |
| `apps/native/src/components/painted/Icon.tsx` | 1 | Edit — IconTabTonight body, rename Swipe→Week with new body, delete Saved |
| `apps/native/src/components/painted/index.ts` | 1 | Edit — rename + delete exports |
| `apps/native/src/features/week/weekDates.ts` | 2 | New — local date utils |
| `apps/native/src/stores/weekPlan.ts` | 3 | New — persisted, hydration-guarded |
| `apps/native/src/stores/batchSession.ts` | 3 | New — ephemeral progress, perDate status |
| `apps/native/src/types/energy.ts` | 4 | Edit — add ENERGY_TIER_MINUTES |
| `apps/native/src/components/EnergyPicker.tsx` | 4 | Edit — minutes-first rows |
| `apps/native/src/features/eat/ReviewRecipesScreen.tsx` | 5 | Rewrite — pick-one + writes to weekPlan[today] |
| `apps/native/src/features/eat/EnergyPickerScreen.tsx` | 6 | Copy patch |
| `apps/native/src/features/eat/ContextStep.tsx` | 6 | Copy patch |
| `apps/native/src/features/week/batchDraft.ts` | 7 | New — resumable orchestrator |
| `apps/native/src/features/week/DayRow.tsx` | 7 | New |
| `apps/native/src/features/week/WeekScreen.tsx` | 7 | New |
| `apps/native/src/features/tonight/TonightScreen.tsx` | 8 | Full rewrite — dashboard |
| `apps/native/src/features/shop/aggregateIngredients.ts` | 9 | New — IngredientGroup-aware |
| `apps/native/src/features/shop/ShopScreen.tsx` | 9 | Rewrite — read from weekPlan |
| `apps/native/src/features/recipe/RecipeDetailModal.tsx` | 10 | Edit — add non-destructive "Cook this tonight" |

---

## Dependencies

Verify before Move 3 / Move 9:

```bash
cd /Users/zach/Projects/qook/apps/native
grep zustand package.json
grep '@react-native-async-storage/async-storage' package.json
grep expo-clipboard package.json
```

- `zustand` is installed — `zustand/middleware` + `createJSONStorage` ship with it, no extra install.
- `@react-native-async-storage/async-storage` is standard in Expo templates; confirm presence, install if missing via `bun add @react-native-async-storage/async-storage`.
- `expo-clipboard` needed for Shop's "Copy list". Install if missing: `bun add expo-clipboard`.

The existing `api.generateRecipesForEnergy(tier, context?)` in `src/services/api.ts` is already usable by `batchDraft`. No refactor needed. The function returns `Promise<Recipe[]>` in both mock (returns `mockRecipes.slice(0, 3)`) and live mode.

---

## End-to-end verification

```bash
cd /Users/zach/Projects/qook/apps/native
bun run typecheck
bun run lint
bun run start
```

Happy path sim walk:

1. **Tab bar:** 4 tabs, simplified 22px icons (legible on physical iPhone).
2. **Tonight empty:** "What's for dinner?" → "Find tonight's dinner" → EnergyPicker minutes-hero → pick 30 → Context (skip) → Loading → Review one hero → "Try another" cycles → "Cook tonight" → opens Recipe Modal for chosen recipe. `weekPlan[today]` now has recipes trio + pickIndex + selectedAt.
3. Back to **Tonight:** hero shows the picked recipe. "Cook now" opens modal. "Try another" cycles.
4. **Week:** tag WED 15, THU 30, FRI 45 → CTA `Draft 3 dinners` → inline drafting progress (1 of 3, 2 of 3, 3 of 3) → all 3 rows show recipes with swap icons.
5. Tap WED swap → row cycles pick locally. No regeneration.
6. Back to **Tonight:** Upcoming strip shows WED/THU/FRI with their picks. Tap WED → Recipe Modal opens.
7. **Shop:** list aggregates ingredients across today + WED + THU + FRI. Check items off. "Copy list" copies plaintext.
8. **Persistence:** force-quit + relaunch → everything survives.
9. **Hydration:** cold launch shows "Loading…" on Tonight and "Loading..." disabled CTA on Week for <100ms, then flips to interactive. No data flashes.
10. **Batch failure + resume:** force an API error mid-batch (e.g. toggle to live mode with bad supabase URL). Week shows "Resume draft" button. Tap → only pending/failed dates re-run. Already-drafted days untouched. User swaps also preserved.
11. **Cook this tonight from modal:** open a past Recent cook → Recipe Modal → "Cook this tonight" → Tonight hero updates. Confirm the previous today-trio still exists inside `weekPlan[today].recipes` (the new recipe is appended, not replaced).
12. **DST boundary:** set device clock to Nov 3 10:00 PM local (simulated DST fall-back). Add a day from Nov 3 → expect Nov 4, not Nov 3-again.
13. **Clear future:** Week "Clear future" → dates after today wipe. Today + past remain. Tonight hero unaffected.

---

## Rollback

Moves are independent. Each has its own file set in the critical-files table. Mid-build breakage on Move N → `git checkout -- <files>` on that move only. Moves 1–6 can ship without 7–10; Tonight falls back to old query-based screen, Week stays as stub.

---

## Out of scope — deferred

- `cookedAt` explicit "mark as cooked" action (v1 assumes past-dated `selectedAt` ≈ cooked).
- Shop quantity unit arithmetic (v1 concatenates distinct strings).
- Shop persistence for check-off state.
- Instacart export / email PDF.
- Onboarding changes.
- Account deletion, auth polish.
- Live Seedream image generation (per CLAUDE.md, placeholder watercolor only in live mode).
- Cohort batch generation cron.
- PaintedButton → PolishedButton migration on shell surfaces.
- `src/features/swipe-night/` folder cleanup (route is renamed; folder retained).
- weekPlan storage versioning / migration strategy.
- Multi-user / household sharing of weekPlan.

---

## Load-bearing notes for the executing session

1. **Read before edit** for every file marked "edit" — the plan documents the *target* shape, but the existing file may have imports, helpers, or conventions worth preserving.
2. **Verify tab icon legibility at 22px** on a physical iPhone or sim before merging Move 1. If the new shapes alias or muddy, drop further: Week → rect + single top tab, Tonight → bowl + 1 steam tick.
3. **Hydration is load-bearing.** Any screen reading from `weekPlan` must gate on `hasHydrated` before showing empty-state CTAs that could drive new writes. The pattern is documented in Move 8 (Tonight) and Move 7 (Week) and Move 9 (Shop).
4. **Selected ≠ cooked.** Do not use `cookedAt` anywhere in v1 reads. It's reserved. Use `selectedAt` for history filtering.
5. **Shop aggregator treats `ingredients` as `IngredientGroup[]`.** Do NOT write `pick.ingredients.map(i => i.name)` — that would silently produce empty results. Always `.flatMap(g => g.items)` first.
