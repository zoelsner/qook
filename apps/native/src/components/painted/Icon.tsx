import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { palette } from '../../design';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// Close / X — stroke outline (hero nav)
export function IconClose({ size = 16, color = palette.ink, strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6L6 18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Bookmark — outline (hero nav Save)
export function IconBookmark({
  size = 16,
  color = palette.ink,
  strokeWidth = 1.8,
  filled,
}: IconProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 4h10v16l-5-3-5 3V4Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={filled ? color : 'none'}
      />
    </Svg>
  );
}

// Share / upload
export function IconShare({ size = 16, color = palette.ink, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v12M7 8l5-5 5 5M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// Heart — filled for "save" state in cook dock
export function IconHeart({
  size = 20,
  color = palette.accent,
  strokeColor,
  strokeWidth = 1.5,
  filled,
}: IconProps & { strokeColor?: string; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s-7-4.5-9-9.5C1 7 4 4 7.5 4c2 0 3.5 1 4.5 2.5C13 5 14.5 4 16.5 4 20 4 23 7 21 11.5c-2 5-9 9.5-9 9.5Z"
        fill={filled ? color : 'none'}
        stroke={strokeColor ?? color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Hand-drawn heart from Paper Study 5 (intentionally wobblier than IconHeart)
export function IconPaintedHeart({
  size = 28,
  color = palette.accent,
  strokeColor = palette.accentDeep,
  strokeWidth = 1.2,
}: IconProps & { strokeColor?: string }) {
  return (
    <Svg width={size} height={(size / 30) * 28} viewBox="0 0 30 28" fill="none">
      <Path
        d="M 15 25 C 11 22, 6 18, 4 14 C 2 10, 4 5, 8 4 C 11 4, 13 6, 15 8 C 16 6, 19 4, 22 5 C 26 5, 28 10, 26 14 C 24 18, 19 22, 15 25 Z"
        fill={color}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Refresh / rotating arrow
export function IconRefresh({ size = 18, color = palette.primary, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12a9 9 0 0 1 15.5-6.3L21 3v6h-6l2.5-2.5A7 7 0 1 0 19 12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// Arrow right — inline with button labels
export function IconArrowRight({
  size = 12,
  color = palette.surface,
  strokeWidth = 1.5,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path
        d="M3 6h6M6 3l3 3-3 3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Cooking-pot steam glyph — leads the big "Cook tonight" CTA
export function IconCookingSteam({
  size = 18,
  color = palette.surface,
  strokeWidth = 1.6,
}: IconProps) {
  return (
    <Svg width={size} height={(size / 16) * 12} viewBox="0 0 16 12" fill="none">
      <Path
        d="M3 6 C 6 5, 9 6.5, 12 6 M 10 3 C 11.2 4, 12.2 5, 13 6 C 12.2 7, 11.2 8, 10 9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

// Tonight tab drop — filled rust droplet
export function IconTabTonight({ size = 22, color = palette.accent }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3c-.5 4-4 5-4 9a4 4 0 1 0 8 0c0-4-3.5-5-4-9Z"
        fill={color}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Swipe tab — card with two horizontal lines
export function IconTabSwipe({ size = 22, color = palette.textSecondary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={5}
        y={6}
        width={14}
        height={12}
        rx={2.5}
        stroke={color}
        strokeWidth={1.6}
        fill="none"
      />
      <Path
        d="M9 10h6M9 13h4"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Shop tab — tote bag
export function IconTabShop({ size = 22, color = palette.textSecondary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 7h14l-1.5 10.5a2 2 0 0 1-2 1.5h-7a2 2 0 0 1-2-1.5L5 7Z"
        stroke={color}
        strokeWidth={1.6}
        fill="none"
      />
      <Path
        d="M9 7V5a3 3 0 0 1 6 0v2"
        stroke={color}
        strokeWidth={1.6}
        fill="none"
      />
    </Svg>
  );
}

// Saved tab — bookmark outline
export function IconTabSaved({ size = 22, color = palette.textSecondary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 4h10v16l-5-3-5 3V4Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// More tab — three dots
export function IconTabMore({ size = 22, color = palette.textSecondary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={6} cy={12} r={1.6} fill={color} />
      <Circle cx={12} cy={12} r={1.6} fill={color} />
      <Circle cx={18} cy={12} r={1.6} fill={color} />
    </Svg>
  );
}
