import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';

import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import {
  PaintedButton,
  PaintedDivider,
  IconHeart,
} from '../../components/painted';
import { palette, spacing } from '../../design';
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
    <ScreenShell horizontalPadding={24}>
      <View style={styles.header}>
        <View style={styles.kickerRow}>
          <Mono size={10} bold color={palette.accentDeep}>
            swipe night
          </Mono>
          <View style={styles.kickerDot} />
          <Mono size={10} color={palette.textSecondary}>
            {total > 0
              ? `${Math.min(index + 1, total)} of ${total} · ${likedCount} saved`
              : 'loading deck'}
          </Mono>
        </View>
        <View style={styles.displayTitleWrap}>
          <DisplayText size={44} color={palette.primary} style={styles.displayTitle}>
            Build your week
          </DisplayText>
          <BrushstrokeUnderline
            width={220}
            color={palette.utility}
            pathVariant="v2"
            strokeWidth={2.4}
            style={styles.displayUnderline}
          />
        </View>
      </View>

      <View style={{ height: spacing.lg + spacing.sm }} />

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
          <Pressable
            onPress={() => {
              select();
              handlePass();
            }}
            style={({ pressed }) => [
              styles.skipButton,
              pressed ? { opacity: 0.85, transform: [{ scale: 0.97 }] } : null,
            ]}
          >
            <Mono size={11} bold color={palette.utility}>
              skip
            </Mono>
          </Pressable>
          <PaintedButton
            label="Save"
            size="md"
            tone="forest"
            onPress={() => {
              select();
              handleLike();
            }}
            leadingIcon={<IconHeart size={14} color={palette.surface} filled />}
            style={{ flex: 1 }}
          />
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
    <View style={styles.empty}>
      <Mono size={10} bold color={palette.accentDeep}>
        deck complete
      </Mono>
      <View style={{ height: spacing.xs }} />
      <DisplayText size={28} color={palette.ink} style={styles.emptyTitle}>
        You saved {likedCount}.
      </DisplayText>
      <View style={{ height: spacing.sm }} />
      <BodyText size={14} color={palette.textSecondary} weight="medium">
        Your picks will show up in Tonight and the shopping list. A fresh deck
        lands every Saturday.
      </BodyText>
      <View style={{ height: spacing.md }} />
      <PaintedDivider />
      <View style={{ height: spacing.md }} />
      <PaintedButton
        label="Shuffle again"
        size="md"
        tone="rust"
        onPress={onReset}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
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
    letterSpacing: -1.2,
    lineHeight: 48,
  },
  displayUnderline: {
    position: 'absolute',
    left: -6,
    bottom: -8,
  },
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
    alignItems: 'center',
  },
  skipButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: palette.utilityMuted,
    backgroundColor: palette.surfaceTranslucent,
    minWidth: 80,
    alignItems: 'center',
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
