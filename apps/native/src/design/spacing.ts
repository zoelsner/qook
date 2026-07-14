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
  bottom: 118,
  // Source of truth for the floating tab bar's height (icon + label rows).
  // Used by the bar itself and by any sticky dock that needs to sit above it
  // (computes `insets.bottom + screen.tabBarHeight + gap`). `bottom` above is
  // the scroll clearance that keeps content from ending under the bar — keep
  // it ~40 over tabBarHeight.
  tabBarHeight: 78,
} as const;
