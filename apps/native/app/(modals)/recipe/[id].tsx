import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '../../../src/components/ScreenShell';
import { BodyText, DisplayText, Mono } from '../../../src/components/Text';
import { spacing, typeScale } from '../../../src/design';

export default function RecipeModalRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ScreenShell>
      <Mono>recipe</Mono>
      <View style={{ height: spacing.sm }} />
      <DisplayText size={typeScale.displayS}>Recipe {id}</DisplayText>
      <View style={{ height: spacing.md }} />
      <BodyText>
        Modal placeholder. Full detail view with ingredients, steps, and timeline
        ships in Week 2.
      </BodyText>
    </ScreenShell>
  );
}
