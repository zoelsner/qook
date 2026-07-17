import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { EnergyTier, Recipe } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { Vignette } from '../../components/Vignette';
import { DisplayText, Mono, BodyText } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { palette, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { useGenerationSession } from '../../stores/generationSession';
import { useWeekPlan, activePickFor } from '../../stores/weekPlan';
import { allocateKeeps, tierMismatch, dayChipState, type DayChipState } from './allocation';
import { TIER_MAX_MINUTES } from './weekReset';
import { api } from '../../services/api';
import { addDaysISO, todayISO, type ISODate } from '../week/weekDates';
import type { SeedMealKey } from '../../lib/assets';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function benchNoticeCopy(count: number): string {
  return count === 1
    ? '1 extra saved to your bench — tap a night to use it.'
    : `${count} extras saved to your bench — tap a night to use them.`;
}

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
  const mode = useGenerationSession((s) => s.mode);
  const resetNights = useGenerationSession((s) => s.resetNights);
  const reset = useGenerationSession((s) => s.reset);
  const addToBench = useGenerationSession((s) => s.addToBench);
  const setBenchNotice = useGenerationSession((s) => s.setBenchNotice);
  const appendRecipeAndSelect = useWeekPlan((s) => s.appendRecipeAndSelect);
  const commitSelection = useWeekPlan((s) => s.commitSelection);
  const plan = useWeekPlan((s) => s.plan);

  const kept = deck?.kept ?? [];
  const cookTonightId = deck?.cookTonightId ?? null;
  // Every upcoming day is placeable — extras can land on untagged nights too
  // (Zach 2026-07-13: "why doesn't it show Thu–Sun?"). Tagged reset nights
  // carry their tier so the chip can show the time budget.
  const days = useMemo(() => {
    const base = dayOptions();
    if (mode !== 'week') {
      return base.map((d) => ({ ...d, tier: undefined as EnergyTier | undefined }));
    }
    const tierByDate = new Map(resetNights.map((n) => [n.date, n.tier]));
    return base.map((d) => ({ ...d, tier: tierByDate.get(d.date) }));
  }, [mode, resetNights]);

  // Pre-select "Tonight" for the cooked recipe; others start unassigned.
  // Keyed by POSITION, not recipe id: reconcileKept (deckState.ts) swaps a kept
  // recipe's id in place when a phase-2 fill cache-hits, and that swap can land
  // after this screen has already mounted and seeded choices. Indexes survive
  // the id swap because reconcileKept is order-preserving; a same-render id key
  // would silently lose the "Tonight" pre-selection.
  const [choices, setChoices] = useState<Record<number, ISODate | null>>(() => {
    const seed: Record<number, ISODate | null> = {};
    kept.forEach((r, i) => {
      seed[i] = r.id === cookTonightId ? todayISO() : null;
    });
    return seed;
  });

  // Nothing to place (opened directly, or all keeps cleared) — bounce home.
  // Side effect lives in an effect, never in render.
  const nothingToPlace = !deck || kept.length === 0;
  useEffect(() => {
    if (nothingToPlace) {
      if (mode !== 'week') reset();
      router.replace(mode === 'week' ? '/(tabs)/week' : '/(tabs)/tonight');
    }
  }, [nothingToPlace, reset, router, mode]);

  const setDay = (index: number, date: ISODate) => {
    select();
    setChoices((c) => ({ ...c, [index]: c[index] === date ? null : date }));
  };

  // Chips carry week state now — a tap on a taken night asks before it steals
  // it, instead of silently bumping another keep or hiding an existing plan
  // pick as an alternate (Zach device feedback 2026-07-17).
  const requestDay = (index: number, date: ISODate, dayLabel: string, state: DayChipState) => {
    if (choices[index] === date) {
      setDay(index, date);
      return;
    }
    if (state.kind === 'claimed') {
      Alert.alert(
        'Already claimed',
        `${dayLabel} has ${state.claimedTitle} from this hand. Move ${kept[index].title} here instead?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Move it here',
            onPress: () => {
              select();
              setChoices((c) => ({ ...c, [state.claimedIndex]: null, [index]: date }));
            },
          },
        ],
      );
      return;
    }
    if (state.kind === 'planned') {
      Alert.alert(
        `${dayLabel} is taken`,
        `${dayLabel} already has ${state.plannedTitle}. Put this in the spotlight instead? It stays as an alternate.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Swap it in', onPress: () => setDay(index, date) },
        ],
      );
      return;
    }
    setDay(index, date);
  };

  const finish = async () => {
    press();
    // Read the store directly rather than the render-closure `kept`: a phase-2
    // fill can reconcile (id swap) in the same tick Done is tapped, and we want
    // whichever recipe object is live at write time, keyed by the same indexes
    // `choices` was seeded and toggled with.
    const liveKept = useGenerationSession.getState().deck?.kept ?? kept;
    const dayChoices = liveKept.map((r, i) => ({ recipe: r, date: choices[i] ?? null }));
    const nightDates = mode === 'week' ? days.map((d) => d.date) : [];
    const outcome = allocateKeeps(dayChoices, nightDates);

    for (const w of outcome.placed) {
      // Re-fetch the freshest row so a completed phase-2 fill's ingredients land
      // in the plan (Shop aggregation reads plan recipes' ingredients).
      const fresh = (await api.getRecipeById(w.recipe.id).catch(() => null)) ?? w.recipe;
      appendRecipeAndSelect(w.date, fresh);
      commitSelection(w.date);
    }
    if (mode === 'week' && outcome.benched.length) {
      addToBench(outcome.benched);
      setBenchNotice(benchNoticeCopy(outcome.benched.length));
    }

    // Live read, like liveKept above — a reconcile can swap the id between render and Done.
    const cooked = useGenerationSession.getState().deck?.cookTonightId ?? cookTonightId;
    // In week mode, leave the session (and its bench) in place — reset() nulls
    // `deck`, which would wipe the bench the day sheet needs. It clears on the
    // next startWeekReset instead (spec D7).
    if (mode !== 'week') reset();
    if (cooked) {
      router.replace({ pathname: '/(modals)/recipe/[id]', params: { id: cooked } });
    } else {
      router.replace(mode === 'week' ? '/(tabs)/week' : '/(tabs)/tonight');
    }
  };

  const skipAll = () => {
    press();
    if (mode === 'week') {
      // In week mode keeps were already saved (savedRecipeIds) and passes/
      // over-keeps stay on the bench for the day sheet; leave the session.
      const benching = useGenerationSession.getState().deck?.kept ?? [];
      addToBench(benching);
      if (benching.length) setBenchNotice(benchNoticeCopy(benching.length));
    } else {
      reset();
    }
    router.replace(mode === 'week' ? '/(tabs)/week' : '/(tabs)/tonight');
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
        {kept.map((r, i) => {
          const dayStates = days.map((d) => {
            const budget = d.tier ? TIER_MAX_MINUTES[d.tier] : null;
            const over = d.tier ? tierMismatch(r.timeMinutes, d.tier) : false;
            const plannedTitle = activePickFor(plan[d.date])?.title ?? null;
            const claimIndex = kept.findIndex((_, j) => j !== i && choices[j] === d.date);
            const claim = claimIndex === -1 ? null : { index: claimIndex, title: kept[claimIndex].title };
            const state = dayChipState({ dayLabel: d.label, budget, over, plannedTitle, claim });
            return { ...state, date: d.date, over, dayLabel: d.label };
          });
          return (
            <AllocationRow
              key={`${r.id}-${i}`}
              recipe={r}
              dayStates={dayStates}
              selected={choices[i] ?? null}
              onSelect={(d, label, state) => requestDay(i, d, label, state)}
            />
          );
        })}
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

type RowDayState = DayChipState & { date: ISODate; over: boolean; dayLabel: string };

function AllocationRow({
  recipe,
  dayStates,
  selected,
  onSelect,
}: {
  recipe: Recipe;
  dayStates: RowDayState[];
  selected: ISODate | null;
  onSelect: (date: ISODate, dayLabel: string, state: DayChipState) => void;
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
        {dayStates.map((d) => {
          const active = selected === d.date;
          const taken = d.kind !== 'free';
          return (
            <Pressable
              key={d.date}
              onPress={() => onSelect(d.date, d.dayLabel, d)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                active ? styles.chipActive : null,
                d.kind === 'free' && d.over && !active ? styles.chipOver : null,
                taken && !active ? styles.chipTaken : null,
              ]}
            >
              <Mono
                size={10}
                bold
                color={
                  active
                    ? palette.surface
                    : taken
                      ? palette.textTertiary
                      : d.over
                        ? palette.utility
                        : palette.textSecondary
                }
              >
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
  chipOver: {
    borderColor: palette.utility,
  },
  chipTaken: {
    borderStyle: 'dashed',
  },
  skipRow: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
