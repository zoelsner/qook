import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { GroceryCategory, GroceryItem } from '@qook/shared';
import { ScreenShell } from '../../components/ScreenShell';
import { PaperCard } from '../../components/PaperCard';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { palette, spacing } from '../../design';
import { api } from '../../services/api';

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
  const { data: items = [] } = useQuery({
    queryKey: ['groceries'],
    queryFn: () => api.getGroceries(),
  });

  const grouped = useMemo(() => {
    const map = new Map<GroceryCategory, GroceryItem[]>();
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return CATEGORY_ORDER.map((c) => ({ category: c, items: map.get(c) ?? [] })).filter(
      (g) => g.items.length > 0
    );
  }, [items]);

  return (
    <ScreenShell>
      <Mono>shop</Mono>
      <View style={{ height: spacing.sm }} />
      <DisplayText>Grocery list.</DisplayText>
      <BrushstrokeUnderline
        width={180}
        color={palette.primary}
        pathVariant="v3"
        style={{ marginTop: -4 }}
      />
      <View style={{ height: spacing.xl }} />

      {grouped.map(({ category, items: groupItems }, idx) => (
        <View key={category}>
          {idx > 0 && <View style={{ height: spacing.md }} />}
          <Mono>{category}</Mono>
          <View style={{ height: spacing.sm }} />
          <PaperCard padding={spacing.md}>
            {groupItems.map((item, i) => (
              <View key={item.id}>
                {i > 0 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: palette.haloRing,
                      marginVertical: spacing.sm,
                    }}
                  />
                )}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <BodyText
                    size={15}
                    weight={item.checked ? 'regular' : 'medium'}
                    color={item.checked ? palette.textTertiary : palette.text}
                    style={
                      item.checked ? { textDecorationLine: 'line-through' } : undefined
                    }
                  >
                    {item.name}
                  </BodyText>
                  {item.quantityText || item.quantityAmount ? (
                    <Mono color={palette.textSecondary}>
                      {item.quantityText ??
                        `${item.quantityAmount} ${item.quantityUnit ?? ''}`.trim()}
                    </Mono>
                  ) : null}
                </View>
              </View>
            ))}
          </PaperCard>
        </View>
      ))}
    </ScreenShell>
  );
}
