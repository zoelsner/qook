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
  const content = (
    <View style={{ paddingHorizontal: horizontalPadding }}>{children}</View>
  );

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
            {content}
          </ScrollView>
        ) : (
          <View style={styles.fill}>{content}</View>
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
