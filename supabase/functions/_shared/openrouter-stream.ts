import { MODELS, OR_ENDPOINT, orHeaders } from "./openrouter.ts";

export type StreamHandlers = {
  onDelta?: (text: string) => void; // raw token delta
  onPartial?: (partialJson: string) => void; // cumulative buffer
  onDone?: (fullText: string) => void;
  onError?: (err: Error) => void;
};

export async function chatStream(
  messages: { role: string; content: string }[],
  handlers: StreamHandlers,
  opts: { model?: string; temperature?: number; timeoutMs?: number } = {},
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 25_000);

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  try {
    const resp = await fetch(OR_ENDPOINT, {
      method: "POST",
      headers: orHeaders(),
      body: JSON.stringify({
        model: opts.model ?? MODELS.textDraft(),
        messages,
        temperature: opts.temperature ?? 0.7,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!resp.ok || !resp.body) {
      throw new Error(
        `Stream open failed: ${resp.status} ${
          await resp.text().catch(() => "")
        }`,
      );
    }

    reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          const delta = evt?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length) {
            full += delta;
            handlers.onDelta?.(delta);
            handlers.onPartial?.(full);
          }
        } catch {
          /* malformed chunk — skip */
        }
      }
    }
    handlers.onDone?.(full);
    return full;
  } catch (err) {
    handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
    throw err;
  } finally {
    clearTimeout(timeout);
    try {
      reader?.releaseLock();
    } catch {
      /* no-op */
    }
  }
}
