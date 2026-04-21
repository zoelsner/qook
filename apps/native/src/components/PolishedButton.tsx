import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette, typeScale } from '../design';
import { shadowCtaPrimary } from '../design/shadows';
import { BodyText } from './Text';

export type PolishedButtonTone = 'forest' | 'cream';

export interface PolishedButtonProps
  extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  tone?: PolishedButtonTone;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Clean rounded-14 CTA with a subtle vertical gradient + hairline border.
// Used in shell surfaces (auth, onboarding) where PaintedButton's hand-drawn
// wobble feels out of place. Product action buttons still use PaintedButton.
export function PolishedButton({
  label,
  tone = 'forest',
  leadingIcon,
  trailingIcon,
  style,
  disabled,
  ...pressable
}: PolishedButtonProps) {
  const isForest = tone === 'forest';
  const gradient = isForest
    ? ['#3F5238', palette.primary]
    : [palette.surface, '#F4EFDE'];
  const borderColor = isForest
    ? 'rgba(255, 252, 246, 0.16)'
    : 'rgba(42, 58, 38, 0.10)';
  const textColor = isForest ? palette.surface : palette.primary;

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
          { borderColor },
          pressed ? { transform: [{ scale: 0.985 }] } : null,
        ]}
      >
        <LinearGradient
          colors={gradient as [string, string]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.row}>
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
        </View>
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
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  slot: {
    flexShrink: 0,
  },
  label: {
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});
