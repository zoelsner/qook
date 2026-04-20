import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts as useFrauncesFonts,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

import { palette, spacing, typeScale } from './src/design';
import {
  BodyText,
  DisplayText,
  Mono,
} from './src/design/typography';
import { BrushstrokeUnderline } from './src/components/BrushstrokeUnderline';
import { PaperCard } from './src/components/PaperCard';
import { ScreenShell } from './src/components/ScreenShell';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [loaded, error] = useFrauncesFonts({
    Fraunces_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaProvider>
        <ScreenShell>
          <Mono bold>tonight</Mono>
          <View style={{ height: spacing.sm }} />
          <DisplayText>Pasta night.</DisplayText>
          <BrushstrokeUnderline
            width={180}
            color={palette.accent}
            style={{ marginTop: -4 }}
          />
          <View style={{ height: spacing.xl }} />
          <PaperCard>
            <Mono>primitive preview</Mono>
            <View style={{ height: spacing.sm }} />
            <DisplayText size={typeScale.displayS}>PaperCard</DisplayText>
            <View style={{ height: spacing.sm }} />
            <BodyText>
              Two-layer shadow (warm halo outside, cool contact inside) on cream
              surface. Tokens loaded from src/design.
            </BodyText>
          </PaperCard>
        </ScreenShell>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
