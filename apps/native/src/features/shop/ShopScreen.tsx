import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { GroceryCategory, GroceryItem, Timestamp } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { SquareCheckbox } from '../../components/SquareCheckbox';
import { PolishedButton } from '../../components/PolishedButton';
import { ArrowRight } from 'lucide-react-native';
import { palette, screen, spacing, fontFamily } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { useWeekPlan } from '../../stores/weekPlan';
import { todayISO } from '../week/weekDates';
import {
  copyList,
  createInstacartShoppingList,
  openAmazonFresh,
  shareList,
} from '../../lib/shoppingShare';
import {
  aggregateIngredients,
  formatQuantity,
  type ShopItem,
} from './aggregateIngredients';

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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { press, select } = useHaptics();
  const plan = useWeekPlan((s) => s.plan);
  const hasHydrated = useWeekPlan((s) => s.hasHydrated);
  const today = todayISO();

  const items = useMemo(
    () => (hasHydrated ? aggregateIngredients(plan, today) : []),
    [plan, today, hasHydrated],
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

  const dockBottom = insets.bottom + screen.tabBarHeight + 24;

  return (
    <View style={{ flex: 1 }}>
      <ScreenShell horizontalPadding={24}>
        <View style={styles.masthead}>
          <DisplayText size={20} color={palette.ink}>qook</DisplayText>
          <Mono size={10} color={palette.textSecondary}>
            {totalItems} items · {recipeCount} {recipeCount === 1 ? 'recipe' : 'recipes'}
          </Mono>
        </View>
        <View style={styles.mastheadRule} />

        <View style={{ height: spacing.md + 2 }} />
        <DisplayText size={34} color={palette.primary} style={styles.displayTitle}>
          Shopping{' '}
          <Text style={styles.titleItalic}>list</Text>
        </DisplayText>

        <View style={{ height: spacing.sm }} />

        {!hasHydrated ? null : totalItems === 0 ? (
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

        <View style={{ height: spacing.lg }} />
      </ScreenShell>

      {totalItems > 0 ? (
        <View style={[styles.dockFooter, { paddingBottom: dockBottom }]}>
          <ShopDock
            remaining={remaining}
            disabled={remaining === 0}
            onShop={() => {
              press();
              void createInstacartShoppingList(uncheckedGrocery);
            }}
            onCopy={async () => {
              select();
              const ok = await copyList(uncheckedGrocery);
              if (ok) setCopied(true);
            }}
            onShare={async () => {
              select();
              await shareList(uncheckedGrocery);
            }}
            onAmazonFresh={() => {
              press();
              openAmazonFresh(uncheckedGrocery);
            }}
            copied={copied}
            onCopiedExpire={() => setCopied(false)}
          />
        </View>
      ) : null}
    </View>
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

function ShopDock({
  remaining,
  disabled,
  onShop,
  onCopy,
  onShare,
  onAmazonFresh,
  copied,
  onCopiedExpire,
}: {
  remaining: number;
  disabled: boolean;
  onShop: () => void;
  onCopy: () => void;
  onShare: () => void;
  onAmazonFresh: () => void;
  copied: boolean;
  onCopiedExpire: () => void;
}) {
  React.useEffect(() => {
    if (!copied) return;
    const id = setTimeout(onCopiedExpire, 1600);
    return () => clearTimeout(id);
  }, [copied, onCopiedExpire]);

  // Share is the primary handoff (works with any store, partner, or app).
  // Instacart has no real cart integration yet — it opens a search page —
  // so it lives in the quiet secondary row until the Connect API lands.
  return (
    <View style={styles.dock}>
      <PolishedButton
        label="Share the list"
        tone="forest"
        onPress={onShare}
        disabled={disabled}
        trailingIcon={<ArrowRight size={14} color={palette.surface} />}
      />
      <View style={{ height: spacing.sm }} />
      <Mono size={9} color={palette.textSecondary} style={styles.dockSub}>
        {remaining === 0 ? 'ALL CHECKED OFF' : 'YOUR LIST, WHEREVER YOU SHOP'}
      </Mono>
      <View style={{ height: spacing.sm }} />
      <View style={styles.fallbackRow}>
        <Pressable hitSlop={6} onPress={onCopy} disabled={disabled}>
          <BodyText
            size={12}
            weight="semi"
            color={copied ? palette.accentDeep : palette.textSecondary}
          >
            {copied ? 'Copied ✓' : 'Copy list'}
          </BodyText>
        </Pressable>
        <View style={styles.fallbackDot} />
        <Pressable hitSlop={6} onPress={onShop} disabled={disabled}>
          <BodyText size={12} weight="semi" color={palette.textSecondary}>
            Instacart
          </BodyText>
        </Pressable>
        <View style={styles.fallbackDot} />
        <Pressable hitSlop={6} onPress={onAmazonFresh} disabled={disabled}>
          <BodyText size={12} weight="semi" color={palette.textSecondary}>
            Amazon Fresh
          </BodyText>
        </Pressable>
      </View>
    </View>
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
  // In-flow footer on the cream ground (mockup: the dock is part of the
  // page's bottom, list rows never scroll behind it), aligned to the 24px
  // content gutter.
  dockFooter: {
    paddingHorizontal: 24,
    paddingTop: spacing.sm,
    backgroundColor: palette.background,
  },
  dock: {
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md - 2,
    backgroundColor: palette.well,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
  },
  dockSub: {
    textAlign: 'center',
    letterSpacing: 1.6,
  },
  fallbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  fallbackDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.textTertiary,
  },
});
