import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { palette } from '../../design';

// Baked wobbly divider from Paper's Hand-drawn UI Study (Study 4 Divider).
// viewBox 340×14 — use preserveAspectRatio="none" to stretch.
const DIVIDER_PATH =
  'M 4 7 C 30 4, 60 10, 90 7 S 150 4, 180 8 S 240 9, 270 6 S 320 9, 336 7';

export interface PaintedDividerProps {
  width?: number | string;
  height?: number;
  color?: string;
  strokeWidth?: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}

export function PaintedDivider({
  width = '100%',
  height = 14,
  color = palette.primary,
  strokeWidth = 1.6,
  opacity = 0.55,
  style,
}: PaintedDividerProps) {
  return (
    <View style={[{ width: width as any, height }, style]} pointerEvents="none">
      <Svg
        width="100%"
        height={height}
        viewBox="0 0 340 14"
        preserveAspectRatio="none"
        fill="none"
      >
        <Path
          d={DIVIDER_PATH}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={opacity}
          fill="none"
        />
      </Svg>
    </View>
  );
}
