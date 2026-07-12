import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, X } from 'lucide-react-native';
import type { EnergyTier } from '@qook/shared';

import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { Vignette } from '../../components/Vignette';
import { palette, radius, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { api } from '../../services/api';
import { useGenerationSession } from '../../stores/generationSession';
import { activePickFor, useWeekPlan } from '../../stores/weekPlan';
import { benchCards } from '../eat/deckState';
import { formatDayShort, type ISODate } from './weekDates';
import type { ResetNight } from '../eat/weekReset';
import type { SeedMealKey } from '../../lib/assets';

export function DaySheet({
  date,
  tier,
  visible,
  onClose,
}: {
  date: ISODate;
  tier: EnergyTier;
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { press, tap } = useHaptics();
  const deck = useGenerationSession((s) => s.deck);
  const context = useGenerationSession((s) => s.context);
  const placeFromBench = useGenerationSession((s) => s.placeFromBench);
  const reconcileKept = useGenerationSession((s) => s.reconcileKept);
  const startWeekReset = useGenerationSession((s) => s.startWeekReset);
  const appendRecipeAndSelect = useWeekPlan((s) => s.appendRecipeAndSelect);
  const commitSelection = useWeekPlan((s) => s.commitSelection);
  const savedRecipeIds = useWeekPlan((s) => s.savedRecipeIds);
  const toggleSavedRecipe = useWeekPlan((s) => s.toggleSavedRecipe);
  const remapSavedRecipe = useWeekPlan((s) => s.remapSavedRecipe);

  const cards = useMemo(() => (deck ? benchCards(deck) : []), [deck]);
  const { weekday } = formatDayShort(date);

  const place = (recipeId: string) => {
    const card = cards.find((c) => c.id === recipeId);
    if (!card) return;
    press();
    placeFromBench(card);
    appendRecipeAndSelect(date, card);
    commitSelection(date);
    onClose();
    // Bench cards are mostly passes — phase-2 never ran for them, so the
    // object just placed is an ingredient-less skeleton. Fill in the
    // background and swap the full (possibly cache-hit-redirected) row into
    // the day, mirroring DeckScreen.runFill at the plan-write boundary.
    void (async () => {
      try {
        const finalId =
          card.contentStatus === 'full'
            ? card.id
            : (await api.fillRecipe(card.id, context || undefined)).recipeId;
        const full = await api.getRecipeById(finalId);
        if (!full) return;
        // Don't resurrect the day if the user cleared or re-picked it while
        // the fill ran — a background write landing then reads as auto-fill.
        const active = activePickFor(useWeekPlan.getState().plan[date]);
        if (active?.id !== card.id) return;
        reconcileKept(card.id, full);
        appendRecipeAndSelect(date, full);
        commitSelection(date);
        if (full.id !== card.id) remapSavedRecipe(card.id, full.id);
      } catch {
        /* the skeleton stays placed; detail view offers retry on next open */
      }
    })();
  };

  const dealFresh = () => {
    press();
    const night: ResetNight = { date, tier };
    startWeekReset([night]);
    onClose();
    router.push('/(eat)/context');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.head}>
          <View>
            <Mono size={10} bold color={palette.accentDeep}>
              {weekday.toLowerCase()}
            </Mono>
            <View style={{ height: 4 }} />
            <DisplayText size={24} color={palette.primary}>
              {cards.length ? 'From your bench' : 'Nothing benched yet'}
            </DisplayText>
          </View>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <X size={18} color={palette.ink} strokeWidth={2.2} />
          </Pressable>
        </View>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {cards.map((c) => {
            const saved = savedRecipeIds.includes(c.id);
            return (
              <View key={c.id} style={styles.card}>
                <Pressable style={styles.cardMain} onPress={() => place(c.id)} accessibilityRole="button">
                  <Vignette
                    size={44}
                    localKey={c.localImageKey as SeedMealKey | undefined}
                    remoteUrl={c.heroImageUrl}
                    imageStatus={c.imageStatus}
                    title={c.title}
                  />
                  <View style={styles.cardText}>
                    <DisplayText size={16} color={palette.ink} numberOfLines={2}>
                      {c.title}
                    </DisplayText>
                    <Mono size={10} color={palette.textSecondary}>
                      {c.timeMinutes} min · {c.cuisine.toLowerCase()}
                    </Mono>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => {
                    tap();
                    toggleSavedRecipe(c.id);
                  }}
                  hitSlop={10}
                  accessibilityLabel={saved ? 'Unsave' : 'Save'}
                >
                  <Heart
                    size={18}
                    color={saved ? palette.accent : palette.textTertiary}
                    fill={saved ? palette.accent : 'transparent'}
                    strokeWidth={2}
                  />
                </Pressable>
              </View>
            );
          })}
          {!cards.length ? (
            <BodyText size={14} color={palette.textSecondary} weight="medium" style={styles.empty}>
              Deal a fresh hand for {weekday} — passes and extras land here for quick swaps.
            </BodyText>
          ) : null}
          <View style={{ height: spacing.md }} />
        </ScrollView>

        <PolishedButton label="Deal fresh ideas" tone="forest" onPress={dealFresh} />
        <View style={{ height: spacing.md }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 24, 18, 0.35)',
  },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    maxHeight: '78%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.statRuleColor,
    marginBottom: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  list: {
    flexGrow: 0,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.statRuleColor,
    gap: spacing.sm,
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  empty: {
    paddingVertical: spacing.lg,
  },
});
