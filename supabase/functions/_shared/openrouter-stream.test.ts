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
