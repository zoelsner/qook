import React, { useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { EnergyTier } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { EnergyPicker } from '../../components/EnergyPicker';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { IconPill } from '../../components/painted';
import { X, ArrowRight } from 'lucide-react-native';
import { palette, spacing } from '../../design';
import { fontFamily } from '../../design/typography';
import { useHaptics } from '../../hooks/useHaptics';
import { useGenerationSession } from '../../stores/generationSession';
import { todayISO } from '../week/weekDates';
import { contextShortcuts } from './contextShortcuts';

const WEEKDAY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MAX_CHARS = 240;

export function EnergyPickerScreen() {
  const router = useRouter();
  const { press, tap } = useHaptics();
  const start = useGenerationSession((s) => s.start);
  const setContext = useGenerationSession((s) => s.setContext);
  const beginGeneration = useGenerationSession((s) => s.beginGeneration);
  const storedTier = useGenerationSession((s) => s.tier);
  const storedContext = useGenerationSession((s) => s.context);
  const sessionState = useGenerationSession((s) => s.state);
  const sessionMode = useGenerationSession((s) => s.mode);
  const shouldRestoreDraft =
    sessionMode === 'tonight' &&
    (sessionState === 'error' || sessionState === 'collecting_context');
  const [tier, setTier] = useState<EnergyTier>(
    shouldRestoreDraft && storedTier ? storedTier : 'after-work',
  );
  const [draft, setDraft] = useState(shouldRestoreDraft ? storedContext : '');
  const suggestions = useMemo(() => contextShortcuts(todayISO(), tier), [tier]);

  const handleContinue = () => {
    press();
    Keyboard.dismiss();
    start(tier);
    setContext(draft.trim());
    beginGeneration();
    router.replace('/(eat)/loading');
  };

  const handleCancel = () => {
    tap();
    Keyboard.dismiss();
    router.back();
  };

  const applySuggestion = (s: string) => {
    tap();
    setDraft(s);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenShell
        horizontalPadding={24}
        scrollProps={{ keyboardShouldPersistTaps: 'handled' }}
      >
        <View style={styles.masthead}>
          <DisplayText size={20} color={palette.ink}>qook</DisplayText>
          <IconPill onPress={handleCancel} accessibilityLabel="Cancel">
            <X size={16} color={palette.ink} strokeWidth={2.2} />
          </IconPill>
        </View>
        <View style={styles.mastheadRule} />

        <View style={{ height: spacing.md + 2 }} />
        <Mono size={10} bold color={palette.accentDeep}>
          tonight · {WEEKDAY[new Date().getDay()]}
        </Mono>
        <View style={{ height: 6 }} />
        <DisplayText size={34} color={palette.primary} style={styles.displayTitle}>
          How much <Text style={styles.titleItalic}>energy?</Text>
        </DisplayText>

        <View style={{ height: spacing.md }} />
        <BodyText size={15} color={palette.textSecondary} weight="medium">
          {"We'll deal a hand of five dinners tuned to the bandwidth you actually have tonight."}
        </BodyText>

        <View style={{ height: spacing.lg }} />

        <EnergyPicker value={tier} onChange={setTier} />

        <View style={{ height: spacing.lg }} />

        <Mono size={10} bold color={palette.accentDeep}>
          anything specific? · optional
        </Mono>
        <View style={{ height: spacing.xs + 2 }} />
        <View style={styles.inputCard}>
          <TextInput
            value={draft}
            onChangeText={(text) => setDraft(text.slice(0, MAX_CHARS))}
            placeholder="e.g. use up leftover rice, high-protein, nothing spicy…"
            placeholderTextColor={palette.textTertiary}
            multiline
            maxLength={MAX_CHARS}
            style={styles.input}
            returnKeyType="done"
            blurOnSubmit
            accessibilityLabel="Optional dinner preferences or ingredients"
          />
        </View>
        <View style={{ height: spacing.sm }} />
        <View style={styles.suggestionRow}>
          {suggestions.map((s) => (
            <Pressable
              key={s}
              onPress={() => applySuggestion(s)}
              accessibilityRole="button"
              accessibilityLabel={`Use suggestion: ${s}`}
              style={({ pressed }) => [
                styles.suggestionChip,
                pressed ? { opacity: 0.6 } : null,
              ]}
            >
              <BodyText size={13} weight="medium" color={palette.textSecondary}>
                {s}
              </BodyText>
            </Pressable>
          ))}
        </View>

        <View style={{ height: spacing.lg }} />

        <PolishedButton
          label="See dinner ideas"
          tone="forest"
          onPress={handleContinue}
          trailingIcon={<ArrowRight size={14} color={palette.surface} />}
        />
        <View style={{ height: spacing.sm + 2 }} />
        <Mono size={9} color={palette.textTertiary} style={styles.caption}>
          A HAND OF FIVE DINNER IDEAS
        </Mono>
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mastheadRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.statRuleColor,
    marginTop: spacing.sm,
  },
  displayTitle: {
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  titleItalic: {
    fontFamily: fontFamily.displayItalic,
    color: palette.accent,
  },
  inputCard: {
    borderRadius: 16,
    backgroundColor: palette.well,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 72,
  },
  input: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 15,
    lineHeight: 21,
    color: palette.text,
    minHeight: 48,
    textAlignVertical: 'top',
    padding: 0,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(42, 58, 38, 0.22)',
  },
  caption: {
    textAlign: 'center',
    letterSpacing: 1.5,
  },
});
