import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { palette } from '../src/design';
import { BodyText, DisplayText } from '../src/components/Text';
import { PolishedButton } from '../src/components/PolishedButton';
import { readFlag, readString, StorageKeys } from '../src/lib/storage';
import { supabase } from '../src/services/supabase';
import { loadStartupGate, type StartupGate } from '../src/features/auth/startupGate';

type Gate = 'loading' | StartupGate;

export default function Index() {
  const [gate, setGate] = useState<Gate>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadStartupGate(async () => {
      // getSession() reads storage and may refresh an expired session. A failed
      // refresh must not turn a stale local flag into a successful sign-in.
      const [onboardingShown, authMode, sessionResult] = await Promise.all([
        readFlag(StorageKeys.onboardingShown),
        readString(StorageKeys.authMode),
        supabase.auth.getSession(),
      ]);
      if (sessionResult.error) throw sessionResult.error;
      const session = sessionResult.data.session;
      return {
        onboardingShown,
        authMode,
        permanentSession: !!session && session.user.is_anonymous !== true,
      };
    }).then((nextGate) => {
      if (!cancelled) setGate(nextGate);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (gate === 'loading' || gate === 'unavailable') {
    return (
      <View style={styles.status}>
        {gate === 'loading' ? (
          <>
            <ActivityIndicator color={palette.primary} accessibilityLabel="Opening Qook" />
            <BodyText color={palette.textSecondary}>Setting the table…</BodyText>
          </>
        ) : (
          <>
            <DisplayText size={32} color={palette.primary}>Can’t open Qook yet.</DisplayText>
            <BodyText color={palette.textSecondary} style={styles.message}>
              We couldn’t check your session. Check your connection and try again.
            </BodyText>
            <PolishedButton
              label="Try again"
              onPress={() => {
                setGate('loading');
                setAttempt((value) => value + 1);
              }}
            />
          </>
        )}
      </View>
    );
  }

  if (gate === 'onboarding') return <Redirect href="/(onboarding)" />;
  if (gate === 'signed-out') return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href="/(tabs)/tonight" />;
}

const styles = StyleSheet.create({
  status: {
    flex: 1,
    backgroundColor: palette.background,
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 20,
  },
  message: { lineHeight: 24 },
});
