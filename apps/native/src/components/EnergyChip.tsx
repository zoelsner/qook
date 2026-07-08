import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { palette } from '../design';
import { DisplayText, Mono } from './Text';

export interface EnergyChipProps {
  minutes: number;
  tierWord: string;
  active: boolean;
  color: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

// Chunky pressed-shadow chip — the app's single toy (spec §1.2), energy picker
// ONLY. A colored base sits under the face; pressing sinks the face onto it.
export function EnergyChip({ minutes, tierWord, active, color, onPress, style }: EnergyChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${minutes} minutes, ${tierWord}`}
      style={[styles.wrap, style]}
    >
      {({ pressed }) => (
        <View style={[styles.base, { backgroundColor: active ? color : palette.glassBorder }]}>
          <View
            style={[
              styles.face,
              active
                ? { backgroundColor: color, borderColor: color }
                : { backgroundColor: palette.surface, borderColor: palette.glassBorder },
              { transform: [{ translateY: pressed ? 4 : 0 }] },
            ]}
          >
            <DisplayText size={30} color={active ? palette.surface : palette.ink} style={styles.number}>
              {minutes}
            </DisplayText>
            <Mono size={9} bold color={active ? palette.surface : palette.textTertiary} style={styles.word}>
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  number: { letterSpacing: -1, lineHeight: 32 },
  word: { letterSpacing: 1 },
});
