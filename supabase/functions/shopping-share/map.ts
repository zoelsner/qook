export type ClientGroceryItem = {
  name: string;
  quantityAmount?: number;
  quantityUnit?: string;
  quantityText?: string;
};

export type InstacartItem = {
  name: string;
  quantity: number;
  unit: string;
  display_text: string;
};

export function toInstacartItem(item: ClientGroceryItem): InstacartItem {
  const rawUnit = item.quantityUnit;
  const unit = !rawUnit || rawUnit === "count" ? "each" : rawUnit;
  return {
    name: item.name,
    quantity: item.quantityAmount ?? 1,
    unit,
    display_text: item.quantityText || item.name,
  };
}
