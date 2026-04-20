import React from 'react';
import { Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { Recipe } from '@qook/shared';
import { ScreenShell } from '../../components/ScreenShell';
import { PaperCard } from '../../components/PaperCard';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { FoodHeroImage } from '../../components/FoodHeroImage';
import { EnergyBadge } from '../../components/EnergyBadge';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { palette, spacing } from '../../design';
import { api } from '../../services/api';
import { useHaptics } from '../../hooks/useHaptics';
import type { SeedMealKey } from '../../lib/assets';

export function TonightScreen() {
  const router = useRouter();
  const { press } = useHaptics();
  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ['tonight'],
    queryFn: () => api.getTonightPlan(),
  });

  const openRecipe = (id: string) => {
    press();
    router.push({ pathname: '/(modals)/recipe/[id]', params: { id } });
  };

  return (
    <ScreenShell>
      <Mono>tonight</Mono>
      <View style={{ height: spacing.sm }} />
      <DisplayText>Pick your dinner.</DisplayText>
      <BrushstrokeUnderline
        width={220}
        color={palette.accent}
        style={{ marginTop: -4 }}
      />
      <View style={{ height: spacing.xl }} />

      {isLoading ? (
        <Mono>loading</Mono>
      ) : (
        recipes.map((recipe, idx) => (
          <View key={recipe.id}>
            {idx > 0 && <View style={{ height: spacing.md }} />}
            <Pressable onPress={() => openRecipe(recipe.id)}>
              {({ pressed }) => (
                <View style={{ opacity: pressed ? 0.92 : 1 }}>
                  <TonightCard recipe={recipe} />
                </View>
              )}
            </Pressable>
          </View>
        ))
      )}
    </ScreenShell>
  );
}

function TonightCard({ recipe }: { recipe: Recipe }) {
  return (
    <PaperCard padding={spacing.md}>
      <FoodHeroImage
        localKey={recipe.localImageKey as SeedMealKey | undefined}
        height={180}
        cornerRadius={12}
      />
      <View style={{ height: spacing.md }} />
      <EnergyBadge tier={recipe.tier} />
      <View style={{ height: spacing.sm }} />
      <DisplayText size={22}>{recipe.title}</DisplayText>
      <View style={{ height: spacing.xs }} />
      <Mono>
        {recipe.cuisine} · {recipe.timeMinutes} min · serves {recipe.servings}
      </Mono>
      {recipe.notes ? (
        <>
          <View style={{ height: spacing.sm }} />
          <BodyText size={14}>{recipe.notes}</BodyText>
        </>
      ) : null}
    </PaperCard>
  );
}
