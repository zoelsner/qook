import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../design';
import {
  ENERGY_TIERS,
  ENERGY_TIER_MINUTES,
  type EnergyTier,
} from '../types/energy';
import { useHaptics } from '../hooks/useHaptics';
import { EnergyChip } from './EnergyChip';

// Menu mockup §04 chip words: the tier's personality, not the qualifier.
const CHIP_WORD: Record<EnergyTier, string> = {
  'brain-is-fried': 'FRIED',
  'after-work': 'AFTER-WORK',
  'got-energy': 'GOT ENERGY',
  'weekend-project': 'PROJECT',
};

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
        return (
          <EnergyChip
            key={tier}
            minutes={
              ENERGY_TIER_MINUTES[tier].qualifier === 'or more'
                ? `${ENERGY_TIER_MINUTES[tier].value}+`
                : ENERGY_TIER_MINUTES[tier].value
            }
            tierWord={CHIP_WORD[tier]}
            active={active}
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
