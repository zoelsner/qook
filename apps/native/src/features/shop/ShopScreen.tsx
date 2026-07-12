import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { GroceryCategory, GroceryItem, Timestamp } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { SquareCheckbox } from '../../components/SquareCheckbox';
import { PolishedButton } from '../../components/PolishedButton';
import { IconPill } from '../../components/painted';
import { ArrowRight, Check, Copy, Share as ShareIcon } from 'lucide-react-native';
import { palette, spacing, fontFamily } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { activeStagedRecipes, useWeekPlan } from '../../stores/weekPlan';
import { todayISO } from '../week/weekDates';
import {
  copyList,
  createInstacartShoppingList,
  openAmazonFresh,
  shareList,
} from '../../lib/shoppingShare';
import {
  aggregateIngredients,
  collectShopMeals,
  formatQuantity,
  type ShopItem,
} from './aggregateIngredients';
import { MealFilterPills } from './MealFilterPills';

const CATEGORY_ORDER: GroceryCategory[] = [
  'Produce',
  'Protein',
  'Dairy',
  'Pantry',
  'Frozen',
  'Bakery',
  'Other',
];

// shoppingShare helpers take the legacy GroceryItem shape. Map ShopItem onto
// that shape with local-only ids so Instacart/copy/share continue to work
// without forking those helpers.
function toGroceryItem(item: ShopItem): GroceryItem {
  const ts = Date.now() as Timestamp;
  return {
    id: item.key,
    userId: 'local',
    canonicalKey: item.key,
    name: item.name,
    quantityText: item.quantities.join(' + ') || undefined,
    category: item.category,
    checked: false,
    source: 'recipe_import',
    sourceRecipeTitles: item.recipeTitles,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function ShopScreen() {
  const router = useRouter();
  const { press, select } = useHaptics();
  const plan = useWeekPlan((s) => s.plan);
  const shopStaging = useWeekPlan((s) => s.shopStaging);
  const hasHydrated = useWeekPlan((s) => s.hasHydrated);
  const today = todayISO();

  const staged = useMemo(
    () => (hasHydrated ? activeStagedRecipes(shopStaging, today) : []),
    [shopStaging, today, hasHydrated],
  );
  const meals = useMemo(
    () => (hasHydrated ? collectShopMeals(plan, today, staged) : []),
    [plan, today, staged, hasHydrated],
  );

  // Pill exclusions — ephemeral, same lifetime as `checked` (spec
  // 2026-07-13-shop-meal-pills-design.md). A meal leaving the plan takes its
  // stale exclusion with it (excludeIds intersects with live meal ids).
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const excludeIds = useMemo(
    () => new Set(meals.filter((m) => excluded[m.id]).map((m) => m.id)),
    [meals, excluded],
  );

  const items = useMemo(
    () => (hasHydrated ? aggregateIngredients(plan, today, staged, excludeIds) : []),
    [plan, staged, today, hasHydrated, excludeIds],
  );

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<GroceryCategory, ShopItem[]>();
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return CATEGORY_ORDER.map((c) => ({ category: c, items: map.get(c) ?? [] })).filter(
      (g) => g.items.length > 0,
    );
  }, [items]);

  const totalItems = items.length;
  const recipeTitles = useMemo(() => {
    const titles = new Set<string>();
    for (const item of items) item.recipeTitles.forEach((t) => titles.add(t));
    return titles;
  }, [items]);
  const recipeCount = recipeTitles.size;
  const remaining = items.filter((i) => !checked[i.key]).length;
  const uncheckedGrocery = useMemo(
    () => items.filter((i) => !checked[i.key]).map(toGroceryItem),
    [items, checked],
  );

  const handleToggle = (key: string) => {
    select();
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTogglePill = (id: string) => {
    select();
    setExcluded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);

  const listEmpty = remaining === 0;

  const handleCopy = async () => {
    select();
    const ok = await copyList(uncheckedGrocery);
    if (ok) setCopied(true);
  };

  const handleShare = async () => {
    select();
    await shareList(uncheckedGrocery);
  };

  const handleInstacart = () => {
    press();
    void createInstacartShoppingList(uncheckedGrocery);
  };

  const handleAmazonFresh = () => {
    press();
    openAmazonFresh(uncheckedGrocery);
  };

  return (
    <ScreenShell horizontalPadding={24}>
      <View style={styles.masthead}>
        <DisplayText size={20} color={palette.ink}>qook</DisplayText>
        <Mono size={10} color={palette.textSecondary}>
          {totalItems} items · {recipeCount} {recipeCount === 1 ? 'recipe' : 'recipes'}
        </Mono>
      </View>
      <View style={styles.mastheadRule} />

      <View style={{ height: spacing.md + 2 }} />
      <View style={styles.titleRow}>
        <DisplayText
          size={34}
          color={palette.primary}
          style={[styles.displayTitle, styles.titleText]}
        >
          Shopping{' '}
          <Text style={styles.titleItalic}>list</Text>
        </DisplayText>
        <View style={styles.titleActions}>
          <IconPill
            onPress={handleCopy}
            accessibilityLabel="Copy list"
            disabled={listEmpty}
            style={listEmpty ? styles.actionDisabled : null}
          >
            {copied ? (
              <Check size={16} color={palette.ink} strokeWidth={2.2} />
            ) : (
              <Copy size={16} color={palette.ink} strokeWidth={1.8} />
            )}
          </IconPill>
          <IconPill
            onPress={handleShare}
            accessibilityLabel="Share list"
            disabled={listEmpty}
            style={listEmpty ? styles.actionDisabled : null}
          >
            <ShareIcon size={16} color={palette.ink} strokeWidth={1.8} />
          </IconPill>
        </View>
      </View>

      <View style={{ height: spacing.sm }} />

      {meals.length >= 2 ? (
        <>
          <MealFilterPills
            meals={meals}
            excluded={excludeIds}
            onToggle={handleTogglePill}
            edgeBleed={24}
          />
          <View style={{ height: spacing.sm + 2 }} />
        </>
      ) : null}

      {!hasHydrated ? null : totalItems === 0 && excludeIds.size > 0 ? (
        <View style={styles.filteredEmpty}>
          <BodyText size={14} color={palette.textSecondary} weight="medium">
            Every meal is hidden — tap a pill to bring its ingredients back.
          </BodyText>
        </View>
      ) : totalItems === 0 ? (
        <EmptyShop
          onOpenWeek={() => {
            press();
            router.push('/(tabs)/week');
          }}
        />
      ) : (
        grouped.map(({ category, items: groupItems }, idx) => (
          <View key={category} style={idx > 0 ? { marginTop: spacing.md } : null}>
            <View style={styles.sectionDivider}>
              <View style={styles.sectionRule} />
              <Mono size={10} bold color={palette.accentDeep}>
                {category}
              </Mono>
              <View style={styles.sectionRule} />
            </View>
            {groupItems.map((item) => (
              <ShopRow
                key={item.key}
                item={item}
                checked={!!checked[item.key]}
                onToggle={() => handleToggle(item.key)}
              />
            ))}
          </View>
        ))
      )}

      {totalItems > 0 ? (
        <View style={styles.orderViaWrap}>
          <View style={styles.orderVia}>
            <Mono size={10} color={palette.textSecondary}>
              Order via{' '}
            </Mono>
            <Pressable onPress={handleInstacart} disabled={listEmpty} hitSlop={6}>
              <Mono
                size={10}
                color={listEmpty ? palette.textTertiary : palette.accentDeep}
              >
                Instacart
              </Mono>
            </Pressable>
            <Mono size={10} color={palette.textSecondary}>
              {' '}
              ·{' '}
            </Mono>
            <Pressable onPress={handleAmazonFresh} disabled={listEmpty} hitSlop={6}>
              <Mono
                size={10}
                color={listEmpty ? palette.textTertiary : palette.accentDeep}
              >
                Amazon Fresh
              </Mono>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={{ height: spacing.lg }} />
    </ScreenShell>
  );
}

function EmptyShop({ onOpenWeek }: { onOpenWeek: () => void }) {
  return (
    <View style={styles.empty}>
      <Mono size={10} bold color={palette.accentDeep}>
        nothing slotted
      </Mono>
      <View style={{ height: spacing.xs }} />
      <DisplayText size={24} color={palette.ink} style={styles.emptyTitle}>
        No ingredients yet.
      </DisplayText>
      <View style={{ height: spacing.sm }} />
      <BodyText size={14} color={palette.textSecondary} weight="medium">
        Tag a few nights in Week and draft dinners — we&rsquo;ll aggregate everything
        you need into one list here.
      </BodyText>
      <View style={{ height: spacing.md }} />
      <PolishedButton
        label="Plan your week"
        tone="forest"
        onPress={onOpenWeek}
        trailingIcon={<ArrowRight size={14} color={palette.surface} />}
      />
    </View>
  );
}

// Middle-dot leader, clipped per row (same device as MenuRow) — the mockup's
// grocery rows are menu lines: box · name ····· qty, all on one baseline.
const DOT_LEADER = '·'.repeat(80);

function ShopRow({
  item,
  checked,
  onToggle,
}: {
  item: ShopItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const quantity = formatQuantity(item);

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.row, pressed ? { opacity: 0.85 } : null]}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${quantity}${checked ? ', checked' : ''}`}
      accessibilityState={{ checked }}
    >
      <SquareCheckbox checked={checked} size={19} style={styles.rowBox} />
      <BodyText
        size={15}
        weight="medium"
        color={checked ? palette.textTertiary : palette.ink}
        style={[
          styles.rowName,
          checked ? { textDecorationLine: 'line-through' } : null,
        ]}
        numberOfLines={1}
      >
        {item.name}
      </BodyText>
      <Text style={styles.rowLeader} numberOfLines={1} ellipsizeMode="clip">
        {DOT_LEADER}
      </Text>
      <Mono
        size={12}
        color={checked ? palette.textTertiary : palette.textSecondary}
        style={styles.rowQty}
        numberOfLines={1}
      >
        {quantity}
      </Mono>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  filteredEmpty: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleText: {
    flexShrink: 1,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  actionDisabled: {
    opacity: 0.4,
  },
  displayTitle: {
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  titleItalic: {
    fontFamily: fontFamily.displayItalic,
    color: palette.accent,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.statRuleColor,
  },
  // Menu-line grocery row: box · name ····· qty, on one text baseline (the
  // checkbox is a View, so its baseline is its bottom edge — same effect as
  // the mockup's translateY on the box).
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 9,
  },
  rowBox: {
    marginRight: 11,
    transform: [{ rotate: '-2deg' }],
  },
  rowName: {
    flexShrink: 1,
    letterSpacing: -0.15,
  },
  rowLeader: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 13,
    letterSpacing: 3,
    color: palette.statRuleColor,
  },
  rowQty: {
    flexShrink: 0,
    letterSpacing: 0.4,
    textTransform: 'none',
  },
  empty: {
    borderRadius: 22,
    padding: spacing.lg,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
  emptyTitle: {
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  // Quiet ordering paths at the end of the scrolling list — no longer a
  // floating dock, just a centered Mono line the list scrolls past.
  orderViaWrap: {
    marginTop: spacing.lg,
  },
  orderVia: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
});
