import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { EnergyTier } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { BodyText } from '../../components/Text';
import { palette, spacing } from '../../design';
import { usePrefs } from '../../stores/prefs';
import { SettingsHeader } from './SettingsHeader';
import {
  PillGroup,
  PillToggle,
  SegmentedControl,
  SettingsGroup,
  SettingsRow,
} from './SettingsPrimitives';

const TIER_OPTIONS: { tier: EnergyTier; label: string; minutes: string }[] = [
  { tier: 'brain-is-fried', label: 'Brain is fried', minutes: '15 min' },
  { tier: 'after-work', label: 'After work', minutes: '30 min' },
  { tier: 'got-energy', label: 'Got energy', minutes: '45 min' },
  { tier: 'weekend-project', label: 'Weekend project', minutes: '60+ min' },
];

export function GenerationScreen() {
  const defaultTier = usePrefs((s) => s.defaultTier);
  const planningStartDay = usePrefs((s) => s.planningStartDay);
  const setDefaultTier = usePrefs((s) => s.setDefaultTier);
  const setPlanningStartDay = usePrefs((s) => s.setPlanningStartDay);

  const tierLabel = defaultTier
    ? TIER_OPTIONS.find((t) => t.tier === defaultTier)?.label ?? defaultTier
    : 'Ask every time';

  return (
    <ScreenShell horizontalPadding={24}>
      <SettingsHeader
        kicker="when"
        title="Generation"
        subtitle="defaults · schedule"
        underlineWidth={210}
      />

      <SettingsGroup kicker={`default tier · ${tierLabel.toLowerCase()}`}>
        <BodyText size={13} color={palette.textSecondary} weight="medium" style={styles.hint}>
          Skip the energy picker on Tonight if you almost always pick the same
          tier. You can still change it per-day from Week.
        </BodyText>
        <View style={{ height: spacing.sm }} />
        <PillGroup>
          <PillToggle
            label="Ask every time"
            active={defaultTier === null}
            onPress={() => setDefaultTier(null)}
          />
          {TIER_OPTIONS.map(({ tier, label, minutes }) => (
            <PillToggle
              key={tier}
              label={`${label} · ${minutes}`}
              active={defaultTier === tier}
              onPress={() => setDefaultTier(tier)}
            />
          ))}
        </PillGroup>
      </SettingsGroup>

      <SettingsGroup kicker="week starts on">
        <BodyText size={13} color={palette.textSecondary} weight="medium" style={styles.hint}>
          How your Week tab lays out. Shopping prep usually lines up with the
          start of your week.
        </BodyText>
        <View style={{ height: spacing.sm }} />
        <SettingsRow
          label="First day"
          subtitle={
            planningStartDay === 'sunday'
              ? 'Sunday (US default)'
              : 'Monday (ISO week)'
          }
          right={
            <SegmentedControl
              value={planningStartDay}
              onChange={setPlanningStartDay}
              options={[
                { label: 'Sun', value: 'sunday' },
                { label: 'Mon', value: 'monday' },
              ]}
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
