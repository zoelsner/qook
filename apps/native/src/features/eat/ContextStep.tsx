import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WashBackground } from '../../components/WashBackground';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import {
  IconClose,
  IconPill,
  IconArrowRight,
  PaintedButton,
} from '../../components/painted';
import { palette, spacing, typeScale } from '../../design';
import { fontFamily } from '../../design/typography';
import { useHaptics } from '../../hooks/useHaptics';
import { useGenerationSession } from '../../stores/generationSession';

const HORIZONTAL_PADDING = 24;
const MAX_CHARS = 240;

const SUGGESTIONS = [
  'Something easy with chicken',
  'Lean and high-protein',
  'Use up leftover rice',
  'Warm and comforting tonight',
] as const;

export function ContextStep() {
  const router = useRouter();
  const { press, tap } = useHaptics();
  const tier = useGenerationSession((s) => s.tier);
  const storedContext = useGenerationSession((s) => s.context);
  const setContext = useGenerationSession((s) => s.setContext);
  const beginGeneration = useGenerationSession((s) => s.beginGeneration);
  const [draft, setDraft] = useState(storedContext);

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
      <WashBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.content}>
              <View style={styles.topBar}>
                <IconPill onPress={handleCancel} accessibilityLabel="Cancel">
                  <IconClose />
                </IconPill>
              </View>

              <View style={{ height: spacing.md }} />

              <View style={styles.kickerRow}>
                <Mono size={10} bold color={palette.accentDeep}>
                  step 2 of 2
                </Mono>
                <View style={styles.kickerDot} />
                <Mono size={10} color={palette.textSecondary}>
                  optional · 10 seconds
                </Mono>
              </View>

              <View style={styles.headlineWrap}>
                <DisplayText
                  size={38}
                  color={palette.primary}
                  style={styles.headline}
                >
                  Anything specific?
                </DisplayText>
                <BrushstrokeUnderline
                  width={240}
                  strokeWidth={2.4}
                  color={palette.accent}
                  style={styles.underline}
                />
              </View>

              <View style={{ height: spacing.md }} />
              <BodyText
                size={typeScale.bodyMD}
                color={palette.textSecondary}
                weight="medium"
              >
                Tell us what you&rsquo;re in the mood for, what&rsquo;s already
                in the fridge, or nothing at all. We&rsquo;ll tune the drafts.
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
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => applySuggestion(s)}
                    style={({ pressed }) => [
                      styles.suggestionChip,
                      pressed ? { opacity: 0.6 } : null,
                    ]}
                  >
                    <BodyText
                      size={12}
                      weight="medium"
                      color={palette.textSecondary}
                    >
                      {s}
                    </BodyText>
                  </Pressable>
                ))}
              </View>

              <View style={styles.flexSpacer} />

              <PaintedButton
                label={trimmed.length > 0 ? 'Draft with this' : 'Draft three recipes'}
                size="lg"
                tone="forest"
                onPress={handleDraft}
                trailingIcon={<IconArrowRight size={14} color={palette.surface} />}
                fullWidth
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
                  Skip — just surprise me
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingTop: spacing.sm,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.xs + 2,
  },
  kickerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.textSecondary,
  },
  headlineWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  headline: {
    letterSpacing: -1.2,
    lineHeight: 42,
  },
  underline: {
    position: 'absolute',
    left: -4,
    bottom: -8,
  },
  inputCard: {
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    minHeight: 140,
  },
  input: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
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
    backgroundColor: palette.surfaceTranslucent,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
  flexSpacer: {
    flex: 1,
    minHeight: spacing.lg,
  },
  skipRow: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
