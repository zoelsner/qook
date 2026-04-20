import React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ScreenShell } from '../../components/ScreenShell';
import { PaperCard } from '../../components/PaperCard';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { FoodHeroImage } from '../../components/FoodHeroImage';
import { EnergyBadge } from '../../components/EnergyBadge';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { palette, spacing } from '../../design';
import { api } from '../../services/api';
import { mockRecipes } from '../../services/fixtures/recipes';
import type { SeedMealKey } from '../../lib/assets';

export function SwipeNightScreen() {
  const { data: deck } = useQuery({
    queryKey: ['deck'],
    queryFn: () => api.getCurrentDeck(),
  });

  const top = mockRecipes[0];

  return (
    <ScreenShell>
      <Mono>swipe night</Mono>
      <View style={{ height: spacing.sm }} />
      <DisplayText>Build your week.</DisplayText>
      <BrushstrokeUnderline
        width={240}
        color={palette.utility}
        pathVariant="v2"
        style={{ marginTop: -4 }}
      />
      <View style={{ height: spacing.xl }} />

      <PaperCard padding={spacing.md}>
        <FoodHeroImage
          localKey={top.localImageKey as SeedMealKey | undefined}
          height={240}
          cornerRadius={12}
        />
        <View style={{ height: spacing.md }} />
        <EnergyBadge tier={top.tier} />
        <View style={{ height: spacing.sm }} />
        <DisplayText size={26}>{top.title}</DisplayText>
        <View style={{ height: spacing.xs }} />
        <Mono>
          {top.cuisine} · {top.timeMinutes} min · serves {top.servings}
        </Mono>
      </PaperCard>

      <View style={{ height: spacing.md }} />
      <BodyText size={14} color={palette.textSecondary}>
        {deck ? `Deck of ${deck.recipeIds.length} recipes ready.` : 'Loading deck…'}{' '}
        Swipe interactions ship in Week 2.
      </BodyText>
    </ScreenShell>
  );
}
