import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  Share as RNShare,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type {
  IngredientGroup,
  Ingredient,
  Recipe,
} from '@qook/shared';

import { FoodHeroImage } from '../../components/FoodHeroImage';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { MenuRow } from '../../components/MenuRow';
import { ProteinChip } from '../../components/ProteinChip';
import { SquareCheckbox } from '../../components/SquareCheckbox';
import {
  PaintedDivider,
  IconPill,
  IconCookingSteam,
} from '../../components/painted';
import { X, Bookmark, Share, Minus, Plus } from 'lucide-react-native';
import { fontFamily, palette, spacing, typeScale } from '../../design';
import { ENERGY_TIER_SUBTITLE } from '../../types/energy';
import { api } from '../../services/api';
import { useHaptics } from '../../hooks/useHaptics';
import { useWeekPlan, activePickFor } from '../../stores/weekPlan';
import { useCookSession } from '../../stores/cookSession';
import { scaledIngredientQuantity } from '../../lib/scaleQuantity';
import { todayISO } from '../week/weekDates';
import type { SeedMealKey } from '../../lib/assets';
import { shouldPollRecipeArt } from '../../hooks/recipeArtState';

const glassAvailable = isLiquidGlassAvailable();

export interface RecipeDetailModalProps {
  recipeId: string;
}

export function RecipeDetailModal({ recipeId }: RecipeDetailModalProps) {
  const router = useRouter();
  const { tap, press, select } = useHaptics();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => api.getRecipeById(recipeId),
    refetchOnMount: 'always',
    refetchInterval: (query) =>
      shouldPollRecipeArt(query.state.data) ? 2500 : false,
  });

  // Ensure art for any recipe the user actually opens (spotlight-first §1C):
  // 'pending' = never-requested proposal reaching detail; 'failed' = retry.
  // Duplicate fires are cheap server no-ops (pending|failed→generating lock).
  // Fire at most once per modal open — re-firing on every status observation
  // could loop paid retries on a permanently failing row. The delayed
  // invalidate refetches after the server has flipped the row to 'generating'
  // so the poll loop (gated by markRecipeArtRequested) restarts.
  const artFiredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!recipe || artFiredFor.current === recipeId) return;
    if (recipe.imageStatus === 'pending' || recipe.imageStatus === 'failed') {
      artFiredFor.current = recipeId;
      void api.requestRecipeImage(recipeId);
      const t = setTimeout(
        () => queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] }),
        1500,
      );
      return () => clearTimeout(t);
    }
  }, [recipe, recipeId, queryClient]);

  const savedRecipeIds = useWeekPlan((s) => s.savedRecipeIds);
  const toggleSavedRecipe = useWeekPlan((s) => s.toggleSavedRecipe);
  const saved = savedRecipeIds.includes(recipeId);

  // Checklist + serving override live in the persisted cook session so they
  // survive closing the modal mid-cook.
  const cookState = useCookSession((s) => s.byRecipe[recipeId]);
  const toggleChecked = useCookSession((s) => s.toggleChecked);
  const setServings = useCookSession((s) => s.setServings);
  const checkedIds = cookState?.checked ?? EMPTY_CHECKED;
  const servings = cookState?.servings ?? recipe?.servings ?? 2;

  const appendRecipeAndSelect = useWeekPlan((s) => s.appendRecipeAndSelect);
  const stageRecipeForShop = useWeekPlan((s) => s.stageRecipeForShop);
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
        message: `${recipe.title} — cooked with Qook`,
      });
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const onAddAllToList = () => {
    if (!recipe) return;
    press();
    stageRecipeForShop(recipe);
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
            servings={servings}
            onServingsChange={(n) => {
              select();
              setServings(recipeId, n);
            }}
            onToggleIngredient={(id) => {
              select();
              toggleChecked(recipeId, id);
            }}
            onAddAll={onAddAllToList}
          />
        )}
      </ScrollView>

      <SafeAreaView edges={['top']} style={styles.heroNav} pointerEvents="box-none">
        <View style={styles.heroNavInner}>
          <HeroPill onPress={close} accessibilityLabel="Close">
            <X size={16} color={palette.ink} strokeWidth={2.2} />
          </HeroPill>
          <View style={styles.heroNavRight}>
            <HeroPill
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
            </HeroPill>
            <HeroPill onPress={onShare} accessibilityLabel="Share recipe">
              <Share size={16} color={palette.ink} strokeWidth={1.8} />
            </HeroPill>
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
  servings,
  onServingsChange,
  onToggleIngredient,
  onAddAll,
}: {
  recipe: Recipe;
  checkedIds: Record<string, boolean>;
  servings: number;
  onServingsChange: (n: number) => void;
  onToggleIngredient: (id: string) => void;
  onAddAll: () => void;
}) {
  const ingredientCount = recipe.ingredients.reduce(
    (acc, group) => acc + group.items.length,
    0
  );
  const factor = recipe.servings > 0 ? servings / recipe.servings : 1;

  return (
    <View>
      <View style={styles.hero}>
        {recipe.imageStatus === 'failed' ? (
          <View style={[styles.heroImage, styles.heroLetter]}>
            <DisplayText size={140} color={palette.accentDeep}>
              {(recipe.title.trim().charAt(0) || '·').toUpperCase()}
            </DisplayText>
          </View>
        ) : (
          <FoodHeroImage
            localKey={recipe.localImageKey as SeedMealKey | undefined}
            remoteUrl={recipe.heroImageUrl}
            blurhash={recipe.blurhash}
            height={340}
            cornerRadius={0}
            style={styles.heroImage}
          />
        )}
        {recipe.imageStatus === 'pending' || recipe.imageStatus === 'generating' ? (
          <PaintingCaption />
        ) : null}
      </View>

      <View style={styles.titleBlock}>
        <Mono size={10} bold color={palette.accentDeep}>
          {ENERGY_TIER_SUBTITLE[recipe.tier].toUpperCase()} · {recipe.cuisine.toUpperCase()}
        </Mono>
        <View style={styles.titleRow}>
          <View style={styles.titleCol}>
            <DisplayText size={34} style={styles.title}>
              {recipe.title}
            </DisplayText>
            <BrushstrokeUnderline
              width={200}
              color={palette.accent}
              strokeWidth={2.6}
              style={styles.titleUnderline}
            />
          </View>
          {recipe.nutritionalEstimate?.proteinG != null ? (
            <ProteinChip proteinG={recipe.nutritionalEstimate.proteinG} size="md" />
          ) : null}
        </View>
      </View>

      <View style={styles.statsSection}>
        <MenuRow label="Active time" value={`${recipe.timeMinutes} min`} />
        <ServesStepperRow servings={servings} onChange={onServingsChange} />
        <MenuRow label="Ingredients" value={String(ingredientCount)} />
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
                  factor={factor}
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
              the moves
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
                <DisplayText size={22} color={palette.accent} style={styles.moveNumeral}>
                  {String(idx + 1).padStart(2, '0')}
                </DisplayText>
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

function IngredientRow({
  id,
  ingredient,
  factor,
  checked,
  onToggle,
}: {
  id: string;
  ingredient: Ingredient;
  factor: number;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  const quantity = scaledIngredientQuantity(ingredient, factor);
  return (
    <Pressable
      onPress={() => onToggle(id)}
      style={({ pressed }) => [
        styles.ingredientRow,
        pressed ? { opacity: 0.78 } : null,
      ]}
    >
      <SquareCheckbox checked={checked} size={22} />
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
      {quantity ? (
        <Mono size={12} color={palette.textSecondary} style={styles.ingredientQty}>
          {quantity}
        </Mono>
      ) : null}
    </Pressable>
  );
}

// "Serves ····· − 4 +" — the stats row doubles as the scaling calculator.
// Scaling multiplies every parsed ingredient quantity; prose steps keep the
// original amounts (known limit).
const MIN_SERVINGS = 1;
const MAX_SERVINGS = 12;

function ServesStepperRow({
  servings,
  onChange,
}: {
  servings: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.servesRow}>
      <BodyText size={16} weight="medium" color={palette.ink}>
        Serves
      </BodyText>
      <BodyText
        style={styles.servesLeader}
        numberOfLines={1}
      >
        {'·'.repeat(80)}
      </BodyText>
      <View style={styles.stepper}>
        <Pressable
          hitSlop={8}
          disabled={servings <= MIN_SERVINGS}
          onPress={() => onChange(servings - 1)}
          accessibilityLabel="Fewer servings"
          style={({ pressed }) => [
            styles.stepperBtn,
            servings <= MIN_SERVINGS ? { opacity: 0.3 } : null,
            pressed ? { opacity: 0.6 } : null,
          ]}
        >
          <Minus size={13} color={palette.primary} strokeWidth={2.6} />
        </Pressable>
        <Mono size={13} bold color={palette.ink} style={styles.stepperValue}>
          {String(servings)}
        </Mono>
        <Pressable
          hitSlop={8}
          disabled={servings >= MAX_SERVINGS}
          onPress={() => onChange(servings + 1)}
          accessibilityLabel="More servings"
          style={({ pressed }) => [
            styles.stepperBtn,
            servings >= MAX_SERVINGS ? { opacity: 0.3 } : null,
            pressed ? { opacity: 0.6 } : null,
          ]}
        >
          <Plus size={13} color={palette.primary} strokeWidth={2.6} />
        </Pressable>
      </View>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={{ paddingTop: spacing.xxl * 2, paddingHorizontal: spacing.lg }}>
      <Mono>loading recipe</Mono>
    </View>
  );
}

// Quiet caption over the hero placeholder while art is generating (4-9s).
// Lives inside styles.hero, a ScrollView descendant far from the heroNav
// SafeAreaView where the GlassView hero pills render (see HeroPill note
// below) — it is not an ancestor of any GlassView, so animating its opacity
// is safe. Only the Text pulses, never a View wrapper, per the same rule.
function PaintingCaption() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.paintingCaptionWrap} pointerEvents="none">
      <Animated.Text style={[styles.paintingCaptionText, pulseStyle]}>
        Painting your plate…
      </Animated.Text>
    </View>
  );
}

// Clear glass circle for the hero-nav pills (close / save / share) when
// Liquid Glass is available; falls back to the cream IconPill otherwise.
// GlassView renders as an absolute-fill sibling *under* the Pressable inside
// a rounded, overflow-hidden wrapper — it must never be an ancestor of the
// touch target (expo-glass-effect renders as a UIVisualEffectView) and must
// never receive an opacity/animation (breaks glass rendering).
function HeroPill({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  if (!glassAvailable) {
    return (
      <IconPill onPress={onPress} accessibilityLabel={accessibilityLabel}>
        {children}
      </IconPill>
    );
  }
  return (
    <View style={styles.glassHeroPillWrap}>
      <GlassView
        glassEffectStyle="regular"
        tintColor="rgba(255, 252, 246, 0.16)"
        isInteractive
        style={StyleSheet.absoluteFillObject}
      />
      <Pressable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        hitSlop={6}
        style={({ pressed }) => [
          styles.glassHeroPillPressable,
          pressed ? { transform: [{ scale: 0.94 }] } : null,
        ]}
      >
        {children}
      </Pressable>
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
      {glassAvailable ? (
        <GlassCookButton isTodaysPick={isTodaysPick} onCook={onCook} />
      ) : (
        <PolishedButton
          label={isTodaysPick ? "Cooking tonight ✓" : 'Cook tonight'}
          tone="forest"
          onPress={onCook}
          leadingIcon={isTodaysPick ? undefined : <IconCookingSteam />}
          disabled={isTodaysPick}
          style={styles.cookCta}
        />
      )}
    </View>
  );
}

// Prominent tinted glass CTA — Apple's "prominent" glass is a near-opaque
// tint so the primary action doesn't wash out over the scrolling recipe
// body. Same sibling structure as HeroPill: GlassView absolute-fill under
// the Pressable, wrapper carries the rounding + overflow hidden. The
// "cooking tonight" state is expressed via a muted tint + dimmed label
// instead of opacity, since opacity on the GlassView (or an ancestor of it)
// breaks glass rendering.
function GlassCookButton({
  isTodaysPick,
  onCook,
}: {
  isTodaysPick: boolean;
  onCook: () => void;
}) {
  return (
    <View style={styles.cookCtaGlassWrap}>
      <GlassView
        glassEffectStyle="regular"
        tintColor={isTodaysPick ? 'rgba(95, 112, 87, 0.55)' : 'rgba(195, 106, 72, 0.85)'}
        isInteractive
        style={StyleSheet.absoluteFillObject}
      />
      <Pressable
        onPress={onCook}
        disabled={isTodaysPick}
        accessibilityRole="button"
        accessibilityLabel={isTodaysPick ? 'Cooking tonight' : 'Cook tonight'}
        style={({ pressed }) => [
          styles.cookCtaGlassPressable,
          pressed && !isTodaysPick ? { transform: [{ scale: 0.985 }] } : null,
        ]}
      >
        {isTodaysPick ? null : (
          <View style={styles.slot}>
            <IconCookingSteam />
          </View>
        )}
        <BodyText
          weight="semi"
          size={typeScale.bodyLG}
          color={isTodaysPick ? 'rgba(255, 252, 246, 0.75)' : palette.surface}
          style={styles.cookCtaGlassLabel}
        >
          {isTodaysPick ? "Cooking tonight ✓" : 'Cook tonight'}
        </BodyText>
      </Pressable>
    </View>
  );
}

function rowKeyFor(group: IngredientGroup, ing: Ingredient, gIdx: number, iIdx: number): string {
  return `${group.role}-${gIdx}-${iIdx}-${ing.item}`;
}

const EMPTY_CHECKED: Record<string, boolean> = {};

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
  heroLetter: {
    backgroundColor: palette.well,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paintingCaptionWrap: {
    position: 'absolute',
    bottom: spacing.lg,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  paintingCaptionText: {
    fontFamily: fontFamily.monoRegular,
    fontSize: typeScale.monoSM,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: palette.textSecondary,
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
  glassHeroPillWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  glassHeroPillPressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    marginTop: -18,
    paddingHorizontal: 24,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titleCol: {
    flex: 1,
  },
  title: {
    letterSpacing: -1,
    lineHeight: 38,
  },
  titleUnderline: {
    marginTop: 4,
  },
  statsSection: {
    marginTop: spacing.lg,
    paddingHorizontal: 24,
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
  servesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  servesLeader: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 13,
    letterSpacing: 3,
    color: palette.statRuleColor,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.4,
    borderColor: 'rgba(42, 58, 38, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 26,
    textAlign: 'center',
    letterSpacing: 1,
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
  moveNumeral: {
    letterSpacing: -0.5,
    lineHeight: 24,
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
  cookCtaGlassWrap: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cookCtaGlassPressable: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 10,
  },
  cookCtaGlassLabel: {
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  slot: {
    flexShrink: 0,
  },
});
