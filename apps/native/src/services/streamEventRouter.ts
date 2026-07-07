// Pure SSE event routing logic for generate-recipe, split out from
// generateRecipeStream.ts so it can be unit-tested with `bun run` — that
// module (and its expo-constants/react-native-sse/supabase imports) pulls
// in React Native's Flow-syntax entry point, which bun's transpiler cannot
// parse. This file has zero RN-touching imports.

export type StreamCallbacks = {
  onTitle?: (index: number, title: string) => void;
  onFinal?: (recipes: unknown[]) => void;
  onError?: (code: string, message: string) => void;
};

export function routeStreamEvent(
  event: string,
  data: string,
  cb: StreamCallbacks
): void {
  try {
    const payload = JSON.parse(data);
    if (event === 'title') cb.onTitle?.(payload.index, payload.title);
    else if (event === 'final') cb.onFinal?.(payload.recipes ?? []);
    else if (event === 'error') {
      cb.onError?.(payload.code ?? 'generation_failed', payload.message ?? 'Something went wrong.');
    }
  } catch {
    /* malformed event — ignore */
  }
}

// Parses a full buffered SSE response body (as returned by a plain `fetch`,
// not the streaming EventSource client) into the last `final` or `error`
// event it contains. Pure — no RN-touching imports — so it can be unit
// tested with `bun run` alongside routeStreamEvent above.
export function parseBufferedSse(
  text: string
): { finalRecipes?: unknown[]; error?: { code: string; message: string } } {
  const blocks = text.split(/\n\n+/);
  let finalRecipes: unknown[] | undefined;
  let error: { code: string; message: string } | undefined;

  for (const block of blocks) {
    const lines = block.split('\n');
    const eventLine = lines.find((l) => l.startsWith('event:'));
    const dataLine = lines.find((l) => l.startsWith('data:'));
    if (!eventLine || !dataLine) continue;
    const event = eventLine.slice('event:'.length).trim();
    const data = dataLine.slice('data:'.length).trim();
    if (event !== 'final' && event !== 'error') continue;

    try {
      const payload = JSON.parse(data);
      if (event === 'final') {
        finalRecipes = payload.recipes ?? [];
      } else {
        error = {
          code: payload.code ?? 'generation_failed',
          message: payload.message ?? 'Something went wrong.',
        };
      }
    } catch {
      /* malformed event — ignore, fall through to caller's generic error */
    }
  }

  return { finalRecipes, error };
}
