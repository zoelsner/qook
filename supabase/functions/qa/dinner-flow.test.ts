import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { bowl, proposal } from "./culinary.fixtures.ts";

type Handler = (req: Request) => Promise<Response>;
const handlers: Handler[] = [], serve = Deno.serve;
Deno.serve = ((handler: Handler) => { handlers.push(handler); return {}; }) as typeof Deno.serve;
try { await import("../generate-proposals/index.ts"); await import("../fill-recipe/index.ts"); await import("../generate-image/index.ts"); } finally { Deno.serve = serve; }
const [generate, fill, paint] = handlers;
const user = "33333333-3333-4333-8333-333333333333", session = "44444444-4444-4444-8444-444444444444";
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const request = (path: string, data: unknown) => new Request("http://qook.test/" + path, { method: "POST", headers: { Authorization: "Bearer synthetic", "Content-Type": "application/json" }, body: JSON.stringify(data) });

// Actual handlers and SDK serialization, intercepted HTTP and in-memory state.
// This does not verify Postgres transactions, unique indexes, or RLS policies.
type FlowOptions = {
  forbiddenFill?: boolean;
  association?: "returned" | "thrown" | "invalid-body" | "rejected";
  ready?: "returned" | "thrown" | "rejected";
  finalRead?: "error" | "missing";
  fillBeforeReadError?: boolean;
  preAssociationFailure?: boolean;
  failureTransition?: "ready" | "rejected" | "lost-ack";
  promoteBeforeCleanup?: boolean;
  cleanupError?: boolean;
};
async function flow(options: FlowOptions, verify: (s: {
  response: Response; recipes: Map<string, Record<string, unknown>>; items: Record<string, unknown>[];
  fillCalls(): number; repeat(id: string): Promise<Response>; sessionStatus(): string; deleted: string[]; readyCommitted(): boolean;
  failureUpdates(): number; associationCalls(): number; logs: string[]; paint(id: string): Promise<Response>; imageCalls(): number; imagePrompts: string[];
}) => void | Promise<void>) {
  for (const [key, value] of Object.entries({ SUPABASE_URL: "http://qook.test", SUPABASE_ANON_KEY: "synthetic", SUPABASE_SERVICE_ROLE_KEY: "synthetic", OPENROUTER_API_KEY: "synthetic" })) Deno.env.set(key, value);
  const accepted = bowl(), p = proposal(accepted), recipes = new Map<string, Record<string, unknown>>(), items: Record<string, unknown>[] = [], deleted: string[] = [];
  let phase: "proposal" | "fill" = "proposal", fillCalls = 0, status = "generating", readyCommitted = false, failureUpdates = 0, associationCalls = 0;
  const logs: string[] = [], imagePrompts: string[] = [];
  let imageCalls = 0;
  const oldFetch = globalThis.fetch, oldError = console.error;
  console.error = (...args) => logs.push(args.map(String).join(" "));
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), url = new URL(req.url);
    if (req.method !== "GET" && req.method !== "HEAD") assert(!req.signal.aborted, "mutation inherited a disposed preflight signal");
    if (url.hostname === "openrouter.ai") {
      const body = await req.json();
      if (Array.isArray(body.modalities) && body.modalities.includes("image")) {
        imageCalls++;
        const prompt = body.messages[0].content.find((part: { type: string }) => part.type === "text").text;
        imagePrompts.push(prompt);
        for (const component of p.dishContract.components) {
          assert(prompt.includes(component.form)); assert(prompt.includes(component.appearance));
        }
        return json({ choices: [{ message: { images: [{ image_url: { url: "data:image/png;base64,aW1hZ2U=" } }] } }] });
      }
      if (phase === "proposal") return json({ choices: [{ message: { content: JSON.stringify({ proposals: Array.from({ length: 5 }, () => p), refusal: null }) } }] });
      fillCalls++;
      assert(String(body.messages[1].content).includes("No onions"));
      assert(String(body.messages[1].content).includes(JSON.stringify(p.dishContract)));
      const output = options.forbiddenFill ? bowl({ ingredients: [...p.ingredientNames, "red onion"] }) : accepted;
      return json({ choices: [{ message: { content: JSON.stringify(output) } }] });
    }
    assertEquals(url.hostname, "qook.test");
    if (url.pathname === "/rest/v1/rpc/claim_image_attempt") {
      const body = await req.json();
      const row = recipes.get(body.p_recipe_id);
      if (row?.image_status === "ready") return json("skip");
      if (row) row.image_status = "generating";
      return json(row ? "claimed" : "not_found");
    }
    if (url.pathname.startsWith("/storage/v1/object/meal-images/")) return json({ Key: "meal-images/synthetic.png" });
    if (url.pathname === "/auth/v1/user") return json({ id: user });
    if (url.pathname === "/rest/v1/user_preferences") {
      assertEquals(phase, "proposal", "fill reread mutable preferences");
      return json([{ household_size: 2, avoid_ingredients: ["onions"] }]);
    }
    if (url.pathname === "/rest/v1/generation_sessions") {
      if (req.method === "HEAD") return new Response(null, { headers: { "Content-Range": "0-0/0" } });
      if (req.method === "POST") return json({ id: session });
      const patch = await req.json();
      if (patch.status === "failed") {
        failureUpdates++;
        assertEquals(url.searchParams.get("id"), "eq." + session);
        assertEquals(url.searchParams.get("status"), "eq.generating");
        assertEquals(url.searchParams.get("select"), "id");
        assert(req.headers.get("Prefer")?.includes("return=representation"));
        if (options.failureTransition === "ready") status = "ready";
        if (options.failureTransition === "rejected") return json({ message: "PRIVATE transition" }, 403);
        if (status !== "generating") return json([]);
        status = "failed";
        if (options.failureTransition === "lost-ack") return json({ message: "PRIVATE lost failure ack" }, 503);
        if (options.promoteBeforeCleanup) {
          const id = [...recipes.keys()][0];
          recipes.set(id, { ...recipes.get(id), content_status: "full" });
          recipes.set("22222222-2222-4222-8222-222222222222", { id: "22222222-2222-4222-8222-222222222222", content_status: "proposal" });
        }
        return json([{ id: session }]);
      }
      assertEquals(patch.status, "ready");
      if (options.ready === "rejected") return json({ message: "PRIVATE rejected ready" }, 403);
      status = "ready";
      if (status === "ready") {
        readyCommitted = true;
        if (options.ready === "returned") return json({ message: "PRIVATE lost ready acknowledgement" }, 503);
        if (options.ready === "thrown") throw new Error("PRIVATE lost ready transport");
      }
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/rest/v1/generation_items") {
      if (req.method === "POST") {
        associationCalls++;
        if (options.association === "rejected") return json({ message: "PRIVATE rejected items" }, 403);
        items.push(...await req.json());
        if (options.association === "returned") return json({ message: "PRIVATE lost items acknowledgement" }, 503);
        if (options.association === "thrown") throw new Error("PRIVATE lost items transport");
        if (options.association === "invalid-body") return new Response("PRIVATE invalid JSON", { status: 201 });
        return new Response(null, { status: 201 });
      }
      assertEquals(url.searchParams.get("generation_sessions.user_id"), "eq." + user);
      return json([{ ...items[0], id: "private-fixture-item", generation_sessions: { user_id: user } }]);
    }
    assertEquals(url.pathname, "/rest/v1/recipes");
    if (req.method === "POST") {
      if (options.preAssociationFailure && recipes.size === 2) return json({ message: "PRIVATE failed skeleton insert" }, 403);
      const row = await req.json(), id = `11111111-1111-4111-8111-11111111111${recipes.size}`;
      recipes.set(id, { ...row, id }); return json({ id });
    }
    if (req.method === "DELETE") {
      assertEquals(status, "failed");
      assertEquals(url.searchParams.get("content_status"), "eq.proposal");
      if (options.cleanupError) return json({ code: "23503", message: "PRIVATE referenced recipe" }, 409);
      const selected = url.searchParams.get("id")!.slice(4, -1).split(",");
      for (const id of selected) if (recipes.get(id)?.content_status === "proposal") { deleted.push(id); recipes.delete(id); }
      return new Response(null, { status: 204 });
    }
    if (req.method === "PATCH") {
      const id = url.searchParams.get("id")!.slice(3);
      const patch = await req.json();
      if (patch.generation_error) {
        assertEquals(url.searchParams.get("content_status"), "eq.proposal");
        if (recipes.get(id)?.content_status !== "proposal") return new Response(null, { status: 204 });
      }
      recipes.set(id, { ...recipes.get(id), ...patch }); return new Response(null, { status: 204 });
    }
    if (url.searchParams.has("title") || url.searchParams.has("signature")) return json([]);
    if (url.searchParams.get("id")?.startsWith("eq.")) {
      const row = recipes.get(url.searchParams.get("id")!.slice(3));
      return json(req.headers.get("Accept")?.includes("application/vnd.pgrst.object+json") ? row : [row]);
    }
    if (options.fillBeforeReadError) {
      const id = [...recipes.keys()][0]; phase = "fill";
      assertEquals((await fill(request("fill-recipe", { recipeId: id, generationSessionId: session }))).status, 200);
    }
    if (options.finalRead === "error" || options.fillBeforeReadError) return json({ message: "PRIVATE final read" }, 403);
    if (options.finalRead === "missing") return json([...recipes.values()].slice(1));
    return json([...recipes.values()]);
  };
  const repeat = (id: string) => { phase = "fill"; return fill(request("fill-recipe", { recipeId: id, generationSessionId: session, context: "Changed later: onions are fine, serve twelve." })); };
  try {
    const response = await generate(request("generate-proposals", { tier: "brain-is-fried", context: "I only have time for 15 minutes. No onions." }));
    await verify({ response, recipes, items, fillCalls: () => fillCalls, repeat, sessionStatus: () => status, deleted, readyCommitted: () => readyCommitted,
      failureUpdates: () => failureUpdates, associationCalls: () => associationCalls, logs,
      paint: id => paint(request("generate-image", { recipeId: id })), imageCalls: () => imageCalls, imagePrompts });
    assert(!JSON.stringify({ response: response.status === 500 ? await response.json() : null, logs }).includes("PRIVATE"));
  } finally { globalThis.fetch = oldFetch; console.error = oldError; }
}

Deno.test("end-to-end fixture: proposal, private brief, fill and repeat retain portions and original restrictions", async () => {
  await flow({}, async ({ response, recipes, items, repeat, fillCalls }) => {
    assertEquals(response.status, 200);
    const { proposals } = await response.json();
    assertEquals(proposals.length, 5);
    assertEquals(items.length, 5);
    assert([...recipes.values()].every(row => row.serves === 2 && !("brief" in row) && !("context" in row)));
    const id = proposals[0].id;
    assertEquals((await repeat(id)).status, 200);
    assertEquals((await repeat(id)).status, 200);
    assertEquals(fillCalls(), 1);
    assertEquals(recipes.get(id)?.content_status, "full");
    assertEquals(recipes.get(id)?.serves, 2);
  });
});

Deno.test("end-to-end fixture: an onion pantry addition fails both fill attempts and never promotes the accepted card", async () => {
  await flow({ forbiddenFill: true }, async ({ response, recipes, repeat, fillCalls }) => {
    assertEquals(response.status, 200);
    const { proposals } = await response.json(), id = proposals[0].id;
    assertEquals((await repeat(id)).status, 502);
    assertEquals(fillCalls(), 2);
    assertEquals(recipes.get(id)?.content_status, "proposal");
    assertEquals(recipes.get(id)?.generation_error, "Recipe generation failed. Try again.");
  });
});

Deno.test("HTTP lost ready acknowledgement preserves committed cards and ready state", async () => {
  for (const ready of ["returned", "thrown"] as const) await flow({ ready }, ({ response, readyCommitted, deleted, sessionStatus, recipes, failureUpdates, logs }) => {
    assertEquals(response.status, 500); assertEquals(readyCommitted(), true);
    assertEquals(deleted, []); assertEquals(recipes.size, 5); assertEquals(sessionStatus(), "ready");
    assertEquals(failureUpdates(), 0); assert(logs.some(line => line.includes('"stage":"publication_uncertain"')));
  });
});

Deno.test("HTTP association loss/rejection preserves recipes and reservation from the dispatch boundary", async () => {
  for (const association of ["returned", "thrown", "invalid-body", "rejected"] as const) await flow({ association }, ({ response, items, deleted, sessionStatus, recipes, failureUpdates, associationCalls }) => {
    assertEquals(response.status, 500); assertEquals(items.length, association === "rejected" ? 0 : 5);
    assertEquals(deleted, []); assertEquals(recipes.size, 5); assertEquals(sessionStatus(), "generating");
    assertEquals(failureUpdates(), 0); assertEquals(associationCalls(), 1);
  });
});

Deno.test("HTTP final read errors and missing cards after association never authorize cleanup", async () => {
  for (const finalRead of ["error", "missing"] as const) await flow({ finalRead }, ({ response, items, deleted, sessionStatus, recipes, failureUpdates }) => {
    assertEquals(response.status, 500); assertEquals(items.length, 5); assertEquals(deleted, []);
    assertEquals(recipes.size, 5); assertEquals(sessionStatus(), "generating"); assertEquals(failureUpdates(), 0);
  });
  await flow({ ready: "rejected" }, ({ response, deleted, sessionStatus, failureUpdates }) => {
    assertEquals(response.status, 500); assertEquals(deleted, []);
    assertEquals(sessionStatus(), "generating"); assertEquals(failureUpdates(), 0);
  });
});

Deno.test("HTTP a fill that completes before proposal-read failure retains its full recipe and association", async () => {
  await flow({ fillBeforeReadError: true }, ({ response, items, deleted, recipes, failureUpdates, fillCalls }) => {
    assertEquals(response.status, 500); assertEquals(items.length, 5); assertEquals(deleted, []);
    assertEquals(recipes.size, 5); assertEquals(failureUpdates(), 0); assertEquals(fillCalls(), 1);
    assertEquals([...recipes.values()][0].content_status, "full");
  });
});

Deno.test("HTTP pre-association failure deletes only tracked proposals after a confirmed failure transition", async () => {
  await flow({ preAssociationFailure: true }, ({ response, items, recipes, deleted, sessionStatus }) => {
    assertEquals(response.status, 500); assertEquals(items, []); assertEquals(recipes.size, 0);
    assertEquals(deleted.length, 2); assertEquals(sessionStatus(), "failed");
  });
  await flow({ preAssociationFailure: true, promoteBeforeCleanup: true }, ({ response, recipes, deleted }) => {
    assertEquals(response.status, 500); assertEquals(deleted.length, 1); assertEquals(recipes.size, 2);
    assertEquals([...recipes.values()][0].content_status, "full");
    assert(recipes.has("22222222-2222-4222-8222-222222222222"), "untracked recipe was deleted");
  });
  await flow({ preAssociationFailure: true, cleanupError: true }, ({ response, recipes, deleted, sessionStatus, logs }) => {
    assertEquals(response.status, 500); assertEquals(recipes.size, 2); assertEquals(deleted, []);
    assertEquals(sessionStatus(), "failed"); assert(logs.some(line => line.includes('"stage":"skeleton_cleanup"')));
  });
});

Deno.test("HTTP ready/no-match and unknown failure transitions retain pre-association skeletons", async () => {
  for (const failureTransition of ["ready", "rejected", "lost-ack"] as const) await flow({ preAssociationFailure: true, failureTransition }, ({ response, recipes, deleted, sessionStatus }) => {
    assertEquals(response.status, 500); assertEquals(recipes.size, 2); assertEquals(deleted, []);
    assertEquals(sessionStatus(), failureTransition === "ready" ? "ready" : failureTransition === "lost-ack" ? "failed" : "generating");
  });
});

Deno.test("end-to-end dish contract: proposal art and full recipe share one immutable identity without a plate-description call", async () => {
  await flow({}, async ({ response, recipes, items, repeat, fillCalls, paint, imageCalls, imagePrompts }) => {
    assertEquals(response.status, 200);
    const { proposals } = await response.json(), id = proposals[0].id;
    const identity = proposal(bowl()).dishContract;
    assertEquals(proposals[0].dishContract, identity);
    assertEquals(recipes.get(id)?.dish_contract, identity);
    assertEquals((items[0].prompt_meta as { contract: { dishContract: unknown } }).contract.dishContract, identity);
    assertEquals((await paint(id)).status, 200);
    assertEquals(imageCalls(), 1); assertEquals(fillCalls(), 0);
    assertEquals(imagePrompts.length, 1);
    assertEquals((await repeat(id)).status, 200);
    assertEquals(fillCalls(), 1);
    assertEquals(recipes.get(id)?.dish_contract, identity);
    assertEquals(recipes.get(id)?.image_status, "ready");
    assertEquals((await paint(id)).status, 200);
    assertEquals(imageCalls(), 1); assertEquals(fillCalls(), 1);
  });
});
