// Client-side bridge between the canonical domain EnergyTier (dashed form,
// in @qook/shared) and the palette.energyTier camelCase keys in src/design/colors.ts.

import { energyTier, type EnergyTierKey } from '../design/colors';
import { ENERGY_TIERS, type EnergyTier } from '@qook/shared';

export { ENERGY_TIERS, type EnergyTier };

const PALETTE_KEY: Record<EnergyTier, EnergyTierKey> = {
  'brain-is-fried': 'brainIsFried',
  'after-work': 'afterWork',
  'got-energy': 'gotEnergy',
  'weekend-project': 'weekend',
};

export const ENERGY_TIER_LABEL: Record<EnergyTier, string> = {
  'brain-is-fried': 'Brain-fried',
  'after-work': 'After work',
  'got-energy': 'Got energy',
  'weekend-project': 'Weekend',
};

export const ENERGY_TIER_SUBTITLE: Record<EnergyTier, string> = {
  'brain-is-fried': '≤ 15 min',
  'after-work': '≤ 30 min',
  'got-energy': '≤ 45 min',
  'weekend-project': '> 45 min',
};

// Minutes-first EnergyPicker rows (Move 4): hero number + "min or less/more".
export const ENERGY_TIER_MINUTES: Record<
  EnergyTier,
  { value: number; qualifier: 'or less' | 'or more' }
> = {
  'brain-is-fried': { value: 15, qualifier: 'or less' },
  'after-work': { value: 30, qualifier: 'or less' },
  'got-energy': { value: 45, qualifier: 'or less' },
  'weekend-project': { value: 60, qualifier: 'or more' },
};

export function energyTierColors(tier: EnergyTier) {
  return energyTier[PALETTE_KEY[tier]];
}
