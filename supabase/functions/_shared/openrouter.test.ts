import { assertEquals, assert, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildChatRequest, chat, logCost, MODELS } from "./openrouter.ts";

Deno.env.set("OPENROUTER_API_KEY", "test-key");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.test("chat returns message content and logs cost", async () => {
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (...a: unknown[]) => logs.push(a.join(" "));
  const origFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      jsonResponse({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      }),
    );
  try {
    const out = await chat({
      messages: [{ role: "user", content: "hi" }],
    });
    assertEquals(out, '{"ok":true}');
    assert(logs.some((l) => l.includes("or_cost")));
  } finally {
    globalThis.fetch = origFetch;
    console.log = origLog;
  }
});

Deno.test("chat retries on 429 then succeeds", async () => {
  const origFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => {
    calls++;
    if (calls === 1) return Promise.resolve(new Response("rate", { status: 429 }));
    return Promise.resolve(
      jsonResponse({ choices: [{ message: { content: "second" } }] }),
    );
  };
  try {
    const out = await chat({
      messages: [{ role: "user", content: "hi" }],
      timeoutMs: 5000,
    });
    assertEquals(out, "second");
    assertEquals(calls, 2);
  } finally {
    globalThis.fetch = origFetch;
  }
});

Deno.test("chat fails fast on 401", async () => {
  const origFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => {
    calls++;
    return Promise.resolve(new Response("unauthorized", { status: 401 }));
  };
  try {
    let threw: unknown;
    try {
      await chat({ messages: [{ role: "user", content: "hi" }] });
    } catch (err) {
      threw = err;
    }
    assert(threw instanceof Error);
    assert((threw as Error).message.includes("401"));
    assertEquals(calls, 1);
  } finally {
    globalThis.fetch = origFetch;
  }
});

Deno.test("chat surfaces status after exhausted retries", async () => {
  const origFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => {
    calls++;
    return Promise.resolve(new Response("unavailable", { status: 503 }));
  };
  try {
    let threw: unknown;
    try {
      await chat({
        messages: [{ role: "user", content: "hi" }],
        maxRetries: 0,
        timeoutMs: 5000,
      });
    } catch (err) {
      threw = err;
    }
    assert(threw instanceof Error);
    assert((threw as Error).message.includes("503"));
    assertEquals(calls, 1);
  } finally {
    globalThis.fetch = origFetch;
  }
});

Deno.test("MODELS uses Luna 6 without activating another fallback or image model", () => {
  assertEquals(MODELS.textDraft(), "openai/gpt-6-luna");
  assertEquals(MODELS.textPolish(), "anthropic/claude-sonnet-5");
  assertEquals(MODELS.image(), "google/gemini-3.1-flash-image");
});

Deno.test("shared request caches only the reusable prefix with a stable stage key", () => {
  const messages = [
    { role: "system", content: "STATIC recipe instructions" },
    { role: "user", content: "PRIVATE dinner request" },
  ];
  const opts = { model: "openai/gpt-6-luna", costLabel: "proposals" };
  const first = buildChatRequest(messages, opts);
  const next = buildChatRequest([
    messages[0], { role: "user", content: "DIFFERENT dinner request" },
  ], opts);
  assertEquals(first.messages, [
    { role: "system", content: [{ type: "text", text: messages[0].content, prompt_cache_breakpoint: { mode: "explicit" } }] },
    messages[1],
  ]);
  assertEquals(first.prompt_cache_options, { mode: "explicit", ttl: "30m" });
  assertEquals(first.prompt_cache_key, "qook:proposals:v1");
  assertEquals(next.prompt_cache_key, first.prompt_cache_key);
  assertEquals(buildChatRequest(messages, { ...opts, costLabel: "fill" }).prompt_cache_key, "qook:fill:v1");
  assertEquals(messages[0].content, "STATIC recipe instructions");
});

Deno.test("one-off OpenAI requests disable automatic writes and unknown models stay compatible", () => {
  const messages = [{ role: "user", content: "PRIVATE one-off" }];
  const oneOff = buildChatRequest(messages, { model: "openai/gpt-6-luna" });
  assertEquals(oneOff.messages, messages);
  assertEquals(oneOff.prompt_cache_options?.mode, "explicit");
  const unknown = buildChatRequest(messages, { model: "other/model", temperature: 0.4 });
  assertEquals(unknown.messages, messages);
  assertEquals(unknown.prompt_cache_key, undefined);
  assertEquals(unknown.prompt_cache_options, undefined);
  assertEquals(unknown.temperature, 0.4);
});

Deno.test("Haiku challenger uses Anthropic cache blocks without unsupported temperature", () => {
  const request = buildChatRequest([
    { role: "system", content: "STATIC instructions" },
    { role: "user", content: "PRIVATE suffix" },
  ], { model: "anthropic/claude-haiku-5.5", temperature: 0.4, reasoning: { effort: "low" } });
  assertEquals(request.messages[0].content, [{
    type: "text", text: "STATIC instructions", cache_control: { type: "ephemeral" },
  }]);
  assertEquals(request.messages[1].content, "PRIVATE suffix");
  assertEquals(request.temperature, undefined);
  assertEquals(request.prompt_cache_options, undefined);
});

Deno.test("GPT-6 temperature is sent only with non-reasoning requests", () => {
  assertEquals(buildChatRequest([], { model: "openai/gpt-6-luna", reasoning: { effort: "low" } }).temperature, undefined);
  assertEquals(buildChatRequest([], { model: "openai/gpt-6.1-sol" }).temperature, undefined);
  assertEquals(buildChatRequest([], { model: "openai/gpt-6-luna", reasoning: { effort: "none" }, temperature: 0.3 }).temperature, 0.3);
  assertEquals(buildChatRequest([], { model: "openai/gpt-5.6-luna", temperature: 0.4 }).temperature, 0.4);
});

Deno.test("cost telemetry distinguishes observed cache usage, provider bills and conservative estimates", () => {
  const oldLog = console.log;
  const entries: Record<string, unknown>[] = [];
  console.log = (message) => entries.push(JSON.parse(message));
  try {
    const usage = {
      prompt_tokens: 2000, completion_tokens: 100,
      prompt_tokens_details: { cached_tokens: 1000, cache_write_tokens: 500 },
    };
    logCost("openai/gpt-6-luna", { ...usage, cost: 0.123 }, "proposals");
    logCost("openai/gpt-6-luna", usage, "proposals");
    logCost("openai/gpt-6-luna", { prompt_tokens: 2000, completion_tokens: 100 }, "proposals");
    assertEquals(entries[0].usd, 0.123);
    assertEquals(entries[0].costSource, "provider");
    assertEquals(entries[0].cachedTok, 1000);
    assertEquals(entries[0].cacheWriteTok, 500);
    assertEquals(entries[0].cacheHit, true);
    assertEquals(entries[1].usd, 0.0001725);
    assertEquals(entries[1].estimateBasis, "cache-aware");
    assertEquals(entries[2].usd, 0.0003);
    assertEquals(entries[2].cacheHit, null);
    assertEquals(entries[2].estimateBasis, "conservative-cache-unknown");
  } finally { console.log = oldLog; }
});

Deno.test("chat deadline covers a stalled response body after fast headers", async () => {
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (_url, init) => {
    calls++;
    const signal = init!.signal!;
    return Promise.resolve(new Response(new ReadableStream({
      start(c) { signal.addEventListener("abort", () => c.error(signal.reason), { once: true }); },
    })));
  };
  try {
    await assertRejects(() => chat({ messages: [], timeoutMs: 15, totalTimeoutMs: 100, maxRetries: 0 }), DOMException, "attempt timeout");
    assertEquals(calls, 1);
  } finally { globalThis.fetch = oldFetch; }
});

Deno.test("chat stops when Retry-After exceeds whole-call budget and cancels unread body", async () => {
  const oldFetch = globalThis.fetch;
  let calls = 0, cancelled = 0;
  globalThis.fetch = () => {
    calls++;
    return Promise.resolve(new Response(new ReadableStream({ cancel() { cancelled++; } }),
      { status: 429, headers: { "Retry-After": "3600" } }));
  };
  try {
    await assertRejects(() => chat({ messages: [], totalTimeoutMs: 100, maxRetries: 2 }), Error, "remaining budget");
    assertEquals(calls, 1); assertEquals(cancelled, 1);
  } finally { globalThis.fetch = oldFetch; }
});

Deno.test("chat caller cancellation in response body is never retried", async () => {
  const oldFetch = globalThis.fetch;
  const caller = new AbortController(); let calls = 0;
  globalThis.fetch = (_url, init) => {
    calls++;
    const signal = init!.signal!;
    const response = new Response(new ReadableStream({
      start(c) { signal.addEventListener("abort", () => c.error(signal.reason), { once: true }); },
    }));
    queueMicrotask(() => caller.abort(new Error("user stopped")));
    return Promise.resolve(response);
  };
  try {
    await assertRejects(() => chat({ messages: [], signal: caller.signal }), Error, "user stopped");
    assertEquals(calls, 1);
  } finally { globalThis.fetch = oldFetch; }
});

Deno.test("chat caller cancellation interrupts retry sleep without another call", async () => {
  const oldFetch = globalThis.fetch;
  const caller = new AbortController(); let calls = 0;
  globalThis.fetch = () => {
    calls++;
    return Promise.resolve(new Response("private provider error", { status: 429, headers: { "Retry-After": "1" } }));
  };
  const timer = setTimeout(() => caller.abort(new Error("user stopped")), 10);
  try {
    await assertRejects(() => chat({ messages: [], signal: caller.signal }), Error, "user stopped");
    assertEquals(calls, 1);
  } finally { clearTimeout(timer); globalThis.fetch = oldFetch; }
});

Deno.test("chat records missing usage as unknown, provider cost and reasoning as metadata only", async () => {
  const oldFetch = globalThis.fetch, oldLog = console.log;
  const logs: string[] = []; console.log = (...a) => logs.push(a.join(" "));
  let calls = 0;
  globalThis.fetch = () => Promise.resolve(jsonResponse({
    choices: [{ message: { content: "PRIVATE recipe context" } }],
    ...(calls++ ? { usage: { prompt_tokens: 4, completion_tokens: 2, cost: 0.01234567, completion_tokens_details: { reasoning_tokens: 1 } } } : {}),
  }));
  try {
    await chat({ messages: [{ role: "user", content: "PRIVATE user voice" }] });
    await chat({ messages: [] });
    const costs = logs.map(l => JSON.parse(l)).filter(l => l.tag === "or_cost");
    assertEquals(costs[0].inTok, null); assertEquals(costs[0].outTok, null);
    assertEquals(costs[0].usd, null); assertEquals(costs[0].costSource, "unknown");
    assertEquals(costs[1].usd, 0.01234567); assertEquals(costs[1].costSource, "provider");
    assertEquals(costs[1].reasoningTok, 1);
    assert(!logs.join(" ").includes("PRIVATE"));
    assertEquals(logs.map(l => JSON.parse(l)).filter(l => l.tag === "or_attempt").length, 2);
  } finally { globalThis.fetch = oldFetch; console.log = oldLog; }
});

Deno.test("chat malformed provider JSON is not retried as a transport failure", async () => {
  const oldFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = () => { calls++; return Promise.resolve(new Response("private broken payload")); };
  try {
    await assertRejects(() => chat({ messages: [] }), Error, "Invalid JSON response");
    assertEquals(calls, 1);
  } finally { globalThis.fetch = oldFetch; }
});

Deno.test("chat whole-call deadline wins over per-attempt deadline with no retry", async () => {
  const oldFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = (_url, init) => {
    calls++;
    const signal = init!.signal!;
    return Promise.resolve(new Response(new ReadableStream({
      start(c) { signal.addEventListener("abort", () => c.error(signal.reason), { once: true }); },
    })));
  };
  try {
    await assertRejects(() => chat({ messages: [], timeoutMs: 500, totalTimeoutMs: 15 }), DOMException, "total timeout");
    assertEquals(calls, 1);
  } finally { globalThis.fetch = oldFetch; }
});

Deno.test("chat pre-aborted caller does not start a provider request", async () => {
  const oldFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = () => { calls++; return Promise.resolve(jsonResponse({})); };
  const caller = new AbortController(); caller.abort(new Error("already stopped"));
  try {
    await assertRejects(() => chat({ messages: [], signal: caller.signal }), Error, "already stopped");
    assertEquals(calls, 0);
  } finally { globalThis.fetch = oldFetch; }
});

Deno.test("chat retry exhaustion stays within three attempts and discards every error body", async () => {
  const oldFetch = globalThis.fetch; let calls = 0, cancelled = 0;
  globalThis.fetch = () => {
    calls++;
    return Promise.resolve(new Response(new ReadableStream({ cancel() { cancelled++; } }),
      { status: 503, headers: { "Retry-After": "0" } }));
  };
  try {
    await assertRejects(() => chat({ messages: [], totalTimeoutMs: 1000 }), Error, "503 after 3 attempts");
    assertEquals(calls, 3); assertEquals(cancelled, 3);
  } finally { globalThis.fetch = oldFetch; }
});
