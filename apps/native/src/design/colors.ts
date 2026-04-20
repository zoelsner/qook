// Palette — baseline "A" (Paper: Tonight — Populated + Recipe Modal — Light).
// Cream ground, deep forest ink, sage mono, rust accent. Warm, pastoral, candlelit.
// Source of truth for all surface, text, accent, and wash colors.

export const palette = {
  // Grounds
  background: '#F6F0E6',
  surface: '#FFFCF6',
  surfaceTranslucent: 'rgba(255, 252, 246, 0.85)',
  surfaceTranslucentSoft: 'rgba(255, 252, 246, 0.78)',
  surfaceTranslucentFirm: 'rgba(255, 252, 246, 0.82)',

  // Ink family — display/body text
  ink: '#2C2418',
  text: '#2C2418',
  textSecondary: '#7A8568',
  textTertiary: 'rgba(122, 133, 104, 0.65)',

  // Forest family — primary accent / CTA ground
  primary: '#3F5238',
  primaryMuted: '#7A8568',

  // Rust family — decorative accent / kicker
  accent: '#C36A48',
  accentDeep: '#A85539',

  // Secondary accent — reserved for palette C pivot (prussian blue, unused in baseline)
  utility: '#3D5469',
  utilityMuted: 'rgba(61, 84, 105, 0.6)',

  // Borders / rings
  glassBorder: 'rgba(63, 82, 56, 0.10)',
  haloRing: 'rgba(195, 106, 72, 0.08)',
  ingredientRowBorder: 'rgba(63, 82, 56, 0.10)',
  statRuleColor: 'rgba(63, 82, 56, 0.18)',

  // Shadows (tinted)
  shadowWarm: 'rgba(168, 85, 57, 0.12)',
  shadowCool: 'rgba(63, 82, 56, 0.12)',

  // Washes / atmosphere
  washSage: 'rgba(154, 174, 128, 0.22)',
  washRust: 'rgba(195, 106, 72, 0.14)',
  washAmber: 'rgba(226, 186, 124, 0.12)',

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
