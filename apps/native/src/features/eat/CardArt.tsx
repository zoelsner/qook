import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Recipe } from '@qook/shared';

import { FoodHeroImage } from '../../components/FoodHeroImage';
import { Vignette } from '../../components/Vignette';
import { DisplayText, Mono } from '../../components/Text';
import { palette, radius } from '../../design';
import { useRecipeArt } from '../../hooks/useRecipeArt';
import type { SeedMealKey } from '../../lib/assets';

// The ONE knob that decides how meal art is masked on the deck card. Flipped in
// the simulator during the A/B, not from mockups (spec: "final call made in the
// sim"). Same underlying square watercolor asset either way — zero image cost.
export const CARD_ART_MASK: 'circle' | 'square' = 'square';

const CIRCLE_DIAMETER = 240;
const SQUARE_HEIGHT = 300;

export function CardArt({ recipe }: { recipe: Recipe }) {
  // Poll so the letter monogram upgrades to painted art in place as it lands.
  const art = useRecipeArt(recipe, { poll: true });
  const status = art?.imageStatus ?? recipe.imageStatus;
  const localKey = art?.localImageKey as SeedMealKey | undefined;
  const hasArt = !!art?.heroImageUrl || !!localKey;
  const painting = !hasArt && (status === 'pending' || status === 'generating');
  const letter = (recipe.title?.trim().charAt(0) || '·').toUpperCase();

  if (CARD_ART_MASK === 'circle') {
    return (
      <View style={styles.circleWrap}>
        <Vignette
          size={CIRCLE_DIAMETER}
          localKey={localKey}
          remoteUrl={art?.heroImageUrl}
          blurhash={art?.blurhash}
          imageStatus={status}
          title={recipe.title}
        />
        {painting ? <PaintingTick /> : null}
      </View>
    );
  }

  return (
    <View style={styles.squareWrap}>
      {hasArt ? (
        <FoodHeroImage
          localKey={localKey}
          remoteUrl={art?.heroImageUrl}
          blurhash={art?.blurhash}
          height={SQUARE_HEIGHT}
          cornerRadius={radius.sheet}
          style={styles.square}
        />
      ) : (
        <View
          style={[styles.square, styles.monogram]}
          accessibilityLabel={`${recipe.title}, no image yet`}
        >
          <DisplayText size={96} color={palette.accentDeep}>
            {letter}
          </DisplayText>
        </View>
      )}
      {painting ? <PaintingTick /> : null}
    </View>
  );
}

// Quiet "painting…" tick — designed, not apologetic (Treatment 04).
function PaintingTick() {
  return (
    <View style={styles.tick} pointerEvents="none">
      <Mono size={9} bold color={palette.accentDeep}>
        painting…
      </Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  circleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  squareWrap: {
    width: '100%',
  },
  square: {
    width: '100%',
    height: SQUARE_HEIGHT,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  monogram: {
    backgroundColor: palette.well,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    backgroundColor: palette.surfaceTranslucent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
});
