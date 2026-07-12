import { ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PolishedButton } from '../../components/PolishedButton';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { ScreenShell } from '../../components/ScreenShell';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { palette, screen, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { useBatchSession } from '../../stores/batchSession';
import { taggedFutureOrTodayDays, useWeekPlan } from '../../stores/weekPlan';
import { DayRow } from './DayRow';
import { batchDraft } from './batchDraft';
import { formatDayShort, upcomingDays, todayISO } from './weekDates';

export function WeekScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { press, tap } = useHaptics();
  const plan = useWeekPlan((state) => state.plan);
  const hasHydrated = useWeekPlan((state) => state.hasHydrated);
  const clearFuture = useWeekPlan((state) => state.clearFuture);
  const batch = useBatchSession();

  const today = todayISO();
  const days = upcomingDays(7, today);
  const tagged = taggedFutureOrTodayDays(plan, today);
  const drafting = batch.status === 'drafting';
  const failed = batch.status === 'error';

  const first = formatDayShort(days[0]);
  const last = formatDayShort(days[days.length - 1]);
  const rangeKicker = `${first.month} ${first.day} — ${last.month} ${last.day}`;

  const onDraft = async () => {
    if (!hasHydrated || tagged.length === 0) return;
    press();
    useBatchSession.getState().reset();
    await batchDraft(tagged);
  };

  const onRetry = async () => {
    press();
    await batchDraft(tagged);
  };

  const onOpenRecipe = (recipeId: string) => {
    press();
    router.push({ pathname: '/(modals)/recipe/[id]', params: { id: recipeId } });
  };

  const onClearFuture = () => {
    // Guard: blocking clearFuture while a batch draft is in flight avoids the
    // stale-write race where in-flight responses repopulate days the user
    // just cleared (Codex adversarial finding #2).
    if (drafting) return;
    tap();
    clearFuture();
    useBatchSession.getState().reset();
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
        <DayRow date={days[0]} onOpenRecipe={onOpenRecipe} />
      </View>

      <View style={styles.card}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 4 }}
        >
          {days.slice(1).map((date) => (
            <DayRow key={date} date={date} onOpenRecipe={onOpenRecipe} />
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
        <Pressable hitSlop={6} onPress={onClearFuture} disabled={drafting}>
          <BodyText
            size={12}
            weight="medium"
            color={drafting ? palette.textTertiary : palette.accentDeep}
          >
            Clear upcoming
          </BodyText>
        </Pressable>
      </View>

      <View style={{ height: spacing.sm }} />

      {!hasHydrated ? (
        <PolishedButton
          label="Loading..."
          tone="forest"
          onPress={() => undefined}
          disabled
        />
      ) : drafting ? (
        <View style={styles.draftingCard}>
          <ActivityIndicator size="small" color={palette.primary} />
          <View style={{ height: spacing.xs }} />
          <BodyText size={13} weight="semi" color={palette.ink}>
            Drafting {Math.min(batch.completed + 1, batch.total)} of {batch.total}
            {batch.currentDate ? ` · ${formatDayShort(batch.currentDate).weekday}` : ''}
          </BodyText>
        </View>
      ) : failed ? (
        <PolishedButton label="Resume draft" tone="rust" onPress={onRetry} />
      ) : (
        <PolishedButton
          label={
            tagged.length === 0
              ? 'Tag a night to start'
              : `Draft ${tagged.length} ${tagged.length === 1 ? 'dinner' : 'dinners'}`
          }
          tone="forest"
          onPress={onDraft}
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
        About 15 seconds · one shopping list at the end
      </BodyText>

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
  draftingCard: {
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
});
