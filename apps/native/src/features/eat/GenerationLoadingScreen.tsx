import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ScreenShell } from '../../components/ScreenShell';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { CircledWord } from '../../components/CircledWord';
import { StepDots } from '../../components/StepDots';
import { palette, spacing } from '../../design';
import { ENERGY_TIER_LABEL } from '../../types/energy';
import { api } from '../../services/api';
import { useGenerationSession } from '../../stores/generationSession';
import { useHaptics } from '../../hooks/useHaptics';

const STAGES = [
  { label: 'reading your preferences' },
  { label: 'drafting three dinners' },
  { label: 'checking ingredient overlap' },
  { label: 'finalizing timelines' },
];

export function GenerationLoadingScreen() {
  const router = useRouter();
  const { success, error } = useHaptics();
  const tier = useGenerationSession((s) => s.tier);
  const context = useGenerationSession((s) => s.context);
  const finish = useGenerationSession((s) => s.finish);
  const fail = useGenerationSession((s) => s.fail);
  const streamedTitles = useGenerationSession((s) => s.streamedTitles);
  const [stage, setStage] = useState(0);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!tier) {
      router.replace('/(eat)/energy');
      return;
    }

    const tick = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, 900);

    let cancelled = false;
    (async () => {
      try {
        const recipes = await api.generateRecipesForEnergy(tier, context);
        if (cancelled) return;
        // Draft-time hero art (Zach 2026-07-08): fire for every proposal so
        // pictures land while the user is still choosing. Fire-and-forget —
        // the review screen polls until each image arrives.
        for (const r of recipes) void api.requestRecipeImage(r.id);
        finish(recipes);
        success();
        router.replace('/(eat)/review');
      } catch (e) {
        if (cancelled) return;
        fail(e instanceof Error ? e.message : 'Unknown error');
        error();
        router.replace('/(eat)/review');
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [tier, context, finish, fail, router, success, error]);

  return (
    <ScreenShell scrollable={false} horizontalPadding={24}>
      <View style={styles.wrapper}>
        <Mono size={10} bold color={palette.accentDeep}>
          drafting
        </Mono>
        <View style={{ height: spacing.sm }} />
        <DisplayText
          size={34}
          color={palette.primary}
          style={styles.title}
        >
          Cooking up ideas…
        </DisplayText>
        <View style={{ height: spacing.xl + spacing.md }} />
        <CircledWord
          words={[
            'tonight',
            tier ? ENERGY_TIER_LABEL[tier].toLowerCase() : 'your taste',
            'the fridge',
            'no repeats',
          ]}
        />
        <View style={{ height: spacing.lg }} />
        {streamedTitles.filter(Boolean).length > 0 ? (
          streamedTitles.filter(Boolean).map((t, i) => (
            <BodyText
              key={i}
              size={15}
              color={palette.textSecondary}
              weight="medium"
            >
              {t}
            </BodyText>
          ))
        ) : (
          <BodyText size={14} color={palette.textSecondary} weight="medium">
            {STAGES[stage].label}
          </BodyText>
        )}
        <View style={{ height: spacing.md }} />
        <StepDots total={STAGES.length} current={stage} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  title: {
    letterSpacing: -1,
    lineHeight: 38,
    textAlign: 'center',
  },
});
