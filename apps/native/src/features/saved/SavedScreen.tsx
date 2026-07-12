import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useQueries } from '@tanstack/react-query';
import type { Recipe } from '@qook/shared';

import { RingSpinner } from '../../components/RingSpinner';
import { ScreenShell } from '../../components/ScreenShell';
import { BodyText, Mono } from '../../components/Text';
import { Vignette } from '../../components/Vignette';
import { palette, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { api } from '../../services/api';
import { useWeekPlan } from '../../stores/weekPlan';
import type { SeedMealKey } from '../../lib/assets';
import { SettingsHeader } from '../more/SettingsHeader';

export function SavedScreen() {
  const router = useRouter();
  const { press } = useHaptics();
  const savedRecipeIds = useWeekPlan((state) => state.savedRecipeIds);

  const queries = useQueries({
    queries: savedRecipeIds.map((id) => ({
      queryKey: ['recipe', id],
      queryFn: () => api.getRecipeById(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const recipes = queries
    .map((q) => q.data)
    .filter((r): r is Recipe => r != null);

  const onOpenRecipe = (recipeId: string) => {
    press();
    router.push({ pathname: '/(modals)/recipe/[id]', params: { id: recipeId } });
  };

  return (
    <ScreenShell horizontalPadding={24}>
      <SettingsHeader
        kicker="saved"
        title="Saved"
        subtitle="hearted recipes"
        underlineWidth={140}
      />

      <View style={{ height: spacing.md }} />
      <BodyText size={15} color={palette.textSecondary} weight="medium">
        Recipes you&apos;ve hearted. Tap one to cook it again.
      </BodyText>

      <View style={{ height: spacing.lg }} />

      {savedRecipeIds.length === 0 ? (
        <View style={styles.emptyState}>
          <Mono size={10} bold color={palette.accentDeep}>
            NOTHING SAVED YET
          </Mono>
          <View style={{ height: spacing.sm }} />
          <BodyText size={14} color={palette.textSecondary} weight="medium" style={styles.emptyBody}>
            Tap the heart on any recipe to keep it here.
          </BodyText>
        </View>
      ) : isLoading ? (
        <View style={styles.loading}>
          <RingSpinner size={32} />
        </View>
      ) : (
        <View style={styles.list}>
          {recipes.map((recipe) => (
            <Pressable
              key={recipe.id}
              onPress={() => onOpenRecipe(recipe.id)}
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel={recipe.title}
            >
              <Vignette
                size={52}
                localKey={recipe.localImageKey as SeedMealKey | undefined}
                remoteUrl={recipe.heroImageUrl}
                blurhash={recipe.blurhash}
                imageStatus={recipe.imageStatus}
                title={recipe.title}
              />
              <View style={styles.rowText}>
                <BodyText size={14} weight="semi" color={palette.ink} numberOfLines={1}>
                  {recipe.title}
                </BodyText>
                <Mono size={10} color={palette.textSecondary} numberOfLines={1}>
                  {recipe.cuisine} · {recipe.timeMinutes} min
                </Mono>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  emptyBody: {
    textAlign: 'center',
  },
  loading: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});
