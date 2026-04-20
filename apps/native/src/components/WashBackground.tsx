import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { palette } from '../design';
import { washConfigs } from '../design/washes';

// Cream fill + three SVG radial washes.
// TODO: re-add tiled `assets/paper-grain.png` overlay once the 512x512 tile is generated
// (one-time Seedream prompt in section-frontend.md §7.5).
export function WashBackground() {
  const { width, height } = useWindowDimensions();
  const size = Math.max(width, height);

  const gradients = useMemo(
    () =>
      washConfigs.map((cfg, i) => ({
        id: `wash-${i}`,
        cx: cfg.cx * width,
        cy: cfg.cy * height,
        r: cfg.radiusFactor * size,
        color: cfg.color,
      })),
    [width, height, size]
  );

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.base]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          {gradients.map((g) => (
            <RadialGradient
              key={g.id}
              id={g.id}
              cx={g.cx}
              cy={g.cy}
              r={g.r}
              fx={g.cx}
              fy={g.cy}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor={g.color} stopOpacity="1" />
              <Stop offset="100%" stopColor={g.color} stopOpacity="0" />
            </RadialGradient>
          ))}
        </Defs>
        {gradients.map((g) => (
          <Rect
            key={`r-${g.id}`}
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill={`url(#${g.id})`}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: palette.background },
});
