export {};
// The legacy persistence test imports an HTTP entrypoint. Suppress its listener
// only in this test harness so the complete backend suite can run offline.
const original = Deno.serve;
Deno.serve = (() => ({})) as unknown as typeof Deno.serve;
try {
  await import('../../supabase/functions/generate-recipe/persist.test.ts');
} finally {
  Deno.serve = original;
}
