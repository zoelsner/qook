import React from 'react';
import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { palette } from '../design';
import { BodyText, Mono } from './Text';

export interface MenuRowProps {
  label: string;
  value: string;
  labelColor?: string;
  valueColor?: string;
  style?: StyleProp<ViewStyle>;
}

// Dot-leader row (spec §1.2): label · dotted leader · mono value. 15px body
// label, mono value. The dotted leader fills the gap and hangs on the baseline.
export function MenuRow({
  label,
  value,
  labelColor = palette.ink,
  valueColor = palette.textSecondary,
  style,
}: MenuRowProps) {
  return (
    <View style={[styles.row, style]}>
      <BodyText size={15} weight="medium" color={labelColor} numberOfLines={1} style={styles.label}>
        {label}
      </BodyText>
      <View style={styles.leader} />
      <Mono size={13} color={valueColor} style={styles.value}>
        {value}
      </Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 7,
  },
  label: {
    flexShrink: 1,
  },
  leader: {
    flex: 1,
    marginHorizontal: 8,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderStyle: 'dotted',
    borderColor: palette.statRuleColor,
  },
  value: {
    flexShrink: 0,
    letterSpacing: 0.4,
  },
});
