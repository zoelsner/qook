import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { contract, mismatch, storedRecipe, validRecipe } from "./fixtures.ts";
import { dinnerBrief, briefContext } from "../_shared/dinner-brief.ts";
import { buildLiveContext } from "../_shared/context.ts";
import { fillSignature } from "../_shared/fill-contract.ts";

// Exercise the actual HTTP handler. Every network request is intercepted;
// tests run without --allow-net and never access the deployed service.
let handler: (req: Request) => Promise<Response>;
const serve = Deno.serve;
Deno.serve = ((callback: typeof handler) => {
  handler = callback;
  return {};
}) as typeof Deno.serve;
try { await import("./index.ts"); } finally { Deno.serve = serve; }

const id = "11111111-1111-4111-8111-111111111111";
const winnerId = "22222222-2222-4222-8222-222222222222";
const request = () => new Request("http://qook.test/fill-recipe", {
  method: "POST", headers: { Authorization: "Bearer synthetic-qa", "Content-Type": "application/json" },
  body: JSON.stringify({ recipeId: id, generationSessionId: "44444444-4444-4444-8444-444444444444", context: "Changed later: oven only, peanut oil is fine" }),
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

async function scenario(options: { outputs?: unknown[]; alreadyFull?: boolean; badExisting?: boolean; race?: "good" | "bad"; missingBrief?: boolean; forbidden?: boolean; wrongOwner?: boolean; errorPersistence?: "response" | "reject" }, check: (result: { response: Response; writes: Record<string, unknown>[]; deleted: boolean; calls: number; repeat: () => Promise<Response> }) => Promise<void>) {
  for (const [key, value] of Object.entries({ SUPABASE_URL: "http://qook.test", SUPABASE_ANON_KEY: "synthetic-anon", SUPABASE_SERVICE_ROLE_KEY: "synthetic-service", OPENROUTER_API_KEY: "synthetic-provider" })) Deno.env.set(key, value);
  const oldFetch = globalThis.fetch;
  const brief = dinnerBrief(buildLiveContext(contract.tier, { avoid_ingredients: ['peanut'] }, 'Peanut allergy. Microwave only, 12 minutes.'));
  let item = { id: 'private-item', recipe_id: id, generation_sessions: { user_id: options.wrongOwner ? 'other-user' : '33333333-3333-4333-8333-333333333333' }, prompt_meta: { version: 1, originalRecipeId: id, brief, contract } };
  const full = { ...storedRecipe(), id, signature: await fillSignature(validRecipe(), { ...contract, brief }) };
  if (options.forbidden) {
    const r = validRecipe();
    r.ingredientGroups[0].items.push({ item: 'peanut oil', quantity: '1 tsp', notes: null, parsed: { canonical_name: 'peanut oil', canonical_key: 'peanut_oil', category: 'Pantry', amount: 1, unit: 'tsp' } });
    Object.assign(full, storedRecipe(r), { id });
  }
  let row: Record<string, unknown> = options.alreadyFull ? full : { ...full, content_status: "proposal", total_time_min: 12, ingredient_groups: [], workflow_sections: [] };
  const writes: Record<string, unknown>[] = [];
  let calls = 0, deleted = false, lookups = 0;
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init); const url = new URL(req.url);
    if (url.hostname === "openrouter.ai") {
      const body = await req.json();
      assert(String(body.messages[1].content).includes('peanut'));
      const output = options.outputs?.[calls] ?? validRecipe(); calls++;
      return json({ choices: [{ message: { content: JSON.stringify(output) } }] });
    }
    assertEquals(url.hostname, "qook.test", "unexpected network host");
    if (url.pathname === "/auth/v1/user") return json({ id: "33333333-3333-4333-8333-333333333333", aud: "authenticated" });
    if (url.pathname === "/rest/v1/generation_items") {
      if (req.method === 'PATCH') { item = { ...item, ...await req.json() }; return new Response(null, { status: 204 }); }
      assertEquals(url.searchParams.get('generation_sessions.user_id'), 'eq.33333333-3333-4333-8333-333333333333');
      return json(options.missingBrief ? [] : [item]);
    }
    if (url.pathname === "/rest/v1/user_preferences") throw new Error('Mutable preferences must not be fetched during fill');
    if (url.pathname.startsWith("/rest/v1/rpc/")) return json(null);
    assertEquals(url.pathname, "/rest/v1/recipes");
    if (req.method === "DELETE") { deleted = true; return new Response(null, { status: 204 }); }
    if (req.method === "PATCH") {
      const body = await req.json(); writes.push(body);
      if (body.generation_error && options.errorPersistence === "response") return json({ code: "23514", message: "private-database-detail" }, 400);
      if (body.generation_error && options.errorPersistence === "reject") throw new Error("private-database-detail");
      if (options.race && body.content_status === "full") return json({ code: "23505", message: "synthetic concurrent insert" }, 409);
      row = { ...row, ...body }; return new Response(null, { status: 204 });
    }
    if (url.searchParams.has("signature")) {
      lookups++;
      if (options.race && lookups > 1) return json([{ ...storedRecipe(options.race === "good" ? validRecipe() : mismatch), id: winnerId }]);
      return json(options.badExisting ? [{ ...storedRecipe(mismatch), id: winnerId }] : []);
    }
    if (url.searchParams.get('id') === 'eq.' + winnerId) return json([{ ...storedRecipe(), id: winnerId }]);
    return json(deleted ? [] : [row]);
  };
  try {
    const response = await handler(request());
    await check({ response, writes, deleted, calls, repeat: () => handler(request()) });
  } finally { globalThis.fetch = oldFetch; }
}

Deno.test("HTTP fill rejects observed mismatch then persists only corrected full recipe; repeat is idempotent", async () => {
  await scenario({ outputs: [mismatch, validRecipe()] }, async ({ response, writes, calls, repeat }) => {
    assertEquals(response.status, 200); assertEquals(calls, 2);
    assertEquals(writes.filter(w => w.content_status === "full").length, 1);
    assertEquals(writes[0].workflow_sections, validRecipe().workflowSections);
    assertEquals((await repeat()).status, 200);
    assertEquals(writes.length, 1);
  });
});
Deno.test("HTTP repeated bad output never promotes the proposal; error supports a later retry", async () => {
  await scenario({ outputs: [mismatch, mismatch, validRecipe()] }, async ({ response, writes, calls, repeat }) => {
    assertEquals(response.status, 502); assertEquals(calls, 2);
    assert(writes.every(w => w.content_status !== "full"));
    assert(writes.some(w => typeof w.generation_error === "string"));
    assertEquals((await repeat()).status, 200);
    assertEquals(writes.at(-1)?.generation_error, null);
  });
});
Deno.test("HTTP signature cache cannot redirect to a conflicting full method", async () => {
  await scenario({ badExisting: true }, async ({ response, deleted, writes }) => {
    assertEquals(await response.json(), { recipeId: id, status: "full" });
    assertEquals(deleted, false); assertEquals(writes.length, 1);
  });
});
Deno.test("HTTP concurrent-write retry accepts a faithful winner", async () => {
  await scenario({ race: "good" }, async ({ response, deleted, repeat }) => {
    assertEquals(await response.json(), { recipeId: winnerId, status: "full" });
    assertEquals(deleted, true);
    assertEquals(await (await repeat()).json(), { recipeId: winnerId, status: "full" });
  });
});
Deno.test("HTTP concurrent-write retry rejects a conflicting winner without deleting the proposal", async () => {
  await scenario({ race: "bad" }, async ({ response, deleted }) => {
    assertEquals(response.status, 502); assertEquals(deleted, false);
  });
});

Deno.test("HTTP reopen fails closed for peanut-oil full cache and missing private brief", async () => {
  await scenario({ alreadyFull: true, forbidden: true }, async ({ response, calls }) => { assertEquals(response.status, 422); assertEquals(calls, 0); });
  await scenario({ missingBrief: true }, async ({ response, calls }) => { assertEquals(response.status, 422); assertEquals(calls, 0); });
});
Deno.test("HTTP saved brief cannot be read from another user's association", async () => {
  await scenario({ wrongOwner: true }, async ({ response, calls }) => { assertEquals(response.status, 422); assertEquals(calls, 0); });
});

Deno.test("HTTP failed fill keeps private dietary restrictions out of global error fields and logs", async () => {
  const forbidden = validRecipe();
  forbidden.ingredientGroups[0].items.push({ item: "peanut oil", quantity: "1 tsp", notes: null, parsed: { canonical_name: "peanut oil", canonical_key: "peanut_oil", category: "Pantry", amount: 1, unit: "tsp" } });
  const logs: string[] = [];
  const oldError = console.error;
  console.error = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
  try {
    await scenario({ outputs: [forbidden, forbidden, validRecipe()] }, async ({ response, writes, calls, repeat }) => {
      assertEquals(response.status, 502);
      assertEquals(calls, 2);
      assertEquals(writes.map(write => write.generation_error), ["Recipe generation failed. Try again."]);
      assert(writes.every(write => write.content_status !== "full"));
      const visible = JSON.stringify({ writes, logs, response: await response.json() });
      for (const privateText of ["peanut", "Microwave only", contract.title]) {
        assert(!visible.includes(privateText), "private dinner context escaped through an error");
      }
      assert(logs.some(line => line.includes('"tag":"qook_failure"')));
      assertEquals((await repeat()).status, 200);
      assertEquals(writes.at(-1)?.generation_error, null);
    });
  } finally {
    console.error = oldError;
  }
});

Deno.test("HTTP failed fill retains its generic response when error persistence fails", async () => {
  const logs: string[] = [];
  const oldError = console.error;
  console.error = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
  try {
    for (const errorPersistence of ["response", "reject"] as const) {
      await scenario({ outputs: [mismatch, mismatch], errorPersistence }, async ({ response }) => {
        assertEquals(response.status, 502);
        assert(!JSON.stringify({ response: await response.json(), logs }).includes("private-database-detail"));
      });
    }
    assertEquals(logs.filter(line => line.includes('"stage":"error_persistence"')).length, 2);
  } finally {
    console.error = oldError;
  }
});
