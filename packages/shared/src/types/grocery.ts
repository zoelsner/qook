import type { GroceryCategory, Timestamp } from './primitives';

export interface GroceryItem {
  id: string;
  userId: string;
  canonicalKey: string;
  name: string;
  quantityAmount?: number;
  quantityUnit?: string;
  quantityText?: string;
  category: GroceryCategory;
  checked: boolean;
  source: 'manual' | 'recipe_import';
  sourceRecipeTitles?: string[];
  sourceRecipeIds?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AggregatedGroceryItem {
  previewItemId: string;
  canonicalKey: string;
  name: string;
  quantityAmount?: number;
  quantityUnit?: string;
  quantityText?: string;
  category: GroceryCategory;
  recipeCount: number;
  sourceLines: string[];
}

export interface GroceryImportPreview {
  id: string;
  userId: string;
  sessionId: string;
  previewFingerprint: string;
  llmApplied: boolean;
  items: AggregatedGroceryItem[];
  createdAt: Timestamp;
}
