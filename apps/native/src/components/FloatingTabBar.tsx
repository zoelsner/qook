import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { palette, screen, spacing } from '../design';
import { shadowTabBar } from '../design/shadows';
import { useHaptics } from '../hooks/useHaptics';
import { Mono } from './Text';

type TabName = 'tonight' | 'week' | 'shop' | 'saved' | 'more';

const LABELS: Record<TabName, string> = {
  tonight: 'Tonight',
  week: 'Week',
  shop: 'Shop',
  saved: 'Saved',
  more: 'More',
};

const glassAvailable = isLiquidGlassAvailable();

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { select } = useHaptics();
  const [innerWidth, setInnerWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const routeCount = state.routes.length;

  useEffect(() => {
    if (innerWidth === 0) return;
    // Note: RN spring config families (tension/friction vs stiffness/damping)
    // cannot be mixed — passing both throws at runtime.
    Animated.spring(translateX, {
      toValue: state.index * (innerWidth / routeCount),
      useNativeDriver: true,
      friction: 8,
      tension: 70,
    }).start();
  }, [state.index, innerWidth, routeCount, translateX]);

  const onBarLayout = (event: LayoutChangeEvent) => {
    setInnerWidth(event.nativeEvent.layout.width);
  };

  const pillWidth = innerWidth / routeCount;

  const barContent = (
    <>
      {innerWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            {
              width: pillWidth - 8,
              height: screen.tabBarHeight - 12,
              transform: [{ translateX }],
            },
          ]}
        />
      ) : null}
      {state.routes.map((route, idx) => {
        const focused = state.index === idx;
        const { options } = descriptors[route.key];
        const name = route.name as TabName;
        const label = LABELS[name] ?? (options.title ?? route.name);

        const onPress = () => {
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

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
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
    </>
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
        <GlassView glassEffectStyle="regular" style={styles.bar} onLayout={onBarLayout}>
          {barContent}
        </GlassView>
      ) : (
        <BlurView intensity={24} tint="light" style={styles.bar} onLayout={onBarLayout}>
          {barContent}
        </BlurView>
      )}
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
  bar: {
    flexDirection: 'row',
    height: screen.tabBarHeight,
    alignItems: 'center',
  },
  // left:4 provides the pill's static inset within its tab slot; the dynamic
  // translateX (slot index * slot width, unmodified) does the sliding so it
  // matches the flex-1 tab layout measured by onLayout exactly.
  pill: {
    position: 'absolute',
    left: 4,
    top: 6,
    borderRadius: 18,
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
