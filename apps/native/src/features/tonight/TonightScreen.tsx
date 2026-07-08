import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Recipe } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { FoodHeroImage } from '../../components/FoodHeroImage';
import { Vignette } from '../../components/Vignette';
import { MenuRow } from '../../components/MenuRow';
import { ProteinChip } from '../../components/ProteinChip';
import { BodyText, DisplayText, Mono, ItalicText } from '../../components/Text';
import { PolishedButton } from '../../components/PolishedButton';
import { ArrowRight, ChevronRight } from 'lucide-react-native';
import { palette, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
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
  pickIndex,
  totalPicks,
}: {
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
        Tell us your energy, we&rsquo;ll draft three dinners in about 10 seconds.
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
  const protein = pick.nutritionalEstimate?.proteinG;
  return (
    <View style={styles.heroWell}>
      <View style={styles.heroArtRow}>
        <View style={styles.heroTitleCol}>
          <DisplayText size={30} color={palette.ink} style={styles.heroTitle}>
            {pick.title}
          </DisplayText>
        </View>
        <View>
          <Vignette
            size={114}
            localKey={pick.localImageKey as SeedMealKey | undefined}
            remoteUrl={pick.heroImageUrl}
            blurhash={pick.blurhash}
            imageStatus={pick.imageStatus}
            title={pick.title}
          />
          {protein != null ? (
            <ProteinChip proteinG={protein} size="sm" style={styles.heroProtein} />
          ) : null}
        </View>
      </View>

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
}: {
  picks: { recipe: Recipe; idx: number }[];
  onSpotlight: (idx: number) => void;
}) {
  return (
    <View>
      <View style={{ height: spacing.xl }} />
      <Mono size={10} bold color={palette.accentDeep}>
        ALSO ON THE MENU
      </Mono>
      <View style={{ height: spacing.sm }} />
      {picks.map(({ recipe, idx }) => (
        <Pressable
          key={recipe.id}
          onPress={() => onSpotlight(idx)}
          style={styles.menuRowPress}
          accessibilityRole="button"
          accessibilityLabel={`Spotlight ${recipe.title}`}
        >
          <Vignette
            size={52}
            localKey={recipe.localImageKey as SeedMealKey | undefined}
            remoteUrl={recipe.heroImageUrl}
            blurhash={recipe.blurhash}
            imageStatus={recipe.imageStatus}
            title={recipe.title}
          />
          <View style={styles.menuRowLeader}>
            <MenuRow label={recipe.title} value={`${recipe.timeMinutes} min`} />
          </View>
        </Pressable>
      ))}
    </View>
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
        {days.map((date) => {
          const day = plan[date];
          const pick = activePickFor(day);
          const { weekday, month, day: d } = formatDayShort(date);
          const accessibilityLabel = pick
            ? `${weekday}: ${pick.title}`
            : day?.energy
              ? `${weekday}: tagged, not drafted yet`
              : `${weekday}: no plans`;
          return (
            <Pressable
              key={date}
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
                  <View style={styles.upcomingThumb}>
                    <FoodHeroImage
                      localKey={pick.localImageKey as SeedMealKey | undefined}
                      remoteUrl={pick.heroImageUrl}
                      blurhash={pick.blurhash}
                      height={72}
                      cornerRadius={10}
                      style={{ width: '100%', height: 72 }}
                    />
                  </View>
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
        })}
      </ScrollView>
    </View>
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
          const { weekday, month, day: d } = formatDayShort(date);
          const last = idx === days.length - 1;
          return (
            <Pressable
              key={date}
              onPress={() => onOpenRecipe(pick.id)}
              style={[styles.recentRow, last ? styles.recentRowLast : null]}
              accessibilityRole="button"
              accessibilityLabel={`${weekday}: ${pick.title}`}
            >
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
        })}
      </View>
    </View>
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
    lineHeight: 36,
  },
  heroWell: {
    borderRadius: 18,
    padding: spacing.lg,
    backgroundColor: palette.well,
  },
  heroArtRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  heroProtein: {
    position: 'absolute',
    left: -6,
    bottom: -6,
  },
  heroTitleCol: {
    flex: 1,
    justifyContent: 'center',
  },
  heroAside: {
    textAlign: 'left',
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
  upcomingThumb: {
    borderRadius: 10,
    overflow: 'hidden',
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
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(42, 58, 38, 0.08)',
  },
  recentRowLast: {
    borderBottomWidth: 0,
  },
});
