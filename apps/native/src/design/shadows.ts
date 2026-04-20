import { Platform, ViewStyle } from 'react-native';

export type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

// Warm outer halo (rust-tinted) — behind primitives that "float" on cream
export const shadowHalo: ShadowStyle = Platform.select({
  ios: {
    shadowColor: '#A85539',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  android: { elevation: 6 },
  default: {},
})!;

// Close contact shadow — sharpens the bottom edge of cards
export const shadowContact: ShadowStyle = Platform.select({
  ios: {
    shadowColor: '#3F5238',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  android: { elevation: 2 },
  default: {},
})!;

// Icon pill on hero — 40×40 close / bookmark / share buttons
export const shadowIconPill: ShadowStyle = Platform.select({
  ios: {
    shadowColor: '#3F5238',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
  },
  android: { elevation: 4 },
  default: {},
})!;

// Save pill in the cook dock — 60×60
export const shadowSavePill: ShadowStyle = Platform.select({
  ios: {
    shadowColor: '#3F5238',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
  },
  android: { elevation: 6 },
  default: {},
})!;

// Filled forest CTA — the big "Cook tonight" button
export const shadowCtaPrimary: ShadowStyle = Platform.select({
  ios: {
    shadowColor: '#A85539',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
  },
  android: { elevation: 10 },
  default: {},
})!;

// Smaller filled forest CTA — "Cook tonight" inside spotlight card row
export const shadowCtaInline: ShadowStyle = Platform.select({
  ios: {
    shadowColor: '#3F5238',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  android: { elevation: 6 },
  default: {},
})!;

// Floating tab bar at bottom of tabs
export const shadowTabBar: ShadowStyle = Platform.select({
  ios: {
    shadowColor: '#3F5238',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 40,
  },
  android: { elevation: 12 },
  default: {},
})!;

// Glass badge on hero — small translucent pill with kicker text
export const shadowGlassChip: ShadowStyle = Platform.select({
  ios: {
    shadowColor: '#A85539',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  android: { elevation: 2 },
  default: {},
})!;
