import { RecipeJsonSchema } from "./schema.ts";

export const OR_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export function orHeaders(): Record<string, string> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) throw new Error("OPENROUTER_API_KEY missing");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": Deno.env.get("OPENROUTER_SITE_URL") ?? "https://qook.app",
    "X-Title": Deno.env.get("OPENROUTER_APP_NAME") ?? "Qook",
  };
}

export const MODELS = {
  textDraft: () => Deno.env.get("OR_TEXT_MODEL") ?? "anthropic/claude-haiku-4.5",
  textPolish: () => Deno.env.get("OR_POLISH_MODEL") ?? "anthropic/claude-sonnet-5",
  image: () => Deno.env.get("OR_IMAGE_MODEL") ?? "google/gemini-3.1-flash-image",
} as const;

export type ChatMsg = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatOpts = {
  model?: string;
  messages: ChatMsg[];
  jsonSchema?:
    | typeof RecipeJsonSchema
    | { name: string; schema: unknown; strict?: boolean };
  maxRetries?: number; // default 2
  timeoutMs?: number; // default 30_000
  temperature?: number; // default 0.7
  costLabel?: string; // for log line
};

// Approx OpenRouter USD pricing per 1M tokens (2026-07-06); used only for
// the cost log line, never for billing logic.
const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  "anthropic/claude-haiku-4.5": { in: 1, out: 5 },
  "anthropic/claude-sonnet-5": { in: 2, out: 10 },
};

export function logCost(
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined,
  label: string,
): void {
  const p = PRICE_PER_M[model];
  const inTok = usage?.prompt_tokens ?? 0;
  const outTok = usage?.completion_tokens ?? 0;
  const usd = p
    ? (inTok / 1_000_000) * p.in + (outTok / 1_000_000) * p.out
    : null;
  console.log(
    JSON.stringify({
      tag: "or_cost",
      label,
      model,
      inTok,
      outTok,
      usd: usd === null ? null : Number(usd.toFixed(5)),
    }),
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function chat(opts: ChatOpts): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const maxRetries = opts.maxRetries ?? 2;
  const model = opts.model ?? MODELS.textDraft();
  const body = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    ...(opts.jsonSchema && {
      response_format: { type: "json_schema", json_schema: opts.jsonSchema },
    }),
  };

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(OR_ENDPOINT, {
        method: "POST",
        headers: orHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(t);

      if (resp.status === 429) {
        const retryAfter = Number(resp.headers.get("Retry-After") ?? 0);
        const wait = retryAfter > 0
          ? retryAfter * 1000
          : Math.min(1500 * 2 ** attempt, 8000);
        await sleep(wait);
        continue;
      }
      if (resp.status >= 500 && resp.status < 600) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (!resp.ok) {
        throw new Error(`OpenRouter ${resp.status}: ${await resp.text()}`);
      }
      const json = await resp.json();
      const content = json?.choices?.[0]?.message?.content;
      logCost(model, json?.usage, opts.costLabel ?? "chat");
      if (typeof content !== "string" || content.length === 0) {
        throw new Error("Empty content from OpenRouter");
      }
      return content;
    } catch (err) {
      lastErr = err;
      clearTimeout(t);
      if (controller.signal.aborted) {
        await sleep(500);
        continue;
      }
      if (attempt === maxRetries) throw err;
      await sleep(750 * 2 ** attempt);
    }
  }
  throw lastErr ?? new Error("OpenRouter call failed after retries");
}
