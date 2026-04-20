import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type {
  IngredientGroup,
  Recipe,
  RecipeSection,
  RecipeTimelineItem,
} from '@qook/shared';

import { FoodHeroImage } from '../../components/FoodHeroImage';
import { EnergyBadge } from '../../components/EnergyBadge';
import { PaperCard } from '../../components/PaperCard';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { WashBackground } from '../../components/WashBackground';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { palette, radius, spacing, screen, typeScale } from '../../design';
import { api } from '../../services/api';
import { useHaptics } from '../../hooks/useHaptics';
import type { SeedMealKey } from '../../lib/assets';

export interface RecipeDetailModalProps {
  recipeId: string;
}

export function RecipeDetailModal({ recipeId }: RecipeDetailModalProps) {
  const router = useRouter();
  const { tap } = useHaptics();
  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => api.getRecipeById(recipeId),
  });

  const close = () => {
    tap();
    router.back();
  };

  return (
    <View style={styles.root}>
      <WashBackground />
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {isLoading || !recipe ? (
            <LoadingState />
          ) : (
            <RecipeBody recipe={recipe} />
          )}
        </ScrollView>
        <CloseButton onPress={close} />
      </SafeAreaView>
    </View>
  );
}

function RecipeBody({ recipe }: { recipe: Recipe }) {
  return (
    <>
      <FoodHeroImage
        localKey={recipe.localImageKey as SeedMealKey | undefined}
        remoteUrl={recipe.heroImageUrl}
        blurhash={recipe.blurhash}
        height={280}
        cornerRadius={radius.sheet}
        style={styles.hero}
      />

      <View style={styles.hPad}>
        <View style={{ height: spacing.lg }} />
        <EnergyBadge tier={recipe.tier} />
        <View style={{ height: spacing.sm }} />
        <DisplayText size={typeScale.displayM}>{recipe.title}</DisplayText>
        <BrushstrokeUnderline
          width={180}
          color={palette.accent}
          style={{ marginTop: -2 }}
        />
        <View style={{ height: spacing.md }} />
        <Mono>
          {recipe.cuisine} · {recipe.timeMinutes} min · serves {recipe.servings} ·{' '}
          {recipe.difficulty}
        </Mono>

        {recipe.notes ? (
          <>
            <View style={{ height: spacing.md }} />
            <BodyText
              size={typeScale.bodyLG}
              weight="medium"
              color={palette.primary}
            >
              {recipe.notes}
            </BodyText>
          </>
        ) : null}

        <SectionHeader kicker="what you need" label="Ingredients" />
        {recipe.ingredients.map((group, idx) => (
          <IngredientGroupCard key={`${group.title}-${idx}`} group={group} />
        ))}

        <SectionHeader kicker="how to cook" label="Steps" />
        {recipe.steps.map((section, idx) => (
          <StepSectionCard
            key={`${section.title}-${idx}`}
            index={idx + 1}
            section={section}
          />
        ))}

        {recipe.timeline.length > 0 ? (
          <>
            <SectionHeader kicker="timeline" label="When to do what" />
            <TimelineCard items={recipe.timeline} />
          </>
        ) : null}

        {recipe.dietaryTags.length > 0 ? (
          <>
            <View style={{ height: spacing.lg }} />
            <Mono color={palette.textSecondary}>tags</Mono>
            <View style={{ height: spacing.sm }} />
            <View style={styles.tagRow}>
              {recipe.dietaryTags.map((t) => (
                <View key={t} style={styles.tagChip}>
                  <Mono size={9} color={palette.utility}>
                    {t}
                  </Mono>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </View>
    </>
  );
}

function SectionHeader({ kicker, label }: { kicker: string; label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Mono>{kicker}</Mono>
      <View style={{ height: spacing.xs }} />
      <DisplayText size={typeScale.displayS}>{label}</DisplayText>
    </View>
  );
}

function IngredientGroupCard({ group }: { group: IngredientGroup }) {
  return (
    <PaperCard padding={spacing.md} style={styles.card}>
      <Mono color={palette.textSecondary}>{group.title}</Mono>
      <View style={{ height: spacing.sm }} />
      {group.items.map((ing, i) => (
        <View key={`${ing.item}-${i}`} style={styles.ingredientRow}>
          <BodyText size={typeScale.bodyMD} style={styles.ingredientItem}>
            {ing.item}
          </BodyText>
          {ing.quantity ? (
            <BodyText
              size={typeScale.bodySM}
              color={palette.textSecondary}
              style={styles.ingredientQty}
            >
              {ing.quantity}
            </BodyText>
          ) : null}
        </View>
      ))}
    </PaperCard>
  );
}

function StepSectionCard({
  index,
  section,
}: {
  index: number;
  section: RecipeSection;
}) {
  return (
    <PaperCard padding={spacing.md} style={styles.card}>
      <View style={styles.stepTitleRow}>
        <View style={styles.stepIndex}>
          <Mono bold color={palette.accent}>
            {String(index).padStart(2, '0')}
          </Mono>
        </View>
        <DisplayText size={typeScale.displayS} style={styles.stepTitle}>
          {section.title}
        </DisplayText>
      </View>
      <View style={{ height: spacing.xs }} />
      <BodyText size={typeScale.bodySM} color={palette.textSecondary}>
        {section.objective}
      </BodyText>
      <View style={{ height: spacing.md }} />
      {section.steps.map((step, i) => (
        <View key={i} style={styles.substepRow}>
          <View style={styles.substepDot} />
          <View style={styles.substepBody}>
            <BodyText size={typeScale.bodyMD}>{step.instruction}</BodyText>
            {step.durationMin ? (
              <>
                <View style={{ height: 2 }} />
                <Mono size={9} color={palette.utility}>
                  {step.durationMin} min
                </Mono>
              </>
            ) : null}
          </View>
        </View>
      ))}
    </PaperCard>
  );
}

function TimelineCard({ items }: { items: RecipeTimelineItem[] }) {
  return (
    <PaperCard padding={spacing.md} style={styles.card}>
      {items.map((item, i) => (
        <View key={i} style={styles.timelineRow}>
          <View style={styles.timelineTick}>
            <Mono bold color={palette.primary}>
              {formatTick(item.atMin)}
            </Mono>
          </View>
          <View style={styles.timelineBody}>
            <BodyText size={typeScale.bodyMD}>{item.instruction}</BodyText>
            <Mono size={9} color={palette.textTertiary}>
              {item.sectionTitle}
            </Mono>
          </View>
        </View>
      ))}
    </PaperCard>
  );
}

function formatTick(minutes: number): string {
  const m = Math.floor(minutes);
  return `${String(m).padStart(2, '0')}:00`;
}

function LoadingState() {
  return (
    <View style={[styles.hPad, { paddingTop: spacing.xxl }]}>
      <Mono>loading recipe</Mono>
    </View>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={[styles.close, { top: insets.top + spacing.sm }]}
    >
      <Mono size={10} bold color={palette.primary}>
        done
      </Mono>
    </Pressable>
  );
}

const cardStyle: ViewStyle = {
  marginTop: spacing.sm,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  safe: { flex: 1 },
  scroll: {
    paddingBottom: screen.bottom,
  },
  hero: {
    marginHorizontal: screen.horizontal,
    marginTop: spacing.xs,
  },
  hPad: {
    paddingHorizontal: screen.horizontal,
  },
  sectionHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  card: cardStyle,
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.glassBorder,
  },
  ingredientItem: { flex: 1, paddingRight: spacing.sm },
  ingredientQty: { textAlign: 'right' },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIndex: {
    width: 28,
    marginRight: spacing.sm,
  },
  stepTitle: { flex: 1 },
  substepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  substepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.accent,
    marginTop: 9,
    marginRight: spacing.sm,
  },
  substepBody: { flex: 1 },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.glassBorder,
  },
  timelineTick: {
    width: 56,
    marginRight: spacing.sm,
  },
  timelineBody: { flex: 1 },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagChip: {
    borderRadius: radius.tiny,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(61, 84, 105, 0.08)',
  },
  close: {
    position: 'absolute',
    right: screen.horizontal,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceTranslucent,
  },
});
