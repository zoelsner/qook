import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react-native';

import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { PolishedButton } from '../../components/PolishedButton';
import { ScreenShell } from '../../components/ScreenShell';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { fontFamily, palette, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { StorageKeys, writeString } from '../../lib/storage';
import { signInWithEmail, signUpWithEmail } from '../../services/supabase';
import { authErrorMessage } from './authErrorMessage';

type Mode = 'signup' | 'signin';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD = 8;

export function EmailAuthScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tap, press } = useHaptics();

  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    tap();
    setMode(next);
    setError(null);
  };

  const submit = async () => {
    if (busy) return;
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError("That doesn't look like a valid email.");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    press();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(trimmed, password);
      } else {
        await signInWithEmail(trimmed, password);
      }
      await writeString(StorageKeys.authMode, 'email');
      queryClient.clear();
      router.replace('/(tabs)/tonight');
    } catch (e) {
      if (__DEV__) console.warn('[auth] email', mode, e);
      setError(authErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenShell horizontalPadding={24}>
        <Pressable
          onPress={() => {
            tap();
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(auth)/sign-in');
            }
          }}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={18} color={palette.ink} strokeWidth={2.2} />
          <Mono size={10} bold color={palette.ink}>
            BACK
          </Mono>
        </Pressable>

        <View style={{ height: spacing.lg }} />

        <View style={styles.titleWrap}>
          <DisplayText size={40} color={palette.primary} style={styles.title}>
            {mode === 'signup' ? 'Create account' : 'Sign in'}
          </DisplayText>
          <BrushstrokeUnderline
            width={150}
            color={palette.utility}
            strokeWidth={2.4}
            style={styles.underline}
          />
        </View>

        <View style={{ height: spacing.lg }} />

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => switchMode('signup')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Create account"
            accessibilityState={{ selected: mode === 'signup' }}
          >
            <Mono
              size={10}
              bold
              color={mode === 'signup' ? palette.accentDeep : palette.textTertiary}
            >
              CREATE ACCOUNT
            </Mono>
          </Pressable>
          <Pressable
            onPress={() => switchMode('signin')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            accessibilityState={{ selected: mode === 'signin' }}
          >
            <Mono
              size={10}
              bold
              color={mode === 'signin' ? palette.accentDeep : palette.textTertiary}
            >
              SIGN IN
            </Mono>
          </Pressable>
        </View>

        <View style={{ height: spacing.md }} />

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={palette.textTertiary}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          accessibilityLabel="Email"
        />

        <View style={{ height: spacing.sm }} />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          placeholderTextColor={palette.textTertiary}
          style={styles.input}
          secureTextEntry
          autoCapitalize="none"
          textContentType={mode === 'signup' ? 'newPassword' : 'password'}
          returnKeyType="go"
          onSubmitEditing={submit}
          accessibilityLabel="Password"
        />

        {error ? (
          <>
            <View style={{ height: spacing.sm }} />
            <BodyText size={13} color={palette.destructive}>
              {error}
            </BodyText>
          </>
        ) : null}

        <View style={{ height: spacing.lg }} />

        <PolishedButton
          label={mode === 'signup' ? 'Create account' : 'Sign in'}
          tone="forest"
          onPress={submit}
          disabled={busy}
        />

        <View style={{ height: spacing.md }} />

        <BodyText size={12} color={palette.textTertiary} style={styles.footnote}>
          Password reset needs email delivery, which lands with qook.app. Sign in
          with Apple if you&apos;d rather not manage a password.
        </BodyText>
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  titleWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  title: {
    letterSpacing: -1.2,
    lineHeight: 44,
  },
  underline: {
    position: 'absolute',
    left: -6,
    bottom: -8,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  input: {
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.ingredientRowBorder,
    backgroundColor: palette.surface,
    color: palette.ink,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 16,
  },
  footnote: {
    textAlign: 'center',
  },
});
