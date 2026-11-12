import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';

import { ScreenShell } from '../../components/ScreenShell';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { IconPill } from '../../components/painted';
import { palette, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { DeckCard } from '../eat/DeckScreen';
import { SAMPLE_HAND } from './sampleHand';

// Signed-out preview of the real deck, between onboarding and sign-in. Lives in
// local state only: no store writes, so nothing from it can reach a plan, and
// no api calls, so a signed-out user never reaches the backend.
export function SampleHandScreen() {
  const router = useRouter();
  const { press } = useHaptics();
  const [position, setPosition] = useState(0);
  const recipe = SAMPLE_HAND[position];
  const advance = () => setPosition((p) => p + 1);

  const goSignIn = () => {
    press();
    router.replace('/(auth)/sign-in');
  };

  return (
    <ScreenShell horizontalPadding={20}>
      <View style={styles.masthead}>
        <Mono size={10} bold color={palette.accentDeep}>
          sample hand · {Math.min(position + 1, SAMPLE_HAND.length)}/{SAMPLE_HAND.length}
        </Mono>
        <IconPill onPress={goSignIn} accessibilityLabel="Close sample">
          <X size={16} color={palette.ink} strokeWidth={2.2} />
        </IconPill>
      </View>
      <View style={{ height: spacing.xs }} />
      <BodyText size={14} color={palette.textSecondary} weight="medium">
        A taste of how it works. These dishes aren’t made for you yet, and nothing here is saved.
      </BodyText>
      <View style={{ height: spacing.md }} />

      {recipe ? (
        <>
          <DeckCard key={recipe.id} recipe={recipe} onKeep={advance} onPass={advance} />
          <Pressable
            onPress={goSignIn}
            accessibilityRole="button"
            hitSlop={12}
            style={({ pressed }) => [styles.skipRow, pressed ? { opacity: 0.5 } : null]}
          >
            <BodyText size={13} weight="medium" color={palette.textSecondary}>
              Skip — sign in now
            </BodyText>
          </Pressable>
        </>
      ) : (
        <View style={styles.emptyWell}>
          <Mono size={10} bold color={palette.accentDeep}>
            that’s the sample
          </Mono>
          <View style={{ height: spacing.sm }} />
          <DisplayText size={26} color={palette.primary} style={styles.center}>
            Want dinners made for you?
          </DisplayText>
          <View style={{ height: spacing.sm }} />
          <BodyText size={15} color={palette.textSecondary} style={styles.center}>
            Your real hand is written fresh from your answers. That needs an account.
          </BodyText>
          <View style={{ height: spacing.lg }} />
          <PolishedButton label="Sign in to start" tone="forest" onPress={goSignIn} />
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipRow: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  emptyWell: {
    borderRadius: 18,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl + spacing.lg,
    backgroundColor: palette.well,
    alignItems: 'center',
  },
  center: { textAlign: 'center' },
});
