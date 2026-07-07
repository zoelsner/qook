import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { FoodHeroImage } from '../../components/FoodHeroImage';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { IconPill } from '../../components/painted';
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

  const handleClose = () => {
    press();
    reset();
    router.back();
  };

  const handleRegenerate = () => {
    if (!tier) return;
    press();
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
    setRecipes(today, recipes);
    setPickIndex(today, pickIdx);
    commitSelection(today);
    reset();
    router.replace({ pathname: '/(modals)/recipe/[id]', params: { id: pick.id } });
  };

  const pick = recipes[pickIdx];
  const totalPicks = recipes.length;

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
          <Mono size={10} bold color={palette.accentDeep}>
            review
          </Mono>
          <View style={styles.kickerDot} />
          <Mono size={10} color={palette.textSecondary}>
            {tier ? ENERGY_TIER_LABEL[tier].toUpperCase() : '—'} · pick{' '}
            {totalPicks === 0 ? 0 : pickIdx + 1} of {totalPicks}
          </Mono>
        </View>
        <View style={styles.displayTitleWrap}>
          <DisplayText size={38} color={palette.primary} style={styles.displayTitle}>
            Tonight&rsquo;s pick.
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
        <ErrorState
          message={errorMsg ?? 'Something went sideways.'}
          onRetry={handleRegenerate}
        />
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
            {pick.cuisine} · {pick.timeMinutes} min
            {pick.nutritionalEstimate?.proteinG != null
              ? ` · ${pick.nutritionalEstimate.proteinG} g of protein`
              : ''}
            {' '}· serves {pick.servings}
          </Mono>
          {pick.notes ? (
            <>
              <View style={{ height: spacing.sm }} />
              <BodyText
                size={14}
                color={palette.textSecondary}
                weight="medium"
                numberOfLines={3}
              >
                {pick.notes}
              </BodyText>
            </>
          ) : null}
          <View style={{ height: spacing.lg }} />
          <PolishedButton
            label="Cook tonight"
            tone="forest"
            onPress={handleCook}
            trailingIcon={<ArrowRight size={14} color={palette.surface} />}
          />
          <View style={{ height: spacing.sm + 2 }} />
          <Pressable
            hitSlop={6}
            onPress={handleSwap}
            style={{ alignSelf: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="Try another pick"
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
      <Mono size={10} bold color={palette.destructive}>
        {"couldn't draft"}
      </Mono>
      <View style={{ height: spacing.xs }} />
      <DisplayText
        size={22}
        color={palette.ink}
        style={{ letterSpacing: -0.5, lineHeight: 26 }}
      >
        {message}
      </DisplayText>
      <View style={{ height: spacing.md }} />
      <PolishedButton label="Try again" tone="rust" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
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
  displayTitleWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  displayTitle: {
    letterSpacing: -1.2,
    lineHeight: 42,
  },
  displayUnderline: {
    position: 'absolute',
    left: -6,
    bottom: -8,
  },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
  cardTitle: {
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  errorCard: {
    borderRadius: 22,
    padding: spacing.lg,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
});
