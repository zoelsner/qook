# Frontend Architecture — Qook Fresh Build

**Owner:** frontend-architect
**Target:** v1 TestFlight 2026-05-24
**Repo:** `~/Projects/qook/` (fresh, NOT inside sashafood)
**Stack:** Expo 52 + Expo Router v4 + TypeScript + Supabase JS + Zustand + TanStack Query + Reanimated 3 + react-native-svg

---

## 1. Repo Scaffolding

### 1.1 Create the Expo project

```bash
cd ~/Projects
npx create-expo-app@latest qook --template blank-typescript
cd qook
git init && git add -A && git commit -m "chore: initial expo blank-typescript scaffold"
```

Why `blank-typescript`: the default ships extra `tabs` boilerplate we would delete. Blank gives a clean slate; Expo Router is installed manually so we own the layout files.

### 1.2 Install dependencies

```bash
bunx expo install expo-router react-native-screens react-native-safe-area-context \
  react-native-gesture-handler react-native-reanimated expo-linking expo-constants expo-status-bar
bunx expo install expo-font expo-splash-screen
bun add @expo-google-fonts/dm-sans @expo-google-fonts/fraunces @expo-google-fonts/jetbrains-mono
bunx expo install expo-image expo-haptics expo-blur
bunx expo install react-native-svg expo-linear-gradient
bun add @supabase/supabase-js @tanstack/react-query zustand
bunx expo install @react-native-async-storage/async-storage react-native-url-polyfill
bunx expo install @shopify/react-native-skia
bun add -d typescript @types/react eslint prettier eslint-config-expo simplex-noise@^4.0.3
```

### 1.3 Pinned versions (April 2026)

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-font": "~13.0.0",
    "expo-image": "~2.0.0",
    "expo-haptics": "~14.0.0",
    "expo-blur": "~14.0.0",
    "expo-linear-gradient": "~14.0.0",
    "expo-splash-screen": "~0.29.0",
    "expo-status-bar": "~2.0.0",
    "expo-constants": "~17.0.0",
    "expo-linking": "~7.0.0",
    "react": "18.3.1",
    "react-native": "0.76.5",
    "react-native-screens": "~4.4.0",
    "react-native-safe-area-context": "~4.12.0",
    "react-native-gesture-handler": "~2.21.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-svg": "15.8.0",
    "react-native-url-polyfill": "^2.0.0",
    "@react-native-async-storage/async-storage": "~2.1.0",
    "@shopify/react-native-skia": "~1.7.0",
    "@supabase/supabase-js": "^2.47.0",
    "@tanstack/react-query": "^5.60.0",
    "zustand": "^5.0.0",
    "@expo-google-fonts/dm-sans": "^0.2.3",
    "@expo-google-fonts/fraunces": "^0.2.3",
    "@expo-google-fonts/jetbrains-mono": "^0.2.3"
  }
}
```

Note: `@expo-google-fonts/fraunces` ships `Fraunces_700Bold`. No need to bundle the local `.ttf`.

### 1.4 `app.json`

```json
{
  "expo": {
    "name": "Qook",
    "slug": "qook",
    "scheme": "qook",
    "version": "0.1.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "cover",
      "backgroundColor": "#FAF5EC"
    },
    "ios": {
      "bundleIdentifier": "com.qook.app",
      "supportsTablet": false,
      "infoPlist": { "ITSAppUsesNonExemptEncryption": false }
    },
    "experiments": { "typedRoutes": true },
    "plugins": ["expo-router", "expo-font", "expo-splash-screen"],
    "extra": {
      "supabaseUrl": "https://YOUR_PROJECT.supabase.co",
      "supabaseAnonKey": "PUBLIC_ANON_KEY",
      "apiMode": "mock"
    }
  }
}
```

`apiMode: mock` is the kill-switch for the mock layer — flip to `live` once backend is wired.

---

## 2. Folder Structure

```
~/Projects/qook/
├── app/                           # Expo Router routes (file-based)
│   ├── _layout.tsx                # Root: fonts + providers + session guard
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx            # Custom FloatingTabBar
│   │   ├── tonight.tsx
│   │   ├── swipe-night.tsx
│   │   ├── shop.tsx
│   │   ├── saved.tsx
│   │   └── more.tsx
│   ├── (modals)/
│   │   ├── _layout.tsx
│   │   └── recipe/[id].tsx
│   └── onboarding/
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── household.tsx
│       └── avoid.tsx
├── src/
│   ├── design/                    # Pure TS tokens, no React
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   ├── shadows.ts
│   │   ├── washes.ts
│   │   └── index.ts
│   ├── components/
│   │   ├── PaperCard.tsx
│   │   ├── WashBackground.tsx
│   │   ├── BrushstrokeUnderline.tsx
│   │   ├── ScreenShell.tsx
│   │   ├── FloatingTabBar.tsx
│   │   ├── EnergyBadge.tsx
│   │   ├── EnergyPicker.tsx
│   │   ├── FoodHeroImage.tsx
│   │   ├── RingSpinner.tsx
│   │   ├── StepDots.tsx
│   │   └── ShoppingListItem.tsx
│   ├── features/                  # Screen-level compositions
│   │   ├── tonight/{TonightScreen.tsx,DinnerCard.tsx}
│   │   ├── swipe-night/{SwipeNightScreen.tsx,SwipeCard.tsx,useSwipeGesture.ts}
│   │   ├── shop/ShopScreen.tsx
│   │   ├── saved/SavedScreen.tsx
│   │   ├── more/MoreScreen.tsx
│   │   ├── eat/{EnergyPickerScreen.tsx,GenerationLoadingScreen.tsx,ReviewRecipesScreen.tsx}
│   │   └── auth/{SignInScreen.tsx,SignUpScreen.tsx}
│   ├── services/
│   │   ├── api.ts                 # Mock/live toggle
│   │   ├── supabase.ts
│   │   ├── auth.tsx
│   │   └── fixtures/{recipes.json,decks.json,groceries.json}
│   ├── stores/{session.ts,swipe.ts,toast.ts}
│   ├── hooks/{useHaptics.ts,useTonightPlan.ts,useRecipe.ts}
│   ├── lib/{blurhash.ts,energy.ts,assets.ts}
│   └── types/{recipe.ts,deck.ts,grocery.ts}
├── assets/
│   ├── icon.png
│   ├── splash.png
│   ├── paper-grain.png            # 512×512 tiling texture
│   └── meals-seed/v2/             # 24 Seedream PNGs copied from sashafood
├── scripts/bake-wobble.ts         # dev-time simplex-noise path generator
└── app.json, package.json, tsconfig.json, babel.config.js, .env
```

### Folder justifications

- **`app/`** — Expo Router owns routing. `(auth)`, `(tabs)`, `(modals)` groups for stack behavior. Files are thin wrappers re-exporting from `src/features/*`.
- **`src/design/`** — pure tokens. No React deps. Importable from scripts, tests, components.
- **`src/components/`** — reusable primitives. One per file. No screen logic.
- **`src/features/`** — screen-scoped compositions. A feature owns its screen(s), sub-components, and local hooks.
- **`src/services/`** — IO boundary. `api.ts` is the only file most of the app touches; `supabase.ts` is the concrete impl.
- **`src/stores/`** — Zustand for client UX state only. Server data goes through TanStack Query.
- **`src/hooks/`**, **`src/lib/`** — reusable React hooks / pure utilities.
- **`src/types/`** — shared TS types mirroring Supabase schema. Generated by `supabase gen types` once backend is up.
- **`assets/`** — static binaries. Seed PNGs copied at install via `cp -r`.
- **`scripts/`** — dev-time Node scripts, never imported at runtime.

---

## 3. Design Token Library

### 3.1 `src/design/colors.ts`

```ts
// Ported from KataPalette.Light (apps/swift/Qook/Theme/KataPalette.swift)
export const palette = {
  background: '#FAF5EC',          // cream paper
  surface: '#FEFBF3',             // card cream
  surfaceTranslucent: 'rgba(255, 252, 246, 0.82)',

  text: '#26241C',                // warm near-black
  textSecondary: '#5F7057',       // sage-muted
  textTertiary: 'rgba(95, 112, 87, 0.6)',

  primary: '#2A3A26',             // deep forest
  primaryMuted: '#5F7057',

  accent: '#C36A48',              // rust
  accentDeep: '#A85539',

  utility: '#3D5469',             // prussian
  utilityMuted: 'rgba(61, 84, 105, 0.6)',

  glassBorder: 'rgba(42, 58, 38, 0.08)',
  haloRing: 'rgba(195, 106, 72, 0.06)',

  shadowWarm: 'rgba(168, 85, 57, 0.10)',
  shadowCool: 'rgba(42, 58, 38, 0.10)',

  washSage: 'rgba(154, 174, 128, 0.22)',
  washRust: 'rgba(195, 106, 72, 0.14)',
  washAmber: 'rgba(226, 186, 124, 0.10)',

  destructive: '#B33939',
} as const;

export const energyTier = {
  brainIsFried: { bg: 'rgba(232, 105, 94, 0.15)', text: '#E8695E' },
  afterWork:    { bg: 'rgba(212, 149, 43, 0.15)', text: '#E8A84C' },
  gotEnergy:    { bg: 'rgba(125, 184, 127, 0.15)', text: '#7DB87F' },
  weekend:      { bg: 'rgba(94, 138, 232, 0.15)',  text: '#5E8AE8' },
} as const;

export type Palette = typeof palette;
export type EnergyTierKey = keyof typeof energyTier;
```

### 3.2 `src/design/typography.ts`

```tsx
import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { palette } from './colors';

export const fontFamily = {
  display: 'Fraunces_700Bold',
  bodyRegular: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemi: 'DMSans_600SemiBold',
  monoRegular: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const typeScale = {
  displayXL: 56, displayL: 44, displayM: 32, displayS: 22,
  bodyLG: 17, bodyMD: 15, bodySM: 13,
  monoMD: 11, monoSM: 10,
} as const;

const styles = StyleSheet.create({
  display: {
    fontFamily: fontFamily.display,
    color: palette.primary,
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  body: {
    fontFamily: fontFamily.bodyRegular,
    color: palette.text,
    includeFontPadding: false,
  },
  mono: {
    fontFamily: fontFamily.monoRegular,
    color: palette.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
});

export interface DisplayTextProps extends TextProps { size?: number; color?: string; }
export function DisplayText({ size = typeScale.displayL, color, style, ...rest }: DisplayTextProps) {
  return (
    <Text
      style={[
        styles.display,
        { fontSize: size, lineHeight: Math.round(size * 1.05) },
        color ? { color } : null,
        style,
      ]}
      {...rest}
    />
  );
}

export type BodyWeight = 'regular' | 'medium' | 'semi';
export interface BodyTextProps extends TextProps { size?: number; weight?: BodyWeight; color?: string; }
const bodyFamily: Record<BodyWeight, string> = {
  regular: fontFamily.bodyRegular,
  medium: fontFamily.bodyMedium,
  semi: fontFamily.bodySemi,
};

export function BodyText({ size = typeScale.bodyMD, weight = 'regular', color, style, ...rest }: BodyTextProps) {
  return (
    <Text
      style={[
        styles.body,
        { fontFamily: bodyFamily[weight], fontSize: size, lineHeight: Math.round(size * 1.4) },
        color ? { color } : null,
        style,
      ]}
      {...rest}
    />
  );
}

export interface MonoProps extends TextProps { size?: number; bold?: boolean; color?: string; }
export function Mono({ size = typeScale.monoSM, bold, color, style, ...rest }: MonoProps) {
  return (
    <Text
      style={[
        styles.mono,
        {
          fontFamily: bold ? fontFamily.monoBold : fontFamily.monoRegular,
          fontSize: size,
          lineHeight: Math.round(size * 1.3),
        },
        color ? { color } : null,
        style,
      ]}
      {...rest}
    />
  );
}
```

### 3.3 `src/design/spacing.ts`

```ts
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { tiny: 8, nested: 12, card: 18, sheet: 24, pill: 999 } as const;
export const screen = {
  horizontal: 16,
  top: 64,            // clears status bar + ambient header
  bottom: 112,        // clears floating tab bar + home indicator
  tabBarHeight: 56,
} as const;
```

### 3.4 `src/design/shadows.ts`

```ts
import { Platform, ViewStyle } from 'react-native';
import { palette } from './colors';

export type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

export const shadowHalo: ShadowStyle = Platform.select({
  ios: { shadowColor: palette.accentDeep, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 18 },
  android: { elevation: 6 },
  default: {},
})!;

export const shadowContact: ShadowStyle = Platform.select({
  ios: { shadowColor: palette.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
  android: { elevation: 2 },
  default: {},
})!;

export const shadowTabBar: ShadowStyle = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 12 },
  android: { elevation: 10 },
  default: {},
})!;
```

### 3.5 `src/design/washes.ts`

```ts
import { palette } from './colors';

export interface RadialWashConfig {
  color: string;
  cx: number;           // fraction of screen width
  cy: number;           // fraction of screen height
  radiusFactor: number; // fraction of max(w,h)
}

export const washConfigs: RadialWashConfig[] = [
  { color: palette.washSage,  cx: 0.18, cy: 0.08, radiusFactor: 0.55 },
  { color: palette.washRust,  cx: 0.92, cy: 0.96, radiusFactor: 0.55 },
  { color: palette.washAmber, cx: 0.60, cy: 0.50, radiusFactor: 0.45 },
];
```

### 3.6 `src/design/index.ts`

```ts
export * from './colors';
export * from './typography';
export * from './spacing';
export * from './shadows';
export * from './washes';
```

---

## 4. Design Primitives

### 4.1 `src/components/PaperCard.tsx`

```tsx
import React, { PropsWithChildren } from 'react';
import { View, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import { palette, radius, spacing } from '../design';
import { shadowHalo, shadowContact } from '../design/shadows';

export interface PaperCardProps {
  cornerRadius?: number;
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

// Cream-on-cream card with a layered warm halo shadow.
// Two stacked Views because RN only allows one shadow set per View.
// Outer owns the rust halo; inner owns the cool contact shadow + fill.
export function PaperCard({
  cornerRadius = radius.card,
  padding = spacing.md,
  style,
  children,
}: PropsWithChildren<PaperCardProps>) {
  return (
    <View style={[{ borderRadius: cornerRadius }, shadowHalo]}>
      <View style={[styles.inner, { borderRadius: cornerRadius, padding }, shadowContact, style]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
});
```

### 4.2 `src/components/WashBackground.tsx`

```tsx
import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions, Image } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { palette } from '../design';
import { washConfigs } from '../design/washes';

// Cream + three SVG radial washes + tiled PNG grain overlay.
// We use SVG RadialGradient (not expo-linear-gradient — no radial primitive).
export function WashBackground() {
  const { width, height } = useWindowDimensions();
  const size = Math.max(width, height);

  const gradients = useMemo(
    () => washConfigs.map((cfg, i) => ({
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
            <RadialGradient key={g.id} id={g.id} cx={g.cx} cy={g.cy} r={g.r}
              fx={g.cx} fy={g.cy} gradientUnits="userSpaceOnUse">
              <Stop offset="0%"   stopColor={g.color} stopOpacity="1" />
              <Stop offset="100%" stopColor={g.color} stopOpacity="0" />
            </RadialGradient>
          ))}
        </Defs>
        {gradients.map((g) => (
          <Rect key={`r-${g.id}`} x="0" y="0" width="100%" height="100%" fill={`url(#${g.id})`} />
        ))}
      </Svg>
      <Image
        source={require('../../assets/paper-grain.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="repeat"
      />
    </View>
  );
}

const styles = StyleSheet.create({ base: { backgroundColor: palette.background } });
```

### 4.3 `src/components/BrushstrokeUnderline.tsx`

```tsx
import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { palette } from '../design';

export interface BrushstrokeUnderlineProps {
  width: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  pathVariant?: 'v1' | 'v2' | 'v3';
  style?: StyleProp<ViewStyle>;
}

// Baked paths generated by scripts/bake-wobble.ts. NO runtime filter / feTurbulence.
const BAKED_PATHS: Record<'v1' | 'v2' | 'v3', string> = {
  v1: 'M2 7 C18 2 25 12 58 10 C80 8 100 13 118 5 C140 -2 150 9 158 7',
  v2: 'M2 8 C15 3 30 11 50 9 C75 7 95 12 120 6 C140 2 152 10 158 7',
  v3: 'M2 6 C20 11 35 3 55 8 C78 12 95 5 115 10 C138 13 150 6 158 8',
};

export function BrushstrokeUnderline({
  width, height = 12, color = palette.accent, strokeWidth = 2.4, pathVariant = 'v1', style,
}: BrushstrokeUnderlineProps) {
  return (
    <View style={[{ width, height }, style]} pointerEvents="none">
      <Svg width={width} height={height} viewBox="0 0 160 14" fill="none">
        <Path
          d={BAKED_PATHS[pathVariant]}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
```

### 4.4 `src/components/ScreenShell.tsx`

```tsx
import React, { PropsWithChildren } from 'react';
import { View, StyleSheet, ScrollView, ScrollViewProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WashBackground } from './WashBackground';
import { spacing, screen, palette } from '../design';

export interface ScreenShellProps {
  scrollable?: boolean;
  horizontalPadding?: number;
  scrollProps?: Partial<ScrollViewProps>;
}

export function ScreenShell({
  scrollable = true,
  horizontalPadding = screen.horizontal,
  scrollProps,
  children,
}: PropsWithChildren<ScreenShellProps>) {
  const insets = useSafeAreaInsets();
  const content = <View style={{ paddingHorizontal: horizontalPadding }}>{children}</View>;

  return (
    <View style={styles.root}>
      <WashBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {scrollable ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: spacing.lg,
              paddingBottom: screen.bottom + insets.bottom,
            }}
            {...scrollProps}
          >
            {content}
          </ScrollView>
        ) : (
          <View style={styles.fill}>{content}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  safe: { flex: 1 },
  fill: { flex: 1 },
});
```

---

## 5. Typography Loading — `app/_layout.tsx`

```tsx
import React, { useEffect } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts as useFrauncesFonts, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans';
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';
import { palette } from '../src/design';
import { SessionProvider } from '../src/services/auth';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

export default function RootLayout() {
  const [loaded, error] = useFrauncesFonts({
    Fraunces_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: palette.background },
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
              <Stack.Screen name="onboarding" />
            </Stack>
            <StatusBar style="dark" />
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

---

## 6. SVG Wobble Fallback — `scripts/bake-wobble.ts`

```ts
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

function bake(seed: number): string {
  const noise = createNoise2D(() => seededRandom(seed));

  const points: Array<[number, number]> = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    const baseX = 2 + t * (VIEWBOX_W - 4);
    const nx = noise(t * 10, seed) * X_JITTER;
    const ny = noise(t * 10 + 50, seed) * AMPLITUDE;
    points.push([baseX + nx, BASE_Y + ny]);
  }

  // catmull-rom -> cubic bezier
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

const fmt = (n: number) => Math.round(n * 100) / 100;

function seededRandom(seed: number): number {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const variants = { v1: bake(1337), v2: bake(9001), v3: bake(42) };
console.log('const BAKED_PATHS = {');
for (const [key, d] of Object.entries(variants)) console.log(`  ${key}: '${d}',`);
console.log('};');
```

Example output:

```
const BAKED_PATHS = {
  v1: 'M2.13 6.93 C11.45 4.22, 22.88 2.47, 31.2 5.76 C42.77 8.86, 51.4 11.95, 62.3 10.02 C...',
  v2: 'M2.31 7.1 C10.88 3.55, 24.1 10.87, 33.2 8.4 C42.5 5.65, 52.8 11.02, 63.4 9.83 C...',
  v3: 'M2.08 7.22 C12.6 11.4, 24.4 3.15, 35.8 6.66 C47.1 9.95, 57.2 5.11, 68.3 8.77 C...',
};
```

Keep generated output in git so designers can tweak `AMPLITUDE` / `FREQUENCY` and regenerate.

---

## 7. Asset Pipeline

### 7.1 `src/lib/assets.ts` — seed PNG map

```ts
// Static require() map for the 24 Seedream v2 meal images.
// require() must take literal strings — no dynamic concatenation.
export const seedMeals = {
  'adana-kebab':              require('../../assets/meals-seed/v2/adana-kebab.png'),
  'beef-broccoli-stirfry':    require('../../assets/meals-seed/v2/beef-broccoli-stirfry.png'),
  'black-bean-quesadilla':    require('../../assets/meals-seed/v2/black-bean-quesadilla.png'),
  'chicken-tikka':            require('../../assets/meals-seed/v2/chicken-tikka.png'),
  'egg-fried-rice':           require('../../assets/meals-seed/v2/egg-fried-rice.png'),
  'fattoush-grilled-chicken': require('../../assets/meals-seed/v2/fattoush-grilled-chicken.png'),
  'garlic-butter-spaghetti':  require('../../assets/meals-seed/v2/garlic-butter-spaghetti.png'),
  'gochujang-pork':           require('../../assets/meals-seed/v2/gochujang-pork.png'),
  'greek-chicken-bowl':       require('../../assets/meals-seed/v2/greek-chicken-bowl.png'),
  'greek-lemon-chicken-orzo': require('../../assets/meals-seed/v2/greek-lemon-chicken-orzo.png'),
  'lamb-chops-bulgur':        require('../../assets/meals-seed/v2/lamb-chops-bulgur.png'),
  'menemen-sucuk':            require('../../assets/meals-seed/v2/menemen-sucuk.png'),
  'miso-salmon':              require('../../assets/meals-seed/v2/miso-salmon.png'),
  'mushroom-risotto':         require('../../assets/meals-seed/v2/mushroom-risotto.png'),
  'peanut-noodles':           require('../../assets/meals-seed/v2/peanut-noodles.png'),
  'salmon-poke-bowl':         require('../../assets/meals-seed/v2/salmon-poke-bowl.png'),
  'shakshuka-merguez':        require('../../assets/meals-seed/v2/shakshuka-merguez.png'),
  'sheet-pan-chicken':        require('../../assets/meals-seed/v2/sheet-pan-chicken.png'),
  'shrimp-tacos':             require('../../assets/meals-seed/v2/shrimp-tacos.png'),
  'steak-eggs-bowl':          require('../../assets/meals-seed/v2/steak-eggs-bowl.png'),
  'tuna-melt':                require('../../assets/meals-seed/v2/tuna-melt.png'),
  'turkey-chili':             require('../../assets/meals-seed/v2/turkey-chili.png'),
  'turkey-meatballs':         require('../../assets/meals-seed/v2/turkey-meatballs.png'),
  'white-bean-tuna-salad':    require('../../assets/meals-seed/v2/white-bean-tuna-salad.png'),
} as const;

export type SeedMealKey = keyof typeof seedMeals;
export const defaultMealBlurhash = 'L9I|#~%L00oMxvIUxv%M_3xvxvIU';
```

### 7.2 `src/components/FoodHeroImage.tsx`

```tsx
import React from 'react';
import { Image as ExpoImage, ImageSource } from 'expo-image';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { seedMeals, SeedMealKey, defaultMealBlurhash } from '../lib/assets';
import { radius } from '../design';

export interface FoodHeroImageProps {
  localKey?: SeedMealKey;
  remoteUrl?: string;
  blurhash?: string;
  width?: number;
  height?: number;
  cornerRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function FoodHeroImage({
  localKey,
  remoteUrl,
  blurhash = defaultMealBlurhash,
  width,
  height,
  cornerRadius = radius.card,
  style,
}: FoodHeroImageProps) {
  const source: ImageSource = remoteUrl
    ? { uri: remoteUrl }
    : localKey
      ? seedMeals[localKey]
      : seedMeals['miso-salmon'];

  return (
    <ExpoImage
      source={source}
      placeholder={blurhash}
      placeholderContentFit="cover"
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
      style={[{ width, height, borderRadius: cornerRadius, overflow: 'hidden' }, style]}
    />
  );
}
```

### 7.3 Supabase Storage convention

- Bucket: `meals` (public read, service-role write).
- Path: `meals/{recipeId}.png` — deterministic.
- Backend returns `remoteUrl: string | null` on the Recipe DTO.
- Frontend precedence: `remoteUrl` > `localKey` (seed) > default.
- Backend computes blurhash on upload and stores on the row.

### 7.4 Copy seed PNGs at repo init

```bash
mkdir -p assets/meals-seed/v2
cp ~/Projects/sashafood/apps/native/assets/meals-seed/v2/*.png assets/meals-seed/v2/
```

### 7.5 Paper grain PNG

Generate one 512×512 crosshatch tile via Seedream (one-time ~$0.04):

> "Subtle cream paper texture, tileable 512x512, very fine crosshatch grain, warm off-white #FAF5EC base with imperceptible brown speckles at 3% opacity. Flat, no lighting, edge-to-edge tileable."

Save to `assets/paper-grain.png`. Used by `WashBackground` via `resizeMode="repeat"`.

---

## 8. Navigation Skeleton

### 8.1 Full route tree — see §2.

### 8.2 `app/(tabs)/_layout.tsx`

```tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '../../src/components/FloatingTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="tonight"     options={{ title: 'Tonight' }} />
      <Tabs.Screen name="swipe-night" options={{ title: 'Swipe' }} />
      <Tabs.Screen name="shop"        options={{ title: 'Shop' }} />
      <Tabs.Screen name="saved"       options={{ title: 'Saved' }} />
      <Tabs.Screen name="more"        options={{ title: 'More' }} />
    </Tabs>
  );
}
```

### 8.3 `app/(tabs)/tonight.tsx`

```tsx
import { TonightScreen } from '../../src/features/tonight/TonightScreen';
export default TonightScreen;
```

Same pattern for every other `app/(tabs)/*.tsx` and `app/(auth)/*.tsx`: one-line re-export from `src/features/*`.

### 8.4 `app/(modals)/_layout.tsx`

```tsx
import { Stack } from 'expo-router';
import { palette } from '../../src/design';

export default function ModalLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        contentStyle: { backgroundColor: palette.background },
      }}
    />
  );
}
```

### 8.5 `app/(modals)/recipe/[id].tsx`

```tsx
import { useLocalSearchParams } from 'expo-router';
import { RecipeDetailModal } from '../../../src/features/recipe/RecipeDetailModal';

export default function RecipeModalRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecipeDetailModal recipeId={id!} />;
}
```

### 8.6 Auth guard — `src/services/auth.tsx`

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { router, useSegments } from 'expo-router';
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';

interface SessionCtx { session: Session | null; loading: boolean; }
const Ctx = createContext<SessionCtx>({ session: null, loading: true });

export const useSession = () => useContext(Ctx);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) router.replace('/(auth)/sign-in');
    else if (session && inAuthGroup) router.replace('/(tabs)/tonight');
  }, [session, loading, segments]);

  return <Ctx.Provider value={{ session, loading }}>{children}</Ctx.Provider>;
}
```

---

## 9. Mock Mode for Dev — `src/services/api.ts`

```ts
import Constants from 'expo-constants';
import { supabase } from './supabase';
import recipes from './fixtures/recipes.json';
import decks from './fixtures/decks.json';
import groceries from './fixtures/groceries.json';
import type { Recipe } from '../types/recipe';
import type { Deck } from '../types/deck';
import type { GroceryItem } from '../types/grocery';

const mode = (Constants.expoConfig?.extra?.apiMode ?? 'mock') as 'mock' | 'live';
const lag = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export async function getTonightPlan(): Promise<Recipe[]> {
  if (mode === 'mock') {
    await lag();
    return (recipes as Recipe[]).slice(0, 3);
  }
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .select('recipe:recipes(*)')
    .eq('date', new Date().toISOString().slice(0, 10));
  if (error) throw error;
  return data.map((r: any) => r.recipe);
}

export async function getCurrentDeck(): Promise<Deck | null> {
  if (mode === 'mock') { await lag(); return (decks as Deck[])[0] ?? null; }
  const { data, error } = await supabase
    .from('decks')
    .select('*, recipes:deck_recipes(recipe:recipes(*))')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Deck | null;
}

export async function recordSwipe(recipeId: string, direction: 'like' | 'pass') {
  if (mode === 'mock') { await lag(80); return { ok: true }; }
  const { error } = await supabase.from('swipes').insert({ recipe_id: recipeId, direction });
  if (error) throw error;
  return { ok: true };
}

export async function getGroceries(): Promise<GroceryItem[]> {
  if (mode === 'mock') { await lag(); return groceries as GroceryItem[]; }
  const { data, error } = await supabase.from('grocery_items').select('*');
  if (error) throw error;
  return data as GroceryItem[];
}

export async function toggleGrocery(id: string, checked: boolean) {
  if (mode === 'mock') { await lag(80); return; }
  const { error } = await supabase.from('grocery_items').update({ checked }).eq('id', id);
  if (error) throw error;
}

export async function generateRecipesForEnergy(energyTier: string) {
  if (mode === 'mock') { await lag(1500); return (recipes as Recipe[]).slice(0, 6); }
  const { data, error } = await supabase.functions.invoke('generate-recipes', {
    body: { energyTier },
  });
  if (error) throw error;
  return data.recipes as Recipe[];
}

export const api = {
  getTonightPlan, getCurrentDeck, recordSwipe,
  getGroceries, toggleGrocery, generateRecipesForEnergy,
};
```

### 9.1 Fixture shape — `src/services/fixtures/recipes.json`

```json
[
  {
    "id": "rec_001",
    "title": "Miso Salmon Bowl",
    "energyTier": "afterWork",
    "totalMinutes": 25,
    "servings": 2,
    "localImageKey": "miso-salmon",
    "blurhash": "L9I|#~%L00oMxvIUxv%M_3xvxvIU",
    "ingredients": [
      { "name": "salmon fillet", "qty": "8oz" },
      { "name": "miso paste", "qty": "2 tbsp" }
    ],
    "steps": [
      "Whisk miso with mirin and soy.",
      "Brush onto salmon and broil 8 minutes.",
      "Serve over rice with pickled cucumber."
    ]
  }
]
```

### 9.2 `src/services/supabase.ts`

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const url = Constants.expoConfig?.extra?.supabaseUrl as string;
const anonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

---

## 10. Mobile UX Specifics

### 10.1 Safe areas

- `SafeAreaProvider` at root.
- `ScreenShell` uses `edges={['top']}` — bottom handled by floating tab bar padding.
- Modals rely on Expo Router `presentation: 'modal'` which auto-respects the dynamic island.

### 10.2 Keyboard handling

Wrap text-entry screens in `KeyboardAvoidingView`:

```tsx
import { KeyboardAvoidingView, Platform } from 'react-native';
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
>
  {/* form */}
</KeyboardAvoidingView>
```

Install `@react-native-community/keyboard-controller` only if per-field scroll is needed — not v1.

### 10.3 Reanimated + Gesture Handler Pan (Swipe Night card)

`src/features/swipe-night/useSwipeGesture.ts`:

```ts
import { useCallback } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';

const SNAP = { damping: 30, stiffness: 400, mass: 0.8 };
const THROW_THRESHOLD = 0.25;

export function useSwipeGesture({
  onLike, onPass,
}: { onLike: () => void; onPass: () => void }) {
  const { width } = useWindowDimensions();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  const fireHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const pan = Gesture.Pan()
    .onBegin(() => { runOnJS(fireHaptic)(); })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY * 0.5;
      rotate.value = (e.translationX / width) * 12;
    })
    .onEnd((e) => {
      const dx = e.translationX;
      const throwX = Math.abs(dx) / width;
      if (throwX > THROW_THRESHOLD || Math.abs(e.velocityX) > 800) {
        const dir = dx > 0 ? 'like' : 'pass';
        tx.value = withTiming(dir === 'like' ? width * 1.5 : -width * 1.5, { duration: 240 });
        opacity.value = withTiming(0, { duration: 240 });
        runOnJS(dir === 'like' ? onLike : onPass)();
      } else {
        tx.value = withSpring(0, SNAP);
        ty.value = withSpring(0, SNAP);
        rotate.value = withSpring(0, SNAP);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return { pan, cardStyle };
}
```

`src/features/swipe-night/SwipeCard.tsx` (excerpt):

```tsx
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSwipeGesture } from './useSwipeGesture';

export function SwipeCard({ recipe, onLike, onPass }: SwipeCardProps) {
  const { pan, cardStyle } = useSwipeGesture({ onLike, onPass });
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, cardStyle]}>
        {/* PaperCard + FoodHeroImage + content */}
      </Animated.View>
    </GestureDetector>
  );
}
```

### 10.4 Haptics wrapper — `src/hooks/useHaptics.ts`

```ts
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

export function useHaptics() {
  const tap = useCallback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), []);
  const press = useCallback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), []);
  const crossThreshold = useCallback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), []);
  const select = useCallback(() => Haptics.selectionAsync(), []);
  const success = useCallback(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), []);
  const error = useCallback(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), []);
  return { tap, press, crossThreshold, select, success, error };
}
```

Rule: every intentional tap fires `press`; toggles fire `select`; swipe decisions fire `crossThreshold`.

### 10.5 StatusBar

- Global: `<StatusBar style="dark" />` in root (dark glyphs on cream).
- Modals with full-bleed dark imagery: override to `light`.

### 10.6 Splash screen

- `expo-splash-screen` in `app.json` — cream `#FAF5EC` bg with centered mark at 25%.
- `preventAutoHideAsync()` in root layout; `hideAsync()` after fonts load.
- `assets/splash.png`: 2048×2048, cream bg + logo mark.

### 10.7 Floating tab bar — `src/components/FloatingTabBar.tsx`

```tsx
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { palette, spacing, radius, screen } from '../design';
import { shadowTabBar } from '../design/shadows';
import { Mono } from '../design/typography';
import { useHaptics } from '../hooks/useHaptics';

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { select } = useHaptics();

  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + spacing.sm }, shadowTabBar]}>
      <BlurView intensity={35} tint="light" style={styles.bar}>
        {state.routes.map((route, idx) => {
          const focused = state.index === idx;
          const { options } = descriptors[route.key];
          const label = (options.title ?? route.name) as string;
          return (
            <Pressable
              key={route.key}
              onPress={() => { select(); navigation.navigate(route.name); }}
              style={styles.tab}
            >
              <Mono size={10} bold={focused}
                color={focused ? palette.accent : palette.textSecondary}>
                {label}
              </Mono>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.lg, right: spacing.lg,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: palette.surfaceTranslucent,
  },
  bar: {
    flexDirection: 'row',
    height: screen.tabBarHeight,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

---

## 11. Week-by-Week Build Order (Apr 21 → May 24)

### Week 1 — Apr 21-27: Foundation

**Goal:** scaffolding + tokens + primitives + auth. App launches to cream bg with working fonts.

- Mon 4/21 — `create-expo-app`, git init, install deps, `app.json` config
- Tue 4/22 — Folder scaffold; write `src/design/*`
- Wed 4/23 — Write `PaperCard`, `WashBackground`, `BrushstrokeUnderline`, `ScreenShell`
- Thu 4/24 — Write `FloatingTabBar`, `FoodHeroImage`, `RingSpinner`, `StepDots`; font loading in root; run `bake-wobble.ts`
- Fri 4/25 — `supabase.ts`, `auth.tsx`, `(auth)/sign-in.tsx`, `(auth)/sign-up.tsx` — sign in E2E against Supabase
- Sat-Sun 4/26-27 — Buffer: paper-grain asset (Seedream), copy 24 seed PNGs, blurhash encoding script

**Exit criteria:** `bun run start` → simulator to `(auth)/sign-in`, sign-in works, tab bar routes to empty placeholder screens.

### Week 2 — Apr 28-May 4: Tonight + Swipe Night on mock data

**Goal:** the two anchor screens feel native. Visual fidelity locked.

- Mon 4/28 — `TonightScreen`: hero `DisplayText` + `BrushstrokeUnderline` + 3 `DinnerCard`s
- Tue 4/29 — Wire `TonightScreen` to `api.getTonightPlan` mock; stagger entrance via Reanimated `FadeInDown`
- Wed 4/30 — Write `SwipeCard` + `useSwipeGesture`; test pan math on device
- Thu 5/1 — `SwipeNightScreen` full flow: 3-card stack, like/pass → Zustand, record swipes
- Fri 5/2 — Recipe modal: `(modals)/recipe/[id].tsx` + `RecipeDetailModal` with hero + ingredients + steps
- Sat-Sun 5/3-4 — Polish: haptics on every tap, spring tuning, StatusBar, keyboard edge cases

**Exit criteria:** user can view tonight's plan, swipe through 12 mock cards, open recipe modal. Native-quality feel.

### Week 3 — May 5-11: Eat + Shop + Saved + More + Onboarding

**Goal:** feature-complete on mock, then flip to live backend.

- Mon 5/5 — Eat flow: `EnergyPickerScreen` → `GenerationLoadingScreen` → `ReviewRecipesScreen`
- Tue 5/6 — `ShopScreen`: PaperCard list + `ShoppingListItem` with toggle + strikethrough
- Wed 5/7 — `SavedScreen`: grid of saved recipes + filter chips
- Thu 5/8 — `MoreScreen`: settings rows (cuisine, avoid ingredients, household, manage account)
- Fri 5/9 — Onboarding: welcome → household → avoid; StepDots; gate tabs until `profile.onboarded`
- Sat-Sun 5/10-11 — Flip `apiMode: mock` → `live`, fix every error

**Exit criteria:** app runs E2E on real Supabase with no mock. Generation actually calls backend. Onboarding blocks tabs.

### Week 4 — May 12-18: TestFlight polish + launch assets

**Goal:** TestFlight-ready build, internal testers installed.

- Mon 5/12 — EAS Build setup: `eas.json`, `eas build --platform ios --profile preview`
- Tue 5/13 — Error boundaries per screen, crash reporting (Sentry)
- Wed 5/14 — Empty states for every list; loading skeletons; TanStack Query `networkMode: offlineFirst` on reads
- Thu 5/15 — Accessibility pass: dynamic type, VoiceOver labels, 44pt tap targets
- Fri 5/16 — App Store assets: icon (all sizes), splash, 3 screenshots per size, privacy policy URL
- Sat-Sun 5/17-18 — First EAS build → upload to TestFlight → internal testers

**Exit criteria:** internal TestFlight build on 3+ devices, no blocking crashes in 1 hour of use.

### Week 5 — May 19-24: Buffer + public submit

- Mon 5/19 — Bug triage from internal testers; fix top 5
- Tue 5/20 — Public TestFlight submission
- Wed 5/21 — App Store Connect metadata
- Thu 5/22 — Submit to App Store Review
- Fri 5/23 — Respond to reviewer questions
- Sat 5/24 — **Target ship date**; buffer for reviewer round-trip

**Exit criteria:** build live on public TestFlight link; App Store Review in queue.

---

## 12. Open Questions / Cross-Team Risks

### 12.1 Dependencies on backend

- **Wk 2 blocker:** Supabase project, `recipes` + `decks` + `swipes` + `meal_plan_entries` + `grocery_items` with RLS, `generate-recipes` Edge Function stub
- **Wk 3 blocker:** Storage bucket `meals` (public read); `blurhash` column; `profiles.onboarded` flag
- **Wk 4 blocker:** prod Supabase project; separate anon/service_role keys; rate limits
- **Risk:** If Edge Functions can't sustain generation latency (>10s), move generation to Cloudflare Worker — backend agent should flag

### 12.2 Dependencies on domain

- **Wk 2 blocker:** canonical `Recipe`, `Deck`, `GroceryItem` TS types — fixtures must match so mock→live is zero-diff
- **Wk 3 blocker:** energy tier enum values locked (`brainIsFried | afterWork | gotEnergy | weekend`) — used in UI display AND LLM prompt
- **Open:** does gen return `localImageKey` (seed fallback) or always `remoteUrl`? Affects `FoodHeroImage` precedence

### 12.3 Dependencies on AI pipeline

- **Wk 3 blocker:** Generation must honor energy → time constraints (≤15 / ≤30 / ≤45 / >45 min)
- **Risk:** Seedream gen is async (~8s). Propose: return recipe with `remoteUrl: null`, frontend falls back to `localKey` until backend updates. Needs alignment with backend agent.

### 12.4 Frontend-internal risks

- **`react-native-svg` filter gap** — resolved via baked wobble paths + tiling grain PNG. No runtime `feTurbulence`.
- **Android parity** — iOS-only for TestFlight; shadows degrade to flat elevation on Android (accepted for v1).
- **New architecture (`newArchEnabled: true`)** — Reanimated 3 + Gesture Handler 2.21 support it; older libs may not. Keep `false` as escape hatch.
- **Font loading delay** — Fraunces Bold via Google Fonts is ~200KB; splash holds until load. Acceptable.
- **Blur on Android** — `expo-blur` has known issues on some devices; tab bar falls back to solid `surfaceTranslucent`.
- **iPhone SE safe area** — no notch, no home indicator; 112pt bottom is excessive. Add conditional: `insets.bottom > 0 ? 112 : 72`.

### 12.5 Deferred for v2 (do NOT build now)

- Voice context input (UI stub only, no `AVAudioRecorder` wiring)
- Image style presets
- Card display settings toggles
- Protein selection
- Tournament bracket ranker
- Dark mode — v1 ships light tokens only

---

## 13. Developer Quickstart (paste into project README)

```bash
git clone <repo> && cd qook
bun install
cp .env.example .env
bun run scripts/bake-wobble.ts   # regenerate brushstroke paths (optional)
bun run start                    # press `i` for iOS simulator
```

Scripts in `package.json`:

```json
{
  "scripts": {
    "start": "expo start",
    "ios": "expo run:ios",
    "typecheck": "tsc --noEmit",
    "lint": "eslint 'src/**/*.{ts,tsx}' 'app/**/*.{ts,tsx}'",
    "bake-wobble": "bun run scripts/bake-wobble.ts",
    "copy-seeds": "mkdir -p assets/meals-seed/v2 && cp -r ../sashafood/apps/native/assets/meals-seed/v2/* assets/meals-seed/v2/"
  }
}
```

---

## 14. Sources and references

- Palette source: `apps/swift/Qook/Theme/KataPalette.swift` (Light struct)
- Typography source: `apps/swift/Qook/Theme/KataTypography.swift`
- Spacing source: `apps/swift/Qook/Theme/KataSpacing.swift`
- Animation source: `apps/swift/Qook/Theme/KataAnimation.swift`
- PaperCard ref: `apps/swift/Qook/Components/PaperCard.swift`
- WashBackground ref: `apps/swift/Qook/Components/WashBackground.swift`
- BrushstrokeUnderline ref: `apps/swift/Qook/Components/BrushstrokeUnderline.swift`
- ScreenShell ref: `apps/swift/Qook/Components/ScreenShell.swift`
- Design spec: `docs/design/kata-style-guide.md`
- Seed assets: `apps/native/assets/meals-seed/v2/*.png` (24)
- SVG filter limitation: react-native-svg USAGE.md — `feTurbulence` + `feDisplacementMap` not supported on native
- Expo Router v4 docs: https://docs.expo.dev/router/introduction/
- @expo-google-fonts: https://github.com/expo/google-fonts
