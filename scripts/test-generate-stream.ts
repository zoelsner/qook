// scripts/test-generate-stream.ts
// Run: bun run scripts/test-generate-stream.ts
//
// Imports from streamEventRouter.ts (not generateRecipeStream.ts) — the
// latter pulls in expo-constants/react-native-sse/supabase, which transitively
// require react-native's Flow-syntax entry point that bun's transpiler
// cannot parse. The pure event-routing logic lives in streamEventRouter.ts
// specifically so it's testable here.
import { routeStreamEvent } from '../apps/native/src/services/streamEventRouter';

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

console.log(`OK — ${passed} assertions passed`);
