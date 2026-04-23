import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { EnergyTier } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { EnergyPicker } from '../../components/EnergyPicker';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { IconPill } from '../../components/painted';
import { X, ArrowRight } from 'lucide-react-native';
import { palette, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { useGenerationSession } from '../../stores/generationSession';

export function EnergyPickerScreen() {
  const router = useRouter();
  const { press, tap } = useHaptics();
  const start = useGenerationSession((s) => s.start);
  const [tier, setTier] = useState<EnergyTier>('after-work');

  const handleContinue = () => {
    press();
    start(tier);
    router.push('/(eat)/context');
  };

  const handleCancel = () => {
    tap();
    router.back();
  };

  return (
    <ScreenShell horizontalPadding={24}>
      <View style={styles.topBar}>
        <IconPill onPress={handleCancel} accessibilityLabel="Cancel">
          <X size={16} color={palette.ink} strokeWidth={2.2} />
        </IconPill>
      </View>
      <View style={{ height: spacing.md }} />

      <View style={styles.header}>
        <View style={styles.kickerRow}>
          <Mono size={10} bold color={palette.accentDeep}>
            generate
          </Mono>
          <View style={styles.kickerDot} />
          <Mono size={10} color={palette.textSecondary}>
            draft 3 recipes · 1 of 10 today
          </Mono>
        </View>
        <View style={styles.displayTitleWrap}>
          <DisplayText size={38} color={palette.primary} style={styles.displayTitle}>
            How much energy?
          </DisplayText>
          <BrushstrokeUnderline
            width={260}
            color={palette.accent}
            strokeWidth={2.4}
            style={styles.displayUnderline}
          />
        </View>
      </View>

      <View style={{ height: spacing.md }} />
      <BodyText size={15} color={palette.textSecondary} weight="medium">
        {"We'll draft three dinners tuned to the bandwidth you actually have tonight."}
      </BodyText>

      <View style={{ height: spacing.xl }} />

      <View style={styles.pickerCard}>
        <Mono size={10} bold color={palette.accentDeep}>
          {"tonight's level"}
        </Mono>
        <View style={{ height: spacing.md }} />
        <EnergyPicker value={tier} onChange={setTier} />
      </View>

      <View style={{ height: spacing.xl }} />

      <PolishedButton
        label="See dinner ideas"
        tone="forest"
        onPress={handleContinue}
        trailingIcon={<ArrowRight size={14} color={palette.surface} />}
      />
      <View style={{ height: spacing.sm + 2 }} />
      <BodyText
        size={12}
        color={palette.textTertiary}
        weight="medium"
        style={{ textAlign: 'center' }}
      >
        Fresh picks in about 10 seconds.
      </BodyText>
    </ScreenShell>
  );
}

// keep Pressable in bundle for future use
void Pressable;

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
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
    lineHeight: 42,
  },
  displayUnderline: {
    position: 'absolute',
    left: -6,
    bottom: -8,
  },
  pickerCard: {
    borderRadius: 22,
    padding: spacing.md,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
});
