import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { palette } from '../src/design';
import { readFlag, StorageKeys } from '../src/lib/storage';

type Gate = 'loading' | 'onboarding' | 'signed-in' | 'signed-out';

export default function Index() {
  const [gate, setGate] = useState<Gate>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [onboardingShown, signedIn] = await Promise.all([
        readFlag(StorageKeys.onboardingShown),
        readFlag(StorageKeys.signedIn),
      ]);
      if (cancelled) return;
      if (!onboardingShown) {
        setGate('onboarding');
      } else if (signedIn) {
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
