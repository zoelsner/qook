import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenShell } from '../../components/ScreenShell';
import { BodyText } from '../../components/Text';
import { palette, spacing } from '../../design';
import { usePrefs } from '../../stores/prefs';
import { SettingsHeader } from './SettingsHeader';
import {
  SettingsGroup,
  SettingsRow,
  Stepper,
} from './SettingsPrimitives';

export function HouseholdScreen() {
  const servings = usePrefs((s) => s.servings);
  const setServings = usePrefs((s) => s.setServings);

  return (
    <ScreenShell horizontalPadding={24}>
      <SettingsHeader
        kicker="who"
        title="Household"
        subtitle="default serving size"
        underlineWidth={190}
      />

      <SettingsGroup kicker={`default servings · ${servings}`}>
        <BodyText size={13} color={palette.textSecondary} weight="medium" style={styles.hint}>
          Recipes scale to this by default. You can change it per-recipe later.
        </BodyText>
        <View style={{ height: spacing.sm }} />
        <SettingsRow
          label="Cook for"
          subtitle="Head count per meal"
          right={
            <Stepper
              value={servings}
              min={1}
              max={6}
              onChange={setServings}
              suffix={servings === 1 ? 'person' : 'people'}
            />
          }
        />
      </SettingsGroup>

      <View style={{ height: 120 }} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hint: {
    lineHeight: 18,
  },
});
