import React from 'react';
import { View } from 'react-native';
import { ScreenShell } from '../../components/ScreenShell';
import { PaperCard } from '../../components/PaperCard';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { palette, spacing } from '../../design';

const ROWS = [
  { label: 'Preferences', subtitle: 'Cuisines, proteins, avoid list' },
  { label: 'Household', subtitle: 'Size, unit system' },
  { label: 'Generation', subtitle: 'Default energy tier, day of week' },
  { label: 'Account', subtitle: 'Email, sign out, delete account' },
];

export function MoreScreen() {
  return (
    <ScreenShell>
      <Mono>more</Mono>
      <View style={{ height: spacing.sm }} />
      <DisplayText>Settings.</DisplayText>
      <BrushstrokeUnderline
        width={160}
        color={palette.utility}
        style={{ marginTop: -4 }}
      />
      <View style={{ height: spacing.xl }} />

      <PaperCard padding={0}>
        {ROWS.map((row, idx) => (
          <View key={row.label}>
            {idx > 0 && (
              <View
                style={{
                  height: 1,
                  backgroundColor: palette.haloRing,
                  marginHorizontal: spacing.md,
                }}
              />
            )}
            <View style={{ padding: spacing.md }}>
              <BodyText weight="medium">{row.label}</BodyText>
              <View style={{ height: 2 }} />
              <BodyText size={13} color={palette.textSecondary}>
                {row.subtitle}
              </BodyText>
            </View>
          </View>
        ))}
      </PaperCard>
    </ScreenShell>
  );
}
