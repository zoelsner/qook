import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

import { ScreenShell } from '../../components/ScreenShell';
import { BodyText, Mono } from '../../components/Text';
import { palette, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import {
  CUISINE_GROUPS,
  PROTEIN_OPTIONS,
  usePrefs,
} from '../../stores/prefs';
import { SettingsHeader } from './SettingsHeader';
import {
  PillGroup,
  PillToggle,
  SettingsGroup,
} from './SettingsPrimitives';

export function PreferencesScreen() {
  const cuisineGroups = usePrefs((s) => s.cuisineGroups);
  const proteins = usePrefs((s) => s.proteins);
  const avoidList = usePrefs((s) => s.avoidList);
  const toggleCuisineGroup = usePrefs((s) => s.toggleCuisineGroup);
  const toggleProtein = usePrefs((s) => s.toggleProtein);
  const addAvoid = usePrefs((s) => s.addAvoid);
  const removeAvoid = usePrefs((s) => s.removeAvoid);
  const { tap } = useHaptics();

  const [avoidDraft, setAvoidDraft] = useState('');

  const onSubmitAvoid = () => {
    const trimmed = avoidDraft.trim();
    if (!trimmed) return;
    tap();
    addAvoid(trimmed);
    setAvoidDraft('');
  };

  const cuisineSummary =
    cuisineGroups.length === 0
      ? 'No filters — we draft everything'
      : `${cuisineGroups.length} group${cuisineGroups.length === 1 ? '' : 's'} selected`;
  const proteinSummary =
    proteins.length === 0
      ? 'Any protein'
      : `${proteins.length} protein${proteins.length === 1 ? '' : 's'} selected`;

  return (
    <ScreenShell horizontalPadding={24}>
      <SettingsHeader
        kicker="taste"
        title="Preferences"
        subtitle="cuisines · proteins · avoid"
        underlineWidth={200}
      />

      <SettingsGroup kicker={`cuisines · ${cuisineSummary}`}>
        <BodyText size={13} color={palette.textSecondary} weight="medium" style={styles.hint}>
          Pick what you want on the menu. Leave blank to see everything.
        </BodyText>
        <View style={{ height: spacing.sm }} />
        <PillGroup>
          {CUISINE_GROUPS.map((group) => (
            <PillToggle
              key={group}
              label={group}
              active={cuisineGroups.includes(group)}
              onPress={() => toggleCuisineGroup(group)}
            />
          ))}
        </PillGroup>
      </SettingsGroup>

      <SettingsGroup kicker={`proteins · ${proteinSummary}`}>
        <BodyText size={13} color={palette.textSecondary} weight="medium" style={styles.hint}>
          Biases what we draft. Not a hard filter — if a dish is great, we still suggest it.
        </BodyText>
        <View style={{ height: spacing.sm }} />
        <PillGroup>
          {PROTEIN_OPTIONS.map((protein) => (
            <PillToggle
              key={protein}
              label={protein}
              active={proteins.includes(protein)}
              onPress={() => toggleProtein(protein)}
            />
          ))}
        </PillGroup>
      </SettingsGroup>

      <SettingsGroup
        kicker={`avoid · ${avoidList.length} item${avoidList.length === 1 ? '' : 's'}`}
      >
        <BodyText size={13} color={palette.textSecondary} weight="medium" style={styles.hint}>
          Allergens, dislikes, ingredients we should never suggest. Hard filter.
        </BodyText>
        <View style={{ height: spacing.sm }} />

        <View style={styles.avoidInputRow}>
          <TextInput
            value={avoidDraft}
            onChangeText={setAvoidDraft}
            placeholder="e.g. cilantro, shellfish"
            placeholderTextColor={palette.textTertiary}
            style={styles.avoidInput}
            returnKeyType="done"
            onSubmitEditing={onSubmitAvoid}
            autoCapitalize="none"
            accessibilityLabel="Add to avoid list"
          />
          <Pressable
            onPress={onSubmitAvoid}
            disabled={!avoidDraft.trim()}
            hitSlop={6}
            style={({ pressed }) => [
              styles.addBtn,
              !avoidDraft.trim() ? { opacity: 0.4 } : null,
              pressed ? { opacity: 0.85 } : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add"
          >
            <Mono size={10} bold color={palette.surface}>
              ADD
            </Mono>
          </Pressable>
        </View>

        {avoidList.length > 0 ? (
          <>
            <View style={{ height: spacing.sm }} />
            <View style={styles.avoidChips}>
              {avoidList.map((term) => (
                <Pressable
                  key={term}
                  onPress={() => {
                    tap();
                    removeAvoid(term);
                  }}
                  style={({ pressed }) => [
                    styles.avoidChip,
                    pressed ? { opacity: 0.85 } : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${term}`}
                >
                  <BodyText size={12} weight="semi" color={palette.accentDeep}>
                    {term}
                  </BodyText>
                  <X size={12} color={palette.accentDeep} strokeWidth={2.2} />
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </SettingsGroup>

      <View style={{ height: 120 }} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hint: {
    lineHeight: 18,
  },
  avoidInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avoidInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
    backgroundColor: palette.surface,
    color: palette.ink,
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
  },
  addBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: palette.primary,
  },
  avoidChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  avoidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.accentDeep,
  },
});
