import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { useRouter, type Href } from 'expo-router';
import type { Recipe } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { PaperCard } from '../../components/PaperCard';
import { Vignette } from '../../components/Vignette';
import { DisplayText, Mono, ItalicText } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { IconPill } from '../../components/painted';
import { X } from 'lucide-react-native';
import { palette, radius, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { useGenerationSession } from '../../stores/generationSession';
import { useWeekPlan } from '../../stores/weekPlan';
import { focusedRecipe, isExhausted } from './deckState';
import { artIndicesToRequest } from './imagePrefetch';
import { CardArt } from './CardArt';
import { useSwipeGesture } from '../swipe-night/useSwipeGesture';
import { api } from '../../services/api';
import type { SeedMealKey } from '../../lib/assets';

const DOT_LEADER = '·'.repeat(80);

// Task 10 creates app/(eat)/allocate.tsx; typed routes can't see it yet from
// here, so this cast keeps the (identical at runtime) navigation working
// ahead of that route file landing.
const ALLOCATE_ROUTE = '/(eat)/allocate' as Href;

export function DeckScreen() {
  const router = useRouter();
  const { press } = useHaptics();
  const deck = useGenerationSession((s) => s.deck);
  const tier = useGenerationSession((s) => s.tier);
  const context = useGenerationSession((s) => s.context);
  const deckKeep = useGenerationSession((s) => s.deckKeep);
  const deckPass = useGenerationSession((s) => s.deckPass);
  const dealHand = useGenerationSession((s) => s.dealHand);
  const setCookTonight = useGenerationSession((s) => s.setCookTonight);
  const reconcileKept = useGenerationSession((s) => s.reconcileKept);
  const reset = useGenerationSession((s) => s.reset);
  const savedRecipeIds = useWeekPlan((s) => s.savedRecipeIds);
  const toggleSavedRecipe = useWeekPlan((s) => s.toggleSavedRecipe);
  const remapSavedRecipe = useWeekPlan((s) => s.remapSavedRecipe);
  const [dealing, setDealing] = useState(false);

  // Guard: no deck means the user landed here without a hand — bounce to energy.
  useEffect(() => {
    if (!deck) router.replace('/(eat)/energy');
  }, [deck, router]);

  // Cleared explicitly when a fresh hand is dealt (handleFreshHand) — a
  // card-0-id key can collide across hands when cache-hits repeat a recipe,
  // which would silently skip the new hand's art requests.
  const requestedRef = useRef<number[]>([]);

  // Prefetch art: first 3 at deal, then stay 2 ahead of the swiper.
  useEffect(() => {
    if (!deck) return;
    const indices = artIndicesToRequest(
      deck.position,
      deck.proposals.length,
      requestedRef.current
    );
    for (const i of indices) {
      const rec = deck.proposals[i];
      if (rec && rec.imageStatus !== 'ready' && !rec.heroImageUrl) {
        void api.requestRecipeImage(rec.id);
      }
      requestedRef.current.push(i);
    }
  }, [deck, deck?.position]);

  // Fire phase-2 for a kept/cooked card; adopt the final (possibly redirected)
  // full row so allocation writes real ingredients. Fire-and-forget.
  const runFill = useCallback(
    (recipe: Recipe) => {
      if (recipe.contentStatus === 'full') return; // cache-hit card, already full
      void (async () => {
        try {
          const { recipeId } = await api.fillRecipe(recipe.id, context || undefined);
          const full = await api.getRecipeById(recipeId);
          if (full) {
            reconcileKept(recipe.id, full);
            // Signature cache-hit: the fill redirected to an existing row, so
            // move the saved heart from the (now dead) skeleton id with it.
            if (full.id !== recipe.id) remapSavedRecipe(recipe.id, full.id);
          }
        } catch {
          /* detail view offers retry on next open */
        }
      })();
    },
    [context, reconcileKept, remapSavedRecipe]
  );

  const saveIfNew = useCallback(
    (id: string) => {
      if (!savedRecipeIds.includes(id)) toggleSavedRecipe(id);
    },
    [savedRecipeIds, toggleSavedRecipe]
  );

  const focused = deck ? focusedRecipe(deck) : null;

  const handleKeep = useCallback(() => {
    if (!focused) return;
    saveIfNew(focused.id);
    runFill(focused);
    deckKeep();
  }, [focused, saveIfNew, runFill, deckKeep]);

  const handlePass = useCallback(() => {
    deckPass();
  }, [deckPass]);

  const handleCookTonight = useCallback(() => {
    if (!focused) return;
    press();
    saveIfNew(focused.id);
    runFill(focused);
    deckKeep(); // ensure it's in the kept set for allocation
    setCookTonight(focused.id);
    router.replace(ALLOCATE_ROUTE);
  }, [focused, press, saveIfNew, runFill, deckKeep, setCookTonight, router]);

  const goAllocateOrHome = useCallback(() => {
    press();
    if (deck && deck.kept.length > 0) {
      router.replace(ALLOCATE_ROUTE);
    } else {
      reset();
      router.replace('/(tabs)/tonight');
    }
  }, [press, deck, router, reset]);

  const handleClose = useCallback(() => {
    press();
    // Keeps stay saved (savedRecipeIds); if any were kept, let the user place
    // them, otherwise just leave.
    goAllocateOrHome();
  }, [press, goAllocateOrHome]);

  const handleFreshHand = useCallback(() => {
    if (!tier) return;
    press();
    setDealing(true);
    void (async () => {
      try {
        const recipes = await api.generateProposals(tier, context || undefined);
        requestedRef.current = [];
        dealHand(recipes);
      } catch {
        /* keep the exhausted state; the button can be tapped again */
      } finally {
        setDealing(false);
      }
    })();
  }, [tier, press, context, dealHand]);

  if (!deck) return null;

  const keptCount = deck.kept.length;
  const exhausted = isExhausted(deck);

  return (
    <ScreenShell horizontalPadding={20}>
      <View style={styles.masthead}>
        <Mono size={10} bold color={palette.accentDeep}>
          your hand · {deck.position < deck.proposals.length ? deck.position + 1 : deck.proposals.length}/{deck.proposals.length}
        </Mono>
        <IconPill onPress={handleClose} accessibilityLabel="Close">
          <X size={16} color={palette.ink} strokeWidth={2.2} />
        </IconPill>
      </View>

      <View style={{ height: spacing.md }} />

      {dealing ? (
        <View style={styles.emptyWell}>
          <Mono size={10} bold color={palette.accentDeep}>
            reshuffling…
          </Mono>
          <View style={{ height: spacing.sm }} />
          <DisplayText size={24} color={palette.primary}>
            Dealing a fresh hand
          </DisplayText>
        </View>
      ) : exhausted ? (
        <View style={styles.emptyWell}>
          <Mono size={10} bold color={palette.accentDeep}>
            that&apos;s the hand
          </Mono>
          <View style={{ height: spacing.sm }} />
          <DisplayText size={26} color={palette.primary} style={{ textAlign: 'center' }}>
            Nothing grabbed you?
          </DisplayText>
          <View style={{ height: spacing.md }} />
          <PolishedButton label="Deal a fresh hand" tone="forest" onPress={handleFreshHand} />
          {keptCount > 0 ? (
            <>
              <View style={{ height: spacing.sm }} />
              <ItalicText size={14} style={{ textAlign: 'center' }}>
                {keptCount === 1 ? '1 keep waiting to be placed.' : `${keptCount} keeps waiting to be placed.`}
              </ItalicText>
            </>
          ) : null}
        </View>
      ) : focused ? (
        <DeckCard
          key={`${focused.id}-${deck.position}`}
          recipe={focused}
          onKeep={handleKeep}
          onPass={handlePass}
          onCookTonight={handleCookTonight}
        />
      ) : null}

      <View style={styles.footer}>
        {keptCount > 0 ? (
          <Pressable onPress={goAllocateOrHome} accessibilityRole="button" style={styles.keptTray}>
            <View style={styles.keptStrip}>
              {deck.kept.slice(0, 5).map((r) => (
                <Vignette
                  key={r.id}
                  size={34}
                  localKey={r.localImageKey as SeedMealKey | undefined}
                  remoteUrl={r.heroImageUrl}
                  imageStatus={r.imageStatus}
                  title={r.title}
                  style={styles.keptChip}
                />
              ))}
            </View>
            <Mono size={11} bold color={palette.accentDeep}>
              {keptCount === 1 ? 'review 1 keep →' : `review ${keptCount} keeps →`}
            </Mono>
          </Pressable>
        ) : (
          <View style={{ height: 34 }} />
        )}
      </View>
    </ScreenShell>
  );
}

function DeckCard({
  recipe,
  onKeep,
  onPass,
  onCookTonight,
}: {
  recipe: Recipe;
  onKeep: () => void;
  onPass: () => void;
  onCookTonight: () => void;
}) {
  const { pan, cardStyle, likeOverlayStyle, passOverlayStyle } = useSwipeGesture({
    onLike: onKeep,
    onPass,
  });
  const proteinG = recipe.nutritionalEstimate?.proteinG;

  return (
    <View style={styles.cardArea}>
      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>
          <PaperCard padding={0} cornerRadius={radius.sheet}>
            <CardArt recipe={recipe} />
            <View style={styles.cardBody}>
              <Mono size={10} bold color={palette.accentDeep}>
                {recipe.cuisine.toLowerCase()}
              </Mono>
              <View style={{ height: 4 }} />
              <DisplayText size={26} color={palette.ink} numberOfLines={2} style={styles.cardTitle}>
                {recipe.title}
              </DisplayText>
              {recipe.hook ? (
                <>
                  <View style={{ height: 4 }} />
                  <ItalicText size={15} color={palette.textSecondary}>
                    {recipe.hook}
                  </ItalicText>
                </>
              ) : null}
              <View style={{ height: spacing.sm }} />
              <View style={styles.statRow}>
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
          </PaperCard>

          <Animated.View pointerEvents="none" style={[styles.overlay, styles.likeOverlay, likeOverlayStyle]}>
            <Mono bold size={14} color={palette.accent}>
              keep
            </Mono>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.overlay, styles.passOverlay, passOverlayStyle]}>
            <Mono bold size={14} color={palette.utility}>
              pass
            </Mono>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <View style={{ height: spacing.md }} />
      <View style={styles.actionRow}>
        <View style={styles.actionHalf}>
          <PolishedButton label="Pass" tone="ghost" onPress={onPass} />
        </View>
        <View style={{ width: spacing.sm }} />
        <View style={styles.actionHalf}>
          <PolishedButton label="Keep" tone="rust" onPress={onKeep} />
        </View>
      </View>
      <View style={{ height: spacing.sm }} />
      <PolishedButton label="Cook this tonight →" tone="forest" onPress={onCookTonight} />
    </View>
  );
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardArea: {
    width: '100%',
  },
  cardBody: {
    padding: spacing.md,
  },
  cardTitle: {
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  statRow: {
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
  actionRow: {
    flexDirection: 'row',
  },
  actionHalf: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 2,
    borderRadius: radius.tiny,
    backgroundColor: palette.surfaceTranslucent,
  },
  likeOverlay: {
    right: spacing.md,
    borderColor: palette.accent,
    transform: [{ rotate: '-8deg' }],
  },
  passOverlay: {
    left: spacing.md,
    borderColor: palette.utility,
    transform: [{ rotate: '8deg' }],
  },
  emptyWell: {
    borderRadius: 18,
    padding: spacing.xl,
    backgroundColor: palette.well,
    alignItems: 'center',
  },
  footer: {
    marginTop: spacing.lg,
  },
  keptTray: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  keptStrip: {
    flexDirection: 'row',
  },
  keptChip: {
    marginRight: -8,
    borderWidth: 2,
    borderColor: palette.background,
  },
});
