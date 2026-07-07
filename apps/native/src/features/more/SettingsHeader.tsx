import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { DisplayText, Mono } from '../../components/Text';
import { palette, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';

interface SettingsHeaderProps {
  kicker: string;
  title: string;
  subtitle?: string;
  underlineWidth?: number;
}

export function SettingsHeader({
  kicker,
  title,
  subtitle,
  underlineWidth = 160,
}: SettingsHeaderProps) {
  const router = useRouter();
  const { tap } = useHaptics();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => {
          tap();
          router.back();
        }}
        hitSlop={12}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={18} color={palette.ink} strokeWidth={2.2} />
        <Mono size={10} bold color={palette.ink}>
          BACK
        </Mono>
      </Pressable>

      <View style={{ height: spacing.sm }} />

      <View style={styles.kickerRow}>
        <Mono size={10} bold color={palette.accentDeep}>
          {kicker}
        </Mono>
        {subtitle ? (
          <>
            <View style={styles.kickerDot} />
            <Mono size={10} color={palette.textSecondary}>
              {subtitle}
            </Mono>
          </>
        ) : null}
      </View>
      <View style={styles.displayTitleWrap}>
        <DisplayText size={40} color={palette.primary} style={styles.displayTitle}>
          {title}
        </DisplayText>
        <BrushstrokeUnderline
          width={underlineWidth}
          color={palette.utility}
          strokeWidth={2.4}
          style={styles.displayUnderline}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 6,
  },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kickerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.textSecondary,
  },
  displayTitleWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  displayTitle: {
    letterSpacing: -1.2,
    lineHeight: 44,
  },
  displayUnderline: {
    position: 'absolute',
    left: -6,
    bottom: -8,
  },
});
