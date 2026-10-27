import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { prepareProposal } from "./preflight.ts";
import { ManualClock, deferred, flush } from "../_shared/read-phase.fixtures.ts";

let route!: typeof import("./index.ts").handleProposals;
const serve = Deno.serve;
Deno.serve = (() => ({})) as unknown as typeof Deno.serve;
try { route = (await import("./index.ts")).handleProposals; } finally { Deno.serve = serve; }

const user = "33333333-3333-4333-8333-333333333333";
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", ...headers } });
const request = (options: { signal?: AbortSignal; body?: string; auth?: boolean } = {}) => new Request("http://qook.test/generate-proposals", {
  method: "POST", signal: options.signal,
  headers: { ...(options.auth === false ? {} : { Authorization: "Bearer synthetic" }), "Content-Type": "application/json" },
  body: options.body ?? JSON.stringify({ tier: "brain-is-fried", context: "Dinner for two. Microwave only, 12 minutes." }),
});

async function scenario(test: (s: {
  clock: ManualClock; logs: string[]; calls: Request[];
  useFetch(fn: (req: Request) => Promise<Response> | Response): void;
  ordinary(req: Request): Response;
}) => Promise<void>) {
  for (const [key, value] of Object.entries({ SUPABASE_URL: "http://qook.test", SUPABASE_ANON_KEY: "synthetic", SUPABASE_SERVICE_ROLE_KEY: "synthetic", OPENROUTER_API_KEY: "synthetic" })) Deno.env.set(key, value);
  const clock = new ManualClock(), logs: string[] = [], calls: Request[] = [];
  const oldFetch = globalThis.fetch, oldError = console.error;
  console.error = (...args) => { logs.push(args.map(String).join(" ")); };
  const ordinary = (req: Request) => {
    const url = new URL(req.url);
    assertEquals(url.hostname, "qook.test");
    if (url.pathname === "/auth/v1/user") return json({ id: user });
    assertEquals(url.searchParams.get("user_id"), "eq." + user);
    if (url.pathname === "/rest/v1/user_preferences") return json([{ household_size: 4, avoid_ingredients: ["peanut"], cooking_tools: ["microwave"] }]);
    if (url.pathname === "/rest/v1/generation_sessions" && req.method === "HEAD") return new Response(null, { headers: { "Content-Range": "0-0/0" } });
    throw new Error("Unexpected write or provider request in read-only fixture");
  };
  let custom: (req: Request) => Promise<Response> | Response = ordinary;
  globalThis.fetch = async (input, init) => { const req = new Request(input, init); calls.push(req); return await custom(req); };
  try {
    await test({ clock, logs, calls, ordinary, useFetch: (fn) => { custom = fn; } });
    assert(calls.every(req => req.method === "GET" || req.method === "HEAD"), "preflight failure crossed the write boundary");
    assert(!logs.join(" ").includes("PRIVATE"));
    assertEquals(clock.timers.size, 0);
  } finally { globalThis.fetch = oldFetch; console.error = oldError; }
}

Deno.test("preflight preserves saved restrictions and permits genuinely absent preferences", async () => {
  await scenario(async ({ clock, ordinary, useFetch }) => {
    const saved = await prepareProposal(request(), { timers: clock, timeoutMs: 100 });
    assert(!(saved instanceof Response));
    assertEquals(saved.brief.avoidIngredients, ["peanut"]);
    assertEquals(saved.brief.householdSize, 2);
    useFetch(req => new URL(req.url).pathname.endsWith("user_preferences") ? json([]) : ordinary(req));
    const absent = await prepareProposal(request(), { timers: clock, timeoutMs: 100 });
    assert(!(absent instanceof Response));
    assertEquals(absent.brief.avoidIngredients, []);
  });
});

Deno.test("HTTP preflight fails closed on preference errors and malformed bodies, without reservation or payment", async () => {
  for (const mode of ["returned-error", "invalid-json"] as const) await scenario(async ({ clock, ordinary, useFetch }) => {
    useFetch(req => new URL(req.url).pathname.endsWith("user_preferences")
      ? mode === "returned-error" ? json({ code: "42501", message: "PRIVATE saved restriction" }, 403) : new Response("PRIVATE invalid JSON")
      : ordinary(req));
    const response = await route(request(), { timers: clock, timeoutMs: 100 });
    assertEquals(response.status, 503);
    assert(!JSON.stringify(await response.json()).includes("PRIVATE"));
  });
  await scenario(async ({ clock, calls }) => {
    assertEquals((await route(request({ body: "invalid" }), { timers: clock, timeoutMs: 100 })).status, 400);
    assertEquals(calls.length, 1);
  });
});

Deno.test("HTTP auth failures retain 401 while auth infrastructure errors return sanitized 503", async () => {
  for (const mode of ["invalid-token", "http-503", "rate-limited", "network"] as const) await scenario(async ({ clock, ordinary, useFetch }) => {
    useFetch(req => new URL(req.url).pathname === "/auth/v1/user"
      ? mode === "network" ? Promise.reject(new Error("PRIVATE transport")) : json({ message: "PRIVATE auth" }, mode === "invalid-token" ? 401 : mode === "rate-limited" ? 429 : 503)
      : ordinary(req));
    assertEquals((await route(request(), { timers: clock, timeoutMs: 100 })).status, mode === "invalid-token" ? 401 : 503);
  });
  await scenario(async ({ clock, calls }) => {
    assertEquals((await route(request({ auth: false }), { timers: clock, timeoutMs: 100 })).status, 401);
    assertEquals(calls.length, 0);
  });
});

Deno.test("preflight retains SDK recovery from one transient preference error", async () => {
  await scenario(async ({ clock, ordinary, useFetch, calls }) => {
    let preferences = 0;
    useFetch(req => new URL(req.url).pathname.endsWith("user_preferences") && preferences++ === 0
      ? json({ message: "PRIVATE transient" }, 503, { "Retry-After": "0" }) : ordinary(req));
    const result = await prepareProposal(request(), { timers: clock, timeoutMs: 100 });
    assert(!(result instanceof Response));
    assertEquals(result.brief.avoidIngredients, ["peanut"]);
    assertEquals(calls.filter(req => new URL(req.url).pathname.endsWith("user_preferences")).length, 2);
  });
});

Deno.test("HTTP preference/auth/quota stalls expire; late success cannot reserve or generate", async () => {
  for (const path of ["/auth/v1/user", "/rest/v1/user_preferences", "/rest/v1/generation_sessions"]) await scenario(async ({ clock, calls, ordinary, useFetch }) => {
    const entered = deferred<void>(), late = deferred<Response>();
    useFetch(req => { if (new URL(req.url).pathname === path) { entered.resolve(); return late.promise; } return ordinary(req); });
    const pending = route(request(), { timers: clock, timeoutMs: 100 });
    await entered.promise;
    clock.advance(100);
    assertEquals((await pending).status, 504);
    const count = calls.length;
    const last = calls.at(-1)!;
    assert(last.signal.aborted);
    late.resolve(ordinary(last));
    await flush();
    assertEquals(calls.length, count);
  });
});

Deno.test("HTTP preflight deadline includes stalled preference response-body consumption", async () => {
  await scenario(async ({ clock, ordinary, useFetch }) => {
    const entered = deferred<void>();
    let body!: ReadableStreamDefaultController<Uint8Array>;
    useFetch(req => {
      if (!new URL(req.url).pathname.endsWith("user_preferences")) return ordinary(req);
      const stream = new ReadableStream<Uint8Array>({ start(controller) { body = controller; controller.enqueue(new TextEncoder().encode("[")); } });
      entered.resolve();
      return new Response(stream);
    });
    const pending = route(request(), { timers: clock, timeoutMs: 100 });
    await entered.promise;
    clock.advance(100);
    assertEquals((await pending).status, 504);
    body.enqueue(new TextEncoder().encode("{\"household_size\":2}]"));
    body.close();
    await flush();
  });
});

Deno.test("HTTP preflight deadline includes stalled request-body consumption without late database reads", async () => {
  await scenario(async ({ clock, calls, ordinary, useFetch }) => {
    const entered = deferred<void>();
    let body!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      body = controller;
      controller.enqueue(new TextEncoder().encode("{"));
    } });
    useFetch(req => { entered.resolve(); return ordinary(req); });
    const pending = route(new Request("http://qook.test/generate-proposals", {
      method: "POST",
      headers: { Authorization: "Bearer synthetic", "Content-Type": "application/json" },
      body: stream,
    }), { timers: clock, timeoutMs: 100 });
    await entered.promise;
    await flush();
    clock.advance(100);
    assertEquals((await pending).status, 504);
    assertEquals(calls.length, 1);
    body.enqueue(new TextEncoder().encode('"tier":"brain-is-fried"}'));
    body.close();
    await flush();
    assertEquals(calls.length, 1);
  });
});

Deno.test("HTTP expiry during SDK Retry-After sleep starts no further network attempt", async () => {
  await scenario(async ({ clock, ordinary, useFetch, calls }) => {
    const entered = deferred<void>();
    useFetch(req => {
      if (new URL(req.url).pathname.endsWith("user_preferences")) { entered.resolve(); return json({ message: "PRIVATE retry" }, 503, { "Retry-After": "3600" }); }
      return ordinary(req);
    });
    const pending = route(request(), { timers: clock, timeoutMs: 100 });
    await entered.promise;
    await flush();
    clock.advance(100);
    assertEquals((await pending).status, 504);
    await flush();
    assertEquals(calls.filter(req => new URL(req.url).pathname.endsWith("user_preferences")).length, 1);
  });
});

Deno.test("HTTP cancellation, quota limits and brief conflicts stop before any writes", async () => {
  await scenario(async ({ clock, calls }) => {
    const caller = new AbortController(); caller.abort("PRIVATE caller");
    assertEquals((await route(request({ signal: caller.signal }), { timers: clock, timeoutMs: 100 })).status, 503);
    assertEquals(calls.length, 0);
  });
  await scenario(async ({ clock, ordinary, useFetch }) => {
    const entered = deferred<void>(), caller = new AbortController(), late = deferred<Response>();
    useFetch(req => { if (new URL(req.url).pathname.endsWith("user_preferences")) { entered.resolve(); return late.promise; } return ordinary(req); });
    const pending = route(request({ signal: caller.signal }), { timers: clock, timeoutMs: 100 });
    await entered.promise; caller.abort("PRIVATE caller");
    assertEquals((await pending).status, 503);
    late.resolve(json([])); await flush();
  });
  await scenario(async ({ clock, ordinary, useFetch }) => {
    useFetch(req => req.method === "HEAD" ? new Response(null, { headers: { "Content-Range": "0-0/10" } }) : ordinary(req));
    assertEquals((await route(request(), { timers: clock, timeoutMs: 100 })).status, 429);
  });
  await scenario(async ({ clock, calls }) => {
    const body = JSON.stringify({ tier: "brain-is-fried", context: "Microwave only. Roast raw chicken until crispy." });
    assertEquals((await route(request({ body }), { timers: clock, timeoutMs: 100 })).status, 422);
    assertEquals(calls.filter(req => req.method === "HEAD").length, 0);
  });
});

Deno.test("HTTP unavailable quota counts fail closed and parallel preflights remain independently scoped", async () => {
  await scenario(async ({ clock, ordinary, useFetch }) => {
    useFetch(req => req.method === "HEAD" ? new Response(null) : ordinary(req));
    assertEquals((await route(request(), { timers: clock, timeoutMs: 100 })).status, 503);
  });
  await scenario(async ({ clock }) => {
    const results = await Promise.all([prepareProposal(request(), { timers: clock, timeoutMs: 100 }), prepareProposal(request(), { timers: clock, timeoutMs: 100 })]);
    assert(results.every(result => !(result instanceof Response)));
  });
});
