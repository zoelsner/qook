import { Platform, ViewStyle } from 'react-native';
import { palette } from './colors';

export type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

export const shadowHalo: ShadowStyle = Platform.select({
  ios: {
    shadowColor: palette.accentDeep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
  },
  android: { elevation: 6 },
  default: {},
})!;

export const shadowContact: ShadowStyle = Platform.select({
  ios: {
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  android: { elevation: 2 },
  default: {},
})!;

export const shadowTabBar: ShadowStyle = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  android: { elevation: 10 },
  default: {},
})!;
