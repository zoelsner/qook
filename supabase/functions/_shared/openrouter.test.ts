import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { chat, MODELS } from "./openrouter.ts";

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

Deno.test("MODELS defaults match spec §4.3", () => {
  assertEquals(MODELS.textDraft(), "anthropic/claude-haiku-4.5");
  assertEquals(MODELS.textPolish(), "anthropic/claude-sonnet-5");
  assertEquals(MODELS.image(), "google/gemini-3.1-flash-image");
});
