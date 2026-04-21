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

export type PolishedButtonTone = 'forest' | 'cream' | 'apple';

export interface PolishedButtonProps
  extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  tone?: PolishedButtonTone;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Flat rounded CTA for shell surfaces (auth, onboarding). Solid fill,
// hairline border, ios-like. In-app product CTAs still use PaintedButton
// so the hand-drawn voice stays tied to recipe content.
export function PolishedButton({
  label,
  tone = 'forest',
  leadingIcon,
  trailingIcon,
  style,
  disabled,
  ...pressable
}: PolishedButtonProps) {
  const fill =
    tone === 'apple' ? '#000000' : tone === 'cream' ? palette.surface : palette.primary;
  const textColor = tone === 'cream' ? palette.primary : palette.surface;
  const borderColor =
    tone === 'cream' ? 'rgba(42, 58, 38, 0.10)' : 'rgba(255, 252, 246, 0.08)';

  return (
    <View
      style={[
        styles.wrap,
        shadowCtaPrimary,
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
