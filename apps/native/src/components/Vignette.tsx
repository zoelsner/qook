import React from 'react';
import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import type { ImageStatus } from '@qook/shared';
import { FoodHeroImage } from './FoodHeroImage';
import { DisplayText } from './Text';
import { palette } from '../design';
import type { SeedMealKey } from '../lib/assets';

export interface VignetteProps {
  size: number;
  localKey?: SeedMealKey;
  remoteUrl?: string;
  blurhash?: string;
  imageStatus?: ImageStatus;
  title?: string;
  // Scales the art inside the circular crop (>1 zooms in). The bundled
  // seed PNGs frame the plate at ~60% of the canvas, so small vignettes
  // need a zoom; generated live art is already edge-to-edge.
  zoom?: number;
  style?: StyleProp<ViewStyle>;
}

// Circular art crop — how meal art appears on every surface except the recipe
// page (spec §1.2). No real art, or a failed generation → cream circle with the
// dish's first letter in Fraunces (spec §6); retry-on-open is handled by the
// recipe modal, not here.
export function Vignette({
  size,
  localKey,
  remoteUrl,
  blurhash,
  imageStatus,
  title,
  zoom = 1,
  style,
}: VignetteProps) {
  const hasArt = !!remoteUrl || !!localKey;
  const showLetter = !hasArt || imageStatus === 'failed';
  const radius = size / 2;

  if (showLetter) {
    const letter = (title?.trim().charAt(0) || '·').toUpperCase();
    return (
      <View
        style={[
          { width: size, height: size, borderRadius: radius },
          styles.letterWrap,
          style,
        ]}
        accessibilityLabel={title ? `${title}, no image yet` : 'no image yet'}
      >
        <DisplayText size={Math.round(size * 0.42)} color={palette.accentDeep}>
          {letter}
        </DisplayText>
      </View>
    );
  }

  const artSize = size * zoom;
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: radius },
        styles.crop,
        zoom !== 1 ? styles.center : null,
        style,
      ]}
    >
      <FoodHeroImage
        localKey={localKey}
        remoteUrl={remoteUrl}
        blurhash={blurhash}
        width={artSize}
        height={artSize}
        cornerRadius={artSize / 2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  crop: {
    overflow: 'hidden',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterWrap: {
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
});
