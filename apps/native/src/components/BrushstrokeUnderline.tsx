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
// One confident, gently curved arc per variant (no multi-wobble squiggle) to
// match the artifact's tapered brushstroke.
const BAKED_PATHS: Record<'v1' | 'v2' | 'v3', string> = {
  v1: 'M4 9.2 C40 4.8, 118 3.6, 156 7.4',
  v2: 'M3 6.8 C42 10.2, 116 10.6, 157 6.2',
  v3: 'M4 8.6 C38 5.4, 120 5, 156 8.8',
};

// Short inner overlay traced along the same arc, stroked thicker than the
// base line — the two together read as a single stroke that tapers thin at
// the tips and fuller through the middle, without needing a variable-width
// stroke (unsupported by react-native-svg).
const BAKED_TAPER_PATHS: Record<'v1' | 'v2' | 'v3', string> = {
  v1: 'M34 6.3 C58 4.5, 100 3.9, 126 5.4',
  v2: 'M32 8.7 C56 10.1, 102 10.3, 128 8',
  v3: 'M32 6.9 C56 5.6, 102 5.3, 128 6.8',
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
          strokeWidth={strokeWidth * 0.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={BAKED_TAPER_PATHS[pathVariant]}
          stroke={color}
          strokeWidth={strokeWidth * 1.15}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
