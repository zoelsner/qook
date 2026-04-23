import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { GroceryCategory, GroceryItem, Timestamp } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { PaintedCheckbox } from '../../components/painted';
import { PolishedButton } from '../../components/PolishedButton';
import { ArrowRight } from 'lucide-react-native';
import { palette, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { useWeekPlan } from '../../stores/weekPlan';
import { todayISO } from '../week/weekDates';
import {
  copyList,
  openAmazonFresh,
  openInstacart,
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

  const dockBottom = insets.bottom + 68 + 24;

  return (
    <View style={{ flex: 1 }}>
      <ScreenShell horizontalPadding={24}>
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <View style={styles.kickerRow}>
              <Mono size={10} bold color={palette.accentDeep}>
                shop
              </Mono>
              <View style={styles.kickerDot} />
              <Mono size={10} color={palette.textSecondary}>
                {totalItems} items · {recipeCount} {recipeCount === 1 ? 'recipe' : 'recipes'}
              </Mono>
            </View>
            <View style={styles.displayTitleWrap}>
              <DisplayText size={44} color={palette.primary} style={styles.displayTitle}>
                Grocery list
              </DisplayText>
              <BrushstrokeUnderline
                width={220}
                color={palette.accent}
                pathVariant="v3"
                strokeWidth={2.4}
                style={styles.displayUnderline}
              />
            </View>
          </View>
        </View>

        <View style={{ height: spacing.xl - 4 }} />

        {!hasHydrated ? null : totalItems === 0 ? (
          <EmptyShop
            onOpenWeek={() => {
              press();
              router.push('/(tabs)/week');
            }}
          />
        ) : (
          grouped.map(({ category, items: groupItems }, idx) => (
            <View key={category} style={idx > 0 ? { marginTop: spacing.lg } : null}>
              <View style={styles.sectionHeader}>
                <Mono size={10} bold color={palette.accentDeep}>
                  {category} · {groupItems.length}
                </Mono>
                <View style={styles.sectionHeaderRule} />
              </View>
              {groupItems.map((item) => (
                <ShopRow
                  key={item.key}
                  item={item}
                  checked={!!checked[item.key]}
                  onToggle={() => handleToggle(item.key)}
                  hideRecipeSource={recipeCount <= 1}
                />
              ))}
            </View>
          ))
        )}

        <View style={{ height: 200 }} />
      </ScreenShell>

      {totalItems > 0 ? (
        <View style={[styles.stickyDockWrap, { bottom: dockBottom }]} pointerEvents="box-none">
          <ShopDock
            remaining={remaining}
            disabled={remaining === 0}
            onShop={() => {
              press();
              openInstacart(uncheckedGrocery);
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

function ShopRow({
  item,
  checked,
  onToggle,
  hideRecipeSource,
}: {
  item: ShopItem;
  checked: boolean;
  onToggle: () => void;
  hideRecipeSource?: boolean;
}) {
  const quantity = formatQuantity(item);
  const firstRecipe = item.recipeTitles[0];
  const extra = item.recipeTitles.length - 1;
  const subText =
    hideRecipeSource || !firstRecipe
      ? quantity
      : extra > 0
        ? `${quantity} · ${firstRecipe} +${extra}`
        : `${quantity} · ${firstRecipe}`;
  const shortQty = item.quantities[0] ?? (item.recipeCount > 1 ? `×${item.recipeCount}` : '');

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.row, pressed ? { opacity: 0.85 } : null]}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${quantity}${checked ? ', checked' : ''}`}
      accessibilityState={{ checked }}
    >
      <PaintedCheckbox checked={checked} size={22} />
      <View style={styles.rowText}>
        <BodyText
          size={16}
          weight="semi"
          color={checked ? palette.textTertiary : palette.ink}
          style={[
            styles.rowName,
            checked ? { textDecorationLine: 'line-through' } : null,
          ]}
          numberOfLines={1}
        >
          {item.name}
        </BodyText>
        <Mono
          size={11}
          color={checked ? palette.textTertiary : palette.textSecondary}
          numberOfLines={1}
        >
          {subText}
        </Mono>
      </View>
      <Mono
        size={12}
        color={palette.textSecondary}
        style={[styles.rowQty, checked ? { opacity: 0.55 } : null]}
      >
        {shortQty}
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
  const estimatedDollars = Math.max(8, remaining * 3.5).toFixed(0);

  React.useEffect(() => {
    if (!copied) return;
    const id = setTimeout(onCopiedExpire, 1600);
    return () => clearTimeout(id);
  }, [copied, onCopiedExpire]);

  return (
    <View style={styles.dock}>
      <View style={styles.dockHeader}>
        <View style={{ flex: 1 }}>
          <DisplayText size={20} color={palette.ink} style={styles.dockTitle}>
            Ready to shop
          </DisplayText>
          <View style={{ height: 2 }} />
          <BodyText size={13} color={palette.textSecondary} weight="medium">
            {remaining} items left · delivered via Instacart
          </BodyText>
        </View>
        <View style={styles.dockEst}>
          <Mono size={9} bold color={palette.textSecondary}>
            EST
          </Mono>
          <DisplayText size={20} color={palette.accent} style={styles.dockEstValue}>
            ${estimatedDollars}
          </DisplayText>
        </View>
      </View>
      <View style={{ height: spacing.sm }} />
      <PolishedButton
        label="Shop with Instacart"
        tone="forest"
        onPress={onShop}
        disabled={disabled}
        trailingIcon={<ArrowRight size={14} color={palette.surface} />}
      />
      <View style={{ height: spacing.sm + 2 }} />
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
        <Pressable hitSlop={6} onPress={onShare} disabled={disabled}>
          <BodyText size={12} weight="semi" color={palette.textSecondary}>
            Share
          </BodyText>
        </Pressable>
        <View style={styles.fallbackDot} />
        <Pressable hitSlop={6} onPress={onAmazonFresh} disabled={disabled}>
          <BodyText size={12} weight="semi" color={palette.textSecondary}>
            AmazonFresh
          </BodyText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerTitleGroup: {
    gap: 6,
    flexShrink: 1,
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
  displayTitleWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  displayTitle: {
    letterSpacing: -1.2,
    lineHeight: 48,
  },
  displayUnderline: {
    position: 'absolute',
    left: -6,
    bottom: -8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 4,
  },
  sectionHeaderRule: {
    flex: 1,
    height: 1,
    marginLeft: 10,
    backgroundColor: palette.ingredientRowBorder,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.ingredientRowBorder,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    letterSpacing: -0.15,
    lineHeight: 20,
  },
  rowQty: {
    letterSpacing: 1.2,
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
  stickyDockWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  dock: {
    borderRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
    shadowColor: '#2A3A26',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
  },
  dockHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dockTitle: {
    letterSpacing: -0.6,
    lineHeight: 22,
  },
  dockEst: {
    alignItems: 'flex-end',
    gap: 2,
  },
  dockEstValue: {
    letterSpacing: -0.6,
    lineHeight: 22,
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
