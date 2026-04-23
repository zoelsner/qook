import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, spacing } from '../design';
import {
  energyTierColors,
  ENERGY_TIERS,
  ENERGY_TIER_LABEL,
  ENERGY_TIER_MINUTES,
  type EnergyTier,
} from '../types/energy';
import { useHaptics } from '../hooks/useHaptics';
import { BodyText, DisplayText, Mono } from './Text';

export interface EnergyPickerProps {
  value: EnergyTier;
  onChange: (tier: EnergyTier) => void;
}

export function EnergyPicker({ value, onChange }: EnergyPickerProps) {
  const { select } = useHaptics();

  return (
    <View style={styles.stack}>
      {ENERGY_TIERS.map((tier) => {
        const active = value === tier;
        const colors = energyTierColors(tier);
        return (
          <Pressable
            key={tier}
            onPress={() => {
              if (tier !== value) {
                void select();
                onChange(tier);
              }
            }}
            style={[
              styles.row,
              active
                ? { backgroundColor: colors.bg, borderColor: colors.text }
                : styles.rowInactive,
            ]}
          >
            <View style={[styles.dot, { backgroundColor: colors.text }]} />
            <View style={styles.labels}>
              <Mono
                size={10}
                bold
                color={active ? colors.text : palette.textTertiary}
                style={styles.kicker}
              >
                {ENERGY_TIER_LABEL[tier]}
              </Mono>
              <View style={styles.minutesRow}>
                <DisplayText
                  size={36}
                  color={active ? colors.text : palette.ink}
                  style={styles.minutesValue}
                >
                  {ENERGY_TIER_MINUTES[tier].value}
                </DisplayText>
                <BodyText
                  size={13}
                  weight="medium"
                  color={active ? colors.text : palette.textTertiary}
                >
                  min {ENERGY_TIER_MINUTES[tier].qualifier}
                </BodyText>
              </View>
            </View>
            <View
              style={[
                styles.radio,
                active
                  ? { borderColor: colors.text, backgroundColor: colors.text }
                  : { borderColor: palette.glassBorder },
              ]}
            >
              {active ? <View style={styles.radioInner} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.sm + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowInactive: {
    backgroundColor: palette.surfaceTranslucent,
    borderColor: palette.glassBorder,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  labels: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  minutesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  minutesValue: {
    letterSpacing: -1.5,
    lineHeight: 38,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.surface,
  },
});
