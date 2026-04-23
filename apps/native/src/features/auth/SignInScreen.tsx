import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { IconApple } from '../../components/painted';
import { palette, spacing, typeScale } from '../../design';
import { fontFamily } from '../../design/typography';
import { useHaptics } from '../../hooks/useHaptics';
import { StorageKeys, writeFlag, writeString } from '../../lib/storage';

const HORIZONTAL_PADDING = 32;

export function SignInScreen() {
  const router = useRouter();
  const { press, tap } = useHaptics();
  const [busy, setBusy] = useState(false);

  const finish = async (mode: 'apple' | 'guest') => {
    if (busy) return;
    setBusy(true);
    await writeFlag(StorageKeys.signedIn, true);
    await writeString(StorageKeys.authMode, mode);
    router.replace('/(tabs)/tonight');
  };

  const handleApple = () => {
    press();
    console.log('[auth] stub Sign in with Apple');
    void finish('apple');
  };

  const handleGuest = () => {
    tap();
    console.log('[auth] continue as guest');
    void finish('guest');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.topSpacer} />

          <View style={styles.brand}>
            <View style={styles.qMark}>
              <BodyText
                weight="semi"
                size={52}
                color={palette.surface}
                style={styles.qGlyph}
              >
                Q
              </BodyText>
            </View>
            <Mono size={11} color={palette.textSecondary} style={styles.kicker}>
              QOOK
            </Mono>
          </View>

          <View style={{ height: spacing.xl }} />

          <View style={styles.headlineWrap}>
            <DisplayText
              size={46}
              color={palette.primary}
              style={styles.headline}
            >
              Welcome back.
            </DisplayText>
            <BrushstrokeUnderline
              width={220}
              strokeWidth={2.2}
              color={palette.accent}
              style={styles.underline}
            />
          </View>

          <View style={{ height: spacing.md }} />

          <BodyText
            size={typeScale.bodyMD}
            color={palette.textSecondary}
            weight="regular"
            style={styles.subtitle}
          >
            Plan meals, build your grocery list, and cook with confidence.
          </BodyText>

          <View style={styles.flexSpacer} />

          <PolishedButton
            label="Continue with Apple"
            tone="forest"
            onPress={handleApple}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Continue with Apple"
            leadingIcon={<IconApple size={18} color={palette.surface} />}
          />

          <View style={{ height: spacing.md }} />

          <Pressable
            onPress={handleGuest}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Continue as guest"
            hitSlop={12}
            style={({ pressed }) => [
              styles.ghost,
              pressed ? { opacity: 0.6 } : null,
            ]}
          >
            <BodyText
              weight="medium"
              size={typeScale.bodyMD}
              color={palette.primary}
            >
              Continue as guest
            </BodyText>
          </Pressable>

          <View style={{ height: spacing.md }} />

          <BodyText
            size={12}
            color={palette.textTertiary}
            weight="medium"
            style={styles.finePrint}
          >
            Stubbed sign-in for development. No account required.
          </BodyText>

          <View style={{ height: spacing.md }} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  topSpacer: {
    height: spacing.xxl + spacing.md,
  },
  brand: {
    alignItems: 'center',
    gap: 14,
  },
  qMark: {
    width: 80,
    height: 80,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A85539',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 8,
  },
  qGlyph: {
    fontFamily: fontFamily.display,
    letterSpacing: -1.5,
    lineHeight: 58,
    includeFontPadding: false,
    textAlignVertical: 'center',
    marginTop: -2,
  },
  kicker: {
    letterSpacing: 3.5,
  },
  headlineWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  headline: {
    letterSpacing: -1.4,
    lineHeight: 50,
  },
  underline: {
    position: 'absolute',
    left: 96,
    bottom: -8,
  },
  subtitle: {
    lineHeight: 22,
  },
  flexSpacer: {
    flex: 1,
    minHeight: spacing.xxl,
  },
  ghost: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  finePrint: {
    textAlign: 'center',
  },
});
