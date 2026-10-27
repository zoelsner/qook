import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { FloatingTabBar } from '../../src/components/FloatingTabBar';
import { palette } from '../../src/design';
import { fontFamily } from '../../src/design/typography';
import { useAccessibilityPreferences } from '../../src/hooks/useAccessibilityPreferences';

// iOS gets the real UITabBarController — Liquid Glass, capsule selection,
// and minimize-on-scroll come from the system (the Luma/Substack bar).
// Android keeps the custom glass FloatingTabBar; NativeTabs renders
// Material tabs there and had icon bugs at SDK 54.
export default function TabsLayout() {
  const { reduceMotion, reduceTransparency } = useAccessibilityPreferences();
  if (Platform.OS === 'ios') {
    return (
      <NativeTabs
        minimizeBehavior={reduceMotion ? 'never' : 'onScrollDown'}
        tintColor={palette.primary}
        backgroundColor={reduceTransparency ? palette.surface : 'rgba(251, 247, 238, 0.08)'}
        // Keep UIKit's native material rather than substituting a custom blur.
        blurEffect={reduceTransparency ? 'none' : 'systemDefault'}
        shadowColor="rgba(42, 58, 38, 0.12)"
        disableTransparentOnScrollEdge
        iconColor={{ default: palette.textSecondary, selected: palette.primary }}
        labelStyle={{
          default: { fontFamily: fontFamily.bodyMedium, fontSize: 11, color: palette.textSecondary },
          selected: { fontFamily: fontFamily.bodySemi, fontSize: 11, color: palette.primary },
        }}
      >
        {/* No .fill on selection — Tonight is the resting tab, so the solid
            moon was the boldest ink on the bar most of the time. */}
        <NativeTabs.Trigger name="tonight">
          <Icon sf="moon" />
          <Label>Tonight</Label>
        </NativeTabs.Trigger>
        {/* Quiet-icon pass: calendar/basket were the loudest glyphs on the
            bar (solid block, stroke soup). list.bullet and bag carry the
            same meaning at a fraction of the ink. */}
        <NativeTabs.Trigger name="week">
          <Icon sf="list.bullet" />
          <Label>Plan</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="shop">
          <Icon sf="bag" />
          <Label>Shop</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="more">
          <Icon sf="ellipsis" />
          <Label>More</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="tonight" options={{ title: 'Tonight' }} />
      <Tabs.Screen name="week" options={{ title: 'Plan' }} />
      <Tabs.Screen name="shop" options={{ title: 'Shop' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
