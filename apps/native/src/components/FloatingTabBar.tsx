import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { palette, screen, spacing } from '../design';
import { shadowTabBar } from '../design/shadows';
import { useHaptics } from '../hooks/useHaptics';
import { Mono } from './Text';

type TabName = 'tonight' | 'week' | 'shop' | 'more';

const LABELS: Record<TabName, string> = {
  tonight: 'Tonight',
  week: 'Week',
  shop: 'Shop',
  more: 'More',
};

const glassAvailable = isLiquidGlassAvailable();

// Note: RN spring config families (tension/friction vs stiffness/damping)
// cannot be mixed — passing both throws at runtime.
const SPRING_CONFIG = {
  useNativeDriver: true,
  stiffness: 320,
  damping: 28,
  mass: 0.8,
} as const;

// Compact lens — Apple's tab-bar lens hugs the label, it doesn't fill the
// bar. Oversized glass reads as a blob and its tint smears past the shape.
const highlightHeight = screen.tabBarHeight - 24;
const highlightRadius = highlightHeight / 2;
const HIGHLIGHT_INSET = 10;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { select } = useHaptics();
  const [innerWidth, setInnerWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const routeCount = state.routes.length;
  const hoveredIndexRef = useRef(state.index);
  const slotWidth = innerWidth / routeCount;

  // The PanResponder below is created once, so its callbacks must read
  // everything mutable through refs — closing over render values would
  // freeze slotWidth at the pre-layout 0 and state.index at first render.
  const rowRef = useRef<View>(null);
  const rowPageXRef = useRef(0);
  const slotWidthRef = useRef(0);
  const stateIndexRef = useRef(state.index);
  stateIndexRef.current = state.index;

  const animateTo = (index: number) => {
    Animated.spring(translateX, {
      toValue: index * slotWidthRef.current,
      ...SPRING_CONFIG,
    }).start();
  };

  useEffect(() => {
    if (innerWidth === 0) return;
    hoveredIndexRef.current = state.index;
    animateTo(state.index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, innerWidth, routeCount]);

  const onBarLayout = (event: LayoutChangeEvent) => {
    slotWidthRef.current = event.nativeEvent.layout.width / routeCount;
    setInnerWidth(event.nativeEvent.layout.width);
    rowRef.current?.measureInWindow((x) => {
      rowPageXRef.current = x;
    });
  };

  const goToIndex = (index: number) => {
    const route = state.routes[index];
    if (!route) return;
    const focused = state.index === index;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) {
      void select();
      navigation.navigate(route.name, route.params);
    }
  };
  const goToIndexRef = useRef(goToIndex);
  goToIndexRef.current = goToIndex;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dx) > 6,
      // locationX is unreliable after a responder capture (it stays relative
      // to the child Pressable that took the touch), so track the finger in
      // page coordinates against the row's measured window position.
      onPanResponderMove: (_evt, gesture) => {
        const slotW = slotWidthRef.current;
        if (slotW === 0) return;
        const relativeX = gesture.moveX - rowPageXRef.current;
        // Follow the finger 1:1 while held — no spring per slot, or the lens
        // "bounces" between sections. Center the lens under the finger and
        // clamp so it never slides past the first/last slot.
        const maxT = (routeCount - 1) * slotW;
        translateX.setValue(clamp(relativeX - slotW / 2, 0, maxT));
        // Track the nearest slot for the release snap, with a light detent
        // tick each time the finger crosses into a new one (iOS-style).
        const nearest = clamp(Math.round((relativeX - slotW / 2) / slotW), 0, routeCount - 1);
        if (nearest !== hoveredIndexRef.current) {
          hoveredIndexRef.current = nearest;
          void select();
        }
      },
      onPanResponderRelease: () => {
        const target = hoveredIndexRef.current;
        if (target === stateIndexRef.current) {
          animateTo(target);
        } else {
          goToIndexRef.current(target);
        }
      },
      onPanResponderTerminate: () => {
        hoveredIndexRef.current = stateIndexRef.current;
        animateTo(stateIndexRef.current);
      },
    }),
  ).current;

  const highlight = (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.highlightWrapper,
        {
          width: slotWidth - HIGHLIGHT_INSET * 2,
          height: highlightHeight,
          borderRadius: highlightRadius,
          transform: [{ translateX }],
        },
      ]}
    >
      {glassAvailable ? (
        <GlassView
          glassEffectStyle="regular"
          tintColor="rgba(241, 233, 217, 0.55)"
          isInteractive
          style={[styles.highlightFill, { borderRadius: highlightRadius }]}
        />
      ) : (
        <View style={[styles.highlightFallback, { borderRadius: highlightRadius }]} />
      )}
    </Animated.View>
  );

  const row = (
    <View ref={rowRef} style={styles.row} onLayout={onBarLayout} {...panResponder.panHandlers}>
      {state.routes.map((route, idx) => {
        const focused = state.index === idx;
        const { options } = descriptors[route.key];
        const name = route.name as TabName;
        const label = LABELS[name] ?? (options.title ?? route.name);

        const onPressIn = () => {
          hoveredIndexRef.current = idx;
          goToIndex(idx);
        };

        return (
          <Pressable
            key={route.key}
            onPressIn={onPressIn}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : undefined}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
          >
            <Mono
              size={11}
              bold={focused}
              color={focused ? palette.primary : palette.textSecondary}
              style={styles.tabLabel}
            >
              {label}
            </Mono>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View
      style={[
        styles.wrapper,
        { bottom: Math.max(insets.bottom, spacing.sm) + spacing.sm },
        glassAvailable ? null : { backgroundColor: palette.surfaceTranslucent },
        shadowTabBar,
      ]}
    >
      {glassAvailable ? (
        // Overlapping glass views must share a GlassContainer — rendered as
        // independent effects they "merge" unpredictably and the lens bleeds
        // past the bar's corners (expo-glass-effect nesting pitfall).
        <GlassContainer spacing={0} style={StyleSheet.absoluteFillObject}>
          <GlassView glassEffectStyle="regular" style={StyleSheet.absoluteFillObject} />
          {innerWidth > 0 ? highlight : null}
        </GlassContainer>
      ) : (
        <>
          <BlurView intensity={24} tint="light" style={StyleSheet.absoluteFillObject} />
          {innerWidth > 0 ? highlight : null}
        </>
      )}
      {row}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
  // No alignItems:center here — it would shrink each Pressable to its
  // label's height, leaving most of the bar untappable. Tabs stretch to
  // the full bar height and center their own label.
  row: {
    flexDirection: 'row',
    height: screen.tabBarHeight,
  },
  // left:4/top:6 provide the highlight's static inset within its tab slot; the
  // dynamic translateX (slot index * slot width, unmodified) does the sliding
  // so it matches the flex-1 tab layout measured by onLayout exactly.
  highlightWrapper: {
    position: 'absolute',
    left: HIGHLIGHT_INSET,
    top: 12,
  },
  highlightFill: {
    flex: 1,
  },
  highlightFallback: {
    flex: 1,
    backgroundColor: 'rgba(241, 233, 217, 0.92)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  tabLabel: {
    letterSpacing: 0.6,
    lineHeight: 13,
  },
});
