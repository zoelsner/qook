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

export function energyTierColors(tier: EnergyTier) {
  return energyTier[PALETTE_KEY[tier]];
}
