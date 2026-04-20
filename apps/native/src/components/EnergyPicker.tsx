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
    <View style={styles.row}>
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
              styles.pill,
              active
                ? { backgroundColor: colors.bg, borderColor: colors.text }
                : styles.pillInactive,
            ]}
          >
            <BodyText
              size={13}
              weight="semi"
              color={active ? colors.text : palette.textSecondary}
              numberOfLines={1}
            >
              {ENERGY_TIER_LABEL[tier]}
            </BodyText>
            <Mono
              size={9}
              color={active ? colors.text : palette.textTertiary}
              numberOfLines={1}
            >
              {ENERGY_TIER_SUBTITLE[tier]}
            </Mono>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    borderRadius: radius.nested,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
    alignItems: 'center',
  },
  pillInactive: {
    backgroundColor: palette.surfaceTranslucent,
    borderColor: palette.glassBorder,
  },
});
