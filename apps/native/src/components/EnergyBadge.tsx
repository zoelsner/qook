import React from 'react';
import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import {
  energyTierColors,
  ENERGY_TIER_LABEL,
  type EnergyTier,
} from '../types/energy';
import { Mono } from './Text';

export interface EnergyBadgeProps {
  tier: EnergyTier;
  style?: StyleProp<ViewStyle>;
}

export function EnergyBadge({ tier, style }: EnergyBadgeProps) {
  const colors = energyTierColors(tier);

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      <Mono size={9} bold color={colors.text}>
        {ENERGY_TIER_LABEL[tier]}
      </Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 5,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
});
