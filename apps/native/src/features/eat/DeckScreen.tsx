import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { useRouter, type Href } from 'expo-router';
import type { Recipe } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { PaperCard } from '../../components/PaperCard';
import { Vignette } from '../../components/Vignette';
import { DisplayText, Mono, ItalicText, BodyText } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { IconPill } from '../../components/painted';
import { X, Info } from 'lucide-react-native';
import { palette, radius, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { useGenerationSession } from '../../stores/generationSession';
import { useWeekPlan, activePickFor } from '../../stores/weekPlan';
import { focusedRecipe, isExhausted, swipeSummary, sessionExcludeTitles } from './deckState';
import { shouldPrefetchNextHand } from './handPrefetch';
import { buildRedealContext } from './redealContext';
import { unfilledResetNights } from './weekReset';
import { artIndicesToRequest } from './imagePrefetch';
import { CardArt } from './CardArt';
import { useSwipeGesture } from '../swipe-night/useSwipeGesture';
import { api } from '../../services/api';
import type { SeedMealKey } from '../../lib/assets';

const DOT_LEADER = '·'.repeat(80);
const FLIP_DURATION = 350;
const MAX_BACK_INGREDIENTS = 12;
const MAX_BACK_PLAN_LINES = 5;

// Card-back content: proposal teaser (ingredientNames/stepOutline written at
// deal time) takes priority; falls back to deriving from a full recipe's real
// ingredients/steps (cache-hit path); falls back to microcopy-only when
// neither exists yet.
function deriveCardBack(recipe: Recipe): {
  ingredients: string[];
  plan: string[];
  microcopy: string;
} {
  if (recipe.proposalIngredients?.length || recipe.proposalSteps?.length) {
    return {
      ingredients: recipe.proposalIngredients ?? [],
      plan: recipe.proposalSteps ?? [],
      microcopy: 'FULL RECIPE IS WRITTEN WHEN YOU KEEP IT',
    };
  }
  const isFull = recipe.contentStatus !== 'proposal' || recipe.ingredients.length > 0;
  if (isFull) {
    const ingredients = recipe.ingredients
      .flatMap((g) => g.items.map((it) => it.parsed?.name ?? it.item))
      .filter(Boolean)
      .slice(0, MAX_BACK_INGREDIENTS);
    const plan = recipe.steps
      .flatMap((section) => section.steps.map((s) => truncateLine(s.instruction)))
      .filter(Boolean)
      .slice(0, MAX_BACK_PLAN_LINES);
    if (ingredients.length || plan.length) {
      return { ingredients, plan, microcopy: 'FULL RECIPE READY' };
    }
  }
  return { ingredients: [], plan: [], microcopy: 'FULL RECIPE IS WRITTEN WHEN YOU KEEP IT' };
}

function truncateLine(text: string, maxLen = 40): string {
  const trimmed = text.trim();
  return trimmed.length <= maxLen ? trimmed : `${trimmed.slice(0, maxLen).trimEnd()}…`;
}

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
  const mode = useGenerationSession((s) => s.mode);
  const resetNights = useGenerationSession((s) => s.resetNights);
  const stageNextHand = useGenerationSession((s) => s.stageNextHand);
  const promoteNextHand = useGenerationSession((s) => s.promoteNextHand);
  const plan = useWeekPlan((s) => s.plan);
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

  // Tracks the background hand-prefetch: whether one is currently in flight
  // and whether it ultimately failed (drives the "Deal again" card on
  // exhaustion). Failure is sticky until a manual re-deal — each auto-attempt
  // costs a quota unit, so the trigger effect must never re-arm on its own.
  const prefetchInFlightRef = useRef(false);
  const [prefetchFailed, setPrefetchFailed] = useState(false);

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

  // Count nights this reset still needs to fill (excludes days already carrying
  // a committed recipe). Drives whether another hand is worth prefetching.
  const unfilledNights = React.useMemo(() => {
    if (mode !== 'week') return 0;
    const filled = new Set(
      Object.keys(plan).filter((date) => activePickFor(plan[date as keyof typeof plan]) != null),
    );
    return unfilledResetNights(resetNights, filled).length;
  }, [mode, resetNights, plan]);

  const prefetchNextHand = useCallback(() => {
    if (!tier || !deck) return;
    prefetchInFlightRef.current = true;
    const sum = swipeSummary(deck);
    const excludeTitles = sessionExcludeTitles(deck);
    const redealContext = buildRedealContext({ voiceContext: context, summary: sum, excludeTitles });
    void (async () => {
      try {
        try {
          stageNextHand(await api.generateProposals(tier, redealContext));
        } catch {
          // One silent retry (spec §1.1.5) — inline, inside the same
          // invocation, so the in-flight ref stays true until BOTH attempts
          // settle (a recursive call would let the outer finally clear the
          // ref while the retry is still pending, opening a duplicate-call
          // window mid-flight).
          stageNextHand(await api.generateProposals(tier, redealContext));
        }
      } catch {
        setPrefetchFailed(true);
      } finally {
        prefetchInFlightRef.current = false;
      }
    })();
  }, [tier, deck, context, stageNextHand]);

  useEffect(() => {
    // prefetchFailed gates re-arming: once both attempts are spent, any deck
    // mutation (a swipe, a reconcile) would otherwise re-satisfy the pure
    // trigger and fire another billable call. Only handleFreshHand un-sticks.
    if (!deck || mode !== 'week' || prefetchFailed) return;
    const fire = shouldPrefetchNextHand({
      position: deck.position,
      handSize: deck.proposals.length,
      unfilledNights,
      prefetchInFlight: prefetchInFlightRef.current,
      nextHandReady: deck.nextHand != null,
    });
    if (fire) {
      prefetchNextHand();
    }
  }, [deck, mode, unfilledNights, prefetchNextHand, prefetchFailed]);

  // When the current hand runs out and a prefetched hand is staged, reveal it.
  useEffect(() => {
    if (deck && isExhausted(deck) && deck.nextHand != null) {
      requestedRef.current = [];
      promoteNextHand();
    }
  }, [deck, promoteNextHand]);

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
    } else if (mode === 'week') {
      // Passed-on-everything is the mainline week exit: the passes ARE the
      // bench, so the session must survive this close (it clears on the next
      // weekly reset, spec D7).
      router.replace('/(tabs)/week');
    } else {
      reset();
      router.replace('/(tabs)/tonight');
    }
  }, [press, deck, mode, router, reset]);

  const handleClose = useCallback(() => {
    press();
    // Keeps stay saved (savedRecipeIds); if any were kept, let the user place
    // them, otherwise just leave.
    goAllocateOrHome();
  }, [press, goAllocateOrHome]);

  const handleFreshHand = useCallback(() => {
    if (!tier) return;
    press();
    setPrefetchFailed(false);
    setDealing(true);
    void (async () => {
      try {
        // Manual re-deals carry the same swipe steering + exclude set as the
        // background prefetch (spec §1.1.9) — a plain-context deal would
        // happily repeat the titles the user just swiped through.
        const live = useGenerationSession.getState().deck;
        const dealContext = live
          ? buildRedealContext({
              voiceContext: context,
              summary: swipeSummary(live),
              excludeTitles: sessionExcludeTitles(live),
            })
          : context || undefined;
        const recipes = await api.generateProposals(tier, dealContext || undefined);
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
            {prefetchFailed ? "couldn't deal the next hand" : "that's the hand"}
          </Mono>
          <View style={{ height: spacing.sm }} />
          <DisplayText size={26} color={palette.primary} style={{ textAlign: 'center' }}>
            {prefetchFailed ? 'Deal again?' : 'Nothing grabbed you?'}
          </DisplayText>
          <View style={{ height: spacing.md }} />
          {keptCount > 0 ? (
            <>
              <ItalicText size={14} style={{ textAlign: 'center' }}>
                {keptCount === 1 ? '1 keep waiting to be placed.' : `${keptCount} keeps waiting to be placed.`}
              </ItalicText>
              <View style={{ height: spacing.md }} />
              <PolishedButton label="Continue to planning" tone="forest" onPress={goAllocateOrHome} />
              <View style={{ height: spacing.sm }} />
              <PolishedButton label="Deal a fresh hand" tone="cream" onPress={handleFreshHand} />
            </>
          ) : (
            <PolishedButton label="Deal a fresh hand" tone="forest" onPress={handleFreshHand} />
          )}
        </View>
      ) : focused ? (
        <DeckCard
          key={`${focused.id}-${deck.position}`}
          recipe={focused}
          isEncore={focused.id === deck.encoreId}
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
  isEncore,
  onKeep,
  onPass,
  onCookTonight,
}: {
  recipe: Recipe;
  isEncore?: boolean;
  onKeep: () => void;
  onPass: () => void;
  onCookTonight: () => void;
}) {
  const { pan, cardStyle, likeOverlayStyle, passOverlayStyle } = useSwipeGesture({
    onLike: onKeep,
    onPass,
  });
  const { tap } = useHaptics();
  const proteinG = recipe.nutritionalEstimate?.proteinG;

  // 0 = showing the front face, 1 = showing the back. Resets on remount —
  // the caller keys DeckCard by `${recipe.id}-${position}`, so a fresh card
  // always starts unflipped.
  const flip = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);
  const toggleFlip = useCallback(() => {
    tap();
    const next = flip.value === 0 ? 1 : 0;
    flip.value = withTiming(next, { duration: FLIP_DURATION });
    setFlipped(next === 1);
  }, [tap, flip]);

  // backfaceVisibility lives INSIDE the animated styles: reanimated applies
  // the transform natively, and on-device (Fabric) that update clobbers the
  // static style's backfaceVisibility — both faces get culled as back-facing
  // and the flipped card renders blank. (Simulator doesn't reproduce it.)
  const frontFaceStyle = useAnimatedStyle(() => ({
    backfaceVisibility: 'hidden' as const,
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` },
    ],
  }));
  const backFaceStyle = useAnimatedStyle(() => ({
    backfaceVisibility: 'hidden' as const,
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` },
    ],
  }));

  const cardBack = deriveCardBack(recipe);

  return (
    <View style={styles.cardArea}>
      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>
          <View style={styles.flipStack}>
            <Animated.View
              style={[styles.flipFace, frontFaceStyle]}
              pointerEvents={flipped ? 'none' : 'auto'}
            >
              <PaperCard padding={0} cornerRadius={radius.sheet}>
                <CardArt recipe={recipe} />
                <View style={styles.cardBody}>
                  <Mono size={10} bold color={isEncore ? palette.accent : palette.accentDeep}>
                    {isEncore ? 'from your kitchen' : recipe.cuisine.toLowerCase()}
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
            </Animated.View>

            <Animated.View
              style={[styles.flipFace, styles.flipFaceBack, backFaceStyle]}
              pointerEvents={flipped ? 'auto' : 'none'}
            >
              <Pressable
                style={styles.backPressable}
                onPress={toggleFlip}
                accessibilityRole="button"
                accessibilityLabel="Flip back to the recipe card"
              >
                <PaperCard padding={0} cornerRadius={radius.sheet} style={styles.backCard}>
                  <View style={styles.backBody}>
                    <Mono size={10} bold color={palette.accentDeep}>
                      {recipe.cuisine.toLowerCase()}
                    </Mono>
                    <View style={{ height: 4 }} />
                    <DisplayText size={18} color={palette.ink} numberOfLines={2}>
                      {recipe.title}
                    </DisplayText>
                    <View style={{ height: spacing.md }} />

                    {cardBack.ingredients.length ? (
                      <>
                        <Mono size={10} bold color={palette.accentDeep}>
                          ingredients
                        </Mono>
                        <View style={{ height: spacing.xs }} />
                        <BodyText size={14} color={palette.text}>
                          {cardBack.ingredients.join(', ')}
                        </BodyText>
                        <View style={{ height: spacing.md }} />
                      </>
                    ) : null}

                    {cardBack.plan.length ? (
                      <>
                        <Mono size={10} bold color={palette.accentDeep}>
                          the plan
                        </Mono>
                        <View style={{ height: spacing.xs }} />
                        {cardBack.plan.map((line, i) => (
                          <View key={i} style={styles.planRow}>
                            <Mono size={11} color={palette.textSecondary}>
                              {String(i + 1).padStart(2, '0')}
                            </Mono>
                            <BodyText size={14} color={palette.text} style={styles.planLineText}>
                              {line}
                            </BodyText>
                          </View>
                        ))}
                      </>
                    ) : null}

                    <View style={styles.backSpacer} />
                    <Mono size={9} color={palette.textTertiary} style={styles.backMicrocopy}>
                      {cardBack.microcopy}
                    </Mono>
                  </View>
                </PaperCard>
              </Pressable>
            </Animated.View>

            <IconPill
              onPress={toggleFlip}
              accessibilityLabel={flipped ? 'Show the recipe card' : 'Show ingredients and plan'}
              style={styles.infoPill}
            >
              <Info size={16} color={palette.ink} strokeWidth={2.2} />
            </IconPill>
          </View>

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
  flipStack: {
    width: '100%',
  },
  flipFace: {
    width: '100%',
  },
  flipFaceBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backPressable: {
    flex: 1,
  },
  backCard: {
    flex: 1,
  },
  backBody: {
    flex: 1,
    padding: spacing.md,
  },
  backSpacer: {
    flex: 1,
    minHeight: spacing.md,
  },
  backMicrocopy: {
    textAlign: 'center',
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  planLineText: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  infoPill: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 5,
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl + spacing.lg,
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
