import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { palette } from '../src/design';
import { readFlag, readString, StorageKeys } from '../src/lib/storage';
import { supabase } from '../src/services/supabase';

type Gate = 'loading' | 'onboarding' | 'signed-in' | 'signed-out';

export default function Index() {
  const [gate, setGate] = useState<Gate>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // getSession() reads AsyncStorage (and refreshes if expired) — it never
      // creates one, so a first-run user still lands on sign-in.
      const [onboardingShown, authMode, sessionResult] = await Promise.all([
        readFlag(StorageKeys.onboardingShown),
        readString(StorageKeys.authMode),
        supabase.auth.getSession(),
      ]);
      if (cancelled) return;
      const session = sessionResult.data.session;
      const permanentSession = !!session && session.user.is_anonymous !== true;
      if (!onboardingShown) {
        setGate('onboarding');
      } else if (permanentSession || authMode) {
        // A real account wins; the authMode flag covers guests and stale flags.
        setGate('signed-in');
      } else {
        setGate('signed-out');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (gate === 'loading') {
    return <View style={{ flex: 1, backgroundColor: palette.background }} />;
  }

  if (gate === 'onboarding') {
    return <Redirect href="/(onboarding)" />;
  }

  if (gate === 'signed-out') {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href="/(tabs)/tonight" />;
}
