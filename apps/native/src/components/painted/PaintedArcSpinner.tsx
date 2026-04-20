import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { palette } from '../../design';

// 4-frame "hand retracing a circle" paths from Paper's Hand-drawn UI Study
// (Study 6 Loading). Each is a 48×48 viewBox arc.
const FRAMES = [
  'M 24 6 C 32 8, 40 14, 42 24 C 42 30, 38 36, 32 39',
  'M 40 20 C 42 28, 38 38, 28 42 C 20 42, 12 38, 10 30',
  'M 28 42 C 18 40, 8 34, 6 24 C 6 18, 10 12, 16 9',
  'M 8 28 C 6 20, 10 10, 20 6 C 28 6, 36 10, 38 18',
];

export interface PaintedArcSpinnerProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  frameDurationMs?: number;
}

// Rather than animating 4 discrete frames, we rotate a single arc continuously —
// the "pen retracing" effect reads the same and RN doesn't do CSS keyframe
// per-frame swaps cleanly. Uses the 1st frame as the anchor arc.
export function PaintedArcSpinner({
  size = 48,
  color = palette.accent,
  strokeWidth = 3,
  frameDurationMs = 1200,
}: PaintedArcSpinnerProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: frameDurationMs, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation, frameDurationMs]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[{ width: size, height: size }, animStyle]}>
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <Path
            d={FRAMES[0]}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

// Attaching to reduce unused-style complaints
const _unused = StyleSheet.create({ pad: {} });
void _unused;
