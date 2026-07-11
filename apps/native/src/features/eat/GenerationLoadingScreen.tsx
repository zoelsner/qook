import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { ScreenShell } from '../../components/ScreenShell';
import { DisplayText, Mono, BodyText } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { palette, spacing } from '../../design';
import { api } from '../../services/api';
import { useGenerationSession } from '../../stores/generationSession';
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
  const [phase, setPhase] = useState<'thinking' | 'coming-up'>('thinking');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const runId = useRef(0);

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, context]);

  const retry = () => {
    runId.current++; // triggers the effect body via state change below
    setErrorMsg(null);
    setPhase('thinking');
    // Re-run by nudging the effect: bump a dummy dep through context is not
    // ideal; instead re-invoke the same flow inline.
    if (!tier) return;
    void (async () => {
      const myRun = runId.current;
      try {
        const proposals = await api.generateProposals(tier, context);
        if (myRun !== runId.current) return;
        setProposals(proposals);
        setPhase('coming-up');
        proposals.slice(0, PREFETCH_AT_DEAL).forEach((p) => {
          if (p.imageStatus !== 'ready' && !p.heroImageUrl) void api.requestRecipeImage(p.id);
        });
        if (proposals[0]) await waitForFirstArt(proposals[0].id);
        if (myRun !== runId.current) return;
        success();
        router.replace(DECK_ROUTE);
      } catch (e) {
        if (myRun !== runId.current) return;
        setErrorMsg(e instanceof Error ? e.message : 'The kitchen is busy — try again.');
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
