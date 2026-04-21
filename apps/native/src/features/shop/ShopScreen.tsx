import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Svg, { Path } from 'react-native-svg';
import type { GroceryCategory, GroceryItem } from '@qook/shared';

import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import {
  PaintedCheckbox,
  PaintedButton,
  IconPill,
  IconArrowRight,
} from '../../components/painted';
import { palette, spacing } from '../../design';
import { api } from '../../services/api';
import { useHaptics } from '../../hooks/useHaptics';

const CATEGORY_ORDER: GroceryCategory[] = [
  'Produce',
  'Protein',
  'Dairy',
  'Pantry',
  'Frozen',
  'Bakery',
  'Other',
];

export function ShopScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { select, press } = useHaptics();
  const { data: items = [] } = useQuery({
    queryKey: ['groceries'],
    queryFn: () => api.getGroceries(),
  });

  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const map = new Map<GroceryCategory, GroceryItem[]>();
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return CATEGORY_ORDER.map((c) => ({
      category: c,
      items: map.get(c) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [items]);

  const totalItems = items.length;
  const checkedCount = items.filter(
    (i) => optimistic[i.id] ?? i.checked
  ).length;
  const remaining = totalItems - checkedCount;

  const toggleMutation = useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) =>
      api.toggleGrocery(id, checked),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['groceries'] });
    },
  });

  const handleToggle = (id: string, nextChecked: boolean) => {
    select();
    setOptimistic((prev) => ({ ...prev, [id]: nextChecked }));
    toggleMutation.mutate({ id, checked: nextChecked });
  };

  const recipesReferenced = useMemo(() => {
    const titles = new Set<string>();
    items.forEach((item) => {
      item.sourceRecipeTitles?.forEach((t) => titles.add(t));
    });
    return titles.size;
  }, [items]);

  // Tab bar floats at bottom (height 68, gap from bottom insets ≈ 16). Dock
  // sits above the tab bar with a small breathing gap.
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
              {totalItems} items · {recipesReferenced} recipes
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
        <IconPill onPress={() => press()} accessibilityLabel="Add item">
          <AddIcon />
        </IconPill>
      </View>

      <View style={{ height: spacing.xl - 4 }} />

      {grouped.map(({ category, items: groupItems }, idx) => (
        <View key={category} style={idx > 0 ? { marginTop: spacing.lg } : null}>
          <View style={styles.sectionHeader}>
            <Mono size={10} bold color={palette.accentDeep}>
              {category} · {groupItems.length}
            </Mono>
            <View style={styles.sectionHeaderRule} />
          </View>
          {groupItems.map((item) => {
            const isChecked = optimistic[item.id] ?? item.checked;
            return (
              <GroceryRow
                key={item.id}
                item={item}
                checked={isChecked}
                onToggle={() => handleToggle(item.id, !isChecked)}
              />
            );
          })}
        </View>
      ))}

        <View style={{ height: 200 }} />
      </ScreenShell>

      <View style={[styles.stickyDockWrap, { bottom: dockBottom }]} pointerEvents="box-none">
        <ShopDock remaining={remaining} onShop={() => press()} />
      </View>
    </View>
  );
}

function GroceryRow({
  item,
  checked,
  onToggle,
}: {
  item: GroceryItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const recipeLine = item.sourceRecipeTitles?.[0];
  const extraCount = (item.sourceRecipeTitles?.length ?? 1) - 1;
  const quantity = formatQuantity(item);
  const quantityShort = formatShort(item);
  const subText = recipeLine
    ? extraCount > 0
      ? `${quantity} · multiple recipes`
      : `${quantity} · ${recipeLine}`
    : quantity;

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.row,
        pressed ? { opacity: 0.85 } : null,
      ]}
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
        {quantityShort}
      </Mono>
    </Pressable>
  );
}

function ShopDock({
  remaining,
  onShop,
}: {
  remaining: number;
  onShop: () => void;
}) {
  const estimatedDollars = Math.max(8, remaining * 3.5).toFixed(0);
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
      <PaintedButton
        label="Shop with Instacart"
        size="lg"
        tone="forest"
        onPress={onShop}
        trailingIcon={<IconArrowRight size={14} color={palette.surface} />}
        fullWidth
      />
      <View style={{ height: spacing.sm + 2 }} />
      <View style={styles.fallbackRow}>
        <Pressable hitSlop={6}>
          <BodyText size={12} weight="semi" color={palette.textSecondary}>
            Copy list
          </BodyText>
        </Pressable>
        <View style={styles.fallbackDot} />
        <Pressable hitSlop={6}>
          <BodyText size={12} weight="semi" color={palette.textSecondary}>
            Share
          </BodyText>
        </Pressable>
        <View style={styles.fallbackDot} />
        <Pressable hitSlop={6}>
          <BodyText size={12} weight="semi" color={palette.textSecondary}>
            AmazonFresh
          </BodyText>
        </Pressable>
      </View>
    </View>
  );
}

function AddIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={palette.ink}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function formatQuantity(item: GroceryItem): string {
  if (item.quantityText) return item.quantityText;
  if (item.quantityAmount == null) return '';
  const unit =
    item.quantityUnit && item.quantityUnit !== 'count' ? ` ${item.quantityUnit}` : '';
  return `${item.quantityAmount}${unit}`.trim();
}

function formatShort(item: GroceryItem): string {
  if (item.quantityText) return item.quantityText;
  if (item.quantityAmount == null) return '';
  if (item.quantityUnit === 'count' || !item.quantityUnit) {
    return `${item.quantityAmount}`;
  }
  return `${item.quantityAmount} ${item.quantityUnit}`;
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
