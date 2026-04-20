import React from 'react';
import { Pressable, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { palette } from '../../design';

// Baked hand-drawn rounded-square path from Paper's Hand-drawn UI Study
// (Study 2 Checkbox, HAND-DRAWN side). viewBox 28×28.
const BOX_PATH =
  'M 6 3 C 14 2, 22 4, 25 6 C 26 14, 25 22, 24 24 C 16 26, 8 25, 4 23 C 3 15, 4 7, 6 3 Z';

// Hand-drawn checkmark — wobble sag in the middle stroke
const CHECK_PATH = 'M 8 14 C 10 15, 11 18, 13 17 C 15 16, 18 11, 21 9';

export interface PaintedCheckboxProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function PaintedCheckbox({
  checked,
  onChange,
  size = 22,
  style,
  disabled,
}: PaintedCheckboxProps) {
  const handle = () => {
    if (disabled) return;
    onChange?.(!checked);
  };

  return (
    <Pressable
      onPress={handle}
      hitSlop={8}
      disabled={disabled}
      style={({ pressed }) => [
        { width: size, height: size, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        {checked ? (
          <>
            <Path
              d={BOX_PATH}
              fill="rgba(154, 174, 128, 0.85)"
              stroke={palette.primary}
              strokeWidth={1.4}
              strokeLinejoin="round"
            />
            <Path
              d={CHECK_PATH}
              stroke={palette.primary}
              strokeWidth={2.2}
              strokeLinecap="round"
              fill="none"
            />
          </>
        ) : (
          <Path
            d={BOX_PATH}
            fill="none"
            stroke={palette.primary}
            strokeWidth={1.8}
            strokeLinejoin="round"
            opacity={0.85}
          />
        )}
      </Svg>
    </Pressable>
  );
}

export interface PaintedRadioProps {
  checked: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// Hand-drawn circle selector (Study 3 Selection circle). Used for radio groups.
const CIRCLE_PATH =
  'M 16 3 C 22 4, 28 9, 28 16 C 29 22, 23 28, 16 28 C 10 29, 4 23, 4 16 C 3 10, 9 3, 16 3 Z';
const CIRCLE_CHECK_PATH = 'M 10 16 C 12 17, 14 20, 16 19 C 18 18, 20 13, 22 11';

export function PaintedRadio({ checked, size = 28, style }: PaintedRadioProps) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        {checked ? (
          <>
            <Path
              d={CIRCLE_PATH}
              fill={palette.accent}
              stroke={palette.accentDeep}
              strokeWidth={1.2}
            />
            <Path
              d={CIRCLE_CHECK_PATH}
              stroke={palette.surface}
              strokeWidth={2.4}
              strokeLinecap="round"
              fill="none"
            />
          </>
        ) : (
          <Path
            d={CIRCLE_PATH}
            fill="none"
            stroke={palette.primary}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        )}
      </Svg>
    </View>
  );
}

// Attaching to reduce unused-style complaints
const _unused = StyleSheet.create({ pad: {} });
void _unused;
