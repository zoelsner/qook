import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share as RNShare,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type {
  IngredientGroup,
  Ingredient,
  Recipe,
} from '@qook/shared';

import { FoodHeroImage } from '../../components/FoodHeroImage';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import {
  PaintedCheckbox,
  PaintedDivider,
  IconPill,
  GlassChip,
  IconCookingSteam,
} from '../../components/painted';
import { X, Bookmark, Share } from 'lucide-react-native';
import { palette, spacing } from '../../design';
import { ENERGY_TIER_SUBTITLE } from '../../types/energy';
import { api } from '../../services/api';
import { useHaptics } from '../../hooks/useHaptics';
import { useWeekPlan, activePickFor } from '../../stores/weekPlan';
import { todayISO } from '../week/weekDates';
import type { SeedMealKey } from '../../lib/assets';

export interface RecipeDetailModalProps {
  recipeId: string;
}

export function RecipeDetailModal({ recipeId }: RecipeDetailModalProps) {
  const router = useRouter();
  const { tap, press, select } = useHaptics();
  const insets = useSafeAreaInsets();
  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => api.getRecipeById(recipeId),
  });

  const savedRecipeIds = useWeekPlan((s) => s.savedRecipeIds);
  const toggleSavedRecipe = useWeekPlan((s) => s.toggleSavedRecipe);
  const saved = savedRecipeIds.includes(recipeId);
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});

  const appendRecipeAndSelect = useWeekPlan((s) => s.appendRecipeAndSelect);
  const todaysPick = useWeekPlan((s) => activePickFor(s.plan[todayISO()]));
  const isTodaysPick = todaysPick?.id === recipeId;

  const close = () => {
    tap();
    router.back();
  };

  const onCookTonight = () => {
    if (!recipe) return;
    press();
    appendRecipeAndSelect(todayISO(), recipe);
    router.replace('/(tabs)/tonight');
  };

  const onShare = async () => {
    if (!recipe) return;
    tap();
    try {
      await RNShare.share({
        title: recipe.title,
        message: `${recipe.title} — cooked with Qook\nhttps://qook.app/r/${recipe.slug}`,
      });
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const onAddAllToList = () => {
    if (!recipe) return;
    press();
    appendRecipeAndSelect(todayISO(), recipe);
    router.push('/(tabs)/shop');
  };

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 96 + insets.bottom + spacing.lg,
        }}
      >
        {isLoading || !recipe ? (
          <LoadingState />
        ) : (
          <RecipeBody
            recipe={recipe}
            checkedIds={checkedIds}
            onToggleIngredient={(id) => {
              select();
              setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
            }}
            onAddAll={onAddAllToList}
          />
        )}
      </ScrollView>

      <SafeAreaView edges={['top']} style={styles.heroNav} pointerEvents="box-none">
        <View style={styles.heroNavInner}>
          <IconPill onPress={close} accessibilityLabel="Close">
            <X size={16} color={palette.ink} strokeWidth={2.2} />
          </IconPill>
          <View style={styles.heroNavRight}>
            <IconPill
              onPress={() => {
                press();
                toggleSavedRecipe(recipeId);
              }}
              accessibilityLabel={saved ? 'Unsave recipe' : 'Save recipe'}
            >
              <Bookmark
                size={16}
                color={palette.ink}
                fill={saved ? palette.ink : 'transparent'}
                strokeWidth={1.8}
              />
            </IconPill>
            <IconPill onPress={onShare} accessibilityLabel="Share recipe">
              <Share size={16} color={palette.ink} strokeWidth={1.8} />
            </IconPill>
          </View>
        </View>
      </SafeAreaView>

      {recipe ? (
        <CookDock
          bottomInset={insets.bottom}
          isTodaysPick={isTodaysPick}
          onCook={onCookTonight}
        />
      ) : null}
    </View>
  );
}

function RecipeBody({
  recipe,
  checkedIds,
  onToggleIngredient,
  onAddAll,
}: {
  recipe: Recipe;
  checkedIds: Record<string, boolean>;
  onToggleIngredient: (id: string) => void;
  onAddAll: () => void;
}) {
  const ingredientCount = recipe.ingredients.reduce(
    (acc, group) => acc + group.items.length,
    0
  );

  return (
    <View>
      <View style={styles.hero}>
        <FoodHeroImage
          localKey={recipe.localImageKey as SeedMealKey | undefined}
          remoteUrl={recipe.heroImageUrl}
          blurhash={recipe.blurhash}
          height={340}
          cornerRadius={0}
          style={styles.heroImage}
        />
      </View>

      <View style={styles.titleBlock}>
        <View style={styles.chipRow}>
          <GlassChip>
            <View style={styles.tierDot} />
            <Mono size={10} bold color={palette.accentDeep}>
              {ENERGY_TIER_SUBTITLE[recipe.tier].toUpperCase()}
            </Mono>
          </GlassChip>
          <GlassChip>
            <Mono size={10} color={palette.textSecondary}>
              {recipe.cuisine.toUpperCase()}
            </Mono>
          </GlassChip>
        </View>
        <DisplayText size={34} style={styles.title}>
          {recipe.title}
        </DisplayText>
      </View>

      <View style={styles.statsRow}>
        <Stat value={String(recipe.timeMinutes)} label="minutes" />
        {recipe.nutritionalEstimate?.proteinG != null ? (
          <>
            <View style={styles.statRule} />
            <Stat
              value={`${recipe.nutritionalEstimate.proteinG}g`}
              label="protein"
            />
          </>
        ) : null}
        <View style={styles.statRule} />
        <Stat value={String(recipe.servings)} label="serves" />
        <View style={styles.statRule} />
        <Stat value={String(ingredientCount)} label="ingredients" />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Mono size={10} bold color={palette.accentDeep}>
            ingredients
          </Mono>
          <Pressable hitSlop={6} onPress={onAddAll} accessibilityRole="button">
            <BodyText
              size={12}
              weight="semi"
              color={palette.primary}
              style={styles.sectionAction}
            >
              Add all to list
            </BodyText>
          </Pressable>
        </View>
        <View>
          {recipe.ingredients.flatMap((group, gIdx) =>
            group.items.map((ing, iIdx) => {
              const rowId = rowKeyFor(group, ing, gIdx, iIdx);
              return (
                <IngredientRow
                  key={rowId}
                  id={rowId}
                  ingredient={ing}
                  checked={!!checkedIds[rowId]}
                  onToggle={onToggleIngredient}
                />
              );
            })
          )}
        </View>
      </View>

      {recipe.steps.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Mono size={10} bold color={palette.accentDeep}>
              steps
            </Mono>
            <Mono size={10} color={palette.textSecondary}>
              {recipe.steps.length} sections · {recipe.timeMinutes} min
            </Mono>
          </View>
          <View style={{ height: spacing.sm }} />
          {recipe.steps.map((section, idx) => (
            <View
              key={`${section.title}-${idx}`}
              style={[styles.stepSection, idx > 0 ? { marginTop: spacing.md } : null]}
            >
              <View style={styles.stepHeaderRow}>
                <Mono size={11} bold color={palette.accent}>
                  {String(idx + 1).padStart(2, '0')}
                </Mono>
                <DisplayText size={20} style={styles.stepTitle}>
                  {section.title}
                </DisplayText>
              </View>
              <View style={{ height: spacing.xs }} />
              <BodyText size={13} color={palette.textSecondary}>
                {section.objective}
              </BodyText>
              <View style={{ height: spacing.sm }} />
              {section.steps.map((step, si) => (
                <View key={si} style={styles.substepRow}>
                  <View style={styles.substepDot} />
                  <View style={styles.substepBody}>
                    <BodyText size={14} color={palette.ink}>
                      {step.instruction}
                    </BodyText>
                    {step.durationMin ? (
                      <Mono size={9} color={palette.textSecondary}>
                        {step.durationMin} min
                      </Mono>
                    ) : null}
                  </View>
                </View>
              ))}
              {idx < recipe.steps.length - 1 ? (
                <View style={{ marginTop: spacing.sm }}>
                  <PaintedDivider />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {recipe.timeline.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Mono size={10} bold color={palette.accentDeep}>
              timeline
            </Mono>
          </View>
          <View style={{ height: spacing.sm }} />
          <View>
            {recipe.timeline.map((item, idx) => (
              <View key={idx} style={styles.timelineRow}>
                <View style={styles.timelineTick}>
                  <Mono size={11} bold color={palette.primary}>
                    {String(Math.floor(item.atMin)).padStart(2, '0')}:00
                  </Mono>
                </View>
                <View style={styles.timelineBody}>
                  <BodyText size={14} color={palette.ink}>
                    {item.instruction}
                  </BodyText>
                  <Mono size={9} color={palette.textTertiary}>
                    {item.sectionTitle}
                  </Mono>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {recipe.notes ? (
        <View style={[styles.section, { marginTop: spacing.lg }]}>
          <Mono size={10} bold color={palette.accentDeep}>
            notes
          </Mono>
          <View style={{ height: spacing.xs }} />
          <BodyText size={14} color={palette.textSecondary} weight="medium">
            {recipe.notes}
          </BodyText>
        </View>
      ) : null}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <DisplayText size={26} color={palette.primary} style={styles.statValue}>
        {value}
      </DisplayText>
      <Mono size={9} bold color={palette.textSecondary} style={styles.statLabel}>
        {label.toUpperCase()}
      </Mono>
    </View>
  );
}

function IngredientRow({
  id,
  ingredient,
  checked,
  onToggle,
}: {
  id: string;
  ingredient: Ingredient;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onToggle(id)}
      style={({ pressed }) => [
        styles.ingredientRow,
        pressed ? { opacity: 0.78 } : null,
      ]}
    >
      <PaintedCheckbox checked={checked} size={22} />
      <BodyText
        size={16}
        weight="semi"
        color={checked ? palette.textSecondary : palette.ink}
        style={[
          styles.ingredientName,
          checked ? { textDecorationLine: 'line-through' } : null,
        ]}
      >
        {ingredient.item}
      </BodyText>
      {ingredient.quantity ? (
        <Mono size={12} color={palette.textSecondary} style={styles.ingredientQty}>
          {ingredient.quantity}
        </Mono>
      ) : null}
    </Pressable>
  );
}

function LoadingState() {
  return (
    <View style={{ paddingTop: spacing.xxl * 2, paddingHorizontal: spacing.lg }}>
      <Mono>loading recipe</Mono>
    </View>
  );
}

function CookDock({
  bottomInset,
  isTodaysPick,
  onCook,
}: {
  bottomInset: number;
  isTodaysPick: boolean;
  onCook: () => void;
}) {
  return (
    <View
      style={[
        styles.cookDock,
        { bottom: Math.max(bottomInset, spacing.sm) + spacing.sm },
      ]}
    >
      <PolishedButton
        label={isTodaysPick ? "Cooking tonight ✓" : 'Cook tonight'}
        tone="forest"
        onPress={onCook}
        leadingIcon={isTodaysPick ? undefined : <IconCookingSteam />}
        disabled={isTodaysPick}
        style={styles.cookCta}
      />
    </View>
  );
}

function rowKeyFor(group: IngredientGroup, ing: Ingredient, gIdx: number, iIdx: number): string {
  return `${group.role}-${gIdx}-${iIdx}-${ing.item}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  hero: {
    width: '100%',
    height: 340,
  },
  heroImage: {
    width: '100%',
    height: 340,
  },
  heroNav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  heroNavInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: spacing.sm,
  },
  heroNavRight: {
    flexDirection: 'row',
    gap: 10,
  },
  titleBlock: {
    marginTop: -18,
    paddingHorizontal: 24,
    gap: 10,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  tierDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.accent,
  },
  title: {
    letterSpacing: -1,
    lineHeight: 38,
  },
  statsRow: {
    marginTop: spacing.lg,
    marginHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    letterSpacing: 1.8,
  },
  statRule: {
    width: 1,
    height: 36,
    backgroundColor: palette.statRuleColor,
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  sectionAction: {
    fontStyle: 'italic',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.ingredientRowBorder,
  },
  ingredientName: {
    flex: 1,
    letterSpacing: -0.15,
    lineHeight: 20,
  },
  ingredientQty: {
    letterSpacing: 1.2,
  },
  stepSection: {},
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepTitle: {
    flex: 1,
    lineHeight: 22,
  },
  substepRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  substepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.accent,
    marginTop: 9,
  },
  substepBody: { flex: 1 },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.ingredientRowBorder,
  },
  timelineTick: {
    width: 56,
  },
  timelineBody: { flex: 1 },
  cookDock: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cookCta: {
    flex: 1,
  },
});
