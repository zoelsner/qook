import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { palette } from '../design';

export interface BrushstrokeUnderlineProps {
  width: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  pathVariant?: 'v1' | 'v2' | 'v3';
  style?: StyleProp<ViewStyle>;
}

// Baked paths — regenerate with `bun run scripts/bake-wobble.ts` (to be added).
// react-native-svg does not support runtime feTurbulence, so paths are pre-baked.
const BAKED_PATHS: Record<'v1' | 'v2' | 'v3', string> = {
  v1: 'M2 7 C18 2 25 12 58 10 C80 8 100 13 118 5 C140 -2 150 9 158 7',
  v2: 'M2 8 C15 3 30 11 50 9 C75 7 95 12 120 6 C140 2 152 10 158 7',
  v3: 'M2 6 C20 11 35 3 55 8 C78 12 95 5 115 10 C138 13 150 6 158 8',
};

export function BrushstrokeUnderline({
  width,
  height = 12,
  color = palette.accent,
  strokeWidth = 2.4,
  pathVariant = 'v1',
  style,
}: BrushstrokeUnderlineProps) {
  return (
    <View style={[{ width, height }, style]} pointerEvents="none">
      <Svg width={width} height={height} viewBox="0 0 160 14" fill="none">
        <Path
          d={BAKED_PATHS[pathVariant]}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
