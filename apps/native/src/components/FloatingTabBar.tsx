import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
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

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { select } = useHaptics();

  return (
    <View
      style={[
        styles.wrapper,
        { bottom: Math.max(insets.bottom, spacing.sm) + spacing.sm },
        shadowTabBar,
      ]}
    >
      <BlurView intensity={24} tint="light" style={styles.bar}>
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
              <View style={[styles.tabDot, focused ? styles.tabDotActive : null]} />
              <Mono
                size={focused ? 11 : 12}
                bold={focused}
                color={focused ? palette.primary : palette.textSecondary}
                style={styles.tabLabel}
              >
                {label}
              </Mono>
            </Pressable>
          );
        })}
      </BlurView>
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
    backgroundColor: palette.surfaceTranslucent,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
  bar: {
    flexDirection: 'row',
    height: screen.tabBarHeight,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
  },
  tab: {
    width: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  tabDotActive: {
    backgroundColor: palette.accent,
  },
  tabLabel: {
    letterSpacing: 0.6,
    lineHeight: 13,
  },
});
