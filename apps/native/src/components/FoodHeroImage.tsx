import React from 'react';
import {
  Image as ExpoImage,
  type ImageSource,
  type ImageStyle,
} from 'expo-image';
import { StyleSheet, type StyleProp } from 'react-native';
import { seedMeals, type SeedMealKey, defaultMealBlurhash } from '../lib/assets';
import { radius } from '../design';

export interface FoodHeroImageProps {
  localKey?: SeedMealKey;
  remoteUrl?: string;
  blurhash?: string;
  width?: number;
  height?: number;
  cornerRadius?: number;
  style?: StyleProp<ImageStyle>;
}

export function FoodHeroImage({
  localKey,
  remoteUrl,
  blurhash = defaultMealBlurhash,
  width,
  height,
  cornerRadius = radius.card,
  style,
}: FoodHeroImageProps) {
  const source: ImageSource = remoteUrl
    ? { uri: remoteUrl }
    : localKey
      ? (seedMeals[localKey] as ImageSource)
      : (seedMeals['miso-salmon'] as ImageSource);

  return (
    <ExpoImage
      source={source}
      placeholder={blurhash}
      placeholderContentFit="cover"
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
      style={[
        styles.base,
        { width, height, borderRadius: cornerRadius },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});
