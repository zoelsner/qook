import React from 'react';
import { Stack } from 'expo-router';
import { palette } from '../../src/design';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.background },
      }}
    />
  );
}
