import React, { PropsWithChildren } from 'react';
import { View, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import { palette, radius, spacing } from '../design';
import { shadowHalo, shadowContact } from '../design/shadows';

export interface PaperCardProps {
  cornerRadius?: number;
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

// Two stacked Views so we get both warm halo (outer) and cool contact shadow (inner).
// React Native only allows one shadow set per View.
export function PaperCard({
  cornerRadius = radius.card,
  padding = spacing.md,
  style,
  children,
}: PropsWithChildren<PaperCardProps>) {
  return (
    <View style={[{ borderRadius: cornerRadius }, shadowHalo]}>
      <View
        style={[
          styles.inner,
          { borderRadius: cornerRadius, padding },
          shadowContact,
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
});
