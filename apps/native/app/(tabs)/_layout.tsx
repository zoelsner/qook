import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { FloatingTabBar } from '../../src/components/FloatingTabBar';
import { palette } from '../../src/design';
import { fontFamily } from '../../src/design/typography';

// iOS gets the real UITabBarController — Liquid Glass, capsule selection,
// and minimize-on-scroll come from the system (the Luma/Substack bar).
// Android keeps the custom glass FloatingTabBar; NativeTabs renders
// Material tabs there and had icon bugs at SDK 54.
export default function TabsLayout() {
  if (Platform.OS === 'ios') {
    return (
      <NativeTabs
        minimizeBehavior="onScrollDown"
        tintColor={palette.primary}
        // Brand experiment: JetBrains Mono labels on the system bar —
        // fontFamily is exposed even though icon size isn't.
        labelStyle={{ fontFamily: fontFamily.monoRegular, fontSize: 10 }}
      >
        <NativeTabs.Trigger name="tonight">
          <Icon sf={{ default: 'moon', selected: 'moon.fill' }} />
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
          <Icon sf={{ default: 'bag', selected: 'bag.fill' }} />
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
