// Palette — B (primary) + selected C highlights.
// Cream ground, deep forest ink, sage mono, rust accent. Blue + ochre reserved
// for small highlights (tier chips, status dots, secondary badges).
// Source of truth for all surface, text, accent, and wash colors.

export const palette = {
  // Grounds — lightened ~20% toward white for a quieter / airier feel
  background: '#FCF9F1',
  surface: '#FFFCF6',
  surfaceTranslucent: 'rgba(255, 252, 246, 0.85)',
  surfaceTranslucentSoft: 'rgba(255, 252, 246, 0.78)',
  surfaceTranslucentFirm: 'rgba(255, 252, 246, 0.82)',

  // Ink family — display/body text (deep forest doubles as ink in palette B)
  ink: '#2A3A26',
  text: '#2A3A26',
  textSecondary: '#5F7057',
  textTertiary: 'rgba(95, 112, 87, 0.65)',

  // Forest family — primary accent / CTA ground
  primary: '#2A3A26',
  primaryMuted: '#5F7057',

  // Rust family — decorative accent / kicker
  accent: '#C36A48',
  accentDeep: '#A85539',

  // Blue — palette C highlight (prussian). Use sparingly for secondary status or
  // category chips. NOT a replacement for the forest primary.
  utility: '#3D5469',
  utilityMuted: 'rgba(61, 84, 105, 0.55)',

  // Ochre — palette C highlight. Rare; reserved for warm-side callouts.
  highlight: '#E2BA7C',

  // Borders / rings
  glassBorder: 'rgba(42, 58, 38, 0.10)',
  haloRing: 'rgba(195, 106, 72, 0.08)',
  ingredientRowBorder: 'rgba(42, 58, 38, 0.10)',
  statRuleColor: 'rgba(42, 58, 38, 0.18)',

  // Shadows (tinted)
  shadowWarm: 'rgba(168, 85, 57, 0.12)',
  shadowCool: 'rgba(42, 58, 38, 0.12)',

  // Washes / atmosphere — pulled down ~20% so the cream reads as the hero
  washSage: 'rgba(154, 174, 128, 0.16)',
  washRust: 'rgba(195, 106, 72, 0.10)',
  washAmber: 'rgba(226, 186, 124, 0.09)',

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
