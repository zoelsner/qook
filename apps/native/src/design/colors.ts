// Palette — ported from KataPalette.Light (sashafood/apps/swift/Qook/Theme/KataPalette.swift).
// Source of truth for all surface, text, accent, and wash colors.

export const palette = {
  background: '#FAF5EC',
  surface: '#FEFBF3',
  surfaceTranslucent: 'rgba(255, 252, 246, 0.82)',

  text: '#26241C',
  textSecondary: '#5F7057',
  textTertiary: 'rgba(95, 112, 87, 0.6)',

  primary: '#2A3A26',
  primaryMuted: '#5F7057',

  accent: '#C36A48',
  accentDeep: '#A85539',

  utility: '#3D5469',
  utilityMuted: 'rgba(61, 84, 105, 0.6)',

  glassBorder: 'rgba(42, 58, 38, 0.08)',
  haloRing: 'rgba(195, 106, 72, 0.06)',

  shadowWarm: 'rgba(168, 85, 57, 0.10)',
  shadowCool: 'rgba(42, 58, 38, 0.10)',

  washSage: 'rgba(154, 174, 128, 0.22)',
  washRust: 'rgba(195, 106, 72, 0.14)',
  washAmber: 'rgba(226, 186, 124, 0.10)',

  destructive: '#B33939',
} as const;

export const energyTier = {
  brainIsFried: { bg: 'rgba(232, 105, 94, 0.15)', text: '#E8695E' },
  afterWork: { bg: 'rgba(212, 149, 43, 0.15)', text: '#E8A84C' },
  gotEnergy: { bg: 'rgba(125, 184, 127, 0.15)', text: '#7DB87F' },
  weekend: { bg: 'rgba(94, 138, 232, 0.15)', text: '#5E8AE8' },
} as const;

export type Palette = typeof palette;
export type EnergyTierKey = keyof typeof energyTier;
