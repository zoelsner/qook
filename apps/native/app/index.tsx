import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { palette } from '../src/design';
import { readFlag, StorageKeys } from '../src/lib/storage';

type Gate = 'loading' | 'signed-in' | 'signed-out';

export default function Index() {
  const [gate, setGate] = useState<Gate>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const signedIn = await readFlag(StorageKeys.signedIn);
      if (cancelled) return;
      setGate(signedIn ? 'signed-in' : 'signed-out');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (gate === 'loading') {
    return <View style={{ flex: 1, backgroundColor: palette.background }} />;
  }

  if (gate === 'signed-out') {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href="/(tabs)/tonight" />;
}
