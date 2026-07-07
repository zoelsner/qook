import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { palette, screen, spacing } from '../design';
import { shadowTabBar } from '../design/shadows';
import { useHaptics } from '../hooks/useHaptics';
import { BodyText } from './Text';
import {
  IconTabTonight,
  IconTabWeek,
  IconTabShop,
  IconTabMore,
} from './painted';

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
              <TabIcon name={name} focused={focused} />
              <BodyText
                size={11}
                weight={focused ? 'semi' : 'medium'}
                color={focused ? palette.accent : palette.textSecondary}
                style={styles.tabLabel}
              >
                {label}
              </BodyText>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

function TabIcon({ name, focused }: { name: TabName; focused: boolean }) {
  const tint = focused ? palette.accent : palette.textSecondary;
  const size = 24; // 10% bump over the 22px default (was 26; dialed back)
  switch (name) {
    case 'tonight':
      return <IconTabTonight size={size} color={tint} />;
    case 'week':
      return <IconTabWeek size={size} color={tint} />;
    case 'shop':
      return <IconTabShop size={size} color={tint} />;
    case 'more':
      return <IconTabMore size={size} color={tint} />;
    default:
      return null;
  }
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
    gap: 4,
  },
  tabLabel: {
    letterSpacing: 0.2,
    lineHeight: 13,
  },
});
