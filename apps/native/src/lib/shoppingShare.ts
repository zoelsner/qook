import { Alert, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { GroceryItem } from '@qook/shared';

// Format a single grocery item for a text list — favours the original
// quantity string if the row had one, else falls back to amount/unit.
function formatItem(item: GroceryItem): string {
  const parts: string[] = [];
  if (item.quantityText) {
    parts.push(item.quantityText);
  } else if (item.quantityAmount != null) {
    const unit =
      item.quantityUnit && item.quantityUnit !== 'count' ? ` ${item.quantityUnit}` : '';
    parts.push(`${item.quantityAmount}${unit}`.trim());
  }
  parts.push(item.name);
  return parts.join(' ');
}

// Plain-text list, one per line. Used for Copy, Share, clipboard paste.
export function formatListText(items: GroceryItem[]): string {
  if (items.length === 0) return '';
  const body = items.map(formatItem).join('\n');
  return `Tonight's grocery list — Qook\n\n${body}`;
}

export async function copyList(items: GroceryItem[]): Promise<boolean> {
  const text = formatListText(items);
  if (!text) {
    Alert.alert('Nothing to shop yet', 'Check off fewer items or add a recipe to your week.');
    return false;
  }
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

export async function shareList(items: GroceryItem[]): Promise<void> {
  const text = formatListText(items);
  if (!text) {
    Alert.alert('Nothing to shop yet', 'Check off fewer items or add a recipe to your week.');
    return;
  }
  try {
    await Share.share({ message: text });
  } catch {
    /* user dismissed */
  }
}
