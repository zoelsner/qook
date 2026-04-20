import React from 'react';
import { View } from 'react-native';
import { ScreenShell } from '../../components/ScreenShell';
import { PaperCard } from '../../components/PaperCard';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { palette, spacing } from '../../design';

export function SavedScreen() {
  return (
    <ScreenShell>
      <Mono>saved</Mono>
      <View style={{ height: spacing.sm }} />
      <DisplayText>Your cookbook.</DisplayText>
      <BrushstrokeUnderline
        width={200}
        color={palette.accent}
        pathVariant="v2"
        style={{ marginTop: -4 }}
      />
      <View style={{ height: spacing.xl }} />

      <PaperCard padding={spacing.lg}>
        <Mono>nothing saved yet</Mono>
        <View style={{ height: spacing.sm }} />
        <BodyText>
          Recipes you swipe-in or save from Tonight show up here. The grid view with
          filter chips ships in Week 3.
        </BodyText>
      </PaperCard>
    </ScreenShell>
  );
}
