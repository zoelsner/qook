import Constants from 'expo-constants';
import type {
  CohortDeck,
  EnergyTier,
  GroceryItem,
  Recipe,
  Timestamp,
} from '@qook/shared';
import { supabase, ensureSession } from './supabase';
import { dbRowToRecipe } from './recipeRow';
import { mockRecipes } from './fixtures/recipes';
import { mockDeck } from './fixtures/decks';
import { mockGroceries } from './fixtures/groceries';
import { markRecipeArtRequested, unmarkRecipeArtRequested } from '../hooks/recipeArtState';

type ApiMode = 'mock' | 'live';

const mode = (Constants.expoConfig?.extra?.apiMode ?? 'mock') as ApiMode;
const supabaseUrl = (Constants.expoConfig?.extra?.supabaseUrl ?? '') as string;
const mealImagesBase = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/meal-images`;
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
  return data ? dbRowToRecipe(data, mealImagesBase) : null;
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
  const { streamRecipes, normalizeFinalRecipes, parseBufferedSse } = await import(
    './generateRecipeStream'
  );
  const { useGenerationSession } = await import('../stores/generationSession');
  try {
    return await streamRecipes(tier, context, {
      onTitle: (index, title) =>
        useGenerationSession.getState().pushTitle(index, title),
      onError: () => {
        /* surfaced via thrown error below */
      },
    });
  } catch (streamErr) {
    if ((streamErr as Error).message !== 'stream_connection_error') throw streamErr;
    // react-native-sse surfaces both real connection failures AND pre-stream
    // HTTP errors (429 rate-limit, 400, 500 — which arrive as an error event
    // with no `.data`) as the same 'stream_connection_error'. EventSource is
    // kept for the streaming UX; this buffered fetch is the fallback that
    // recovers the server's typed {code,message} either way — from the JSON
    // error body directly if the request never entered the stream, or by
    // parsing the full SSE text if it did.
    const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string;
    const anonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string;
    const token = await ensureSession();
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-recipe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        apikey: anonKey,
      },
      body: JSON.stringify({ tier, context: context?.trim() || undefined }),
    });

    const contentType = res.headers.get('content-type') ?? '';
    if (!res.ok && contentType.includes('application/json')) {
      const body = (await res.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      throw new Error(body.message ?? body.code ?? 'Something went wrong.');
    }

    const text = await res.text();
    const { finalRecipes, error } = parseBufferedSse(text);
    if (finalRecipes) return normalizeFinalRecipes(finalRecipes);
    if (error) throw new Error(error.message ?? error.code);
    throw new Error('Something went wrong.');
  }
}

// Spotlight-first hero art (design-spotlight-art §1): fired for the default
// draft-time proposal, a review-time proposal switch, or a detail-modal open
// on a pending/failed row — never for all 3 proposals up front. Called but NOT
// awaited by the UI. The server's atomic pending|failed→generating lock only
// prevents CONCURRENT duplicate generations for a row — a failed row can still
// be retried, and each retry is a new paid attempt. Marks the id requested
// first (recipeArtState) so the poll guard lets a 'pending' row poll once its
// generation is actually in flight; unmarks it again on failure so a request
// that never reached the server doesn't leave the row polling forever with
// nothing coming. No-op in mock mode: fixture recipes have no DB row.
export async function requestRecipeImage(recipeId: string): Promise<void> {
  markRecipeArtRequested(recipeId); // enables poll for this row while 'pending'
  if (mode === 'mock') return;
  try {
    await ensureSession();
    const { error } = await supabase.functions.invoke('generate-image', {
      body: { recipeId },
    });
    if (error) {
      unmarkRecipeArtRequested(recipeId);
      if (__DEV__) console.warn(`[recipe-image] ${recipeId}: ${error.message}`);
    }
  } catch (error) {
    unmarkRecipeArtRequested(recipeId);
    if (__DEV__) {
      console.warn(`[recipe-image] ${recipeId}: request failed`, error);
    }
  }
}

// Phase-1 (spec 2026-07-10): deal a hand of 5 proposals — one cheap Luna call.
// The edge already maps rows to client shape; we only normalize the ISO
// createdAt/updatedAt strings to the branded Timestamp number. Mock mode returns
// 5 tier-matched fixtures (already full, with local art).
export async function generateProposals(
  tier: EnergyTier,
  context?: string,
  energyMix?: string
): Promise<Recipe[]> {
  if (mode === 'mock') {
    await lag(1200);
    return pickForTier(tier, 5);
  }
  await ensureSession();
  const { data, error } = await supabase.functions.invoke('generate-proposals', {
    body: { tier, context: context?.trim() || undefined, energyMix: energyMix?.trim() || undefined },
  });
  if (error) {
    const msg = (error as { message?: string }).message ?? 'Something went wrong.';
    throw new Error(msg);
  }
  const proposals = ((data as { proposals?: unknown[] })?.proposals ?? []) as Record<
    string,
    unknown
  >[];
  return proposals.map((r) => ({
    ...r,
    createdAt: (typeof r.createdAt === 'string'
      ? Date.parse(r.createdAt)
      : r.createdAt) as Timestamp,
    updatedAt: (typeof r.updatedAt === 'string'
      ? Date.parse(r.updatedAt)
      : r.updatedAt) as Timestamp,
  })) as unknown as Recipe[];
}

// Phase-2 (spec 2026-07-10): write ONE full recipe for a kept/cooked proposal.
// Quota-free. Returns the FINAL row id — a cache hit redirects to a pre-existing
// full row and the skeleton is deleted server-side, so callers must adopt the
// returned recipeId. Called but the deck does not block on it.
export async function fillRecipe(
  recipeId: string,
  context?: string
): Promise<{ recipeId: string; status: string }> {
  if (mode === 'mock') {
    await lag(200);
    return { recipeId, status: 'full' };
  }
  await ensureSession();
  const { data, error } = await supabase.functions.invoke('fill-recipe', {
    body: { recipeId, context: context?.trim() || undefined },
  });
  if (error) {
    const msg = (error as { message?: string }).message ?? 'Something went wrong.';
    throw new Error(msg);
  }
  const out = data as { recipeId?: string; status?: string };
  return { recipeId: out?.recipeId ?? recipeId, status: out?.status ?? 'full' };
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
  generateProposals,
  fillRecipe,
  requestRecipeImage,
};
