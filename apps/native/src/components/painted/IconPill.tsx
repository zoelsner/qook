import React, { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { palette, radius, spacing } from '../../design';
import { shadowIconPill, shadowSavePill } from '../../design/shadows';

// Translucent cream circle/square with a layered shadow — hosts an Icon.
// Matches Paper's 40×40 hero-nav pills and 60×60 cook-dock save pill.

export type IconPillSize = 'sm' | 'lg';

export interface IconPillProps {
  onPress?: () => void;
  accessibilityLabel?: string;
  size?: IconPillSize;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

const DIMS: Record<IconPillSize, { side: number; radius: number }> = {
  sm: { side: 40, radius: 12 },
  lg: { side: 60, radius: 16 },
};

export function IconPill({
  children,
  onPress,
  accessibilityLabel,
  size = 'sm',
  style,
  disabled,
}: PropsWithChildren<IconPillProps>) {
  const { side, radius: r } = DIMS[size];
  const shadow = size === 'lg' ? shadowSavePill : shadowIconPill;

  return (
    <View style={[{ borderRadius: r }, shadow, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled || !onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        hitSlop={6}
        style={({ pressed }) => [
          styles.pill,
          { width: side, height: side, borderRadius: r },
          pressed ? { transform: [{ scale: 0.94 }], opacity: 0.92 } : null,
        ]}
      >
        {children}
      </Pressable>
    </View>
  );
}

// Glass chip — translucent rounded-rect that holds a row of text/dot/icon.
// Used for spotlight badge, energy badge, kicker chips.
export function GlassChip({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.glassChip, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceTranslucent,
  },
  glassChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.tiny,
    backgroundColor: palette.surfaceTranslucentFirm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
});
