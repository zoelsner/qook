// Generates static SVG path strings with simplex-noise-baked wobble.
// Run at dev time only; output is pasted into BrushstrokeUnderline.tsx.
//   bun run scripts/bake-wobble.ts

import { createNoise2D } from 'simplex-noise';

const VIEWBOX_W = 160;
const VIEWBOX_H = 14;
const SAMPLES = 12;
const BASE_Y = VIEWBOX_H / 2;
const AMPLITUDE = 3.2;
const X_JITTER = 1.8;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmt = (n: number) => Math.round(n * 100) / 100;

function bake(seed: number): string {
  const noise = createNoise2D(seededRandom(seed));

  const points: Array<[number, number]> = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    const baseX = 2 + t * (VIEWBOX_W - 4);
    const nx = noise(t * 10, seed) * X_JITTER;
    const ny = noise(t * 10 + 50, seed) * AMPLITUDE;
    points.push([baseX + nx, BASE_Y + ny]);
  }

  // Catmull-Rom -> cubic Bézier
  let d = `M${fmt(points[0][0])} ${fmt(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[Math.max(0, i - 1)];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const [x3, y3] = points[Math.min(points.length - 1, i + 2)];
    const cp1x = x1 + (x2 - x0) / 6;
    const cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6;
    const cp2y = y2 - (y3 - y1) / 6;
    d += ` C${fmt(cp1x)} ${fmt(cp1y)}, ${fmt(cp2x)} ${fmt(cp2y)}, ${fmt(x2)} ${fmt(y2)}`;
  }
  return d;
}

const variants = { v1: bake(1337), v2: bake(9001), v3: bake(42) };

console.log('const BAKED_PATHS: Record<\'v1\' | \'v2\' | \'v3\', string> = {');
for (const [key, d] of Object.entries(variants)) {
  console.log(`  ${key}: '${d}',`);
}
console.log('};');
