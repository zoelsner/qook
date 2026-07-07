import Constants from 'expo-constants';
import EventSource from 'react-native-sse';
import type { EnergyTier, Recipe, Timestamp } from '@qook/shared';
import { ensureSession } from './supabase';
import { routeStreamEvent, parseBufferedSse } from './streamEventRouter';
import type { StreamCallbacks } from './streamEventRouter';

// Re-exported so any other consumer can still import the router from here;
// the bun assertion script imports it directly from streamEventRouter.ts
// instead (see that file's header comment for why).
export { routeStreamEvent, parseBufferedSse };
export type { StreamCallbacks };

// The edge mapper (dbRowToClientRecipe) emits createdAt/updatedAt as ISO
// strings, but the client Timestamp type is a branded number. Normalize at
// this client boundary rather than pretending the raw payload is already a
// Recipe.
export function normalizeFinalRecipes(recipes: unknown[]): Recipe[] {
  return (recipes as Record<string, unknown>[]).map((r) => ({
    ...r,
    createdAt: (typeof r.createdAt === 'string'
      ? Date.parse(r.createdAt)
      : r.createdAt) as Timestamp,
    updatedAt: (typeof r.updatedAt === 'string'
      ? Date.parse(r.updatedAt)
      : r.updatedAt) as Timestamp,
  })) as unknown as Recipe[];
}

export async function streamRecipes(
  tier: EnergyTier,
  context: string | undefined,
  cb: StreamCallbacks
): Promise<Recipe[]> {
  const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string;
  const token = await ensureSession();

  const url = `${supabaseUrl}/functions/v1/generate-recipe`;

  return new Promise<Recipe[]>((resolve, reject) => {
    const es = new EventSource<'title' | 'final'>(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, context: context?.trim() || undefined }),
      pollingInterval: 0,
    });

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      es.removeAllEventListeners();
      es.close();
      fn();
    };

    (['title', 'final'] as const).forEach((evt) => {
      es.addEventListener(evt, (e) => {
        routeStreamEvent(evt, (e as { data?: string | null }).data ?? '{}', {
          onTitle: cb.onTitle,
          onFinal: (recipes) =>
            finish(() => resolve(normalizeFinalRecipes(recipes))),
        });
      });
    });

    // react-native-sse dispatches both the backend's `event: error` SSE
    // frames AND connection-level failures (xhr error/timeout/exception)
    // through the same 'error' listener bucket. Server-sent error frames
    // always carry a `.data` payload; connection-level failures never do —
    // use that to tell them apart rather than registering two listeners on
    // the same event name (whichever fired first would silently win).
    es.addEventListener('error', (e) => {
      const raw = (e as { data?: string | null }).data;
      if (raw == null) {
        // Connection-level failure — reject distinctly so the caller can
        // fall back to a non-stream call.
        finish(() => reject(new Error('stream_connection_error')));
        return;
      }
      // routeStreamEvent swallows JSON-parse failures internally (it just
      // returns without calling onError) — so a malformed `error` frame
      // would otherwise never call onError, and the promise would hang
      // forever. Track whether it actually fired and reject as a
      // connection-level failure if not.
      let handled = false;
      routeStreamEvent('error', raw, {
        onError: (code, message) => {
          handled = true;
          cb.onError?.(code, message);
          finish(() => reject(new Error(message)));
        },
      });
      if (!handled) {
        finish(() => reject(new Error('stream_connection_error')));
      }
    });
  });
}
