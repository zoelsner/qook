import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PaintedDivider } from '../../components/painted';
import { palette, spacing } from '../../design';

export function SavedScreen() {
  return (
    <ScreenShell horizontalPadding={24}>
      <View style={styles.header}>
        <View style={styles.kickerRow}>
          <Mono size={10} bold color={palette.accentDeep}>
            saved
          </Mono>
          <View style={styles.kickerDot} />
          <Mono size={10} color={palette.textSecondary}>
            0 recipes · no tags yet
          </Mono>
        </View>
        <View style={styles.displayTitleWrap}>
          <DisplayText size={44} color={palette.primary} style={styles.displayTitle}>
            Your cookbook
          </DisplayText>
          <BrushstrokeUnderline
            width={220}
            color={palette.accent}
            pathVariant="v2"
            strokeWidth={2.4}
            style={styles.displayUnderline}
          />
        </View>
      </View>

      <View style={{ height: spacing.xl + spacing.sm }} />

      <View style={styles.emptyCard}>
        <Mono size={10} bold color={palette.accentDeep}>
          nothing saved yet
        </Mono>
        <View style={{ height: spacing.sm }} />
        <DisplayText size={20} color={palette.ink} style={styles.emptyTitle}>
          Swipe-in recipes land here
        </DisplayText>
        <View style={{ height: spacing.sm }} />
        <BodyText size={14} color={palette.textSecondary} weight="medium">
          Anything you save from Tonight or swipe right in Swipe Night shows up
          here with its watercolor, cook time, and the ingredients you need.
        </BodyText>
        <View style={{ height: spacing.md }} />
        <PaintedDivider />
        <View style={{ height: spacing.sm }} />
        <BodyText size={12} color={palette.textTertiary} weight="medium">
          Grid view with cuisine + protein filter chips ships in Week 3.
        </BodyText>
      </View>
    </ScreenShell>
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
  emptyCard: {
    borderRadius: 22,
    padding: spacing.lg,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
  emptyTitle: {
    letterSpacing: -0.5,
    lineHeight: 24,
  },
});
