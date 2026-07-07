export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  tiny: 8,
  nested: 12,
  card: 18,
  sheet: 24,
  pill: 999,
} as const;

export const screen = {
  horizontal: 16,
  top: 64,
  bottom: 112,
  // Source of truth for the floating tab bar's height. Used by the bar itself
  // and by any sticky dock that needs to sit above it (e.g. Shop's Instacart
  // dock computes `insets.bottom + screen.tabBarHeight + gap`).
  tabBarHeight: 72,
} as const;
