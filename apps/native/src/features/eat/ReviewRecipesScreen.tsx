import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { Vignette } from '../../components/Vignette';
import { DisplayText, Mono, ItalicText } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { IconPill } from '../../components/painted';
import { X, RefreshCw } from 'lucide-react-native';
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
      )}
    </ScreenShell>
  );
}

function firstWord(title: string): string {
  return title.trim().split(/\s+/)[0]?.toLowerCase() || 'this';
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
  errorCard: {
    borderRadius: 22,
    padding: spacing.lg,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
});
