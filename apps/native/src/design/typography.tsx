import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { palette } from './colors';

export const fontFamily = {
  display: 'Fraunces_700Bold',
  bodyRegular: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemi: 'DMSans_600SemiBold',
  monoRegular: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const typeScale = {
  displayXL: 56,
  displayL: 44,
  displayM: 32,
  displayS: 22,
  bodyLG: 17,
  bodyMD: 15,
  bodySM: 13,
  monoMD: 11,
  monoSM: 10,
} as const;

const styles = StyleSheet.create({
  display: {
    fontFamily: fontFamily.display,
    color: palette.primary,
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  body: {
    fontFamily: fontFamily.bodyRegular,
    color: palette.text,
    includeFontPadding: false,
  },
  mono: {
    fontFamily: fontFamily.monoRegular,
    color: palette.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
});

export interface DisplayTextProps extends TextProps {
  size?: number;
  color?: string;
}

export function DisplayText({
  size = typeScale.displayL,
  color,
  style,
  ...rest
}: DisplayTextProps) {
  return (
    <Text
      style={[
        styles.display,
        { fontSize: size, lineHeight: Math.round(size * 1.05) },
        color ? { color } : null,
        style,
      ]}
      {...rest}
    />
  );
}

export type BodyWeight = 'regular' | 'medium' | 'semi';

export interface BodyTextProps extends TextProps {
  size?: number;
  weight?: BodyWeight;
  color?: string;
}

const bodyFamily: Record<BodyWeight, string> = {
  regular: fontFamily.bodyRegular,
  medium: fontFamily.bodyMedium,
  semi: fontFamily.bodySemi,
};

export function BodyText({
  size = typeScale.bodyMD,
  weight = 'regular',
  color,
  style,
  ...rest
}: BodyTextProps) {
  return (
    <Text
      style={[
        styles.body,
        {
          fontFamily: bodyFamily[weight],
          fontSize: size,
          lineHeight: Math.round(size * 1.4),
        },
        color ? { color } : null,
        style,
      ]}
      {...rest}
    />
  );
}

export interface MonoProps extends TextProps {
  size?: number;
  bold?: boolean;
  color?: string;
}

export function Mono({
  size = typeScale.monoSM,
  bold,
  color,
  style,
  ...rest
}: MonoProps) {
  return (
    <Text
      style={[
        styles.mono,
        {
          fontFamily: bold ? fontFamily.monoBold : fontFamily.monoRegular,
          fontSize: size,
          lineHeight: Math.round(size * 1.3),
        },
        color ? { color } : null,
        style,
      ]}
      {...rest}
    />
  );
}
