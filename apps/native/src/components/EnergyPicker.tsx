import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, spacing } from '../design';
import {
  energyTierColors,
  ENERGY_TIERS,
  ENERGY_TIER_LABEL,
  ENERGY_TIER_SUBTITLE,
  type EnergyTier,
} from '../types/energy';
import { useHaptics } from '../hooks/useHaptics';
import { BodyText, Mono } from './Text';

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
              <BodyText
                size={15}
                weight="semi"
                color={active ? colors.text : palette.ink}
              >
                {ENERGY_TIER_LABEL[tier]}
              </BodyText>
              <Mono
                size={10}
                color={active ? colors.text : palette.textTertiary}
                style={styles.subtitle}
              >
                {ENERGY_TIER_SUBTITLE[tier]}
              </Mono>
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
  subtitle: {
    letterSpacing: 1,
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
