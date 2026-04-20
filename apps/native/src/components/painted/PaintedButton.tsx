import React, { PropsWithChildren } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { palette } from '../../design';
import { shadowCtaPrimary, shadowCtaInline } from '../../design/shadows';
import { BodyText } from '../Text';

// Hand-drawn rounded-rect shape, baked from Paper's Hand-drawn UI Study
// (Study 1 Button, HAND-DRAWN side). viewBox 340×60. Using preserveAspectRatio="none"
// so the painted edge stretches to any button width.
const PAINTED_PILL_PATH =
  'M 14 6 C 80 3, 170 2, 240 4 S 322 2, 332 10 C 336 20, 335 42, 331 52 C 260 56, 110 55, 36 54 C 14 52, 4 48, 6 38 C 5 26, 8 14, 14 6 Z';

export type PaintedButtonSize = 'sm' | 'md' | 'lg';
export type PaintedButtonTone = 'forest' | 'rust';

export interface PaintedButtonProps
  extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  size?: PaintedButtonSize;
  tone?: PaintedButtonTone;
  trailingIcon?: React.ReactNode;
  leadingIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZE_MAP: Record<
  PaintedButtonSize,
  { height: number; fontSize: number; lineHeight: number; paddingX: number }
> = {
  sm: { height: 36, fontSize: 12, lineHeight: 16, paddingX: 14 },
  md: { height: 44, fontSize: 14, lineHeight: 18, paddingX: 18 },
  lg: { height: 60, fontSize: 15, lineHeight: 18, paddingX: 22 },
};

export function PaintedButton({
  label,
  size = 'lg',
  tone = 'forest',
  trailingIcon,
  leadingIcon,
  fullWidth,
  style,
  disabled,
  ...pressable
}: PaintedButtonProps) {
  const { height, fontSize, lineHeight, paddingX } = SIZE_MAP[size];
  const fill = tone === 'rust' ? palette.accent : palette.primary;
  const shadow = size === 'lg' ? shadowCtaPrimary : shadowCtaInline;

  return (
    <View
      style={[
        fullWidth ? { alignSelf: 'stretch' } : null,
        shadow,
        { opacity: disabled ? 0.6 : 1 },
        style,
      ]}
    >
      <Pressable
        disabled={disabled}
        {...pressable}
        style={({ pressed }) => [
          styles.pressable,
          { height, paddingHorizontal: paddingX },
          pressed ? { transform: [{ scale: 0.985 }] } : null,
        ]}
      >
        <Svg
          width="100%"
          height={height}
          viewBox="0 0 340 60"
          preserveAspectRatio="none"
          style={StyleSheet.absoluteFill}
        >
          <Path d={PAINTED_PILL_PATH} fill={fill} />
        </Svg>
        <InnerRow
          fontSize={fontSize}
          lineHeight={lineHeight}
          leadingIcon={leadingIcon}
          trailingIcon={trailingIcon}
        >
          {label}
        </InnerRow>
      </Pressable>
    </View>
  );
}

function InnerRow({
  children,
  fontSize,
  lineHeight,
  leadingIcon,
  trailingIcon,
}: PropsWithChildren<{
  fontSize: number;
  lineHeight: number;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}>) {
  return (
    <View style={styles.row}>
      {leadingIcon ? <View style={styles.leading}>{leadingIcon}</View> : null}
      <BodyText
        weight="semi"
        size={fontSize}
        color={palette.surface}
        style={{ lineHeight, letterSpacing: 0.2 }}
      >
        {children}
      </BodyText>
      {trailingIcon ? <View style={styles.trailing}>{trailingIcon}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leading: { flexShrink: 0 },
  trailing: { flexShrink: 0 },
});
