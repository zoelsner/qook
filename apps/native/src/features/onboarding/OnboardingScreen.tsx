import React, { useRef, useState } from 'react';
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { StepDots } from '../../components/StepDots';
import { PolishedButton } from '../../components/PolishedButton';
import { ArrowRight } from 'lucide-react-native';
import { palette, spacing, typeScale, energyTier } from '../../design';
import { fontFamily } from '../../design/typography';
import { useHaptics } from '../../hooks/useHaptics';
import { StorageKeys, writeFlag } from '../../lib/storage';

const HORIZONTAL_PADDING = 32;

type SlideId = 'brand' | 'tiers' | 'flow';

interface Slide {
  id: SlideId;
  kicker: string;
  headline: string;
  underlineFocus: 'all' | 'none';
  body: string;
}

const SLIDES: Slide[] = [
  {
    id: 'brand',
    kicker: 'QOOK',
    headline: "Tonight's dinner, sorted.",
    underlineFocus: 'all',
    body: 'A calmer way to pick what to cook — tuned to the energy you actually have tonight.',
  },
  {
    id: 'tiers',
    kicker: 'HOW IT WORKS',
    headline: 'Start with your energy.',
    underlineFocus: 'all',
    body: 'Tell us how much bandwidth you have. We draft three dinners that fit that level — no more scrolling for an hour.',
  },
  {
    id: 'flow',
    kicker: 'THE LOOP',
    headline: 'Swipe · save · shop.',
    underlineFocus: 'all',
    body: 'Swipe through picks, save the ones that click, and send the grocery list straight to Instacart — one tap.',
  },
];

export function OnboardingScreen() {
  const router = useRouter();
  const { press, tap } = useHaptics();
  const { width: screenWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (next !== index) {
      tap();
      setIndex(next);
    }
  };

  const goNext = () => {
    press();
    if (isLast) {
      void finish();
      return;
    }
    const target = index + 1;
    listRef.current?.scrollToIndex({ index: target, animated: true });
    setIndex(target);
  };

  const finish = async () => {
    await writeFlag(StorageKeys.onboardingShown, true);
    router.replace('/(auth)/sign-in');
  };

  const handleSkip = () => {
    tap();
    void finish();
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            hitSlop={12}
            style={({ pressed }) => [
              styles.skip,
              pressed ? { opacity: 0.5 } : null,
            ]}
          >
            <Mono size={11} color={palette.textSecondary}>
              SKIP
            </Mono>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={SLIDES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(s) => s.id}
          onScroll={onScroll}
          scrollEventThrottle={32}
          renderItem={({ item }) => (
            <View style={{ width: screenWidth }}>
              <SlideBody slide={item} />
            </View>
          )}
        />

        <View style={styles.footer}>
          <StepDots total={SLIDES.length} current={index} />
          <View style={{ height: spacing.lg }} />
          <PolishedButton
            label={isLast ? 'Get started' : 'Next'}
            tone="forest"
            trailingIcon={<ArrowRight size={14} color={palette.surface} />}
            onPress={goNext}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

function SlideBody({ slide }: { slide: Slide }) {
  return (
    <View style={styles.slide}>
      <View style={styles.slideVisual}>
        <SlideVisual slide={slide} />
      </View>

      <Mono size={11} bold color={palette.accentDeep} style={styles.kicker}>
        {slide.kicker}
      </Mono>
      <View style={{ height: spacing.sm }} />

      <View style={styles.headlineWrap}>
        <DisplayText
          size={38}
          color={palette.primary}
          style={styles.headline}
        >
          {slide.headline}
        </DisplayText>
        {slide.underlineFocus === 'all' ? (
          <BrushstrokeUnderline
            width={240}
            strokeWidth={2.2}
            color={palette.accent}
            style={styles.underline}
          />
        ) : null}
      </View>

      <View style={{ height: spacing.lg }} />

      <BodyText
        size={typeScale.bodyMD}
        color={palette.textSecondary}
        style={styles.body}
      >
        {slide.body}
      </BodyText>
    </View>
  );
}

function SlideVisual({ slide }: { slide: Slide }) {
  switch (slide.id) {
    case 'brand':
      return <BrandVisual />;
    case 'tiers':
      return <TiersVisual />;
    case 'flow':
      return <FlowVisual />;
    default:
      return null;
  }
}

function BrandVisual() {
  return (
    <View style={styles.qMark}>
      <Image
        source={require('../../../assets/icon.png')}
        style={styles.qIcon}
        resizeMode="cover"
        accessibilityLabel="Qook"
      />
    </View>
  );
}

const TIER_ROWS: {
  key: keyof typeof energyTier;
  label: string;
  cook: string;
}[] = [
  { key: 'brainIsFried', label: 'Brain-fried', cook: '≤ 15 min' },
  { key: 'afterWork', label: 'After work', cook: '≤ 30 min' },
  { key: 'gotEnergy', label: 'Got energy', cook: '≤ 45 min' },
  { key: 'weekend', label: 'Weekend', cook: '> 45 min' },
];

function TiersVisual() {
  return (
    <View style={styles.tierCard}>
      {TIER_ROWS.map((row) => {
        const color = energyTier[row.key];
        return (
          <View key={row.key} style={styles.tierRow}>
            <View
              style={[
                styles.tierChip,
                { backgroundColor: color.bg },
              ]}
            >
              <Mono size={9} bold color={color.text}>
                {row.label.toUpperCase()}
              </Mono>
            </View>
            <BodyText
              size={13}
              weight="medium"
              color={palette.textSecondary}
              style={styles.tierCook}
            >
              {row.cook}
            </BodyText>
          </View>
        );
      })}
    </View>
  );
}

const FLOW_STEPS = [
  { kicker: '01', title: 'Swipe', body: 'See three draft dinners tuned to tonight.' },
  { kicker: '02', title: 'Save', body: 'Tap the ones that click — they land in your week.' },
  { kicker: '03', title: 'Shop', body: 'One tap sends the grocery list to Instacart.' },
];

function FlowVisual() {
  return (
    <View style={styles.flowCard}>
      {FLOW_STEPS.map((step) => (
        <View key={step.kicker} style={styles.flowRow}>
          <View style={styles.flowNumBubble}>
            <Mono size={10} bold color={palette.surface}>
              {step.kicker}
            </Mono>
          </View>
          <View style={styles.flowText}>
            <BodyText
              size={15}
              weight="semi"
              color={palette.primary}
              style={{ fontFamily: fontFamily.display, letterSpacing: -0.4 }}
            >
              {step.title}
            </BodyText>
            <BodyText size={12} color={palette.textSecondary}>
              {step.body}
            </BodyText>
          </View>
        </View>
      ))}
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  skip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  slide: {
    flex: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: spacing.md,
  },
  slideVisual: {
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  kicker: {
    letterSpacing: 2.5,
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
  body: {
    lineHeight: 22,
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: spacing.lg,
  },
  qMark: {
    width: 112,
    height: 112,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A85539',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.32,
    shadowRadius: 34,
    elevation: 10,
  },
  qIcon: {
    width: '100%',
    height: '100%',
  },
  tierCard: {
    alignSelf: 'stretch',
    marginHorizontal: 16,
    borderRadius: 22,
    padding: spacing.md,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
    gap: spacing.sm + 2,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  tierChip: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  tierCook: {
    // Fixed slot + left-align so the leading symbol (≤ / >) lines up across
    // rows. With proportional numerals "15" is narrower than "30/45" and a
    // right-aligned slot pushes its ≤ outward.
    width: 66,
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },
  flowCard: {
    alignSelf: 'stretch',
    marginHorizontal: 16,
    borderRadius: 22,
    padding: spacing.md,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
    gap: spacing.md,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  flowNumBubble: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowText: {
    flex: 1,
    gap: 2,
  },
});
