import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../design';
import {
  energyTierColors,
  ENERGY_TIERS,
  ENERGY_TIER_MINUTES,
  type EnergyTier,
} from '../types/energy';
import { useHaptics } from '../hooks/useHaptics';
import { EnergyChip } from './EnergyChip';

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
          <EnergyChip
            key={tier}
            minutes={ENERGY_TIER_MINUTES[tier].value}
            tierWord={ENERGY_TIER_MINUTES[tier].qualifier.toUpperCase()}
            active={active}
            color={colors.text}
            onPress={() => {
              if (tier !== value) {
                void select();
                onChange(tier);
              }
            }}
          />
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
});
