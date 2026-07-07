import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ScreenShell } from '../../components/ScreenShell';
import { BodyText } from '../../components/Text';
import { palette, spacing } from '../../design';
import { usePrefs } from '../../stores/prefs';
import { SettingsHeader } from './SettingsHeader';
import {
  SegmentedControl,
  SettingsGroup,
  SettingsRow,
  Stepper,
} from './SettingsPrimitives';

export function HouseholdScreen() {
  const servings = usePrefs((s) => s.servings);
  const unitSystem = usePrefs((s) => s.unitSystem);
  const partnerName = usePrefs((s) => s.partnerName);
  const setServings = usePrefs((s) => s.setServings);
  const setUnitSystem = usePrefs((s) => s.setUnitSystem);
  const setPartnerName = usePrefs((s) => s.setPartnerName);

  const [nameDraft, setNameDraft] = useState(partnerName ?? '');

  const commitName = () => {
    setPartnerName(nameDraft);
  };

  return (
    <ScreenShell horizontalPadding={24}>
      <SettingsHeader
        kicker="who"
        title="Household"
        subtitle="size · units · partner"
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

      <SettingsGroup kicker="units">
        <BodyText size={13} color={palette.textSecondary} weight="medium" style={styles.hint}>
          How we show quantities in recipes and shopping lists.
        </BodyText>
        <View style={{ height: spacing.sm }} />
        <SettingsRow
          label="Unit system"
          subtitle={unitSystem === 'us' ? 'cups · oz · lb · F' : 'ml · g · kg · C'}
          right={
            <SegmentedControl
              value={unitSystem}
              onChange={setUnitSystem}
              options={[
                { label: 'US', value: 'us' },
                { label: 'Metric', value: 'metric' },
              ]}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup kicker="partner">
        <BodyText size={13} color={palette.textSecondary} weight="medium" style={styles.hint}>
          Optional. We only use this to personalize a few copy lines — nothing
          gets shared or sent.
        </BodyText>
        <View style={{ height: spacing.sm }} />
        <TextInput
          value={nameDraft}
          onChangeText={setNameDraft}
          onBlur={commitName}
          onSubmitEditing={commitName}
          placeholder="Partner's first name"
          placeholderTextColor={palette.textTertiary}
          style={styles.textInput}
          autoCapitalize="words"
          returnKeyType="done"
          accessibilityLabel="Partner name"
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
  textInput: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
    backgroundColor: palette.surface,
    color: palette.ink,
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
  },
});
