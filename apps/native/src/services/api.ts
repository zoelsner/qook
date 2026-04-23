import Constants from 'expo-constants';
import type {
  CohortDeck,
  EnergyTier,
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

// Fisher-Yates shuffle (pure; no mutation of input).
function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Pick N recipes matching the requested tier. Falls back to adjacent tiers
// if the pool is too thin (shouldn't happen with 24 seed recipes, but safe).
function pickForTier(tier: EnergyTier, count = 3): Recipe[] {
  const primary = mockRecipes.filter((r) => r.tier === tier);
  if (primary.length >= count) return shuffle(primary).slice(0, count);
  const rest = mockRecipes.filter((r) => r.tier !== tier);
  return [...shuffle(primary), ...shuffle(rest)].slice(0, count);
}

export async function getTonightPlan(): Promise<Recipe[]> {
  if (mode === 'mock') {
    await lag();
    // Pick 3 varied meals across tiers for the generic "tonight" preview.
    return shuffle(mockRecipes).slice(0, 3);
  }
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .select('recipe:recipes(*)')
    .eq('date', new Date().toISOString().slice(0, 10));
  if (error) throw error;
  return (data as unknown as { recipe: Recipe }[]).map((row) => row.recipe);
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  if (mode === 'mock') {
    await lag(150);
    return mockRecipes.find((r) => r.id === id) ?? null;
  }
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Recipe | null) ?? null;
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

export async function getSwipeFeed(): Promise<Recipe[]> {
  if (mode === 'mock') {
    await lag();
    const byId = new Map(mockRecipes.map((r) => [r.id, r]));
    return mockDeck.recipeIds
      .map((id) => byId.get(id))
      .filter((r): r is Recipe => Boolean(r));
  }
  const deck = await getCurrentDeck();
  if (!deck || deck.recipeIds.length === 0) return [];
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .in('id', deck.recipeIds);
  if (error) throw error;
  const order = new Map(deck.recipeIds.map((id, i) => [id, i]));
  return (data as Recipe[]).slice().sort((a, b) => {
    const ai = order.get(a.id) ?? 0;
    const bi = order.get(b.id) ?? 0;
    return ai - bi;
  });
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

export async function generateRecipesForEnergy(
  tier: EnergyTier,
  context?: string
): Promise<Recipe[]> {
  if (mode === 'mock') {
    await lag(1500);
    return pickForTier(tier, 3);
  }
  const { data, error } = await supabase.functions.invoke('generate-recipe', {
    body: { tier, context: context?.trim() || undefined },
  });
  if (error) throw error;
  return (data as { recipes: Recipe[] }).recipes;
}

export const api = {
  getTonightPlan,
  getRecipeById,
  getCurrentDeck,
  getSwipeFeed,
  recordSwipe,
  getGroceries,
  toggleGrocery,
  generateRecipesForEnergy,
};
