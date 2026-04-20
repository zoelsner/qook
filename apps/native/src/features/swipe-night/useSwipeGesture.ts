import { useCallback } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const SNAP = { damping: 30, stiffness: 400, mass: 0.8 };
const THROW_THRESHOLD = 0.25;
const VELOCITY_THRESHOLD = 800;
const THROW_DURATION = 240;

export interface UseSwipeGestureArgs {
  onLike: () => void;
  onPass: () => void;
  onReset?: () => void;
}

export function useSwipeGesture({ onLike, onPass, onReset }: UseSwipeGestureArgs) {
  const { width } = useWindowDimensions();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rotate = useSharedValue(0);

  const fireDecisionHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY * 0.4;
      rotate.value = (e.translationX / width) * 12;
    })
    .onEnd((e) => {
      const dx = e.translationX;
      const throwRatio = Math.abs(dx) / width;
      const throwing =
        throwRatio > THROW_THRESHOLD || Math.abs(e.velocityX) > VELOCITY_THRESHOLD;

      if (throwing) {
        const dir = dx > 0 ? 'like' : 'pass';
        const target = dir === 'like' ? width * 1.5 : -width * 1.5;
        const cb = dir === 'like' ? onLike : onPass;
        tx.value = withTiming(target, { duration: THROW_DURATION }, (finished) => {
          if (finished) runOnJS(cb)();
        });
        runOnJS(fireDecisionHaptic)();
        if (onReset) runOnJS(onReset)();
      } else {
        tx.value = withSpring(0, SNAP);
        ty.value = withSpring(0, SNAP);
        rotate.value = withSpring(0, SNAP);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const likeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [0, width * 0.25], [0, 1], 'clamp'),
  }));

  const passOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-width * 0.25, 0], [1, 0], 'clamp'),
  }));

  return { pan, cardStyle, likeOverlayStyle, passOverlayStyle };
}
