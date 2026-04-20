import { palette } from './colors';

export interface RadialWashConfig {
  color: string;
  cx: number;
  cy: number;
  radiusFactor: number;
}

export const washConfigs: RadialWashConfig[] = [
  { color: palette.washSage, cx: 0.18, cy: 0.08, radiusFactor: 0.55 },
  { color: palette.washRust, cx: 0.92, cy: 0.96, radiusFactor: 0.55 },
  { color: palette.washAmber, cx: 0.6, cy: 0.5, radiusFactor: 0.45 },
];
