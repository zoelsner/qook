import React from 'react';
import { Stack } from 'expo-router';
import { palette } from '../../src/design';

export default function EatLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.background },
      }}
    />
  );
}
