import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { palette, typeScale } from '../design';
import { shadowCtaPrimary } from '../design/shadows';
import { BodyText } from './Text';

export type PolishedButtonTone = 'forest' | 'rust' | 'cream' | 'ghost' | 'apple';

export interface PolishedButtonProps
  extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  tone?: PolishedButtonTone;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Flat rounded CTA. Solid fill or outline ghost, hairline border, ios-like.
// PaintedButton (wobbly hand-drawn) is deprecated — always prefer this.
// Tones: forest (primary), rust (alt / error retry), cream (secondary on
// washed surfaces), ghost (outline), apple (Sign-in-with-Apple black).
export function PolishedButton({
  label,
  tone = 'forest',
  leadingIcon,
  trailingIcon,
  style,
  disabled,
  ...pressable
}: PolishedButtonProps) {
  const { fill, textColor, borderColor, withShadow } = resolveTone(tone);

  return (
    <View
      style={[
        styles.wrap,
        withShadow ? shadowCtaPrimary : null,
        { opacity: disabled ? 0.55 : 1 },
        style,
      ]}
    >
      <Pressable
        disabled={disabled}
        {...pressable}
        style={({ pressed }) => [
          styles.pressable,
          { backgroundColor: fill, borderColor },
          pressed ? { transform: [{ scale: 0.985 }], opacity: 0.92 } : null,
        ]}
      >
        {leadingIcon ? <View style={styles.slot}>{leadingIcon}</View> : null}
        <BodyText
          weight="semi"
          size={typeScale.bodyLG}
          color={textColor}
          style={styles.label}
        >
          {label}
        </BodyText>
        {trailingIcon ? <View style={styles.slot}>{trailingIcon}</View> : null}
      </Pressable>
    </View>
  );
}

function resolveTone(tone: PolishedButtonTone): {
  fill: string;
  textColor: string;
  borderColor: string;
  withShadow: boolean;
} {
  switch (tone) {
    case 'rust':
      return {
        fill: palette.accent,
        textColor: palette.surface,
        borderColor: 'rgba(255, 252, 246, 0.10)',
        withShadow: true,
      };
    case 'cream':
      return {
        fill: palette.surface,
        textColor: palette.primary,
        borderColor: 'rgba(42, 58, 38, 0.10)',
        withShadow: true,
      };
    case 'ghost':
      return {
        fill: 'transparent',
        textColor: palette.primary,
        borderColor: 'rgba(42, 58, 38, 0.22)',
        withShadow: false,
      };
    case 'apple':
      return {
        fill: '#000000',
        textColor: palette.surface,
        borderColor: 'rgba(255, 252, 246, 0.08)',
        withShadow: true,
      };
    case 'forest':
    default:
      return {
        fill: palette.primary,
        textColor: palette.surface,
        borderColor: 'rgba(255, 252, 246, 0.08)',
        withShadow: true,
      };
  }
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    borderRadius: 14,
  },
  pressable: {
    height: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  slot: {
    flexShrink: 0,
  },
  label: {
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});
