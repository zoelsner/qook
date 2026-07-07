// scripts/test-generate-stream.ts
// Run: bun run scripts/test-generate-stream.ts
//
// Imports from streamEventRouter.ts (not generateRecipeStream.ts) — the
// latter pulls in expo-constants/react-native-sse/supabase, which transitively
// require react-native's Flow-syntax entry point that bun's transpiler
// cannot parse. The pure event-routing logic lives in streamEventRouter.ts
// specifically so it's testable here.
import { routeStreamEvent, parseBufferedSse } from '../apps/native/src/services/streamEventRouter';

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  passed++;
}

const titles: Array<[number, string]> = [];
let finalRecipes: unknown[] | null = null;
let err: { code: string; message: string } | null = null;

const cb = {
  onTitle: (i: number, t: string) => titles.push([i, t]),
  onFinal: (r: unknown[]) => (finalRecipes = r),
  onError: (code: string, message: string) => (err = { code, message }),
};

routeStreamEvent('title', JSON.stringify({ index: 0, title: 'Sesame Soba' }), cb);
assert(titles.length === 1 && titles[0][1] === 'Sesame Soba', 'title routed');

routeStreamEvent('final', JSON.stringify({ recipes: [{ id: 'x' }] }), cb);
assert(finalRecipes !== null && finalRecipes!.length === 1, 'final routed');

routeStreamEvent('error', JSON.stringify({ code: 'rate_limited', message: 'slow down' }), cb);
assert(err !== null && err!.code === 'rate_limited', 'error routed');

// parseBufferedSse — the buffered-fetch fallback's SSE-text parser.
const partialAndFinal = [
  'event: ready\ndata: {"status":"generating"}',
  'event: title\ndata: {"index":0,"title":"Sesame Soba"}',
  'event: partial\ndata: {"recipes":[{"title":"Sesame Soba"}]}',
  'event: final\ndata: {"recipes":[{"id":"x"},{"id":"y"}]}',
  'event: done\ndata: {}',
].join('\n\n');
const finalResult = parseBufferedSse(partialAndFinal);
assert(
  finalResult.finalRecipes !== undefined && finalResult.finalRecipes!.length === 2,
  'parseBufferedSse extracts final recipes from a partial+final stream'
);
assert(finalResult.error === undefined, 'parseBufferedSse leaves error undefined on success');

const errorOnly = [
  'event: ready\ndata: {"status":"generating"}',
  'event: error\ndata: {"code":"rate_limited","message":"You\'ve hit today\'s recipe limit — back tomorrow."}',
].join('\n\n');
const errorResult = parseBufferedSse(errorOnly);
assert(errorResult.finalRecipes === undefined, 'parseBufferedSse leaves finalRecipes undefined on error');
assert(
  errorResult.error?.code === 'rate_limited' &&
    errorResult.error?.message === "You've hit today's recipe limit — back tomorrow.",
  'parseBufferedSse extracts the error event'
);

const garbage = 'not an sse stream at all, just noise';
const garbageResult = parseBufferedSse(garbage);
assert(
  garbageResult.finalRecipes === undefined && garbageResult.error === undefined,
  'parseBufferedSse returns neither final nor error for garbage input'
);

console.log(`OK — ${passed} assertions passed`);
