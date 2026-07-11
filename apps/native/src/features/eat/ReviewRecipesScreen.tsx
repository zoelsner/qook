import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { Vignette } from '../../components/Vignette';
import { DisplayText, Mono, ItalicText } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { IconPill } from '../../components/painted';
import { X, RefreshCw } from 'lucide-react-native';
import { palette, spacing } from '../../design';
import { fontFamily } from '../../design/typography';
import { ENERGY_TIER_LABEL } from '../../types/energy';
import { useHaptics } from '../../hooks/useHaptics';
import { useRecipeArt } from '../../hooks/useRecipeArt';
import { useGenerationSession } from '../../stores/generationSession';
import { useWeekPlan } from '../../stores/weekPlan';
import { todayISO } from '../week/weekDates';
import { api } from '../../services/api';
import type { Recipe } from '@qook/shared';
import type { SeedMealKey } from '../../lib/assets';

const DOT_LEADER = '·'.repeat(80);

export function ReviewRecipesScreen() {
  const router = useRouter();
  const { press, select } = useHaptics();
  const queryClient = useQueryClient();
  const tier = useGenerationSession((s) => s.tier);
  const recipes = useGenerationSession((s) => s.recipes);
  const sessionState = useGenerationSession((s) => s.state);
  const errorMsg = useGenerationSession((s) => s.error);
  const start = useGenerationSession((s) => s.start);
  const reset = useGenerationSession((s) => s.reset);
  const setRecipes = useWeekPlan((s) => s.setRecipes);
  const setPickIndex = useWeekPlan((s) => s.setPickIndex);
  const commitSelection = useWeekPlan((s) => s.commitSelection);
  const [pickIdx, setPickIdx] = useState(0);

  const handleClose = () => {
    press();
    reset();
    router.back();
  };

  const handleRegenerate = () => {
    if (!tier) return;
    press();
    start(tier);
    router.replace('/(eat)/loading');
  };

  const handleCook = () => {
    const pick = recipes[pickIdx];
    if (!pick) return;
    press();
    const today = todayISO();
    setRecipes(today, recipes);
    setPickIndex(today, pickIdx);
    commitSelection(today);
    reset();
    router.replace({ pathname: '/(modals)/recipe/[id]', params: { id: pick.id } });
  };

  const pick = recipes[pickIdx];

  return (
    <ScreenShell horizontalPadding={24}>
      <View style={styles.masthead}>
        <DisplayText size={20} color={palette.ink}>qook</DisplayText>
        <View style={styles.mastheadPills}>
          <IconPill
            onPress={handleRegenerate}
            accessibilityLabel="Regenerate"
            disabled={!tier}
          >
            <RefreshCw size={18} color={palette.primary} strokeWidth={2} />
          </IconPill>
          <IconPill onPress={handleClose} accessibilityLabel="Close">
            <X size={16} color={palette.ink} strokeWidth={2.2} />
          </IconPill>
        </View>
      </View>
      <View style={styles.mastheadRule} />

      <View style={{ height: spacing.md + 2 }} />
      <Mono size={10} bold color={palette.accentDeep}>
        review · {tier ? ENERGY_TIER_LABEL[tier].toLowerCase() : '—'}
      </Mono>
      <View style={{ height: 6 }} />
      <View style={styles.displayTitleWrap}>
        <DisplayText size={34} color={palette.primary} style={styles.displayTitle}>
          Tonight&rsquo;s <Text style={styles.titleItalic}>pick.</Text>
        </DisplayText>
        <BrushstrokeUnderline
          width={210}
          color={palette.accent}
          style={styles.displayUnderline}
        />
      </View>

      <View style={{ height: spacing.lg }} />

      {sessionState === 'error' ? (
        <ErrorState
          message={errorMsg ?? 'Something went sideways.'}
          onRetry={handleRegenerate}
        />
      ) : !pick ? null : (
        <>
          <View style={styles.sectionDivider}>
            <View style={styles.sectionRule} />
            <Mono size={10} bold color={palette.accentDeep}>
              the kitchen proposes
            </Mono>
            <View style={styles.sectionRule} />
          </View>
          <View style={{ height: 2 }} />
          {recipes.map((r, i) => (
            <ProposalRow
              key={r.id}
              recipe={r}
              selected={i === pickIdx}
              onPress={() => {
                if (i === pickIdx) return;
                select();
                setPickIdx(i);
                // Spotlight-first (spec §1B): engaging an alternate kicks off its
                // art; invalidate nudges the poll loop so the vignette upgrades
                // in place (requestRecipeImage marks it requested, so a still-
                // 'pending' row now polls; a cache-hit 'ready' row shows at once).
                if (r.imageStatus !== 'ready' && !r.heroImageUrl) {
                  void api.requestRecipeImage(r.id);
                  queryClient.invalidateQueries({ queryKey: ['recipe', r.id] });
                }
              }}
            />
          ))}
          <View style={{ height: spacing.lg }} />
          <PolishedButton
            label={`Cook the ${dishShortName(pick.title)} →`}
            tone="forest"
            onPress={handleCook}
          />
          <View style={{ height: spacing.sm }} />
          <ItalicText size={14} style={{ textAlign: 'center' }}>
            swaps are free — try another.
          </ItalicText>
        </>
      )}
    </ScreenShell>
  );
}

// One proposal as a menu line: vignette, title, "N min ···· value" sub-row.
// The selected proposal sits in the beige well with a rust dot on its corner.
// Art polls while the draft-time image is still generating.
function ProposalRow({
  recipe,
  selected,
  onPress,
}: {
  recipe: Recipe;
  selected: boolean;
  onPress: () => void;
}) {
  const art = useRecipeArt(recipe, { poll: true });
  const proteinG = recipe.nutritionalEstimate?.proteinG;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.proposalRow, selected ? styles.proposalSelected : null]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${recipe.title}${selected ? ', selected' : ''}`}
    >
      <View style={selected ? styles.vignetteRing : null}>
        <Vignette
          size={74}
          localKey={art?.localImageKey as SeedMealKey | undefined}
          remoteUrl={art?.heroImageUrl}
          blurhash={art?.blurhash}
          imageStatus={art?.imageStatus ?? recipe.imageStatus}
          title={recipe.title}
        />
      </View>
      <View style={styles.proposalText}>
        <DisplayText size={17} color={palette.ink} numberOfLines={2} style={styles.proposalTitle}>
          {recipe.title}
        </DisplayText>
        <View style={styles.proposalSub}>
          <Mono size={10} color={palette.textSecondary}>
            {recipe.timeMinutes} min
          </Mono>
          <Text style={styles.leaderText} numberOfLines={1} ellipsizeMode="clip">
            {DOT_LEADER}
          </Text>
          <Mono size={10} color={palette.textSecondary}>
            {proteinG ? `${proteinG}g pro` : recipe.cuisine.toLowerCase()}
          </Mono>
        </View>
      </View>
      {selected ? <View style={styles.selDot} /> : null}
    </Pressable>
  );
}

// "Crispy Chicken Thighs with Roasted Root Vegetables" → "crispy chicken thighs".
// A bare first word ("Cook the crispy →", "Cook the korean →") read as nonsense;
// the dish name is everything before the first joiner/punctuation.
function dishShortName(title: string): string {
  const head = title.split(/\s+(?:with|and|in|over|on)\s+|[,—(]/i)[0].trim();
  return head.toLowerCase() || 'this';
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorWell}>
      <Mono size={10} bold color={palette.destructive}>
        {"couldn't draft"}
      </Mono>
      <View style={{ height: spacing.xs }} />
      <DisplayText
        size={22}
        color={palette.ink}
        style={{ letterSpacing: -0.5, lineHeight: 26 }}
      >
        {message}
      </DisplayText>
      <View style={{ height: spacing.md }} />
      <PolishedButton label="Try again" tone="rust" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mastheadPills: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  mastheadRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.statRuleColor,
    marginTop: spacing.sm,
  },
  displayTitleWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  displayTitle: {
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  titleItalic: {
    fontFamily: fontFamily.displayItalic,
    color: palette.accent,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.statRuleColor,
  },
  displayUnderline: {
    position: 'absolute',
    left: -4,
    bottom: -9,
  },
  proposalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
  },
  proposalSelected: {
    backgroundColor: palette.well,
    borderRadius: 18,
    marginHorizontal: -spacing.sm,
  },
  vignetteRing: {
    borderRadius: 999,
    borderWidth: 3,
    borderColor: palette.background,
  },
  proposalText: {
    flex: 1,
    gap: 3,
  },
  proposalTitle: {
    letterSpacing: -0.3,
    lineHeight: 21,
  },
  proposalSub: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  leaderText: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 12,
    letterSpacing: 3,
    color: palette.statRuleColor,
  },
  selDot: {
    position: 'absolute',
    top: 12,
    right: 14,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.accentDeep,
  },
  errorWell: {
    borderRadius: 18,
    padding: spacing.lg,
    backgroundColor: palette.well,
  },
});
