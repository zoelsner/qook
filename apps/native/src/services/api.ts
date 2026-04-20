import Constants from 'expo-constants';
import type {
  CohortDeck,
  GroceryItem,
  Recipe,
} from '@qook/shared';
import { supabase } from './supabase';
import { mockRecipes } from './fixtures/recipes';
import { mockDeck } from './fixtures/decks';
import { mockGroceries } from './fixtures/groceries';

type ApiMode = 'mock' | 'live';

const mode = (Constants.expoConfig?.extra?.apiMode ?? 'mock') as ApiMode;
const lag = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export async function getTonightPlan(): Promise<Recipe[]> {
  if (mode === 'mock') {
    await lag();
    return mockRecipes.slice(0, 3);
  }
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .select('recipe:recipes(*)')
    .eq('date', new Date().toISOString().slice(0, 10));
  if (error) throw error;
  return (data as unknown as { recipe: Recipe }[]).map((row) => row.recipe);
}

export async function getCurrentDeck(): Promise<CohortDeck | null> {
  if (mode === 'mock') {
    await lag();
    return mockDeck;
  }
  const { data, error } = await supabase
    .from('cohort_decks')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CohortDeck | null) ?? null;
}

export async function recordSwipe(
  recipeId: string,
  direction: 'like' | 'pass'
) {
  if (mode === 'mock') {
    await lag(80);
    return { ok: true };
  }
  const { error } = await supabase
    .from('swipes')
    .insert({ recipe_id: recipeId, direction });
  if (error) throw error;
  return { ok: true };
}

export async function getGroceries(): Promise<GroceryItem[]> {
  if (mode === 'mock') {
    await lag();
    return mockGroceries;
  }
  const { data, error } = await supabase.from('grocery_items').select('*');
  if (error) throw error;
  return data as GroceryItem[];
}

export async function toggleGrocery(id: string, checked: boolean) {
  if (mode === 'mock') {
    await lag(80);
    return;
  }
  const { error } = await supabase
    .from('grocery_items')
    .update({ checked })
    .eq('id', id);
  if (error) throw error;
}

export async function generateRecipesForEnergy(_tier: string): Promise<Recipe[]> {
  if (mode === 'mock') {
    await lag(1500);
    return mockRecipes.slice(0, 3);
  }
  const { data, error } = await supabase.functions.invoke('generate-recipes', {
    body: { tier: _tier },
  });
  if (error) throw error;
  return (data as { recipes: Recipe[] }).recipes;
}

export const api = {
  getTonightPlan,
  getCurrentDeck,
  recordSwipe,
  getGroceries,
  toggleGrocery,
  generateRecipesForEnergy,
};
