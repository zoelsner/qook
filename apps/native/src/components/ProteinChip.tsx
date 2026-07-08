import React from 'react';
import { Platform, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { palette } from '../design';
import { DisplayText, Mono } from './Text';

export type ProteinChipSize = 'mini' | 'sm' | 'md' | 'lg';

export interface ProteinChipProps {
  proteinG: number;
  size?: ProteinChipSize;
  style?: StyleProp<ViewStyle>;
}

// Hand-drawn-feel rounded-square border, baked path.
// Viewbox 72x72 — scales cleanly at every size below.
// Soft, meaningfully rounded corners (radius 18 of 72) to match the
// artifact's rounded-square badge, rather than the tighter original corners.
const BAKED_SQUARE =
  'M 24 6 L 48 6 C 58 6, 66 14, 66 24 L 66 48 C 66 58, 58 66, 48 66 L 24 66 C 14 66, 6 58, 6 48 L 6 24 C 6 14, 14 6, 24 6 Z';

// Soft drop shadow behind the cream-filled badge — reads as shading behind
// both the number and the "PROTEIN" kicker beneath it.
const badgeShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  android: { elevation: 4 },
  default: {},
})!;

const SIZE_PRESETS: Record<
  ProteinChipSize,
  {
    box: number;
    radius: number;
    number: number;
    kicker: number;
    kickerTop: number;
    strokeWidth: number;
  }
> = {
  mini: { box: 40, radius: 11, number: 15, kicker: 6, kickerTop: 1, strokeWidth: 2.2 },
  sm: { box: 52, radius: 14, number: 20, kicker: 8, kickerTop: 1, strokeWidth: 2.6 },
  md: { box: 64, radius: 17, number: 26, kicker: 9, kickerTop: 2, strokeWidth: 2.8 },
  lg: { box: 78, radius: 20, number: 32, kicker: 10, kickerTop: 3, strokeWidth: 3.0 },
};

export function ProteinChip({ proteinG, size = 'md', style }: ProteinChipProps) {
  const preset = SIZE_PRESETS[size];
  return (
    <View
      style={[
        { width: preset.box, height: preset.box, borderRadius: preset.radius },
        styles.wrap,
        badgeShadow,
        style,
      ]}
      accessibilityLabel={`${proteinG} grams protein per serving`}
    >
      <Svg
        width={preset.box}
        height={preset.box}
        viewBox="0 0 72 72"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Path
          d={BAKED_SQUARE}
          stroke={palette.accent}
          strokeWidth={preset.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={palette.background}
        />
      </Svg>
      <DisplayText
        size={preset.number}
        color={palette.ink}
        style={styles.number}
      >
        {proteinG}g
      </DisplayText>
      <View style={{ height: preset.kickerTop }} />
      <Mono size={preset.kicker} bold color={palette.accentDeep} style={styles.kicker}>
        PROTEIN
      </Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  number: {
    letterSpacing: -0.8,
  },
  kicker: {
    letterSpacing: 1.2,
  },
});
