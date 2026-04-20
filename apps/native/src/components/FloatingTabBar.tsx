import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { palette, radius, screen, spacing } from '../design';
import { shadowTabBar } from '../design/shadows';
import { useHaptics } from '../hooks/useHaptics';
import { Mono } from './Text';

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
      <BlurView intensity={35} tint="light" style={styles.bar}>
        {state.routes.map((route, idx) => {
          const focused = state.index === idx;
          const { options } = descriptors[route.key];
          const label = (options.title ?? route.name) as string;

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
                size={10}
                bold={focused}
                color={focused ? palette.accent : palette.textSecondary}
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
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: palette.surfaceTranslucent,
  },
  bar: {
    flexDirection: 'row',
    height: screen.tabBarHeight,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
