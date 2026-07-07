import type { EnergyTier } from '@qook/shared';
import { ChevronRight, RefreshCw } from 'lucide-react-native';
import React from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { BodyText, DisplayText, Mono } from '../../components/Text';
import { palette } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { useBatchSession } from '../../stores/batchSession';
import { activePickFor, useWeekPlan } from '../../stores/weekPlan';
import { energyTierColors } from '../../types/energy';
import { formatDayShort, isToday, type ISODate } from './weekDates';

const WEEK_TIERS: { tier: EnergyTier; minutes: number }[] = [
  { tier: 'brain-is-fried', minutes: 15 },
  { tier: 'after-work', minutes: 30 },
  { tier: 'got-energy', minutes: 45 },
];

export function DayRow({
  date,
  onOpenRecipe,
}: {
  date: ISODate;
  onOpenRecipe: (recipeId: string) => void;
}) {
  const { tap, select } = useHaptics();
  const setEnergy = useWeekPlan((state) => state.setEnergy);
  const clearEnergy = useWeekPlan((state) => state.clearEnergy);
  const swapPick = useWeekPlan((state) => state.swapPick);
  const clearDay = useWeekPlan((state) => state.clearDay);
  const day = useWeekPlan((state) => state.plan[date]);
  // Guard: while a batch draft is in flight, ignore chip mutations — otherwise
  // an in-flight response can repopulate a day the user just cleared or
  // retarget a tier the user just changed (Codex adversarial finding #2).
  const drafting = useBatchSession((s) => s.status === 'drafting');

  const { weekday } = formatDayShort(date);
  const activeTier = day?.energy;
  const pick = activePickFor(day);

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

  const onChipPress = (tier: EnergyTier) => {
    if (drafting) return;
    if (activeTier === tier) {
      tap();
      clearEnergy(date);
      return;
    }

    select();
    setEnergy(date, tier);
  };

  if (pick) {
    return (
      <Pressable
        onPress={() => onOpenRecipe(pick.id)}
        onLongPress={onClearDay}
        delayLongPress={400}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={`${weekday}: ${pick.title}. Long-press to clear.`}
      >
        <View style={styles.dayLabel}>
          {isToday(date) ? <View style={styles.todayDot} /> : <View style={styles.todayDotSpacer} />}
          <Mono size={12} bold color={palette.ink}>
            {weekday}
          </Mono>
        </View>
        <View style={styles.pickArea}>
          <BodyText size={14} weight="semi" color={palette.ink} numberOfLines={1}>
            {pick.title}
          </BodyText>
          <Mono size={10} color={palette.textSecondary}>
            {pick.cuisine} · {pick.timeMinutes} min
            {pick.nutritionalEstimate?.proteinG != null
              ? ` · ${pick.nutritionalEstimate.proteinG} g of protein`
              : ''}
          </Mono>
        </View>
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
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.dayLabel}>
        {isToday(date) ? <View style={styles.todayDot} /> : <View style={styles.todayDotSpacer} />}
        <Mono size={12} bold color={palette.ink}>
          {weekday}
        </Mono>
      </View>
      <View style={styles.chips}>
        {WEEK_TIERS.map(({ tier, minutes }) => {
          const active = activeTier === tier;
          const colors = energyTierColors(tier);
          return (
            <Pressable
              key={tier}
              onPress={() => onChipPress(tier)}
              disabled={drafting}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: colors.text, borderColor: colors.text }
                  : styles.chipInactive,
                drafting ? styles.chipDrafting : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${minutes} minutes`}
              accessibilityState={{ selected: active, disabled: drafting }}
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
    gap: 12,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(42, 58, 38, 0.08)',
  },
  dayLabel: {
    width: 56,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.accent,
  },
  todayDotSpacer: {
    width: 6,
    height: 6,
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  chip: {
    width: 66,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipInactive: {
    backgroundColor: palette.surface,
    borderColor: palette.glassBorder,
  },
  chipDrafting: {
    opacity: 0.55,
  },
  chipNumber: {
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  pickArea: {
    flex: 1,
    gap: 2,
  },
  swapBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceTranslucent,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
});
