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

// Baked paths — regenerate with `bun run bake-wobble`.
// react-native-svg does not support runtime feTurbulence, so paths are pre-baked.
// ONE stroke per variant: a previous two-path taper overlay read as two
// separate lines (a thin one under a thick one) — the artifact's underline is
// a single confident, gently squiggled stroke.
const BAKED_PATHS: Record<'v1' | 'v2' | 'v3', string> = {
  v1: 'M4 8 C28 5, 52 10.5, 80 7.5 C108 4.5, 136 9.5, 156 6.5',
  v2: 'M3 6.5 C30 9.5, 56 4.5, 84 7.5 C112 10.5, 138 5.5, 157 8',
  v3: 'M4 7.5 C26 10, 54 5, 82 8 C110 11, 134 5.5, 156 7.5',
};

export function BrushstrokeUnderline({
  width,
  height = 12,
  color = palette.accent,
  strokeWidth = 3.4,
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
