import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { DisplayText, Mono } from '../../components/Text';
import { palette, radius, spacing } from '../../design';

const CARD_COUNT = 5;
const CARD_W = 92;
const CARD_H = 128;
// Final fan offsets (x, rotation) for the five dealt cards, centered.
const FAN = [
  { x: -132, rot: -16 },
  { x: -66, rot: -8 },
  { x: 0, rot: 0 },
  { x: 66, rot: 8 },
  { x: 132, rot: 16 },
];

// "Dealing the hand" (spec Loading screen): five face-down cards deal into a fan
// with an overshoot settle; the center card paints itself; the hand holds, then
// re-deals. One unhurried ~7s cycle, looping while phase-1 runs. Copy changes
// exactly once (driven by the `phase` prop). Reduced-motion → static dealt fan.
export function DealingHandLoader({ phase }: { phase: 'thinking' | 'coming-up' }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 7000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion]);

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        {FAN.map((fan, i) => {
          if (reduceMotion) {
            return (
              <View
                key={i}
                style={[
                  styles.card,
                  i === 2 ? styles.centerCard : null,
                  { transform: [{ translateX: fan.x }, { rotate: `${fan.rot}deg` }] },
                ]}
              />
            );
          }
          // Stagger each card's deal across the first ~60% of the cycle, hold,
          // then sweep out over the last ~15%.
          const dealStart = 0.05 + i * 0.09;
          const dealEnd = dealStart + 0.16;
          const tx = progress.interpolate({
            inputRange: [dealStart, dealEnd, 0.85, 1],
            outputRange: [0, fan.x, fan.x, fan.x * 1.4],
            extrapolate: 'clamp',
          });
          const rot = progress.interpolate({
            inputRange: [dealStart, dealEnd, 1],
            outputRange: ['0deg', `${fan.rot}deg`, `${fan.rot}deg`],
            extrapolate: 'clamp',
          });
          const opacity = progress.interpolate({
            inputRange: [dealStart, dealEnd, 0.85, 1],
            outputRange: [0, 1, 1, 0],
            extrapolate: 'clamp',
          });
          // Center card "paints": a wash fades in after it lands.
          const paint =
            i === 2
              ? progress.interpolate({
                  inputRange: [dealEnd, 0.6, 0.85],
                  outputRange: [0, 1, 1],
                  extrapolate: 'clamp',
                })
              : undefined;
          return (
            <Animated.View
              key={i}
              style={[
                styles.card,
                i === 2 ? styles.centerCard : null,
                { opacity, transform: [{ translateX: tx }, { rotate: rot }] },
              ]}
            >
              {i === 2 && paint ? (
                <Animated.View style={[styles.paintWash, { opacity: paint }]} />
              ) : null}
            </Animated.View>
          );
        })}
      </View>

      <View style={{ height: spacing.xl }} />
      <Mono size={10} bold color={palette.accentDeep}>
        dealing your hand
      </Mono>
      <View style={{ height: spacing.sm }} />
      <DisplayText size={30} color={palette.primary} style={styles.copy}>
        {phase === 'thinking' ? 'The kitchen is thinking' : 'Five proposals, coming up'}
      </DisplayText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    width: '100%',
    height: CARD_H + 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    borderRadius: radius.card,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
  centerCard: {
    backgroundColor: palette.surface,
    zIndex: 5,
  },
  paintWash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.card,
    backgroundColor: palette.well,
  },
  copy: {
    letterSpacing: -0.6,
    lineHeight: 34,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
