import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { StepDots } from '../../components/StepDots';
import { PolishedButton } from '../../components/PolishedButton';
import { ScreenShell } from '../../components/ScreenShell';
import { EnergyChip } from '../../components/EnergyChip';
import { Vignette } from '../../components/Vignette';
import { ArrowRight } from 'lucide-react-native';
import { palette, spacing, typeScale } from '../../design';
import { fontFamily } from '../../design/typography';
import { useHaptics } from '../../hooks/useHaptics';
import { StorageKeys, writeFlag } from '../../lib/storage';
import type { SeedMealKey } from '../../lib/assets';
import { usePrefs } from '../../stores/prefs';

// Concrete choices over abstract questions: picking a few real dishes yields
// many preference signals in seconds. Every step is skippable.
type Step = 0 | 1 | 2;

interface SeedDish {
  key: SeedMealKey;
  title: string;
  name: string;
  tagLine: string;
  cuisineGroups: string[];
  proteins: string[];
}

// 8 dishes spanning the fixture set's cuisines + proteins (see
// services/fixtures/recipes.ts). cuisineGroups values match
// stores/prefs.ts CUISINE_GROUPS; proteins match PROTEIN_OPTIONS.
const SEED_DISHES: SeedDish[] = [
  {
    key: 'miso-salmon',
    title: 'Miso Salmon Bowl',
    name: 'Miso salmon bowl',
    tagLine: 'japanese · fish',
    cuisineGroups: ['Asian'],
    proteins: ['Fish'],
  },
  {
    key: 'beef-broccoli-stirfry',
    title: 'Beef and Broccoli Stir-Fry',
    name: 'Beef & broccoli stir-fry',
    tagLine: 'chinese · wok',
    cuisineGroups: ['Asian'],
    proteins: ['Beef'],
  },
  {
    key: 'turkey-meatballs',
    title: 'Turkey Meatballs with Marinara',
    name: 'Turkey meatballs',
    tagLine: 'italian-american · pasta',
    cuisineGroups: ['European'],
    proteins: ['Turkey'],
  },
  {
    key: 'shrimp-tacos',
    title: 'Chili-Lime Shrimp Tacos',
    name: 'Chili-lime shrimp tacos',
    tagLine: 'mexican · tacos',
    cuisineGroups: ['Latin & Mexican'],
    proteins: ['Shrimp'],
  },
  {
    key: 'chicken-tikka',
    title: 'Chicken Tikka',
    name: 'Chicken tikka',
    tagLine: 'indian · grill',
    cuisineGroups: ['Asian'],
    proteins: ['Chicken'],
  },
  {
    key: 'fattoush-grilled-chicken',
    title: 'Fattoush with Grilled Chicken',
    name: 'Grilled chicken fattoush',
    tagLine: 'lebanese · salad',
    cuisineGroups: ['Mediterranean & Middle Eastern'],
    proteins: ['Chicken'],
  },
  {
    key: 'turkey-chili',
    title: 'Weeknight Turkey Chili',
    name: 'Weeknight turkey chili',
    tagLine: 'american · comfort',
    cuisineGroups: ['American & Regional'],
    proteins: ['Turkey'],
  },
  {
    key: 'black-bean-quesadilla',
    title: 'Black Bean Quesadilla',
    name: 'Black bean quesadilla',
    tagLine: 'mexican · veggie',
    cuisineGroups: ['Latin & Mexican'],
    proteins: ['Beans'],
  },
];

const SERVINGS_OPTIONS: { value: number; word: string }[] = [
  { value: 1, word: 'JUST ME' },
  { value: 2, word: 'US TWO' },
  { value: 4, word: 'FAMILY' },
  { value: 6, word: 'CROWD' },
];

const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-free',
  'Dairy-free',
  'No pork',
  'No shellfish',
] as const;

export function OnboardingScreen() {
  const router = useRouter();
  const { press, tap, select } = useHaptics();
  const [step, setStep] = useState<Step>(0);

  const [selectedDishKeys, setSelectedDishKeys] = useState<SeedMealKey[]>([]);
  const [selectedServings, setSelectedServings] = useState<number | null>(null);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);

  const cuisineGroups = usePrefs((s) => s.cuisineGroups);
  const proteins = usePrefs((s) => s.proteins);
  const toggleCuisineGroup = usePrefs((s) => s.toggleCuisineGroup);
  const toggleProtein = usePrefs((s) => s.toggleProtein);
  const setServings = usePrefs((s) => s.setServings);
  const addAvoid = usePrefs((s) => s.addAvoid);

  const finish = async () => {
    await writeFlag(StorageKeys.onboardingShown, true);
    router.replace('/(auth)/sign-in');
  };

  const handleSkipAll = () => {
    tap();
    void finish();
  };

  const handleWelcomeNext = () => {
    press();
    setStep(1);
  };

  const toggleDish = (key: SeedMealKey) => {
    select();
    setSelectedDishKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const applyTastePrefs = () => {
    const chosen = SEED_DISHES.filter((d) => selectedDishKeys.includes(d.key));
    const cuisineGroupsToAdd = Array.from(
      new Set(chosen.flatMap((d) => d.cuisineGroups))
    ).filter((g) => !cuisineGroups.includes(g));
    const proteinsToAdd = Array.from(
      new Set(chosen.flatMap((d) => d.proteins))
    ).filter((p) => !proteins.includes(p));
    cuisineGroupsToAdd.forEach(toggleCuisineGroup);
    proteinsToAdd.forEach(toggleProtein);
  };

  const handleTasteContinue = () => {
    press();
    applyTastePrefs();
    setStep(2);
  };

  const handleTasteSkip = () => {
    tap();
    setStep(2);
  };

  const toggleDietary = (label: string) => {
    select();
    setSelectedDietary((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const handleHouseholdFinish = () => {
    press();
    if (selectedServings != null) setServings(selectedServings);
    selectedDietary.forEach(addAvoid);
    void finish();
  };

  return (
    <ScreenShell horizontalPadding={32}>
      <Masthead onSkip={handleSkipAll} />
      <View style={{ height: spacing.md }} />
      <StepDots total={3} current={step} />
      <View style={{ height: spacing.lg }} />

      {step === 0 ? (
        <WelcomeStep onNext={handleWelcomeNext} />
      ) : step === 1 ? (
        <TasteStep
          selectedKeys={selectedDishKeys}
          onToggle={toggleDish}
          onContinue={handleTasteContinue}
          onSkip={handleTasteSkip}
        />
      ) : (
        <HouseholdStep
          selectedServings={selectedServings}
          onSelectServings={(v) => {
            select();
            setSelectedServings(v);
          }}
          selectedDietary={selectedDietary}
          onToggleDietary={toggleDietary}
          onFinish={handleHouseholdFinish}
        />
      )}
    </ScreenShell>
  );
}

function Masthead({ onSkip }: { onSkip: () => void }) {
  return (
    <View>
      <View style={styles.masthead}>
        <DisplayText size={20} color={palette.ink}>
          qook
        </DisplayText>
        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          hitSlop={12}
          style={({ pressed }) => [pressed ? { opacity: 0.5 } : null]}
        >
          <Mono size={11} color={palette.textSecondary}>
            SKIP
          </Mono>
        </Pressable>
      </View>
      <View style={styles.mastheadRule} />
    </View>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <View>
      <View style={styles.headlineWrap}>
        <DisplayText size={38} color={palette.primary} style={styles.headline}>
          Tonight&rsquo;s dinner, <Text style={styles.titleItalic}>sorted.</Text>
        </DisplayText>
        <BrushstrokeUnderline
          width={210}
          strokeWidth={2.2}
          color={palette.accent}
          style={styles.underline}
        />
      </View>

      <View style={{ height: spacing.lg + 4 }} />

      <BodyText size={typeScale.bodyLG} color={palette.textSecondary} style={styles.body}>
        A calmer way to pick what to cook — tuned to your taste, not just tonight&rsquo;s
        energy.
      </BodyText>

      <View style={{ height: spacing.xxl }} />

      <PolishedButton
        label="Set the table"
        tone="forest"
        trailingIcon={<ArrowRight size={14} color={palette.surface} />}
        onPress={onNext}
      />
    </View>
  );
}

function TasteStep({
  selectedKeys,
  onToggle,
  onContinue,
  onSkip,
}: {
  selectedKeys: SeedMealKey[];
  onToggle: (key: SeedMealKey) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <View>
      <Mono size={10} bold color={palette.accentDeep}>
        your taste
      </Mono>
      <View style={{ height: 6 }} />
      <DisplayText size={34} color={palette.primary} style={styles.headline}>
        What looks like <Text style={styles.titleItalic}>dinner?</Text>
      </DisplayText>

      <View style={{ height: spacing.md }} />
      <BodyText size={typeScale.bodyLG} color={palette.textSecondary} weight="medium">
        Tap the three that look like your table. This tunes every draft.
      </BodyText>

      <View style={{ height: spacing.lg }} />

      <View style={styles.grid}>
        {SEED_DISHES.map((dish) => {
          const selected = selectedKeys.includes(dish.key);
          return (
            <Pressable
              key={dish.key}
              onPress={() => onToggle(dish.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${dish.title}${selected ? ', selected' : ''}`}
              style={[styles.tile, selected ? styles.tileSelected : null]}
            >
              <View style={styles.tileVignetteWrap}>
                <Vignette size={104} localKey={dish.key} title={dish.title} />
                {selected ? <View style={styles.tileDot} /> : null}
              </View>
              <View style={{ height: spacing.xs + 2 }} />
              <BodyText
                size={15}
                weight="semi"
                color={palette.ink}
                numberOfLines={1}
                style={styles.tileName}
              >
                {dish.name}
              </BodyText>
              <Mono size={10} color={palette.textSecondary}>
                {dish.tagLine}
              </Mono>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: spacing.lg }} />

      {selectedKeys.length > 0 ? (
        <>
          <PolishedButton
            label="Continue"
            tone="forest"
            trailingIcon={<ArrowRight size={14} color={palette.surface} />}
            onPress={onContinue}
          />
          <View style={{ height: spacing.sm + 2 }} />
        </>
      ) : null}

      <Pressable
        onPress={onSkip}
        accessibilityRole="button"
        accessibilityLabel="Skip taste picks"
        hitSlop={12}
        style={({ pressed }) => [styles.skipRow, pressed ? { opacity: 0.5 } : null]}
      >
        <BodyText size={13} weight="medium" color={palette.textTertiary}>
          Skip — I eat everything
        </BodyText>
      </Pressable>
    </View>
  );
}

function HouseholdStep({
  selectedServings,
  onSelectServings,
  selectedDietary,
  onToggleDietary,
  onFinish,
}: {
  selectedServings: number | null;
  onSelectServings: (value: number) => void;
  selectedDietary: string[];
  onToggleDietary: (label: string) => void;
  onFinish: () => void;
}) {
  return (
    <View>
      <Mono size={10} bold color={palette.accentDeep}>
        your table
      </Mono>
      <View style={{ height: 6 }} />
      <DisplayText size={34} color={palette.primary} style={styles.headline}>
        How many <Text style={styles.titleItalic}>plates?</Text>
      </DisplayText>

      <View style={{ height: spacing.xl }} />

      <View style={styles.servingsRow}>
        {SERVINGS_OPTIONS.map((opt) => (
          <EnergyChip
            key={opt.value}
            minutes={opt.value}
            tierWord={opt.word}
            active={selectedServings === opt.value}
            onPress={() => onSelectServings(opt.value)}
          />
        ))}
      </View>

      <View style={{ height: spacing.xl }} />

      <Mono size={10} bold color={palette.accentDeep}>
        anything to avoid
      </Mono>
      <View style={{ height: spacing.sm }} />
      <View style={styles.suggestionRow}>
        {DIETARY_OPTIONS.map((label) => {
          const active = selectedDietary.includes(label);
          return (
            <Pressable
              key={label}
              onPress={() => onToggleDietary(label)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.suggestionChip,
                active ? styles.suggestionChipActive : null,
                pressed ? { opacity: 0.6 } : null,
              ]}
            >
              <BodyText
                size={12}
                weight="medium"
                color={active ? palette.ink : palette.textSecondary}
              >
                {label}
              </BodyText>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: spacing.xl }} />

      <PolishedButton
        label="Set my menu"
        tone="forest"
        trailingIcon={<ArrowRight size={14} color={palette.surface} />}
        onPress={onFinish}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  headlineWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  headline: {
    letterSpacing: -0.8,
    lineHeight: 42,
  },
  titleItalic: {
    fontFamily: fontFamily.displayItalic,
    color: palette.accent,
  },
  underline: {
    position: 'absolute',
    left: -4,
    bottom: -8,
  },
  body: {
    lineHeight: 22,
    maxWidth: 320,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 18,
    marginBottom: spacing.md,
  },
  tileSelected: {
    backgroundColor: palette.well,
  },
  tileVignetteWrap: {
    position: 'relative',
  },
  tileDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.accentDeep,
  },
  tileName: {
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  skipRow: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  servingsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  suggestionChipActive: {
    backgroundColor: palette.well,
    borderColor: 'transparent',
  },
});
