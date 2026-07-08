import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
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
// The path is a single closed stroke with subtle jitter in the straight runs
// so it reads as "drawn" rather than "CSS border."
const BAKED_SQUARE =
  'M 8.4 4.6 C 18 3.8, 30 4.3, 40.5 3.9 C 52 4.1, 62.5 4.4, 66 5.1 C 67.7 14, 68.2 26, 67.6 38 C 68.1 50, 67.9 60, 66.6 66 C 56.5 67.6, 44 67.3, 32 67.8 C 20 67.5, 10.5 67.9, 5.8 66.4 C 4.6 55, 4.3 44, 4.7 32 C 4.3 22, 4.7 12.5, 5.6 5.4 C 6.1 5.1, 7.1 4.8, 8.4 4.6 Z';

const SIZE_PRESETS: Record<
  ProteinChipSize,
  { box: number; number: number; kicker: number; kickerTop: number; strokeWidth: number }
> = {
  mini: { box: 40, number: 15, kicker: 6, kickerTop: 1, strokeWidth: 1.5 },
  sm: { box: 52, number: 20, kicker: 8, kickerTop: 1, strokeWidth: 1.8 },
  md: { box: 64, number: 26, kicker: 9, kickerTop: 2, strokeWidth: 2.0 },
  lg: { box: 78, number: 32, kicker: 10, kickerTop: 3, strokeWidth: 2.2 },
};

export function ProteinChip({ proteinG, size = 'md', style }: ProteinChipProps) {
  const preset = SIZE_PRESETS[size];
  return (
    <View
      style={[{ width: preset.box, height: preset.box }, styles.wrap, style]}
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
          stroke={palette.accentDeep}
          strokeWidth={preset.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
      <DisplayText
        size={preset.number}
        color={palette.ink}
        style={styles.number}
      >
        {proteinG}
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
  },
  number: {
    letterSpacing: -0.8,
  },
  kicker: {
    letterSpacing: 1.2,
  },
});
