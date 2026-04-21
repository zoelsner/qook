import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { Recipe } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { FoodHeroImage } from '../../components/FoodHeroImage';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import {
  GlassChip,
  IconPill,
  IconRefresh,
  IconCookingSteam,
  IconArrowRight,
  PaintedButton,
} from '../../components/painted';
import { palette, spacing } from '../../design';
import { shadowCtaInline } from '../../design/shadows';
import { ENERGY_TIER_LABEL } from '../../types/energy';
import { api } from '../../services/api';
import { useHaptics } from '../../hooks/useHaptics';
import type { SeedMealKey } from '../../lib/assets';

type SpotlightStatus = 'ready' | 'needs';

interface SpotlightState {
  spotlightId: string | null;
  statusByRecipe: Record<string, SpotlightStatus>;
}

export function TonightScreen() {
  const router = useRouter();
  const { press, tap } = useHaptics();
  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ['tonight'],
    queryFn: () => api.getTonightPlan(),
  });

  const openEatFlow = () => {
    press();
    router.push('/(eat)/energy');
  };

  const [localSpotlight, setLocalSpotlight] = useState<string | null>(null);

  const state: SpotlightState = useMemo(() => {
    const statusByRecipe: Record<string, SpotlightStatus> = {};
    recipes.forEach((recipe, idx) => {
      statusByRecipe[recipe.id] = idx === 0 ? 'ready' : idx === 1 ? 'ready' : 'needs';
    });
    return {
      spotlightId: localSpotlight ?? recipes[0]?.id ?? null,
      statusByRecipe,
    };
  }, [recipes, localSpotlight]);

  const spotlight = recipes.find((r) => r.id === state.spotlightId) ?? recipes[0];
  const others = recipes.filter((r) => r.id !== spotlight?.id).slice(0, 2);
  const readyCount = Object.values(state.statusByRecipe).filter(
    (s) => s === 'ready'
  ).length;

  const openRecipe = (id: string) => {
    press();
    router.push({ pathname: '/(modals)/recipe/[id]', params: { id } });
  };

  const swapSpotlight = (id: string) => {
    tap();
    setLocalSpotlight(id);
  };

  return (
    <ScreenShell horizontalPadding={24}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.kickerRow}>
            <Mono size={10} bold color={palette.accentDeep}>
              tonight
            </Mono>
            <View style={styles.kickerDot} />
            <Mono size={10} color={palette.textSecondary}>
              spotlight {readyCount}/{Math.max(recipes.length, 1)} ready
            </Mono>
          </View>
          <View style={styles.displayTitleWrap}>
            <DisplayText size={56} color={palette.primary} style={styles.displayTitle}>
              Tonight
            </DisplayText>
            <BrushstrokeUnderline
              width={170}
              color={palette.accent}
              strokeWidth={2.4}
              style={styles.displayUnderline}
            />
          </View>
        </View>
        <IconPill
          onPress={openEatFlow}
          accessibilityLabel="Draft fresh recipes"
        >
          <IconRefresh />
        </IconPill>
      </View>

      <View style={{ height: spacing.lg }} />

      {isLoading ? (
        <Mono>loading</Mono>
      ) : spotlight ? (
        <>
          <SpotlightCard
            recipe={spotlight}
            status={state.statusByRecipe[spotlight.id] ?? 'ready'}
            onOpen={() => openRecipe(spotlight.id)}
          />
          {others.length > 0 ? (
            <>
              <View style={{ height: spacing.lg }} />
              <View style={styles.morePicksHeader}>
                <Mono size={10} bold color={palette.accentDeep}>
                  more picks
                </Mono>
                <Mono size={11} color={palette.textSecondary} style={styles.tapHint}>
                  Tap to spotlight
                </Mono>
              </View>
              <View style={{ height: spacing.sm + 2 }} />
              <View style={styles.miniRow}>
                {others.map((recipe) => (
                  <MiniCard
                    key={recipe.id}
                    recipe={recipe}
                    status={state.statusByRecipe[recipe.id] ?? 'needs'}
                    onPress={() => swapSpotlight(recipe.id)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : (
        <EmptyTonightCard onDraft={openEatFlow} />
      )}
    </ScreenShell>
  );
}

function EmptyTonightCard({ onDraft }: { onDraft: () => void }) {
  return (
    <View style={styles.empty}>
      <Mono size={10} bold color={palette.accentDeep}>
        sunday reset
      </Mono>
      <View style={{ height: spacing.xs }} />
      <DisplayText size={28} color={palette.ink} style={styles.emptyTitle}>
        No plan yet.
      </DisplayText>
      <View style={{ height: spacing.sm }} />
      <BodyText size={14} color={palette.textSecondary} weight="medium">
        Cook up fresh picks for tonight — tell us your energy and we&apos;ll
        draft three dinners in about ten seconds.
      </BodyText>
      <View style={{ height: spacing.md }} />
      <PaintedButton
        label="Draft tonight"
        size="lg"
        tone="forest"
        onPress={onDraft}
        leadingIcon={<IconCookingSteam />}
        fullWidth
      />
    </View>
  );
}

function SpotlightCard({
  recipe,
  status,
  onOpen,
}: {
  recipe: Recipe;
  status: SpotlightStatus;
  onOpen: () => void;
}) {
  return (
    <View style={styles.spotlight}>
      <View style={styles.spotlightImageWrap}>
        <FoodHeroImage
          localKey={recipe.localImageKey as SeedMealKey | undefined}
          remoteUrl={recipe.heroImageUrl}
          blurhash={recipe.blurhash}
          height={218}
          cornerRadius={0}
          style={{ width: '100%', height: 218 }}
        />
        <GlassChip style={styles.spotlightBadge}>
          <View style={[styles.tinyDot, { backgroundColor: palette.accent }]} />
          <Mono size={10} bold color={palette.accentDeep}>
            SPOTLIGHT 1 OF 3
          </Mono>
        </GlassChip>
        <GlassChip style={styles.energyBadge}>
          <View style={[styles.tinyDot, { backgroundColor: palette.accent }]} />
          <Mono size={10} bold color={palette.accentDeep}>
            {ENERGY_TIER_LABEL[recipe.tier].toUpperCase()}
          </Mono>
        </GlassChip>
      </View>

      <View style={styles.spotlightContent}>
        <View style={styles.spotlightTitleBlock}>
          <Pressable onPress={onOpen}>
            <DisplayText size={28} color={palette.ink} style={styles.spotlightTitle}>
              {recipe.title}
            </DisplayText>
          </Pressable>
          <View style={{ height: 6 }} />
          <View style={styles.metaRow}>
            <BodyText size={13} color={palette.textSecondary} weight="medium">
              {recipe.cuisine}
            </BodyText>
            <View style={styles.metaDot} />
            <BodyText size={13} color={palette.textSecondary} weight="medium">
              {recipe.timeMinutes} min
            </BodyText>
            <View style={styles.metaDot} />
            <BodyText size={13} color={palette.textSecondary} weight="medium">
              serves {recipe.servings}
            </BodyText>
          </View>
        </View>

        <View style={styles.cookRow}>
          <View style={styles.cookRowLeft}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: status === 'ready' ? palette.primaryMuted : palette.accent },
              ]}
            />
            <Mono size={10} bold color={palette.textSecondary}>
              {status === 'ready' ? 'READY TO COOK' : 'NEEDS SHOPPING'}
            </Mono>
          </View>
          <Pressable
            onPress={onOpen}
            style={[styles.cookButton, shadowCtaInline]}
          >
            <BodyText size={12} weight="semi" color={palette.surface}>
              Cook tonight
            </BodyText>
            <IconArrowRight size={12} color={palette.surface} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MiniCard({
  recipe,
  status,
  onPress,
}: {
  recipe: Recipe;
  status: SpotlightStatus;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.miniCard,
        pressed ? { opacity: 0.92, transform: [{ scale: 0.985 }] } : null,
      ]}
    >
      <FoodHeroImage
        localKey={recipe.localImageKey as SeedMealKey | undefined}
        remoteUrl={recipe.heroImageUrl}
        blurhash={recipe.blurhash}
        height={88}
        cornerRadius={0}
        style={styles.miniImage}
      />
      <View style={styles.miniBody}>
        <DisplayText size={18} color={palette.ink} style={styles.miniTitle}>
          {recipe.title}
        </DisplayText>
        <View style={styles.miniMetaRow}>
          <BodyText size={11} color={palette.textSecondary} weight="medium">
            {recipe.cuisine} · {recipe.timeMinutes} min
          </BodyText>
          <View style={styles.miniStatusRow}>
            <View
              style={[
                styles.statusDotSm,
                { backgroundColor: status === 'ready' ? palette.primaryMuted : palette.accent },
              ]}
            />
            <Mono size={9} bold color={palette.textSecondary}>
              {status === 'ready' ? 'READY' : 'NEEDS 1'}
            </Mono>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleGroup: {
    gap: 6,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kickerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.textSecondary,
  },
  displayTitleWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  displayTitle: {
    letterSpacing: -2,
    lineHeight: 56,
  },
  displayUnderline: {
    position: 'absolute',
    left: -6,
    bottom: -6,
  },
  spotlight: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
  spotlightImageWrap: {
    position: 'relative',
    width: '100%',
    height: 218,
  },
  spotlightBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  energyBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  tinyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  spotlightContent: {
    padding: 22,
    paddingTop: 12,
    gap: 10,
  },
  spotlightTitleBlock: {
    gap: 6,
  },
  spotlightTitle: {
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.textSecondary,
  },
  cookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  cookRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotSm: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  cookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: palette.primary,
  },
  morePicksHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  tapHint: {
    fontStyle: 'italic',
  },
  miniRow: {
    flexDirection: 'row',
    gap: 12,
  },
  miniCard: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
  miniImage: {
    width: '100%',
    height: 88,
  },
  miniBody: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 6,
  },
  miniTitle: {
    letterSpacing: -0.4,
    lineHeight: 20,
  },
  miniMetaRow: {
    gap: 2,
  },
  miniStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  empty: {
    borderRadius: 22,
    padding: spacing.lg,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
  emptyTitle: {
    letterSpacing: -0.6,
    lineHeight: 32,
  },
});
