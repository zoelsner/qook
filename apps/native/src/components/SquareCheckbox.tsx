import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { palette } from '../design';

export interface SquareCheckboxProps {
  checked: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// Hand-drawn square checkbox (spec §1.4, replaces PaintedCheckbox). Same baked
// wobble path as ProteinChip. Checked = rust fill + a drawn check.
const BAKED_SQUARE =
  'M 8.4 4.6 C 18 3.8, 30 4.3, 40.5 3.9 C 52 4.1, 62.5 4.4, 66 5.1 C 67.7 14, 68.2 26, 67.6 38 C 68.1 50, 67.9 60, 66.6 66 C 56.5 67.6, 44 67.3, 32 67.8 C 20 67.5, 10.5 67.9, 5.8 66.4 C 4.6 55, 4.3 44, 4.7 32 C 4.3 22, 4.7 12.5, 5.6 5.4 C 6.1 5.1, 7.1 4.8, 8.4 4.6 Z';
const CHECK_PATH = 'M 20 38 L 32 50 L 52 24';

export function SquareCheckbox({ checked, size = 22, style }: SquareCheckboxProps) {
  return (
    <View style={[{ width: size, height: size }, style]} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <Svg width={size} height={size} viewBox="0 0 72 72" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path
          d={BAKED_SQUARE}
          stroke={palette.accentDeep}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={checked ? palette.accent : 'none'}
        />
        {checked ? (
          <Path d={CHECK_PATH} stroke={palette.surface} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ) : null}
      </Svg>
    </View>
  );
}
