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
