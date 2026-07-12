import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { ScreenShell } from '../../components/ScreenShell';
import { DisplayText, Mono } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { palette, spacing } from '../../design';
import { api } from '../../services/api';
import { useGenerationSession } from '../../stores/generationSession';
import { useWeekPlan, activePickFor } from '../../stores/weekPlan';
import { encoreCandidateId } from './encore';
import { todayISO } from '../week/weekDates';
import { useHaptics } from '../../hooks/useHaptics';
import { DealingHandLoader } from './DealingHandLoader';

const FIRST_ART_TIMEOUT_MS = 6000;
const POLL_INTERVAL_MS = 1200;
const PREFETCH_AT_DEAL = 3;

// Same stale-typed-routes workaround as DeckScreen's ALLOCATE_ROUTE (Task 10):
// app/(eat)/deck.tsx exists on disk, but the generated router.d.ts predates it.
const DECK_ROUTE = '/(eat)/deck' as Href;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Reveal gate: proposal text is already resolved; wait for card-1 art up to a
// timeout, then reveal (art timeout → deck shows the monogram anyway).
async function waitForFirstArt(id: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < FIRST_ART_TIMEOUT_MS) {
    const r = await api.getRecipeById(id).catch(() => null);
    if (r && (r.imageStatus === 'ready' || r.heroImageUrl)) return;
    await sleep(POLL_INTERVAL_MS);
  }
}

export function GenerationLoadingScreen() {
  const router = useRouter();
  const { success, error: errorHaptic } = useHaptics();
  const tier = useGenerationSession((s) => s.tier);
  const context = useGenerationSession((s) => s.context);
  const setProposals = useGenerationSession((s) => s.setProposals);
  const fail = useGenerationSession((s) => s.fail);
  const mode = useGenerationSession((s) => s.mode);
  const attachEncore = useGenerationSession((s) => s.attachEncore);
  const savedRecipeIds = useWeekPlan((s) => s.savedRecipeIds);
  const plan = useWeekPlan((s) => s.plan);
  const [phase, setPhase] = useState<'thinking' | 'coming-up'>('thinking');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const runId = useRef(0);
  const mountedRef = useRef(true);

  // Compute the encore candidate from the user's history and attach it as a
  // 6th card (spec §1.3). Week mode only; below-threshold or no candidate is
  // a no-op — a plain hand of 5. Fetches the full recipe by id (quota-free,
  // no generate-proposals call).
  const maybeAttachEncore = React.useCallback(
    async (dealtIds: string[]) => {
      if (mode !== 'week') return;
      // Same staleness guard as every other async continuation in this file:
      // the fetch below can resolve after the user backed out and a NEW
      // session dealt its own hand — attaching then would bolt a stale encore
      // onto the wrong deck (7 cards, or a hijacked encoreId).
      const myRun = runId.current;
      const cookedIds = Object.values(plan)
        .filter((d) => d.cookedAt && d.recipes?.length)
        .map((d) => activePickFor(d)?.id)
        .filter((id): id is string => Boolean(id));
      // Only the CURRENT week's placements exclude a dish — the plan keeps
      // past days forever, and counting them would cancel the cooked-history
      // leg entirely (every cooked dish was once placed).
      const today = todayISO();
      const placedThisWeekIds = Object.entries(plan)
        .filter(([date]) => date >= today)
        .map(([, d]) => activePickFor(d)?.id)
        .filter((id): id is string => Boolean(id));
      const candidateId = encoreCandidateId({
        savedIds: savedRecipeIds,
        cookedIds,
        placedThisWeekIds,
        dealtThisSessionIds: dealtIds,
      });
      if (!candidateId) return;
      const full = await api.getRecipeById(candidateId).catch(() => null);
      if (!mountedRef.current || myRun !== runId.current) return;
      if (full) attachEncore(full);
    },
    [mode, plan, savedRecipeIds, attachEncore],
  );

  useEffect(() => {
    mountedRef.current = true; // refs persist across Fast Refresh re-runs — re-arm on setup
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!tier) {
      router.replace('/(eat)/energy');
      return;
    }
    const myRun = ++runId.current;
    let cancelled = false;

    (async () => {
      try {
        setErrorMsg(null);
        setPhase('thinking');
        const proposals = await api.generateProposals(tier, context);
        if (cancelled || myRun !== runId.current) return;
        setProposals(proposals);
        void maybeAttachEncore(proposals.map((p) => p.id));
        setPhase('coming-up');
        // Warm the first 3 hero images in parallel (spec: pre-fire first 3).
        proposals.slice(0, PREFETCH_AT_DEAL).forEach((p) => {
          if (p.imageStatus !== 'ready' && !p.heroImageUrl) void api.requestRecipeImage(p.id);
        });
        if (proposals[0]) await waitForFirstArt(proposals[0].id);
        if (cancelled || myRun !== runId.current) return;
        success();
        router.replace(DECK_ROUTE);
      } catch (e) {
        if (cancelled || myRun !== runId.current) return;
        const msg = e instanceof Error ? e.message : 'The kitchen is busy — try again.';
        fail(msg);
        setErrorMsg(msg);
        errorHaptic();
      }
    })();

    return () => {
      cancelled = true;
      // Intentionally reads/mutates the ref's live value at cleanup time (not a
      // stale local copy) so a concurrent retry() sees the bumped runId.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      runId.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, context]);

  const retry = () => {
    // Supersedes any in-flight run (the main effect's async closure checks
    // `myRun !== runId.current` and bails) — this does not re-trigger the effect.
    runId.current++;
    setErrorMsg(null);
    setPhase('thinking');
    if (!tier) return;
    void (async () => {
      const myRun = runId.current;
      try {
        const proposals = await api.generateProposals(tier, context);
        if (!mountedRef.current || myRun !== runId.current) return;
        setProposals(proposals);
        void maybeAttachEncore(proposals.map((p) => p.id));
        setPhase('coming-up');
        proposals.slice(0, PREFETCH_AT_DEAL).forEach((p) => {
          if (p.imageStatus !== 'ready' && !p.heroImageUrl) void api.requestRecipeImage(p.id);
        });
        if (proposals[0]) await waitForFirstArt(proposals[0].id);
        if (!mountedRef.current || myRun !== runId.current) return;
        success();
        router.replace(DECK_ROUTE);
      } catch (e) {
        if (!mountedRef.current || myRun !== runId.current) return;
        const msg = e instanceof Error ? e.message : 'The kitchen is busy — try again.';
        fail(msg);
        setErrorMsg(msg);
        errorHaptic();
      }
    })();
  };

  if (errorMsg) {
    return (
      <ScreenShell scrollable={false} horizontalPadding={24}>
        <View style={styles.errorWrap}>
          <Mono size={10} bold color={palette.destructive}>
            {"couldn't deal"}
          </Mono>
          <View style={{ height: spacing.sm }} />
          <DisplayText size={24} color={palette.ink} style={{ lineHeight: 28, textAlign: 'center' }}>
            {errorMsg}
          </DisplayText>
          <View style={{ height: spacing.lg }} />
          <PolishedButton label="Try again" tone="rust" onPress={retry} />
          <View style={{ height: spacing.sm }} />
          <PolishedButton label="Back" tone="ghost" onPress={() => router.replace('/(eat)/energy')} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell scrollable={false} horizontalPadding={24}>
      <DealingHandLoader phase={phase} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
