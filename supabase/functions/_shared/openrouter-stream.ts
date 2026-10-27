import { buildChatRequest, logCost, MODELS, OR_ENDPOINT, orHeaders, type ProviderUsage } from "./openrouter.ts";

export type StreamHandlers = {
  onDelta?: (text: string) => void; // raw token delta
  onPartial?: (partialJson: string) => void; // cumulative buffer
  onDone?: (fullText: string) => void;
  onError?: (err: Error) => void;
};

export async function chatStream(
  messages: { role: string; content: string }[],
  handlers: StreamHandlers,
  opts: {
    model?: string;
    temperature?: number;
    timeoutMs?: number;
    maxTokens?: number;
    jsonSchema?: { name: string; schema: unknown; strict?: boolean };
    reasoning?: { effort: "none" | "low" | "medium" | "high" };
    costLabel?: string;
  } = {},
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 25_000);

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let usage: ProviderUsage | undefined;
  const model = opts.model ?? MODELS.textDraft();

  try {
    const resp = await fetch(OR_ENDPOINT, {
      method: "POST",
      headers: orHeaders(),
      body: JSON.stringify({
        ...buildChatRequest(messages, { ...opts, model }),
        stream: true,
        stream_options: { include_usage: true },
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
    const receiveLine = (raw: string) => {
      const line = raw.trim();
      if (!line.startsWith("data:")) return;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") return;
      let evt;
      try {
        evt = JSON.parse(payload);
      } catch {
        return; // malformed chunk — skip
      }
      if (evt?.usage) usage = evt.usage;
      const delta = evt?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length) {
        full += delta;
        handlers.onDelta?.(delta);
        handlers.onPartial?.(full);
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) receiveLine(raw);
    }
    // Some providers close immediately after a final usage event, without a
    // trailing newline. Preserve its billing/cache telemetry too.
    receiveLine(buffer + decoder.decode());
    handlers.onDone?.(full);
    return full;
  } catch (err) {
    handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
    throw err;
  } finally {
    logCost(model, usage, opts.costLabel ?? "stream");
    clearTimeout(timeout);
    try {
      reader?.releaseLock();
    } catch {
      /* no-op */
    }
  }
}
