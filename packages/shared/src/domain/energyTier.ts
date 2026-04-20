import type { EnergyTier } from '../types/primitives';

export function deriveEnergyTier(activeMinutes: number): EnergyTier {
  if (activeMinutes <= 15) return 'brain-is-fried';
  if (activeMinutes <= 30) return 'after-work';
  if (activeMinutes <= 45) return 'got-energy';
  return 'weekend-project';
}
