import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { FloatingTabBar } from '../../src/components/FloatingTabBar';
import { palette } from '../../src/design';

// iOS gets the real UITabBarController — Liquid Glass, capsule selection,
// and minimize-on-scroll come from the system (the Luma/Substack bar).
// Android keeps the custom glass FloatingTabBar; NativeTabs renders
// Material tabs there and had icon bugs at SDK 54.
export default function TabsLayout() {
  if (Platform.OS === 'ios') {
    return (
      <NativeTabs minimizeBehavior="onScrollDown" tintColor={palette.primary}>
        <NativeTabs.Trigger name="tonight">
          <Icon sf={{ default: 'moon', selected: 'moon.fill' }} />
          <Label>Tonight</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="week">
          <Icon sf="calendar" />
          <Label>Plan</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="shop">
          <Icon sf={{ default: 'basket', selected: 'basket.fill' }} />
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
