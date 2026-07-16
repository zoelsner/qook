import React, { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { IconPill } from '../../components/painted';
import { X, ArrowRight } from 'lucide-react-native';
import { palette, spacing, typeScale } from '../../design';
import { fontFamily } from '../../design/typography';
import { useHaptics } from '../../hooks/useHaptics';
import { useGenerationSession } from '../../stores/generationSession';
import { todayISO } from '../week/weekDates';
import { contextShortcuts } from './contextShortcuts';

const HORIZONTAL_PADDING = 24;
const MAX_CHARS = 240;

export function ContextStep() {
  const router = useRouter();
  const { press, tap } = useHaptics();
  const tier = useGenerationSession((s) => s.tier);
  const mode = useGenerationSession((s) => s.mode);
  const storedContext = useGenerationSession((s) => s.context);
  const setContext = useGenerationSession((s) => s.setContext);
  const beginGeneration = useGenerationSession((s) => s.beginGeneration);
  const [draft, setDraft] = useState(storedContext);
  const suggestions = useMemo(() => contextShortcuts(todayISO(), tier), [tier]);

  useEffect(() => {
    if (!tier) router.replace('/(eat)/energy');
  }, [tier, router]);

  const proceed = (payload: string) => {
    setContext(payload);
    beginGeneration();
    router.replace('/(eat)/loading');
  };

  const handleDraft = () => {
    press();
    Keyboard.dismiss();
    proceed(draft.trim());
  };

  const handleSkip = () => {
    tap();
    Keyboard.dismiss();
    proceed('');
  };

  const handleCancel = () => {
    tap();
    router.back();
  };

  const applySuggestion = (s: string) => {
    tap();
    setDraft(s);
  };

  const trimmed = draft.trim();
  const remaining = MAX_CHARS - draft.length;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.content}>
              <View style={styles.masthead}>
                <DisplayText size={20} color={palette.ink}>qook</DisplayText>
                <IconPill onPress={handleCancel} accessibilityLabel="Cancel">
                  <X size={16} color={palette.ink} strokeWidth={2.2} />
                </IconPill>
              </View>
              <View style={styles.mastheadRule} />

              <View style={{ height: spacing.md + 2 }} />

              <Mono size={10} bold color={palette.accentDeep}>
                {mode === 'week' ? 'weekly reset · optional' : 'step 2 of 2 · optional'}
              </Mono>
              <View style={{ height: 6 }} />
              <DisplayText
                size={34}
                color={palette.primary}
                style={styles.headline}
              >
                {mode === 'week' ? (
                  <>
                    How&rsquo;s your <RNText style={styles.titleItalic}>week?</RNText>
                  </>
                ) : (
                  <>
                    Anything <RNText style={styles.titleItalic}>specific?</RNText>
                  </>
                )}
              </DisplayText>

              <View style={{ height: spacing.md }} />
              <BodyText
                size={typeScale.bodyLG}
                color={palette.textSecondary}
                weight="medium"
              >
                {mode === 'week'
                  ? 'Tired nights, busy stretches, anything you’re craving — tell us and we’ll steer the hand. Or skip it.'
                  : 'Tell us what you’re in the mood for, what’s already in the fridge, or nothing at all. We’ll tune the drafts.'}
              </BodyText>

              <View style={{ height: spacing.lg }} />

              <View style={styles.inputCard}>
                <TextInput
                  value={draft}
                  onChangeText={(text) =>
                    setDraft(text.slice(0, MAX_CHARS))
                  }
                  placeholder="e.g. use up leftover rice, high-protein, nothing spicy…"
                  placeholderTextColor={palette.textTertiary}
                  multiline
                  maxLength={MAX_CHARS}
                  style={styles.input}
                  returnKeyType="done"
                  blurOnSubmit
                />
                <View style={styles.inputMeta}>
                  <Mono size={9} color={palette.textTertiary}>
                    {remaining} chars left
                  </Mono>
                </View>
              </View>

              <View style={{ height: spacing.md }} />

              <View style={styles.suggestionRow}>
                {suggestions.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => applySuggestion(s)}
                    style={({ pressed }) => [
                      styles.suggestionChip,
                      pressed ? { opacity: 0.6 } : null,
                    ]}
                  >
                    <BodyText
                      size={13}
                      weight="medium"
                      color={palette.textSecondary}
                    >
                      {s}
                    </BodyText>
                  </Pressable>
                ))}
              </View>

              <View style={styles.flexSpacer} />

              <PolishedButton
                label={
                  mode === 'week'
                    ? trimmed.length > 0
                      ? 'Use this, plan my week'
                      : 'Plan my week'
                    : trimmed.length > 0
                      ? 'Use this, find dinner'
                      : "Find tonight's dinner"
                }
                tone="forest"
                onPress={handleDraft}
                trailingIcon={<ArrowRight size={14} color={palette.surface} />}
              />

              <View style={{ height: spacing.sm + 2 }} />

              <Pressable
                onPress={handleSkip}
                accessibilityRole="button"
                accessibilityLabel="Skip context"
                hitSlop={12}
                style={({ pressed }) => [
                  styles.skipRow,
                  pressed ? { opacity: 0.5 } : null,
                ]}
              >
                <BodyText
                  size={13}
                  weight="medium"
                  color={palette.textTertiary}
                >
                  Skip — surprise me
                </BodyText>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Matches SHELL_TOP_PAD (ScreenShell) so this screen's masthead sits at
    // the same height as the tabs'.
    paddingTop: 12,
  },
  mastheadRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.statRuleColor,
    marginTop: spacing.sm,
  },
  headline: {
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  titleItalic: {
    fontFamily: fontFamily.displayItalic,
    color: palette.accent,
  },
  // The well is the one "alive" surface — the input sits in it, no border.
  inputCard: {
    borderRadius: 18,
    backgroundColor: palette.well,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    minHeight: 140,
  },
  input: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 16,
    lineHeight: 23,
    color: palette.text,
    minHeight: 96,
    textAlignVertical: 'top',
    padding: 0,
  },
  inputMeta: {
    alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(42, 58, 38, 0.22)',
  },
  // Grows to absorb keyboard-avoiding shifts but caps so the CTA sits just
  // below the chips instead of pinned to the bottom of a tall screen.
  flexSpacer: {
    flex: 1,
    minHeight: spacing.lg,
    maxHeight: 96,
  },
  // Same pill outline as the suggestion chips so skip reads as tappable
  // (Zach 2026-07-13: "put a little oval around it").
  skipRow: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md + 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(42, 58, 38, 0.22)',
  },
});
