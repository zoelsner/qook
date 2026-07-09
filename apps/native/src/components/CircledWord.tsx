import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { palette } from '../design';
import { DisplayText } from './Text';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Hand-drawn ring, baked wobble (same language as BrushstrokeUnderline).
const RING_PATH =
  'M 68 7 C 102 4, 128 15, 127 30 C 126 47, 98 57, 64 56 C 32 57, 7 47, 8 31 C 9 16, 32 8, 59 8';
const RING_LENGTH = 340;
const CYCLE_MS = 2600;

export interface CircledWordProps {
  words: string[];
}

// Loading animation (Menu §loading option 02): a pen circles a word the way
// you'd circle a dish on a paper menu — draws, holds a beat, lifts, then
// circles the next word.
export function CircledWord({ words }: CircledWordProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [wordIdx, setWordIdx] = useState(0);

  useEffect(() => {
    let mounted = true;
    const run = () => {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: CYCLE_MS,
        easing: Easing.bezier(0.55, 0.06, 0.35, 0.95),
        useNativeDriver: false, // strokeDashoffset is not a native prop
      }).start(({ finished }) => {
        if (!finished || !mounted) return;
        setWordIdx((i) => (i + 1) % Math.max(words.length, 1));
        run();
      });
    };
    run();
    return () => {
      mounted = false;
      progress.stopAnimation();
    };
  }, [progress, words.length]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 0.42, 1],
    outputRange: [RING_LENGTH, 0, 0],
  });
  const ringOpacity = progress.interpolate({
    inputRange: [0, 0.78, 0.92, 1],
    outputRange: [1, 1, 0, 0],
  });

  return (
    <View style={styles.wrap}>
      <DisplayText size={24} color={palette.primary} style={styles.word}>
        {words[wordIdx] ?? ''}
      </DisplayText>
      <Svg
        width={135}
        height={63}
        viewBox="0 0 135 63"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <AnimatedPath
          d={RING_PATH}
          fill="none"
          stroke={palette.accent}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${RING_LENGTH}`}
          strokeDashoffset={dashOffset}
          opacity={ringOpacity}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 135,
    height: 63,
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: {
    letterSpacing: -0.5,
  },
});
