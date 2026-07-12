import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Recipe } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { Vignette } from '../../components/Vignette';
import { MenuRow } from '../../components/MenuRow';
import { ProteinChip } from '../../components/ProteinChip';
import { BodyText, DisplayText, Mono, ItalicText } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { ArrowRight, ChevronRight } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { palette, spacing, fontFamily } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { useRecipeArt } from '../../hooks/useRecipeArt';
import { hasRequestedRecipeArt, isRecipeArtMissing } from '../../hooks/recipeArtState';
import { api } from '../../services/api';
import {
  useWeekPlan,
  activePickFor,
  recentSelectedDays,
  type DayPlan,
} from '../../stores/weekPlan';
import {
  todayISO,
  upcomingDays,
  formatDayShort,
  type ISODate,
} from '../week/weekDates';
import type { SeedMealKey } from '../../lib/assets';

export function TonightScreen() {
  const router = useRouter();
  const { press, select } = useHaptics();
  const plan = useWeekPlan((s) => s.plan);
  const hasHydrated = useWeekPlan((s) => s.hasHydrated);
  const setPickIndex = useWeekPlan((s) => s.setPickIndex);

  const today = todayISO();
  const todayPlan = plan[today];
  const todayPick = activePickFor(todayPlan);
  const upcoming = upcomingDays(4, today).slice(1); // next 3 days after today
  const recent = recentSelectedDays(plan, today, 5);

  const onFindDinner = () => {
    press();
    router.push('/(eat)/energy');
  };

  const onOpenRecipe = (recipeId: string) => {
    press();
    router.push({ pathname: '/(modals)/recipe/[id]', params: { id: recipeId } });
  };

  const onSpotlight = (idx: number) => {
    select();
    setPickIndex(today, idx);
  };

  const onOpenWeek = () => {
    press();
    router.push('/(tabs)/week');
  };

  // Don't render anything state-dependent until AsyncStorage hydration completes
  // to avoid an empty-state flash on cold launch when a pick already exists.
  if (!hasHydrated) {
    return <ScreenShell horizontalPadding={24} />;
  }

  const pickIndex = todayPlan?.pickIndex ?? 0;
  const recipes = todayPlan?.recipes ?? [];
  const morePicks = recipes
    .map((r, i) => ({ recipe: r, idx: i }))
    .filter(({ idx }) => idx !== pickIndex);

  return (
    <ScreenShell horizontalPadding={24}>
      <TonightHeader
        hasPick={Boolean(todayPick)}
        pickIndex={pickIndex}
        totalPicks={recipes.length}
      />

      {todayPick ? (
        <HeroPopulated
          pick={todayPick}
          onOpen={() => onOpenRecipe(todayPick.id)}
        />
      ) : (
        <HeroEmpty onFind={onFindDinner} />
      )}

      {morePicks.length > 0 ? (
        <MorePicks
          picks={morePicks}
          onSpotlight={onSpotlight}
          onOpenRecipe={onOpenRecipe}
        />
      ) : null}

      <UpcomingStrip
        days={upcoming}
        plan={plan}
        onOpenRecipe={onOpenRecipe}
        onOpenWeek={onOpenWeek}
      />

      <RecentCooks days={recent} plan={plan} onOpenRecipe={onOpenRecipe} />
    </ScreenShell>
  );
}

function TonightHeader({
  hasPick,
  pickIndex,
  totalPicks,
}: {
  hasPick: boolean;
  pickIndex: number;
  totalPicks: number;
}) {
  const subtitle =
    totalPicks > 1
      ? `SPOTLIGHT ${pickIndex + 1}/${totalPicks} READY`
      : totalPicks === 1
        ? 'READY TO COOK'
        : 'NOTHING YET';
  const { weekday, month, day } = formatDayShort(todayISO());
  return (
    <View style={styles.headerBlock}>
      <View style={styles.masthead}>
        <DisplayText size={20} color={palette.ink}>qook</DisplayText>
        <Mono size={10} color={palette.textSecondary}>
          {weekday} · {month} {day}
        </Mono>
      </View>
      <View style={styles.mastheadRule} />
      {/* When a pick exists, the recipe title becomes the screen's headline
          (see HeroPopulated) — the static "Tonight" title/kicker/brushstroke
          only render here for the no-pick/empty state. */}
      {hasPick ? null : (
        <>
          <View style={{ height: spacing.md }} />
          <View style={styles.kickerRow}>
            <Mono size={10} bold color={palette.accentDeep}>
              TONIGHT
            </Mono>
            <View style={styles.kickerDot} />
            <Mono size={10} color={palette.textSecondary}>
              {subtitle}
            </Mono>
          </View>
          <View style={{ height: 4 }} />
          <View style={styles.titleWrap}>
            <DisplayText size={44} color={palette.primary} style={styles.brandTitle}>
              Tonight
            </DisplayText>
            <BrushstrokeUnderline
              width={180}
              color={palette.accent}
              strokeWidth={2.6}
              style={styles.brandUnderline}
            />
          </View>
        </>
      )}
      <View style={{ height: spacing.lg }} />
    </View>
  );
}

function HeroEmpty({ onFind }: { onFind: () => void }) {
  return (
    <View style={styles.emptyCard}>
      <DisplayText size={26} color={palette.ink} style={styles.emptyHeadline}>
        What&rsquo;s for dinner?
      </DisplayText>
      <View style={{ height: spacing.xs }} />
      <BodyText size={15} color={palette.textSecondary} weight="medium">
        Tell us your energy, we&rsquo;ll deal a hand of five dinners in about 15 seconds.
      </BodyText>
      <View style={{ height: spacing.md }} />
      <PolishedButton
        label="Find tonight's dinner"
        tone="forest"
        onPress={onFind}
        trailingIcon={<ArrowRight size={14} color={palette.surface} />}
      />
    </View>
  );
}

function HeroPopulated({
  pick,
  onOpen,
}: {
  pick: Recipe;
  onOpen: () => void;
}) {
  const art = useRecipeArt(pick);
  const protein = pick.nutritionalEstimate?.proteinG;
  const words = pick.title.trim().split(/\s+/);
  const lastWord = words[words.length - 1];
  const leadWords = words.slice(0, -1).join(' ');
  return (
    <View>
      {/* The dish itself is tappable — title or plate opens the recipe. */}
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${pick.title}`}
        style={({ pressed }) => [styles.heroArtRow, pressed ? { opacity: 0.88 } : null]}
      >
        <View style={styles.heroTitleCol}>
          <Mono size={10} bold color={palette.accentDeep}>
            TONIGHT&rsquo;S TABLE
          </Mono>
          <View style={{ height: 6 }} />
          <View style={styles.titleWrap}>
            {leadWords ? (
              <DisplayText size={33} color={palette.primary} style={styles.heroTitle}>
                {leadWords}
              </DisplayText>
            ) : null}
            <DisplayText
              size={33}
              color={palette.accent}
              style={[styles.heroTitle, styles.heroTitleItalic]}
            >
              {lastWord}
            </DisplayText>
            <BrushstrokeUnderline
              width={200}
              color={palette.accent}
              strokeWidth={3.4}
              style={styles.heroUnderline}
            />
          </View>
        </View>
        {/* Keyed on the pick's id so a swap remounts the art with a fade-in
            instead of a hard cut. */}
        <Animated.View
          key={pick.id}
          entering={FadeIn.duration(250)}
          style={styles.heroArtWrap}
        >
          <Vignette
            size={190}
            localKey={art?.localImageKey as SeedMealKey | undefined}
            remoteUrl={art?.heroImageUrl}
            blurhash={art?.blurhash}
            imageStatus={art?.imageStatus}
            title={pick.title}
          />
          {protein != null ? (
            <ProteinChip proteinG={protein} size="sm" style={styles.heroProtein} />
          ) : null}
        </Animated.View>
      </Pressable>

      <View style={{ height: spacing.md }} />
      <MenuRow label="Active time" value={`${pick.timeMinutes} min`} />
      <MenuRow label="Serves" value={String(pick.servings)} />
      <MenuRow label="Cuisine" value={pick.cuisine} />

      <View style={{ height: spacing.md }} />
      <PolishedButton
        label="Cook tonight"
        tone="ghost"
        onPress={onOpen}
        trailingIcon={<ArrowRight size={14} color={palette.primary} />}
      />
      <View style={{ height: spacing.sm }} />
      <ItalicText size={14} style={styles.heroAside}>
        Tonight&rsquo;s pick — you&rsquo;re one tap from the stove.
      </ItalicText>
    </View>
  );
}

function MorePicks({
  picks,
  onSpotlight,
  onOpenRecipe,
}: {
  picks: { recipe: Recipe; idx: number }[];
  onSpotlight: (idx: number) => void;
  onOpenRecipe: (id: string) => void;
}) {
  return (
    <View>
      <View style={{ height: spacing.xl }} />
      <View style={styles.sectionDivider}>
        <View style={styles.sectionRule} />
        <Mono size={10} bold color={palette.accentDeep}>
          SWAP TONIGHT&rsquo;S PICK
        </Mono>
        <View style={styles.sectionRule} />
      </View>
      <View style={{ height: spacing.sm }} />
      <ItalicText size={14} style={styles.heroAside}>
        Not feeling it? Tap a dish to trade.
      </ItalicText>
      <View style={{ height: spacing.sm }} />
      {picks.map(({ recipe, idx }) => (
        <MorePickRow
          key={recipe.id}
          recipe={recipe}
          onSpotlight={() => onSpotlight(idx)}
          onPeek={() => onOpenRecipe(recipe.id)}
        />
      ))}
    </View>
  );
}

function MorePickRow({
  recipe,
  onSpotlight,
  onPeek,
}: {
  recipe: Recipe;
  onSpotlight: () => void;
  onPeek: () => void;
}) {
  const art = useRecipeArt(recipe);

  // Warm this alternate's art as soon as its row is visible — spotlight-first
  // otherwise only fires on detail-open, leaving a visible blank vignette.
  // Guarded client-side (hasRequestedRecipeArt) so re-renders don't spam; the
  // server also holds an atomic pending|failed→generating lock.
  useEffect(() => {
    if (recipe.id && isRecipeArtMissing(art) && !hasRequestedRecipeArt(recipe.id)) {
      void api.requestRecipeImage(recipe.id);
    }
  }, [recipe.id, art]);

  return (
    <Pressable
      onPress={onSpotlight}
      style={styles.menuRowPress}
      accessibilityRole="button"
      accessibilityLabel={`Swap ${recipe.title} in tonight`}
    >
      {/* Nested Pressable wins the tap over the row's — lets you peek at the
          recipe without committing to the swap. */}
      <Pressable
        onPress={onPeek}
        accessibilityRole="button"
        accessibilityLabel={`View ${recipe.title} recipe`}
      >
        <Vignette
          size={80}
          localKey={art?.localImageKey as SeedMealKey | undefined}
          remoteUrl={art?.heroImageUrl}
          blurhash={art?.blurhash}
          imageStatus={art?.imageStatus}
          title={recipe.title}
        />
      </Pressable>
      <View style={styles.menuRowLeader}>
        <MenuRow label={recipe.title} value={`${recipe.timeMinutes} min`} />
      </View>
    </Pressable>
  );
}

function UpcomingStrip({
  days,
  plan,
  onOpenRecipe,
  onOpenWeek,
}: {
  days: ISODate[];
  plan: Record<ISODate, DayPlan>;
  onOpenRecipe: (id: string) => void;
  onOpenWeek: () => void;
}) {
  const anyPlanned = days.some(
    (d) => plan[d]?.energy || (plan[d]?.recipes?.length ?? 0) > 0,
  );
  if (!anyPlanned) return null;

  return (
    <View>
      <View style={{ height: spacing.xl }} />
      <Mono size={10} bold color={palette.accentDeep}>
        UPCOMING
      </Mono>
      <View style={{ height: spacing.sm }} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10 }}
      >
        {days.map((date) => (
          <UpcomingCard
            key={date}
            date={date}
            day={plan[date]}
            onOpenRecipe={onOpenRecipe}
            onOpenWeek={onOpenWeek}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function UpcomingCard({
  date,
  day,
  onOpenRecipe,
  onOpenWeek,
}: {
  date: ISODate;
  day: DayPlan | undefined;
  onOpenRecipe: (id: string) => void;
  onOpenWeek: () => void;
}) {
  const pick = activePickFor(day);
  const art = useRecipeArt(pick ?? undefined);

  // Same warm-on-visibility as MorePickRow (§5) — guarded so re-renders
  // don't spam; server holds an atomic pending|failed→generating lock.
  useEffect(() => {
    if (pick?.id && isRecipeArtMissing(art) && !hasRequestedRecipeArt(pick.id)) {
      void api.requestRecipeImage(pick.id);
    }
  }, [pick?.id, art]);

  const { weekday, month, day: d } = formatDayShort(date);
  const accessibilityLabel = pick
    ? `${weekday}: ${pick.title}`
    : day?.energy
      ? `${weekday}: tagged, not drafted yet`
      : `${weekday}: no plans`;
  return (
    <Pressable
      onPress={() => (pick ? onOpenRecipe(pick.id) : onOpenWeek())}
      style={styles.upcomingCard}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Mono size={9} bold color={palette.accentDeep}>
        {weekday} · {month} {d}
      </Mono>
      <View style={{ height: spacing.xs }} />
      {pick ? (
        <>
          <Vignette
            size={64}
            localKey={art?.localImageKey as SeedMealKey | undefined}
            remoteUrl={art?.heroImageUrl}
            blurhash={art?.blurhash}
            imageStatus={art?.imageStatus}
            title={pick.title}
            style={styles.upcomingVignette}
          />
          <View style={{ height: spacing.xs }} />
          <BodyText
            size={12}
            weight="semi"
            color={palette.ink}
            numberOfLines={2}
          >
            {pick.title}
          </BodyText>
        </>
      ) : day?.energy ? (
        <BodyText
          size={12}
          weight="medium"
          color={palette.textSecondary}
          numberOfLines={2}
        >
          tagged · not drafted yet
        </BodyText>
      ) : (
        <BodyText
          size={12}
          weight="medium"
          color={palette.textTertiary}
          numberOfLines={2}
        >
          no plans
        </BodyText>
      )}
    </Pressable>
  );
}

function RecentCooks({
  days,
  plan,
  onOpenRecipe,
}: {
  days: ISODate[];
  plan: Record<ISODate, DayPlan>;
  onOpenRecipe: (id: string) => void;
}) {
  if (days.length === 0) return null;

  return (
    <View>
      <View style={{ height: spacing.xl }} />
      <Mono size={10} bold color={palette.accentDeep}>
        YOU&rsquo;VE COOKED
      </Mono>
      <View style={{ height: spacing.sm }} />
      <View style={styles.recentList}>
        {days.map((date, idx) => {
          const pick = activePickFor(plan[date]);
          if (!pick) return null;
          return (
            <RecentRow
              key={date}
              date={date}
              pick={pick}
              isLast={idx === days.length - 1}
              onOpenRecipe={onOpenRecipe}
            />
          );
        })}
      </View>
    </View>
  );
}

function RecentRow({
  date,
  pick,
  isLast,
  onOpenRecipe,
}: {
  date: ISODate;
  pick: Recipe;
  isLast: boolean;
  onOpenRecipe: (id: string) => void;
}) {
  const art = useRecipeArt(pick);
  const { weekday, month, day: d } = formatDayShort(date);
  return (
    <Pressable
      onPress={() => onOpenRecipe(pick.id)}
      style={[styles.recentRow, isLast ? styles.recentRowLast : null]}
      accessibilityRole="button"
      accessibilityLabel={`${weekday}: ${pick.title}`}
    >
      <Vignette
        size={53}
        localKey={art?.localImageKey as SeedMealKey | undefined}
        remoteUrl={art?.heroImageUrl}
        blurhash={art?.blurhash}
        imageStatus={art?.imageStatus}
        title={pick.title}
      />
      <View style={{ flex: 1 }}>
        <Mono size={9} color={palette.textSecondary}>
          {weekday} · {month} {d}
        </Mono>
        <View style={{ height: 2 }} />
        <BodyText
          size={14}
          weight="semi"
          color={palette.ink}
          numberOfLines={1}
        >
          {pick.title}
        </BodyText>
      </View>
      <ChevronRight size={16} color={palette.textTertiary} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    marginBottom: spacing.sm,
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  mastheadRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.statRuleColor,
    marginTop: spacing.sm,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kickerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.textSecondary,
  },
  titleWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  brandTitle: {
    letterSpacing: -1.6,
    lineHeight: 48,
  },
  brandUnderline: {
    position: 'absolute',
    left: -4,
    bottom: -10,
  },
  emptyCard: {
    borderRadius: 22,
    padding: spacing.lg,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
  emptyHeadline: {
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  heroTitle: {
    letterSpacing: -0.5,
  },
  heroTitleItalic: {
    fontFamily: fontFamily.displayItalic,
  },
  heroUnderline: {
    position: 'absolute',
    left: -4,
    bottom: -8,
  },
  heroArtRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  // The big hero vignette bleeds into the right screen gutter so the title
  // column keeps enough width for whole words at display size.
  heroArtWrap: {
    marginRight: -20,
  },
  heroProtein: {
    position: 'absolute',
    left: -6,
    bottom: -6,
    transform: [{ rotate: '-6deg' }],
  },
  heroTitleCol: {
    flex: 1,
    justifyContent: 'center',
  },
  heroAside: {
    textAlign: 'left',
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.statRuleColor,
  },
  menuRowPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 6,
  },
  menuRowLeader: {
    flex: 1,
  },
  upcomingCard: {
    width: 132,
    padding: spacing.sm + 2,
    borderRadius: 14,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
  upcomingVignette: {
    alignSelf: 'center',
  },
  recentList: {
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
    paddingHorizontal: spacing.md,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(42, 58, 38, 0.08)',
  },
  recentRowLast: {
    borderBottomWidth: 0,
  },
});
