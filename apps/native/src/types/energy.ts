// Temporary local energy-tier type + palette bridge.
// Batch 3 replaces this with `import { EnergyTier } from '@qook/shared'`.
// The runtime palette keys in `src/design/colors.ts` are camelCase; this map
// translates the canonical dashed form used throughout the domain layer.

import { energyTier, type EnergyTierKey } from '../design/colors';

export type EnergyTier =
  | 'brain-is-fried'
  | 'after-work'
  | 'got-energy'
  | 'weekend-project';

export const ENERGY_TIER_KEYS: EnergyTier[] = [
  'brain-is-fried',
  'after-work',
  'got-energy',
  'weekend-project',
];

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
