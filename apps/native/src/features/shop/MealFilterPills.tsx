import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { Recipe } from '@qook/shared';

import { BodyText } from '../../components/Text';
import { Vignette } from '../../components/Vignette';
import { palette } from '../../design';
import type { SeedMealKey } from '../../lib/assets';

/**
 * Spotify-style meal scoping row for the Shop tab (spec
 * 2026-07-13-shop-meal-pills-design.md). Every meal feeding the list gets a
 * pill; all start ON, tapping toggles that meal's ingredients out of the
 * list. ON is calm (well fill) because it's the default state; OFF reads as
 * ghosted-out, not deleted.
 */
export function MealFilterPills({
  meals,
  excluded,
  onToggle,
  edgeBleed,
}: {
  meals: Recipe[];
  excluded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  // ScreenShell's horizontal padding, so pills can scroll off the screen edge.
  edgeBleed: number;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -edgeBleed, flexGrow: 0 }}
      contentContainerStyle={[styles.row, { paddingHorizontal: edgeBleed }]}
    >
      {meals.map((meal) => {
        const on = !excluded.has(meal.id);
        return (
          <Pressable
            key={meal.id}
            onPress={() => onToggle(meal.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${meal.title} — ${on ? 'on' : 'off'} the list`}
            style={[styles.pill, on ? styles.pillOn : styles.pillOff]}
          >
            <View style={on ? null : styles.thumbOff}>
              <Vignette
                size={22}
                localKey={meal.localImageKey as SeedMealKey | undefined}
                remoteUrl={meal.heroImageUrl}
                imageStatus={meal.imageStatus}
                title={meal.title}
              />
            </View>
            <BodyText
              size={13}
              weight="medium"
              color={on ? palette.ink : palette.textTertiary}
              numberOfLines={1}
              style={styles.pillTitle}
            >
              {meal.title}
            </BodyText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillOn: {
    backgroundColor: palette.well,
    borderColor: 'rgba(42, 58, 38, 0.14)',
  },
  pillOff: {
    backgroundColor: 'transparent',
    borderColor: palette.glassBorder,
  },
  thumbOff: {
    opacity: 0.35,
  },
  pillTitle: {
    maxWidth: 150,
  },
});
