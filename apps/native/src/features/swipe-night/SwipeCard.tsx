import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import type { Recipe } from '@qook/shared';

import { PaperCard } from '../../components/PaperCard';
import { FoodHeroImage } from '../../components/FoodHeroImage';
import { EnergyBadge } from '../../components/EnergyBadge';
import { DisplayText, Mono } from '../../components/Text';
import { palette, spacing, radius } from '../../design';
import { useSwipeGesture } from './useSwipeGesture';
import type { SeedMealKey } from '../../lib/assets';

export interface SwipeCardProps {
  recipe: Recipe;
  onLike: () => void;
  onPass: () => void;
}

export function SwipeCard({ recipe, onLike, onPass }: SwipeCardProps) {
  const { pan, cardStyle, likeOverlayStyle, passOverlayStyle } = useSwipeGesture({
    onLike,
    onPass,
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.animated, cardStyle]}>
        <PaperCard padding={0} cornerRadius={radius.sheet}>
          <FoodHeroImage
            localKey={recipe.localImageKey as SeedMealKey | undefined}
            remoteUrl={recipe.heroImageUrl}
            blurhash={recipe.blurhash}
            height={280}
            cornerRadius={radius.sheet}
            style={styles.hero}
          />
          <View style={styles.body}>
            <EnergyBadge tier={recipe.tier} />
            <View style={{ height: spacing.sm }} />
            <DisplayText size={26}>{recipe.title}</DisplayText>
            <View style={{ height: spacing.xs }} />
            <Mono>
              {recipe.cuisine} · {recipe.timeMinutes} min · serves {recipe.servings}
            </Mono>
          </View>
        </PaperCard>

        <Animated.View
          pointerEvents="none"
          style={[styles.overlay, styles.likeOverlay, likeOverlayStyle]}
        >
          <Mono bold size={14} color={palette.accent}>
            save
          </Mono>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[styles.overlay, styles.passOverlay, passOverlayStyle]}
        >
          <Mono bold size={14} color={palette.utility}>
            skip
          </Mono>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

export function SwipeCardGhost({ recipe }: { recipe: Recipe }) {
  return (
    <View style={styles.animated}>
      <PaperCard padding={0} cornerRadius={radius.sheet}>
        <FoodHeroImage
          localKey={recipe.localImageKey as SeedMealKey | undefined}
          remoteUrl={recipe.heroImageUrl}
          blurhash={recipe.blurhash}
          height={280}
          cornerRadius={radius.sheet}
          style={styles.hero}
        />
        <View style={styles.body}>
          <EnergyBadge tier={recipe.tier} />
          <View style={{ height: spacing.sm }} />
          <DisplayText size={26}>{recipe.title}</DisplayText>
          <View style={{ height: spacing.xs }} />
          <Mono>
            {recipe.cuisine} · {recipe.timeMinutes} min · serves {recipe.servings}
          </Mono>
        </View>
      </PaperCard>
    </View>
  );
}

const styles = StyleSheet.create({
  animated: {
    width: '100%',
  },
  hero: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  body: {
    padding: spacing.md,
  },
  overlay: {
    position: 'absolute',
    top: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 2,
    borderRadius: radius.tiny,
    backgroundColor: palette.surfaceTranslucent,
  },
  likeOverlay: {
    right: spacing.md,
    borderColor: palette.accent,
    transform: [{ rotate: '-8deg' }],
  },
  passOverlay: {
    left: spacing.md,
    borderColor: palette.utility,
    transform: [{ rotate: '8deg' }],
  },
});
