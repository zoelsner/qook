import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';

import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { PaperCard } from '../../components/PaperCard';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { palette, spacing, radius } from '../../design';
import { api } from '../../services/api';
import { useHaptics } from '../../hooks/useHaptics';
import { selectCurrent, selectNext, useSwipeDeck } from '../../stores/swipeDeck';
import { SwipeCard, SwipeCardGhost } from './SwipeCard';

export function SwipeNightScreen() {
  const { select, success } = useHaptics();
  const { data: feed = [], isLoading } = useQuery({
    queryKey: ['swipe-feed'],
    queryFn: () => api.getSwipeFeed(),
  });

  const load = useSwipeDeck((s) => s.load);
  const like = useSwipeDeck((s) => s.like);
  const pass = useSwipeDeck((s) => s.pass);
  const reset = useSwipeDeck((s) => s.reset);
  const current = useSwipeDeck(selectCurrent);
  const next = useSwipeDeck(selectNext);
  const index = useSwipeDeck((s) => s.index);
  const total = useSwipeDeck((s) => s.recipes.length);
  const likedCount = useSwipeDeck((s) => s.likedIds.length);

  useEffect(() => {
    if (feed.length > 0) load(feed);
  }, [feed, load]);

  const swipeMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'like' | 'pass' }) =>
      api.recordSwipe(id, direction),
  });

  const handleLike = useCallback(() => {
    if (!current) return;
    swipeMutation.mutate({ id: current.id, direction: 'like' });
    like();
  }, [current, like, swipeMutation]);

  const handlePass = useCallback(() => {
    if (!current) return;
    swipeMutation.mutate({ id: current.id, direction: 'pass' });
    pass();
  }, [current, pass, swipeMutation]);

  const handleReset = useCallback(() => {
    success();
    reset();
  }, [reset, success]);

  return (
    <ScreenShell>
      <Mono>swipe night</Mono>
      <View style={{ height: spacing.sm }} />
      <DisplayText>Build your week.</DisplayText>
      <BrushstrokeUnderline
        width={240}
        color={palette.utility}
        pathVariant="v2"
        style={{ marginTop: -4 }}
      />
      <View style={{ height: spacing.md }} />
      <Mono>
        {total > 0
          ? `${Math.min(index + 1, total)} of ${total} · ${likedCount} saved`
          : '…'}
      </Mono>
      <View style={{ height: spacing.lg }} />

      {isLoading ? (
        <Mono>loading deck</Mono>
      ) : !current ? (
        <EmptyState likedCount={likedCount} onReset={handleReset} />
      ) : (
        <View style={styles.stack}>
          {next ? (
            <View style={styles.ghostSlot}>
              <SwipeCardGhost recipe={next} />
            </View>
          ) : null}
          <View style={styles.topSlot}>
            <SwipeCard
              key={`${index}-${current.id}`}
              recipe={current}
              onLike={handleLike}
              onPass={handlePass}
            />
          </View>
        </View>
      )}

      {current ? (
        <View style={styles.actions}>
          <ActionButton label="skip" onPress={() => { select(); handlePass(); }} tone="utility" />
          <ActionButton label="save" onPress={() => { select(); handleLike(); }} tone="accent" />
        </View>
      ) : null}
    </ScreenShell>
  );
}

function EmptyState({
  likedCount,
  onReset,
}: {
  likedCount: number;
  onReset: () => void;
}) {
  return (
    <PaperCard padding={spacing.lg}>
      <Mono>deck complete</Mono>
      <View style={{ height: spacing.xs }} />
      <DisplayText size={26}>You saved {likedCount}.</DisplayText>
      <View style={{ height: spacing.sm }} />
      <BodyText size={14} color={palette.textSecondary}>
        Your picks will show up in Tonight and the shopping list. A fresh deck
        lands every Saturday.
      </BodyText>
      <View style={{ height: spacing.md }} />
      <Pressable onPress={onReset} style={styles.resetButton}>
        <Mono bold color={palette.accent}>
          shuffle again
        </Mono>
      </Pressable>
    </PaperCard>
  );
}

function ActionButton({
  label,
  onPress,
  tone,
}: {
  label: string;
  onPress: () => void;
  tone: 'utility' | 'accent';
}) {
  const color = tone === 'accent' ? palette.accent : palette.utility;
  return (
    <Pressable onPress={onPress} style={[styles.actionButton, { borderColor: color }]}>
      <Mono bold color={color}>
        {label}
      </Mono>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    minHeight: 420,
    position: 'relative',
  },
  ghostSlot: {
    position: 'absolute',
    top: spacing.sm,
    left: 0,
    right: 0,
    opacity: 0.6,
    transform: [{ scale: 0.96 }],
  },
  topSlot: {
    position: 'relative',
  },
  actions: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  actionButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    backgroundColor: palette.surfaceTranslucent,
    minWidth: 96,
    alignItems: 'center',
  },
  resetButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.accent,
  },
});
