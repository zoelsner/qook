import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';

import { BodyText, Mono } from '../../components/Text';
import { palette, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';

export function SettingsGroup({
  kicker,
  children,
  style,
}: {
  kicker: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ marginTop: spacing.lg }, style]}>
      <View style={groupStyles.header}>
        <Mono size={10} bold color={palette.accentDeep}>
          {kicker}
        </Mono>
        <View style={groupStyles.rule} />
      </View>
      <View style={groupStyles.card}>{children}</View>
    </View>
  );
}

const groupStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  rule: {
    flex: 1,
    height: 1,
    marginLeft: 10,
    backgroundColor: palette.ingredientRowBorder,
  },
  card: {
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
    padding: spacing.md,
  },
});

export function PillToggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { select } = useHaptics();
  return (
    <Pressable
      onPress={() => {
        select();
        onPress();
      }}
      style={({ pressed }) => [
        pillStyles.pill,
        active ? pillStyles.pillActive : pillStyles.pillInactive,
        pressed ? { opacity: 0.85 } : null,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <BodyText
        size={13}
        weight="semi"
        color={active ? palette.surface : palette.ink}
      >
        {label}
      </BodyText>
    </Pressable>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  pillInactive: {
    backgroundColor: palette.surface,
    borderColor: palette.glassBorder,
  },
});

export function PillGroup({ children }: { children: React.ReactNode }) {
  return <View style={pillGroupStyles.wrap}>{children}</View>;
}

const pillGroupStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

export function SettingsRow({
  label,
  subtitle,
  right,
}: {
  label: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={rowStyles.row}>
      <View style={{ flex: 1 }}>
        <BodyText size={15} weight="semi" color={palette.ink}>
          {label}
        </BodyText>
        {subtitle ? (
          <>
            <View style={{ height: 2 }} />
            <BodyText size={12} color={palette.textSecondary} weight="medium">
              {subtitle}
            </BodyText>
          </>
        ) : null}
      </View>
      {right ? <View style={rowStyles.right}>{right}</View> : null}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  right: {
    flexShrink: 0,
  },
});

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { select } = useHaptics();
  return (
    <View style={segStyles.wrap}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              select();
              onChange(opt.value);
            }}
            style={({ pressed }) => [
              segStyles.segment,
              active ? segStyles.segmentActive : null,
              pressed ? { opacity: 0.85 } : null,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <BodyText
              size={12}
              weight="semi"
              color={active ? palette.surface : palette.ink}
            >
              {opt.label}
            </BodyText>
          </Pressable>
        );
      })}
    </View>
  );
}

const segStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: 10,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
    overflow: 'hidden',
  },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  segmentActive: {
    backgroundColor: palette.primary,
  },
});

export function Stepper({
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  const { select } = useHaptics();
  const dec = () => {
    if (value <= min) return;
    select();
    onChange(value - 1);
  };
  const inc = () => {
    if (value >= max) return;
    select();
    onChange(value + 1);
  };
  return (
    <View style={stepperStyles.wrap}>
      <Pressable
        onPress={dec}
        disabled={value <= min}
        hitSlop={8}
        style={({ pressed }) => [
          stepperStyles.btn,
          pressed ? { opacity: 0.85 } : null,
          value <= min ? { opacity: 0.4 } : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Decrease"
      >
        <BodyText size={18} weight="semi" color={palette.ink}>
          −
        </BodyText>
      </Pressable>
      <BodyText
        size={15}
        weight="semi"
        color={palette.ink}
        style={stepperStyles.value}
      >
        {value}
        {suffix ? <Mono size={11} color={palette.textSecondary}> {suffix}</Mono> : null}
      </BodyText>
      <Pressable
        onPress={inc}
        disabled={value >= max}
        hitSlop={8}
        style={({ pressed }) => [
          stepperStyles.btn,
          pressed ? { opacity: 0.85 } : null,
          value >= max ? { opacity: 0.4 } : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Increase"
      >
        <BodyText size={18} weight="semi" color={palette.ink}>
          +
        </BodyText>
      </Pressable>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
  value: {
    minWidth: 24,
    textAlign: 'center',
  },
});
