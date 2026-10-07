import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { bowl, proposal } from "./culinary.fixtures.ts";

type Handler = (req: Request) => Promise<Response>;
const handlers: Handler[] = [], serve = Deno.serve;
Deno.serve = ((handler: Handler) => { handlers.push(handler); return {}; }) as typeof Deno.serve;
try { await import("../generate-proposals/index.ts"); await import("../fill-recipe/index.ts"); } finally { Deno.serve = serve; }
const [generate, fill] = handlers;
const user = "33333333-3333-4333-8333-333333333333", session = "44444444-4444-4444-8444-444444444444";
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const request = (path: string, data: unknown) => new Request("http://qook.test/" + path, { method: "POST", headers: { Authorization: "Bearer synthetic", "Content-Type": "application/json" }, body: JSON.stringify(data) });

// Actual handlers and SDK serialization, intercepted HTTP and in-memory state.
// This does not verify Postgres transactions, unique indexes, or RLS policies.
async function flow(options: { forbiddenFill?: boolean; loseReadyResponse?: boolean }, verify: (s: {
  response: Response; recipes: Map<string, Record<string, unknown>>; items: Record<string, unknown>[];
  fillCalls(): number; repeat(id: string): Promise<Response>; sessionStatus(): string; deleted: string[]; readyCommitted(): boolean;
}) => Promise<void>) {
  for (const [key, value] of Object.entries({ SUPABASE_URL: "http://qook.test", SUPABASE_ANON_KEY: "synthetic", SUPABASE_SERVICE_ROLE_KEY: "synthetic", OPENROUTER_API_KEY: "synthetic" })) Deno.env.set(key, value);
  const accepted = bowl(), p = proposal(accepted), recipes = new Map<string, Record<string, unknown>>(), items: Record<string, unknown>[] = [], deleted: string[] = [];
  let phase: "proposal" | "fill" = "proposal", fillCalls = 0, status = "generating", readyCommitted = false;
  const oldFetch = globalThis.fetch, oldError = console.error;
  console.error = () => {};
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), url = new URL(req.url);
    if (req.method !== "GET" && req.method !== "HEAD") assert(!req.signal.aborted, "mutation inherited a disposed preflight signal");
    if (url.hostname === "openrouter.ai") {
      if (phase === "proposal") return json({ choices: [{ message: { content: JSON.stringify({ proposals: Array.from({ length: 5 }, () => p), refusal: null }) } }] });
      fillCalls++;
      const body = await req.json();
      assert(String(body.messages[1].content).includes("No onions"));
      const output = options.forbiddenFill ? bowl({ ingredients: [...p.ingredientNames, "red onion"] }) : accepted;
      return json({ choices: [{ message: { content: JSON.stringify(output) } }] });
    }
    assertEquals(url.hostname, "qook.test");
    if (url.pathname === "/auth/v1/user") return json({ id: user });
    if (url.pathname === "/rest/v1/user_preferences") {
      assertEquals(phase, "proposal", "fill reread mutable preferences");
      return json([{ household_size: 2, avoid_ingredients: ["onions"] }]);
    }
    if (url.pathname === "/rest/v1/generation_sessions") {
      if (req.method === "HEAD") return new Response(null, { headers: { "Content-Range": "0-0/0" } });
      if (req.method === "POST") return json({ id: session });
      const patch = await req.json(); status = patch.status;
      if (status === "ready") {
        readyCommitted = true;
        if (options.loseReadyResponse) return json({ message: "synthetic lost acknowledgement" }, 503);
      }
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/rest/v1/generation_items") {
      if (req.method === "POST") { items.push(...await req.json()); return new Response(null, { status: 201 }); }
      assertEquals(url.searchParams.get("generation_sessions.user_id"), "eq." + user);
      return json([{ ...items[0], id: "private-fixture-item", generation_sessions: { user_id: user } }]);
    }
    assertEquals(url.pathname, "/rest/v1/recipes");
    if (req.method === "POST") {
      const row = await req.json(), id = `11111111-1111-4111-8111-11111111111${recipes.size}`;
      recipes.set(id, { ...row, id }); return json({ id });
    }
    if (req.method === "DELETE") { for (const id of recipes.keys()) deleted.push(id); recipes.clear(); return new Response(null, { status: 204 }); }
    if (req.method === "PATCH") {
      const id = url.searchParams.get("id")!.slice(3);
      recipes.set(id, { ...recipes.get(id), ...await req.json() }); return new Response(null, { status: 204 });
    }
    if (url.searchParams.has("title") || url.searchParams.has("signature")) return json([]);
    if (url.searchParams.get("id")?.startsWith("eq.")) return json([recipes.get(url.searchParams.get("id")!.slice(3))]);
    return json([...recipes.values()]);
  };
  const repeat = (id: string) => { phase = "fill"; return fill(request("fill-recipe", { recipeId: id, generationSessionId: session, context: "Changed later: onions are fine, serve twelve." })); };
  try {
    const response = await generate(request("generate-proposals", { tier: "brain-is-fried", context: "I only have time for 15 minutes. No onions." }));
    await verify({ response, recipes, items, fillCalls: () => fillCalls, repeat, sessionStatus: () => status, deleted, readyCommitted: () => readyCommitted });
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

Deno.test("KNOWN GAP: lost ready acknowledgement can trigger cleanup of committed cards", async () => {
  await flow({ loseReadyResponse: true }, async ({ response, readyCommitted, deleted, sessionStatus, recipes }) => {
    assertEquals(response.status, 500);
    assertEquals(readyCommitted(), true);
    assertEquals(deleted.length, 5);
    assertEquals(recipes.size, 0);
    assertEquals(sessionStatus(), "failed");
  });
});
