export const fontFamily = {
  display: 'Fraunces_700Bold',
  bodyRegular: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemi: 'DMSans_600SemiBold',
  monoRegular: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const typeScale = {
  displayXL: 56,
  displayL: 44,
  displayM: 32,
  displayS: 22,
  bodyLG: 17,
  bodyMD: 15,
  bodySM: 13,
  monoMD: 11,
  monoSM: 10,
} as const;

export type FontFamilyKey = keyof typeof fontFamily;
export type TypeScaleKey = keyof typeof typeScale;
