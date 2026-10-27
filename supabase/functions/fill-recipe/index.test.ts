import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { contract, mismatch, storedRecipe, validRecipe } from "./fixtures.ts";
import { dinnerBrief } from "../_shared/dinner-brief.ts";
import { buildLiveContext } from "../_shared/context.ts";
import { fillSignature } from "../_shared/fill-contract.ts";
import type { DishContract } from "../_shared/dish-contract.ts";

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

async function scenario(options: { outputs?: unknown[]; alreadyFull?: boolean; badExisting?: boolean; race?: "good" | "bad"; missingBrief?: boolean; forbidden?: boolean; wrongOwner?: boolean; errorPersistence?: "response" | "reject"; cacheCandidates?: Record<string, unknown>[]; cacheFailure?: boolean; associationFailure?: boolean; dishContract?: unknown; publicDishContract?: unknown }, check: (result: { response: Response; writes: Record<string, unknown>[]; associations: Record<string, unknown>[]; events: string[]; deleted: boolean; calls: number; repeat: () => Promise<Response> }) => void | Promise<void>) {
  for (const [key, value] of Object.entries({ SUPABASE_URL: "http://qook.test", SUPABASE_ANON_KEY: "synthetic-anon", SUPABASE_SERVICE_ROLE_KEY: "synthetic-service", OPENROUTER_API_KEY: "synthetic-provider" })) Deno.env.set(key, value);
  const oldFetch = globalThis.fetch;
  const brief = dinnerBrief(buildLiveContext(contract.tier, { avoid_ingredients: ['peanut'] }, 'Peanut allergy. Microwave only, 12 minutes.'));
  const savedContract = { ...contract, ...(options.dishContract === undefined ? {} : { dishContract: options.dishContract }) };
  let item = { id: 'private-item', recipe_id: id, generation_sessions: { user_id: options.wrongOwner ? 'other-user' : '33333333-3333-4333-8333-333333333333' }, prompt_meta: { version: 1, originalRecipeId: id, brief, contract: savedContract } };
  const publicDish = Object.hasOwn(options, 'publicDishContract') ? options.publicDishContract : options.dishContract;
  const full = { ...storedRecipe(), id, signature: await fillSignature(validRecipe(), { ...contract, brief }), ...(publicDish === undefined ? {} : { dish_contract: publicDish }) };
  if (options.forbidden) {
    const r = validRecipe();
    r.ingredientGroups[0].items.push({ item: 'peanut oil', quantity: '1 tsp', notes: null, parsed: { canonical_name: 'peanut oil', canonical_key: 'peanut_oil', category: 'Pantry', amount: 1, unit: 'tsp' } });
    Object.assign(full, storedRecipe(r), { id });
  }
  let row: Record<string, unknown> = options.alreadyFull ? full : { ...full, content_status: "proposal", total_time_min: 12, ingredient_groups: [], workflow_sections: [] };
  const writes: Record<string, unknown>[] = [];
  const associations: Record<string, unknown>[] = [];
  const events: string[] = [];
  let calls = 0, deleted = false, lookups = 0;
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init); const url = new URL(req.url);
    if (url.hostname === "openrouter.ai") {
      events.push("model");
      const body = await req.json();
      assert(String(body.messages[1].content).includes('peanut'));
      const output = options.outputs?.[calls] ?? validRecipe(); calls++;
      return json({ choices: [{ message: { content: JSON.stringify(output) } }] });
    }
    assertEquals(url.hostname, "qook.test", "unexpected network host");
    if (url.pathname === "/auth/v1/user") return json({ id: "33333333-3333-4333-8333-333333333333", aud: "authenticated" });
    if (url.pathname === "/rest/v1/generation_items") {
      if (req.method === 'PATCH') {
        events.push("associate");
        assertEquals(url.searchParams.get('id'), 'eq.private-item');
        const patch = await req.json(); associations.push(patch);
        if (options.associationFailure) return json({ message: "private-association-error" }, 400);
        item = { ...item, ...patch }; return new Response(null, { status: 204 });
      }
      assertEquals(url.searchParams.get('generation_sessions.user_id'), 'eq.33333333-3333-4333-8333-333333333333');
      return json(options.missingBrief ? [] : [item]);
    }
    if (url.pathname === "/rest/v1/user_preferences") throw new Error('Mutable preferences must not be fetched during fill');
    if (url.pathname.startsWith("/rest/v1/rpc/")) return json(null);
    assertEquals(url.pathname, "/rest/v1/recipes");
    if (req.method === "DELETE") { deleted = true; return new Response(null, { status: 204 }); }
    if (req.method === "PATCH") {
      const body = await req.json(); writes.push(body);
      if (body.generation_error) {
        assertEquals(url.searchParams.get('content_status'), 'eq.proposal');
        if (row.content_status !== 'proposal') return new Response(null, { status: 204 });
      }
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
    if (url.searchParams.has("title")) {
      events.push("cache");
      assertEquals(url.searchParams.get("title"), "eq." + contract.title);
      assertEquals(url.searchParams.get("user_id"), "is.null");
      assertEquals(url.searchParams.get("content_status"), "eq.full");
      assertEquals(url.searchParams.get("limit"), "5");
      if (options.cacheFailure) return json({ message: "private-cache-error" }, 400);
      return json(options.cacheCandidates ?? []);
    }
    if (url.searchParams.get('id') === 'eq.' + winnerId) return json([options.cacheCandidates?.find(candidate => candidate.id === winnerId) ?? { ...storedRecipe(), id: winnerId }]);
    return json(deleted ? [] : [row]);
  };
  try {
    const response = await handler(request());
    await check({ response, writes, associations, events, deleted, calls, repeat: () => handler(request()) });
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

Deno.test("HTTP fill reuses an exact completed proposal before any paid call and redirects only its private item", async () => {
  const cached = { ...storedRecipe(), id: winnerId, image_status: "ready", image_storage_path: "cached-art.png" };
  await scenario({ cacheCandidates: [cached] }, async ({ response, writes, associations, events, deleted, calls, repeat }) => {
    assertEquals(await response.json(), { recipeId: winnerId, status: "full" });
    assertEquals(calls, 0);
    assertEquals(events, ["cache", "associate"]);
    assertEquals(associations, [{ recipe_id: winnerId }]);
    assertEquals(writes, []);
    assertEquals(deleted, false, "source art may still be running; preserve its recipe row");
    assertEquals(await (await repeat()).json(), { recipeId: winnerId, status: "full" });
    assertEquals(events, ["cache", "associate"], "reopen uses the adopted full row without another cache/model request");
  });
});

Deno.test("HTTP pre-model cache rejects changed proposal identity, method, servings and private allergy requirements", async () => {
  const forbidden = validRecipe();
  forbidden.ingredientGroups[0].items.push({ item: "peanut oil", quantity: "1 tsp", notes: null, parsed: { canonical_name: "peanut oil", canonical_key: "peanut_oil", category: "Pantry", amount: 1, unit: "tsp" } });
  const candidates = [
    { ...storedRecipe(), title: "Another dinner" },
    storedRecipe(mismatch),
    { ...storedRecipe(), serves: 4 },
    { ...storedRecipe(), proposal_ingredients: [...contract.ingredients, "spinach"] },
    { ...storedRecipe(), proposal_steps: ["Use the stovetop instead."] },
    storedRecipe(forbidden),
  ].map(row => ({ ...row, id: winnerId }));
  await scenario({ cacheCandidates: candidates }, async ({ response, associations, events, calls, deleted }) => {
    assertEquals(await response.json(), { recipeId: id, status: "full" });
    assertEquals(calls, 1);
    assertEquals(events, ["cache", "model"]);
    assertEquals(associations, []);
    assertEquals(deleted, false);
  });
});

Deno.test("HTTP cache read and adoption failures never purchase another fill or report a successful redirect", async () => {
  const logs: string[] = [];
  const oldError = console.error;
  console.error = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
  try {
    for (const options of [
      { cacheFailure: true },
      { cacheCandidates: [{ ...storedRecipe(), id: winnerId }], associationFailure: true },
    ]) {
      await scenario(options, async ({ response, writes, deleted, calls }) => {
        assertEquals(response.status, 502);
        assertEquals(calls, 0);
        assertEquals(deleted, false);
        assert(writes.every(write => write.content_status !== "full"));
        assert(!JSON.stringify({ response: await response.json(), logs }).includes("private-cache-error"));
        assert(!JSON.stringify(logs).includes("private-association-error"));
      });
    }
  } finally { console.error = oldError; }
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
  await scenario({ race: "bad" }, ({ response, deleted }) => {
    assertEquals(response.status, 502); assertEquals(deleted, false);
  });
});

Deno.test("HTTP reopen fails closed for peanut-oil full cache and missing private brief", async () => {
  await scenario({ alreadyFull: true, forbidden: true }, ({ response, calls }) => { assertEquals(response.status, 422); assertEquals(calls, 0); });
  await scenario({ missingBrief: true }, ({ response, calls }) => { assertEquals(response.status, 422); assertEquals(calls, 0); });
});
Deno.test("HTTP saved brief cannot be read from another user's association", async () => {
  await scenario({ wrongOwner: true }, ({ response, calls }) => { assertEquals(response.status, 422); assertEquals(calls, 0); });
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

const eggDish: DishContract = {
  version: 1,
  components: [{ ingredientNames: ["eggs"], form: "soft microwave eggs", appearance: "set whites and golden yolks" }],
  plating: "Eggs nestled in tomato sauce with feta scattered over them.",
};

Deno.test("HTTP private/public dish mismatch and malformed identity fail before cache, AI or writes", async () => {
  for (const options of [
    { dishContract: eggDish, publicDishContract: null },
    { dishContract: eggDish, publicDishContract: { ...eggDish, plating: "A different dish arrangement." } },
    { dishContract: { ...eggDish, version: 2 } },
    { publicDishContract: { version: 1 } },
  ]) {
    await scenario(options, ({ response, writes, associations, events, calls }) => {
      assertEquals(response.status, 422);
      assertEquals(calls, 0);
      assertEquals(events, []);
      assertEquals(writes, []);
      assertEquals(associations, []);
    });
  }
});

Deno.test("HTTP exact dish cache avoids generation and full fill never rewrites contract or art", async () => {
  const matching = { ...storedRecipe(), id: winnerId, dish_contract: eggDish, image_status: "ready", image_storage_path: "same-dish.png" };
  await scenario({ dishContract: eggDish, cacheCandidates: [matching] }, async ({ response, calls, writes, repeat }) => {
    assertEquals(await response.json(), { recipeId: winnerId, status: "full" });
    assertEquals(calls, 0);
    assertEquals(writes, []);
    assertEquals((await repeat()).status, 200);
  });
  const changed = { ...matching, dish_contract: { ...eggDish, components: [{ ...eggDish.components[0], form: "scrambled eggs" }] } };
  await scenario({ dishContract: eggDish, cacheCandidates: [changed] }, async ({ response, calls, associations, writes }) => {
    assertEquals(await response.json(), { recipeId: id, status: "full" });
    assertEquals(calls, 1);
    assertEquals(associations, []);
    assert(writes.every(write => !("dish_contract" in write) && !("image_status" in write) && !("image_storage_path" in write)));
  });
});
