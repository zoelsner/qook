import { ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EnergyTier } from '@qook/shared';

import { PolishedButton } from '../../components/PolishedButton';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { ScreenShell } from '../../components/ScreenShell';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { palette, screen, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { useGenerationSession } from '../../stores/generationSession';
import { taggedFutureOrTodayDays, useWeekPlan } from '../../stores/weekPlan';
import type { ResetNight } from '../eat/weekReset';
import { DaySheet } from './DaySheet';
import { DayRow } from './DayRow';
import { formatDayShort, upcomingDays, todayISO, type ISODate } from './weekDates';

export function WeekScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { press, tap } = useHaptics();
  const plan = useWeekPlan((state) => state.plan);
  const hasHydrated = useWeekPlan((state) => state.hasHydrated);
  const clearFuture = useWeekPlan((state) => state.clearFuture);
  const startWeekReset = useGenerationSession((state) => state.startWeekReset);
  const [sheet, setSheet] = useState<{ date: ISODate; tier: EnergyTier } | null>(null);

  const today = todayISO();
  const days = upcomingDays(7, today);
  const tagged = taggedFutureOrTodayDays(plan, today);

  const first = formatDayShort(days[0]);
  const last = formatDayShort(days[days.length - 1]);
  const rangeKicker = `${first.month} ${first.day} — ${last.month} ${last.day}`;

  const onPlanWeek = () => {
    if (!hasHydrated || tagged.length === 0) return;
    press();
    const nights: ResetNight[] = tagged
      .map((date) => {
        const tier = plan[date]?.energy;
        return tier ? { date, tier } : null;
      })
      .filter((n): n is ResetNight => n !== null);
    if (nights.length === 0) return;
    startWeekReset(nights);
    router.push('/(eat)/context');
  };

  const onOpenRecipe = (recipeId: string) => {
    press();
    router.push({ pathname: '/(modals)/recipe/[id]', params: { id: recipeId } });
  };

  const onClearFuture = () => {
    tap();
    clearFuture();
  };

  const onOpenDay = (date: ISODate, tier: EnergyTier) => {
    press();
    setSheet({ date, tier });
  };

  return (
    <ScreenShell horizontalPadding={24} scrollable={false}>
      <View style={styles.header}>
        <View style={styles.kickerRow}>
          <Mono size={10} bold color={palette.accentDeep}>
            PLAN
          </Mono>
          <View style={styles.kickerDot} />
          <Mono size={10} color={palette.textSecondary}>
            {rangeKicker}
          </Mono>
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
        Tap a time on the nights you&apos;ll cook. Scroll for the rest.
      </BodyText>

      <View style={{ height: spacing.lg }} />

      <View style={styles.pinnedToday}>
        <DayRow date={days[0]} onOpenRecipe={onOpenRecipe} onOpenDay={onOpenDay} />
      </View>

      <View style={styles.card}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 4 }}
        >
          {days.slice(1).map((date) => (
            <DayRow key={date} date={date} onOpenRecipe={onOpenRecipe} onOpenDay={onOpenDay} />
          ))}
        </ScrollView>
      </View>

      <View style={{ height: spacing.sm }} />

      <View style={styles.summary}>
        <View style={styles.summaryLeft}>
          <Mono size={10} bold color={palette.primary}>
            {tagged.length} {tagged.length === 1 ? 'NIGHT' : 'NIGHTS'} SET
          </Mono>
          <View style={styles.kickerDot} />
          <Mono size={10} color={palette.textSecondary}>
            scroll for more
          </Mono>
        </View>
        <Pressable hitSlop={6} onPress={onClearFuture}>
          <BodyText size={12} weight="medium" color={palette.accentDeep}>
            Clear upcoming
          </BodyText>
        </Pressable>
      </View>

      <View style={{ height: spacing.sm }} />

      {!hasHydrated ? (
        <PolishedButton label="Loading..." tone="forest" onPress={() => undefined} disabled />
      ) : (
        <PolishedButton
          label={tagged.length === 0 ? 'Tag a night to start' : 'Plan my week'}
          tone="forest"
          onPress={onPlanWeek}
          disabled={tagged.length === 0}
          trailingIcon={
            tagged.length > 0 ? <ArrowRight size={14} color={palette.surface} /> : undefined
          }
        />
      )}

      <View style={{ height: spacing.xs + 2 }} />
      <BodyText
        size={11}
        weight="medium"
        color={palette.textTertiary}
        style={{ textAlign: 'center' }}
      >
        Swipe a hand of ideas, place your keeps
      </BodyText>

      {sheet ? (
        <DaySheet
          date={sheet.date}
          tier={sheet.tier}
          visible={sheet != null}
          onClose={() => setSheet(null)}
        />
      ) : null}
      <View style={{ height: insets.bottom + screen.tabBarHeight + spacing.sm }} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 6,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kickerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.textSecondary,
  },
  titleWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  title: {
    letterSpacing: -1.2,
    lineHeight: 42,
  },
  displayUnderline: {
    position: 'absolute',
    left: -6,
    bottom: -8,
  },
  pinnedToday: {
    paddingHorizontal: 18,
  },
  card: {
    flex: 1,
    borderRadius: 22,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
