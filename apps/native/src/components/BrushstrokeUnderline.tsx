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
const BAKED_PATHS: Record<'v1' | 'v2' | 'v3', string> = {
  v1: 'M3.33 8.43 C5.19 8.05, 9.85 6.43, 14.49 6.11 C19.13 5.8, 26.17 6.42, 31.18 6.53 C36.18 6.65, 40.12 6.56, 44.49 6.79 C48.87 7.02, 52.49 8.19, 57.42 7.91 C62.34 7.64, 69 5.08, 74.03 5.14 C79.07 5.2, 82.91 7.81, 87.64 8.29 C92.36 8.78, 97.78 8.23, 102.4 8.05 C107.01 7.88, 110.89 7.08, 115.32 7.24 C119.74 7.41, 124.29 8.95, 128.96 9.04 C133.63 9.13, 138.48 7.83, 143.32 7.77 C148.16 7.72, 155.55 8.57, 158 8.73',
  v2: 'M0.84 7.79 C3.37 7.55, 11.11 6.67, 16.02 6.32 C20.94 5.98, 25.38 5.26, 30.32 5.73 C35.27 6.2, 41.01 9.2, 45.69 9.14 C50.36 9.08, 53.92 5.66, 58.37 5.36 C62.82 5.07, 67.35 7.24, 72.38 7.39 C77.4 7.54, 83.81 6.17, 88.52 6.27 C93.23 6.36, 96 7.95, 100.66 7.98 C105.32 8, 111.7 6.4, 116.47 6.4 C121.25 6.4, 124.77 8.01, 129.29 7.98 C133.81 7.95, 138.96 6.3, 143.62 6.22 C148.27 6.15, 154.94 7.31, 157.21 7.52',
  v3: 'M1.4 8.56 C4.01 8.1, 12.29 5.96, 17.05 5.78 C21.8 5.6, 25.55 7.22, 29.95 7.47 C34.35 7.72, 38.64 7.04, 43.45 7.28 C48.27 7.53, 53.75 9.15, 58.86 8.93 C63.96 8.71, 69.29 6.07, 74.09 5.94 C78.89 5.8, 83.02 7.95, 87.65 8.1 C92.27 8.25, 97.02 7.35, 101.85 6.84 C106.69 6.34, 112.12 5.3, 116.66 5.06 C121.21 4.83, 124.76 4.88, 129.12 5.41 C133.48 5.93, 138.01 7.74, 142.83 8.22 C147.64 8.69, 155.47 8.26, 158 8.27',
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
