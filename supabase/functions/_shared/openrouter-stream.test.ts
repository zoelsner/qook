import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { chatStream } from "./openrouter-stream.ts";

Deno.env.set("OPENROUTER_API_KEY", "test-key");

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}

Deno.test("chatStream accumulates deltas and reports full text", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(
        sseStream([
          'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
          "data: [DONE]\n\n",
        ]),
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      ),
    );
  const deltas: string[] = [];
  let done = "";
  try {
    const full = await chatStream(
      [{ role: "user", content: "hi" }],
      { onDelta: (d) => deltas.push(d), onDone: (f) => (done = f) },
    );
    assertEquals(full, "Hello");
    assertEquals(deltas, ["Hel", "lo"]);
    assertEquals(done, "Hello");
  } finally {
    globalThis.fetch = origFetch;
  }
});

Deno.test("chatStream calls onError on non-2xx open", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(new Response("nope", { status: 500 }));
  const errors: Error[] = [];
  try {
    let threw = false;
    try {
      await chatStream(
        [{ role: "user", content: "hi" }],
        { onError: (e) => errors.push(e) },
      );
    } catch {
      threw = true;
    }
    assertEquals(threw, true);
    assertEquals(errors.length, 1);
    assertEquals(errors[0].message.includes("500"), true);
  } finally {
    globalThis.fetch = origFetch;
  }
});

Deno.test("chatStream calls onError on fetch rejection", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error("boom"));
  const errors: Error[] = [];
  try {
    let threw = false;
    try {
      await chatStream(
        [{ role: "user", content: "hi" }],
        { onError: (e) => errors.push(e) },
      );
    } catch {
      threw = true;
    }
    assertEquals(threw, true);
    assertEquals(errors.length, 1);
    assertEquals(errors[0].message, "boom");
  } finally {
    globalThis.fetch = origFetch;
  }
});

Deno.test("stream uses shared cache policy and captures final cache usage without trailing newline", async () => {
  const oldFetch = globalThis.fetch, oldLog = console.log;
  let request: Record<string, unknown> = {};
  const logs: Record<string, unknown>[] = [];
  console.log = (message) => logs.push(JSON.parse(message));
  globalThis.fetch = (_url, init) => {
    request = JSON.parse(String(init?.body));
    return Promise.resolve(new Response(sseStream([
      'data: {"choices":[{"delta":{"content":"recipe"}}]}\n\n',
      'data: {"choices":[],"usage":{"prompt_tokens":1200,"completion_tokens":20,"cost":0.001,"prompt_tokens_details":{"cached_tokens":1100,"cache_write_tokens":0}}}',
    ])));
  };
  try {
    const full = await chatStream([
      { role: "system", content: "STATIC instructions" },
      { role: "user", content: "PRIVATE context" },
    ], {}, { model: "openai/gpt-6-luna", costLabel: "legacy-recipes", reasoning: { effort: "low" } });
    assertEquals(full, "recipe");
    assertEquals(request.temperature, undefined);
    assertEquals(request.stream_options, { include_usage: true });
    assertEquals(request.prompt_cache_key, "qook:legacy-recipes:v1");
    assertEquals(request.prompt_cache_options, { mode: "explicit", ttl: "30m" });
    assertEquals(request.messages, [
      { role: "system", content: [{ type: "text", text: "STATIC instructions", prompt_cache_breakpoint: { mode: "explicit" } }] },
      { role: "user", content: "PRIVATE context" },
    ]);
    assertEquals(logs.length, 1);
    assertEquals(logs[0].costSource, "provider");
    assertEquals(logs[0].usd, 0.001);
    assertEquals(logs[0].cachedTok, 1100);
    assertEquals(logs[0].cacheWriteTok, 0);
    assertEquals(JSON.stringify(logs).includes("PRIVATE"), false);
  } finally { globalThis.fetch = oldFetch; console.log = oldLog; }
});
