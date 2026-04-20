import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { palette, spacing } from '../../design';

interface MoreRow {
  label: string;
  subtitle: string;
  kicker?: string;
}

const ROWS: MoreRow[] = [
  {
    label: 'Preferences',
    subtitle: 'Cuisines, proteins, avoid list',
    kicker: 'taste',
  },
  { label: 'Household', subtitle: 'Size, unit system', kicker: 'who' },
  {
    label: 'Generation',
    subtitle: 'Default energy tier, day of week',
    kicker: 'when',
  },
  {
    label: 'Account',
    subtitle: 'Email, sign out, delete account',
    kicker: 'you',
  },
];

export function MoreScreen() {
  return (
    <ScreenShell horizontalPadding={24}>
      <View style={styles.header}>
        <View style={styles.kickerRow}>
          <Mono size={10} bold color={palette.accentDeep}>
            more
          </Mono>
          <View style={styles.kickerDot} />
          <Mono size={10} color={palette.textSecondary}>
            settings · account · help
          </Mono>
        </View>
        <View style={styles.displayTitleWrap}>
          <DisplayText size={44} color={palette.primary} style={styles.displayTitle}>
            Settings
          </DisplayText>
          <BrushstrokeUnderline
            width={170}
            color={palette.utility}
            strokeWidth={2.4}
            style={styles.displayUnderline}
          />
        </View>
      </View>

      <View style={{ height: spacing.xl + spacing.sm }} />

      <View style={styles.rowList}>
        {ROWS.map((row, idx) => (
          <Pressable
            key={row.label}
            style={({ pressed }) => [
              styles.row,
              idx > 0 ? styles.rowDivider : null,
              pressed ? { opacity: 0.85 } : null,
            ]}
          >
            <View style={styles.rowKickerWrap}>
              <Mono size={10} bold color={palette.accent}>
                {row.kicker ?? ''}
              </Mono>
            </View>
            <View style={{ flex: 1 }}>
              <BodyText size={16} weight="semi" color={palette.ink}>
                {row.label}
              </BodyText>
              <View style={{ height: 2 }} />
              <BodyText size={12} color={palette.textSecondary} weight="medium">
                {row.subtitle}
              </BodyText>
            </View>
            <Mono size={14} color={palette.textTertiary}>
              ›
            </Mono>
          </Pressable>
        ))}
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
  rowList: {
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md + 2,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.ingredientRowBorder,
  },
  rowKickerWrap: {
    width: 40,
  },
});
