import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { palette } from '../design';
import { DisplayText, Mono } from './Text';

export interface EnergyChipProps {
  minutes: number | string;
  tierWord: string;
  active: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

// Chunky pressed-shadow chip — the app's single toy (spec §1.2), energy picker
// ONLY. Menu mockup §04: inactive chips sit directly on cream with a forest
// border; the selected chip is rust with a darker-rust base underneath.
// Pressing sinks the face onto the base.
const BASE_SHADOW = '#9C4F31';

export function EnergyChip({ minutes, tierWord, active, onPress, style }: EnergyChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${minutes} minutes, ${tierWord}`}
      style={[styles.wrap, style]}
    >
      {({ pressed }) => (
        <View style={[styles.base, { backgroundColor: active ? BASE_SHADOW : 'transparent' }]}>
          <View
            style={[
              styles.face,
              active
                ? { backgroundColor: palette.accentDeep, borderColor: palette.accentDeep }
                : { backgroundColor: palette.background, borderColor: 'rgba(42, 58, 38, 0.30)' },
              { transform: [{ translateY: pressed ? 4 : 0 }] },
            ]}
          >
            <DisplayText size={30} color={active ? palette.background : palette.primary} style={styles.number}>
              {minutes}
            </DisplayText>
            <Mono size={9} bold color={active ? palette.background : palette.textSecondary} style={styles.word}>
              {tierWord}
            </Mono>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  base: { borderRadius: 18, paddingBottom: 4 },
  face: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1.6,
  },
  number: { letterSpacing: -1, lineHeight: 32 },
  word: { letterSpacing: 1 },
});
