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
      reset();
      router.replace('/(tabs)/tonight');
    }
  }, [nothingToPlace, reset, router]);

  const setDay = (index: number, date: ISODate) => {
    select();
    setChoices((c) => ({ ...c, [index]: c[index] === date ? null : date }));
  };

  const finish = async () => {
    press();
    // Read the store directly rather than the render-closure `kept`: a phase-2
    // fill can reconcile (id swap) in the same tick Done is tapped, and we want
    // whichever recipe object is live at write time, keyed by the same indexes
    // `choices` was seeded and toggled with.
    const liveKept = useGenerationSession.getState().deck?.kept ?? kept;
    const writes = allocationWrites(
      liveKept.map((r, i) => ({ recipe: r, date: choices[i] ?? null }))
    );
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
        {kept.map((r, i) => (
          <AllocationRow
            key={`${r.id}-${i}`}
            recipe={r}
            days={days}
            selected={choices[i] ?? null}
            onSelect={(d) => setDay(i, d)}
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
