import React, { PropsWithChildren } from 'react';
import { View, StyleSheet, ScrollView, ScrollViewProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, screen, palette } from '../design';

export interface ScreenShellProps {
  scrollable?: boolean;
  horizontalPadding?: number;
  scrollProps?: Partial<ScrollViewProps>;
}

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
              paddingTop: spacing.lg,
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
          <View style={[styles.fill, { paddingHorizontal: horizontalPadding }]}>
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
