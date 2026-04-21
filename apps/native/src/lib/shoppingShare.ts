import { Alert, Linking, Share } from 'react-native';
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

// Flat comma-joined query for search-bar deep links.
function formatSearchQuery(items: GroceryItem[]): string {
  return items
    .map((i) => i.name.trim())
    .filter(Boolean)
    .join(', ');
}

function openUrl(url: string) {
  void Linking.openURL(url).catch(() => {
    Alert.alert(
      'Cannot open link',
      'We could not hand off to the store. Copy the list instead?'
    );
  });
}

export function openInstacart(items: GroceryItem[]) {
  const q = formatSearchQuery(items);
  if (!q) return;
  // Instacart public search URL — each item isn't deduped/quantified,
  // but the comma-joined query lands the user on a search results page
  // where they can add items to their cart. Real cart prefill needs
  // the Connect Platform API (v1.1 gate).
  const url = `https://www.instacart.com/store/s?k=${encodeURIComponent(q)}`;
  openUrl(url);
}

export function openAmazonFresh(items: GroceryItem[]) {
  const q = formatSearchQuery(items);
  if (!q) return;
  const url = `https://www.amazon.com/s?k=${encodeURIComponent(
    q
  )}&i=amazonfresh`;
  openUrl(url);
}

export async function copyList(items: GroceryItem[]): Promise<boolean> {
  const text = formatListText(items);
  if (!text) return false;
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

export async function shareList(items: GroceryItem[]): Promise<void> {
  const text = formatListText(items);
  if (!text) return;
  try {
    await Share.share({ message: text });
  } catch {
    /* user dismissed */
  }
}
