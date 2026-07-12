import React, { PropsWithChildren } from 'react';
import { View, StyleSheet, ScrollView, ScrollViewProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { screen, palette } from '../design';

export interface ScreenShellProps {
  scrollable?: boolean;
  horizontalPadding?: number;
  scrollProps?: Partial<ScrollViewProps>;
}

// One top pad shared by BOTH branches so every screen's masthead sits at the
// same height below the notch. Historically scrollable screens got spacing.lg
// and non-scrollable (Plan) got 0 — Zach 2026-07-13: meet in the middle.
export const SHELL_TOP_PAD = 12;

export function ScreenShell({
  scrollable = true,
  horizontalPadding = screen.horizontal,
  scrollProps,
  children,
}: PropsWithChildren<ScreenShellProps>) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {scrollable ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: SHELL_TOP_PAD,
              paddingBottom: screen.bottom + insets.bottom,
            }}
            {...scrollProps}
          >
            <View style={{ paddingHorizontal: horizontalPadding }}>{children}</View>
          </ScrollView>
        ) : (
          // Children go directly under a flex:1 view — nesting them in the
          // auto-height `content` wrapper collapses any flex:1 child to zero
          // height (GenerationLoadingScreen rendered no text because of this).
          <View
            style={[
              styles.fill,
              { paddingHorizontal: horizontalPadding, paddingTop: SHELL_TOP_PAD },
            ]}
          >
            {children}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  safe: { flex: 1 },
  fill: { flex: 1 },
});
