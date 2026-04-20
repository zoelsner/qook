import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Recipe } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { FoodHeroImage } from '../../components/FoodHeroImage';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import {
  PaintedButton,
  PaintedDivider,
  IconPill,
  IconClose,
  IconArrowRight,
  IconRefresh,
  IconHeart,
  GlassChip,
} from '../../components/painted';
import { palette, spacing } from '../../design';
import { ENERGY_TIER_LABEL } from '../../types/energy';
import { useHaptics } from '../../hooks/useHaptics';
import { useGenerationSession } from '../../stores/generationSession';
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
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});

  const handleRegenerate = () => {
    if (!tier) return;
    press();
    start(tier);
    router.replace('/(eat)/loading');
  };

  const handleClose = () => {
    press();
    reset();
    router.back();
  };

  const toggleSave = (id: string) => {
    select();
    setSavedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openRecipe = (id: string) => {
    press();
    router.push({ pathname: '/(modals)/recipe/[id]', params: { id } });
  };

  const savedCount = Object.values(savedIds).filter(Boolean).length;

  return (
    <ScreenShell horizontalPadding={24}>
      <View style={styles.topBar}>
        <IconPill onPress={handleClose} accessibilityLabel="Close">
          <IconClose />
        </IconPill>
        <IconPill
          onPress={handleRegenerate}
          accessibilityLabel="Regenerate"
          disabled={!tier}
        >
          <IconRefresh />
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
            {tier ? ENERGY_TIER_LABEL[tier].toUpperCase() : '—'} · {recipes.length} drafts
          </Mono>
        </View>
        <View style={styles.displayTitleWrap}>
          <DisplayText size={38} color={palette.primary} style={styles.displayTitle}>
            Three new ideas
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
      ) : (
        <>
          <BodyText size={14} color={palette.textSecondary} weight="medium">
            {"Tap the heart on the ones you want — they'll land in Saved and feed tomorrow's shopping list."}
          </BodyText>
          <View style={{ height: spacing.lg }} />

          <View style={styles.list}>
            {recipes.map((recipe, idx) => (
              <View key={recipe.id} style={idx > 0 ? { marginTop: spacing.md } : null}>
                <ReviewCard
                  recipe={recipe}
                  saved={!!savedIds[recipe.id]}
                  onOpen={() => openRecipe(recipe.id)}
                  onToggleSave={() => toggleSave(recipe.id)}
                />
              </View>
            ))}
          </View>

          <View style={{ height: spacing.lg }} />
          <PaintedDivider />
          <View style={{ height: spacing.md }} />

          <PaintedButton
            label={savedCount === 0 ? 'Save all three' : `Save ${savedCount} of ${recipes.length}`}
            size="lg"
            tone="forest"
            onPress={handleClose}
            trailingIcon={<IconArrowRight size={14} color={palette.surface} />}
            fullWidth
          />
          <View style={{ height: spacing.sm + 2 }} />
          <Pressable hitSlop={6} onPress={handleRegenerate} style={{ alignSelf: 'center' }}>
            <BodyText size={12} weight="semi" color={palette.textSecondary}>
              Not these — draft again
            </BodyText>
          </Pressable>
        </>
      )}
    </ScreenShell>
  );
}

function ReviewCard({
  recipe,
  saved,
  onOpen,
  onToggleSave,
}: {
  recipe: Recipe;
  saved: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
}) {
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.card,
        pressed ? { opacity: 0.95, transform: [{ scale: 0.995 }] } : null,
      ]}
    >
      <View style={styles.cardImageWrap}>
        <FoodHeroImage
          localKey={recipe.localImageKey as SeedMealKey | undefined}
          remoteUrl={recipe.heroImageUrl}
          blurhash={recipe.blurhash}
          height={140}
          cornerRadius={0}
          style={{ width: '100%', height: 140 }}
        />
        <GlassChip style={styles.tierBadge}>
          <View style={[styles.tinyDot, { backgroundColor: palette.accent }]} />
          <Mono size={9} bold color={palette.accentDeep}>
            {ENERGY_TIER_LABEL[recipe.tier].toUpperCase()}
          </Mono>
        </GlassChip>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          hitSlop={8}
          style={styles.saveBtn}
          accessibilityLabel="Toggle save"
        >
          <IconHeart
            size={22}
            color={palette.accent}
            strokeColor={palette.accentDeep}
            filled={saved}
          />
        </Pressable>
      </View>
      <View style={styles.cardBody}>
        <DisplayText size={22} color={palette.ink} style={styles.cardTitle}>
          {recipe.title}
        </DisplayText>
        <View style={{ height: 4 }} />
        <Mono size={11} color={palette.textSecondary}>
          {recipe.cuisine} · {recipe.timeMinutes} min · serves {recipe.servings}
        </Mono>
        {recipe.notes ? (
          <>
            <View style={{ height: 6 }} />
            <BodyText size={13} color={palette.textSecondary} weight="medium" numberOfLines={2}>
              {recipe.notes}
            </BodyText>
          </>
        ) : null}
      </View>
    </Pressable>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorCard}>
      <Mono size={10} bold color={palette.destructive}>
        {"couldn't draft"}
      </Mono>
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
  list: {
    gap: 0,
  },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
  cardImageWrap: {
    position: 'relative',
    width: '100%',
    height: 140,
  },
  tierBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  tinyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  saveBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: palette.surfaceTranslucent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: spacing.md,
  },
  cardTitle: {
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  errorCard: {
    borderRadius: 22,
    padding: spacing.lg,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
});
