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
