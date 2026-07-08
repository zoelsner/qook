import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { EnergyTier } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { EnergyPicker } from '../../components/EnergyPicker';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { IconPill } from '../../components/painted';
import { X, ArrowRight } from 'lucide-react-native';
import { palette, spacing } from '../../design';
import { fontFamily } from '../../design/typography';
import { useHaptics } from '../../hooks/useHaptics';
import { useGenerationSession } from '../../stores/generationSession';

const WEEKDAY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

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
      <View style={styles.masthead}>
        <DisplayText size={20} color={palette.ink}>qook</DisplayText>
        <IconPill onPress={handleCancel} accessibilityLabel="Cancel">
          <X size={16} color={palette.ink} strokeWidth={2.2} />
        </IconPill>
      </View>
      <View style={styles.mastheadRule} />

      <View style={{ height: spacing.md + 2 }} />
      <Mono size={10} bold color={palette.accentDeep}>
        tonight · {WEEKDAY[new Date().getDay()]}
      </Mono>
      <View style={{ height: 6 }} />
      <DisplayText size={34} color={palette.primary} style={styles.displayTitle}>
        How much <Text style={styles.titleItalic}>energy?</Text>
      </DisplayText>

      <View style={{ height: spacing.md }} />
      <BodyText size={15} color={palette.textSecondary} weight="medium">
        {"We'll draft three dinners tuned to the bandwidth you actually have tonight."}
      </BodyText>

      <View style={{ height: spacing.xl }} />

      <EnergyPicker value={tier} onChange={setTier} />

      <View style={{ height: spacing.xl }} />

      <PolishedButton
        label="See dinner ideas"
        tone="forest"
        onPress={handleContinue}
        trailingIcon={<ArrowRight size={14} color={palette.surface} />}
      />
      <View style={{ height: spacing.sm + 2 }} />
      <Mono size={9} color={palette.textTertiary} style={styles.caption}>
        FRESH PICKS IN ABOUT 10 SECONDS
      </Mono>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mastheadRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.statRuleColor,
    marginTop: spacing.sm,
  },
  displayTitle: {
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  titleItalic: {
    fontFamily: fontFamily.displayItalic,
    color: palette.accent,
  },
  caption: {
    textAlign: 'center',
    letterSpacing: 1.5,
  },
});
