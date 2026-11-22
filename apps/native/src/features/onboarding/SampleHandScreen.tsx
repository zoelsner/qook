import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Recipe } from '@qook/shared';
import { ArrowLeft, ArrowRight, ChevronRight, X } from 'lucide-react-native';

import { ScreenShell } from '../../components/ScreenShell';
import { MenuRow } from '../../components/MenuRow';
import { Vignette } from '../../components/Vignette';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { IconPill } from '../../components/painted';
import { palette, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { DeckCard } from '../eat/DeckScreen';
import { SAMPLE_HAND } from './sampleHand';
import type { SeedMealKey } from '../../lib/assets';

// Signed-out preview of the real deck, between onboarding and sign-in. Lives in
// local state only: no store writes, so nothing from it can reach a plan, and
// no api calls, so a signed-out user never reaches the backend.
export function SampleHandScreen() {
  const router = useRouter();
  const { press, tap } = useHaptics();
  const [position, setPosition] = useState(0);
  const [kept, setKept] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const recipe = SAMPLE_HAND[position];
  const advance = () => setPosition((p) => p + 1);

  const goSignIn = () => {
    press();
    router.replace('/(auth)/sign-in');
  };

  const handleKeep = () => {
    if (!recipe) return;
    setKept((prev) => (prev.some((r) => r.id === recipe.id) ? prev : [...prev, recipe]));
    advance();
  };

  const handleOpenRecipe = (dish: Recipe) => {
    press();
    setSelectedRecipe(dish);
  };

  if (selectedRecipe) {
    return (
      <SampleRecipePreview
        recipe={selectedRecipe}
        onBack={() => {
          tap();
          setSelectedRecipe(null);
        }}
        onSignIn={goSignIn}
      />
    );
  }

  return (
    <ScreenShell horizontalPadding={20}>
      <View style={styles.masthead}>
        <Mono size={10} bold color={palette.accentDeep}>
          sample hand · {Math.min(position + 1, SAMPLE_HAND.length)}/{SAMPLE_HAND.length}
        </Mono>
        <IconPill onPress={goSignIn} accessibilityLabel="Close sample">
          <X size={16} color={palette.ink} strokeWidth={2.2} />
        </IconPill>
      </View>
      <View style={{ height: spacing.xs }} />
      <BodyText size={14} color={palette.textSecondary} weight="medium">
        A taste of how it works — nothing here carries over after sign-in. Open any dish to see its full recipe and shopping list.
      </BodyText>
      <View style={{ height: spacing.md }} />

      {recipe ? (
        <>
          <DeckCard
            key={recipe.id}
            recipe={recipe}
            primaryCookTonight
            cookLabel="See full recipe →"
            keepLabel="Bookmark"
            onCookTonight={() => handleOpenRecipe(recipe)}
            onKeep={handleKeep}
            onPass={advance}
          />
          {kept.length > 0 ? (
            <Pressable
              onPress={() => handleOpenRecipe(kept[kept.length - 1])}
              accessibilityRole="button"
              style={styles.savedTray}
            >
              <Mono size={11} bold color={palette.accentDeep}>
                {kept.length === 1
                  ? `1 saved · open ${kept[0].title} →`
                  : `${kept.length} saved · open ${kept[kept.length - 1].title} →`}
              </Mono>
            </Pressable>
          ) : null}
          <Pressable
            onPress={goSignIn}
            accessibilityRole="button"
            hitSlop={12}
            style={({ pressed }) => [styles.skipRow, pressed ? { opacity: 0.5 } : null]}
          >
            <BodyText size={13} weight="medium" color={palette.textSecondary}>
              Skip — sign in now
            </BodyText>
          </Pressable>
        </>
      ) : (
        <View style={styles.emptyWell}>
          <Mono size={10} bold color={palette.accentDeep}>
            that&rsquo;s the sample
          </Mono>
          <View style={{ height: spacing.sm }} />
          <DisplayText size={26} color={palette.primary} style={styles.center}>
            {kept.length > 0
              ? kept.length === 1
                ? '1 sample dish saved'
                : `${kept.length} sample dishes saved`
              : 'Want dinners made for you?'}
          </DisplayText>
          <View style={{ height: spacing.sm }} />
          <BodyText size={15} color={palette.textSecondary} style={styles.center}>
            {kept.length > 0
              ? 'Tap a dish below to inspect its recipe and shopping list, or sign in for hands written for your taste.'
              : 'Your real hand is written fresh from your answers. That needs an account.'}
          </BodyText>
          {kept.length > 0 ? (
            <View style={styles.savedList}>
              {kept.map((dish) => (
                <Pressable
                  key={dish.id}
                  onPress={() => handleOpenRecipe(dish)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open sample recipe ${dish.title}`}
                  style={({ pressed }) => [
                    styles.savedRow,
                    pressed ? { opacity: 0.75 } : null,
                  ]}
                >
                  <Vignette
                    size={44}
                    localKey={dish.localImageKey as SeedMealKey | undefined}
                    title={dish.title}
                  />
                  <View style={styles.savedRowBody}>
                    <BodyText size={15} weight="semi" color={palette.ink} numberOfLines={1}>
                      {dish.title}
                    </BodyText>
                    <Mono size={10} color={palette.textSecondary}>
                      {dish.timeMinutes} min · {dish.cuisine.toLowerCase()}
                    </Mono>
                  </View>
                  <ChevronRight size={16} color={palette.textTertiary} strokeWidth={2} />
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={{ height: spacing.lg }} />
          <View style={styles.fullWidth}>
            <PolishedButton
              label="Sign in to start"
              tone="forest"
              onPress={goSignIn}
              trailingIcon={<ArrowRight size={14} color={palette.surface} />}
            />
          </View>
        </View>
      )}
    </ScreenShell>
  );
}

function SampleRecipePreview({
  recipe,
  onBack,
  onSignIn,
}: {
  recipe: Recipe;
  onBack: () => void;
  onSignIn: () => void;
}) {
  const flatIngredients = recipe.ingredients.flatMap((group) => group.items ?? []);
  const flatSteps = recipe.steps.flatMap((section) => section.steps ?? []);

  return (
    <ScreenShell horizontalPadding={24}>
      <View style={styles.masthead}>
        <IconPill onPress={onBack} accessibilityLabel="Back to sample hand">
          <ArrowLeft size={16} color={palette.ink} strokeWidth={2.2} />
        </IconPill>
        <Mono size={10} bold color={palette.accentDeep}>
          sample recipe &amp; list
        </Mono>
        <IconPill onPress={onSignIn} accessibilityLabel="Skip sample and sign in">
          <X size={16} color={palette.ink} strokeWidth={2.2} />
        </IconPill>
      </View>

      <View style={{ height: spacing.lg }} />

      <View style={styles.previewHero}>
        <Vignette
          size={140}
          localKey={recipe.localImageKey as SeedMealKey | undefined}
          title={recipe.title}
        />
        <View style={{ height: spacing.md }} />
        <Mono size={10} bold color={palette.accentDeep}>
          {recipe.cuisine.toLowerCase()}
        </Mono>
        <View style={{ height: 4 }} />
        <DisplayText size={28} color={palette.primary} style={styles.center}>
          {recipe.title}
        </DisplayText>
      </View>

      <View style={{ height: spacing.md }} />
      <MenuRow label="Estimated time" value={`${recipe.timeMinutes} min`} />
      <MenuRow label="Serves" value={String(recipe.servings)} />
      <MenuRow label="Cuisine" value={recipe.cuisine} />

      <View style={{ height: spacing.lg }} />
      <Mono size={10} bold color={palette.accentDeep}>
        shopping list · {flatIngredients.length} items
      </Mono>
      <View style={{ height: spacing.sm }} />
      <View style={styles.previewCard}>
        {flatIngredients.map((ing, idx) => (
          <View
            key={`${ing.item}-${idx}`}
            style={[
              styles.ingredientRow,
              idx === flatIngredients.length - 1 ? styles.ingredientRowLast : null,
            ]}
          >
            <BodyText size={15} weight="medium" color={palette.ink} style={styles.ingredientName}>
              {ing.parsed?.name || ing.item}
            </BodyText>
            <Mono size={11} color={palette.textSecondary} style={styles.ingredientQty}>
              {ing.quantity || 'to taste'}
            </Mono>
          </View>
        ))}
      </View>

      <View style={{ height: spacing.lg }} />
      <Mono size={10} bold color={palette.accentDeep}>
        steps · {flatSteps.length}
      </Mono>
      <View style={{ height: spacing.sm }} />
      {flatSteps.map((step, idx) => (
        <View key={idx} style={styles.stepRow}>
          <Mono size={11} bold color={palette.accentDeep} style={styles.stepNum}>
            {String(idx + 1).padStart(2, '0')}
          </Mono>
          <BodyText size={15} color={palette.text} style={styles.stepText}>
            {step.instruction}
          </BodyText>
        </View>
      ))}

      <View style={{ height: spacing.xl }} />
      <PolishedButton
        label="Sign in for dinners made for you"
        tone="forest"
        onPress={onSignIn}
        trailingIcon={<ArrowRight size={14} color={palette.surface} />}
      />
      <View style={{ height: spacing.sm }} />
      <PolishedButton label="Back to sample hand" tone="ghost" onPress={onBack} />
      <View style={{ height: spacing.lg }} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedTray: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 999,
    backgroundColor: palette.well,
  },
  skipRow: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  emptyWell: {
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: palette.well,
    alignItems: 'center',
  },
  savedList: {
    width: '100%',
    marginTop: spacing.md,
    borderRadius: 14,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(42, 58, 38, 0.08)',
  },
  savedRowBody: {
    flex: 1,
  },
  fullWidth: {
    width: '100%',
  },
  center: { textAlign: 'center' },
  previewHero: {
    alignItems: 'center',
  },
  previewCard: {
    borderRadius: 16,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
    paddingHorizontal: spacing.md,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.ingredientRowBorder,
  },
  ingredientRowLast: {
    borderBottomWidth: 0,
  },
  ingredientName: {
    flex: 1,
  },
  ingredientQty: {
    textAlign: 'right',
    maxWidth: '45%',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stepNum: {
    marginTop: 2,
    width: 22,
  },
  stepText: {
    flex: 1,
    lineHeight: 22,
  },
});
