import { RecipeJsonSchema } from "./schema.ts";
import { abortableWait, retryDelayMs } from "./provider-wait.ts";

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
  textDraft: () => Deno.env.get("OR_TEXT_MODEL") ?? "openai/gpt-6-luna",
  textPolish: () =>
    Deno.env.get("OR_POLISH_MODEL") ?? "anthropic/claude-sonnet-5",
  image: () =>
    Deno.env.get("OR_IMAGE_MODEL") ?? "google/gemini-3.1-flash-image",
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
  timeoutMs?: number; // per attempt, including response body; default 30_000
  totalTimeoutMs?: number; // whole call, including backoff; default timeoutMs × attempts
  signal?: AbortSignal; // caller cancellation is never retried
  temperature?: number; // default 0.7
  // Cap on completion tokens (reasoning included). Without it OpenRouter
  // reserves the model's full output window and 402s
  // any key whose remaining budget can't cover that reservation.
  maxTokens?: number; // default 8192
  costLabel?: string; // for log line
  // Keep effort explicit on latency-sensitive calls. Changing it requires a
  // quality comparison; the default model change does not lower callers' effort.
  reasoning?: { effort: "none" | "low" | "medium" | "high" };
};

type RequestOpts = Omit<ChatOpts, "messages">;

// Both transports use the same compatibility and cache policy. Initial system
// messages must contain reusable instructions; private/request-specific data
// belongs in the later user messages. Cache keys contain only a static stage.
export function buildChatRequest(
  messages: { role: string; content: string }[],
  opts: RequestOpts = {},
) {
  const model = opts.model ?? MODELS.textDraft();
  const openAI = /^openai\/gpt-(?:5\.6|6(?:\.\d+)?)-/.test(model);
  const anthropic = model.startsWith("anthropic/");
  let prefixEnd = -1;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role !== "system" && messages[i].role !== "developer") break;
    if (messages[i].content.trim()) prefixEnd = i;
  }
  const stage = opts.jsonSchema?.name ?? opts.costLabel ?? "chat";
  // Internal stage names only; never turn request text or user IDs into keys.
  const cacheKey = `qook:${/^[a-zA-Z0-9_-]{1,64}$/.test(stage) ? stage : "chat"}:v1`;
  const requestMessages = (openAI || anthropic) && prefixEnd >= 0
    ? messages.map((message, i) => i === prefixEnd
      ? {
        ...message,
        content: [{
          type: "text",
          text: message.content,
          ...(openAI
            ? { prompt_cache_breakpoint: { mode: "explicit" } }
            : { cache_control: { type: "ephemeral" } }),
        }],
      }
      : message)
    : messages;
  const omitTemperature = (
    /^openai\/gpt-6(?:\.\d+)?-/.test(model) && opts.reasoning?.effort !== "none"
  ) || /^anthropic\/claude-haiku-5\.5(?:$|:)/.test(model);
  return {
    model,
    messages: requestMessages,
    ...(!omitTemperature && { temperature: opts.temperature ?? 0.7 }),
    max_tokens: opts.maxTokens ?? 8192,
    ...(opts.jsonSchema && {
      response_format: { type: "json_schema", json_schema: opts.jsonSchema },
    }),
    ...(opts.reasoning && { reasoning: opts.reasoning }),
    ...((openAI || anthropic) && { prompt_cache_key: cacheKey }),
    // Explicit mode also prevents automatic writes of one-off user suffixes.
    // Prefixes below the provider minimum simply do not cache; never pad them.
    ...(openAI && { prompt_cache_options: { mode: "explicit", ttl: "30m" } }),
  };
}

type TokenPrice = { in: number; out: number; read: number; write: number };
// Public OpenRouter catalog, verified 2026-10-25. Default cache writes are
// OpenAI 30m / Anthropic 5m. Estimates are diagnostics, never billing logic;
// provider-reported usage.cost always wins, including regional/provider fees.
const PRICE_PER_M: Record<string, TokenPrice & {
  longPrompt?: { above: number; price: TokenPrice };
}> = {
  "openai/gpt-5.6-luna": {
    in: 0.2, out: 1.2, read: 0.02, write: 0.25,
    longPrompt: { above: 272000, price: { in: 0.4, out: 1.8, read: 0.04, write: 0.5 } },
  },
  "openai/gpt-6-luna": {
    in: 0.1, out: 0.5, read: 0.01, write: 0.125,
    longPrompt: { above: 272000, price: { in: 0.2, out: 0.75, read: 0.02, write: 0.25 } },
  },
  "anthropic/claude-haiku-5.5": {
    in: 0.1, out: 0.5, read: 0.01, write: 0.125,
    longPrompt: { above: 100000, price: { in: 0.5, out: 2.5, read: 0.05, write: 0.625 } },
  },
  "anthropic/claude-sonnet-5": { in: 2, out: 10, read: 0.2, write: 2.5 },
  "anthropic/claude-sonnet-5.5": { in: 2, out: 10, read: 0.1, write: 2.5 },
  "openai/gpt-6.1-sol": {
    in: 2, out: 10, read: 0.1, write: 2.5,
    longPrompt: { above: 272000, price: { in: 4, out: 15, read: 0.2, write: 5 } },
  },
};

export type ProviderUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
  prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
};

export function logCost(
  model: string,
  usage: ProviderUsage | undefined,
  label: string,
): void {
  const finite = (n: unknown): number | null =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
  const basePrice = PRICE_PER_M[model];
  const inTok = finite(usage?.prompt_tokens);
  const outTok = finite(usage?.completion_tokens);
  const p = basePrice?.longPrompt && inTok !== null && inTok > basePrice.longPrompt.above
    ? basePrice.longPrompt.price
    : basePrice;
  const cachedTok = finite(usage?.prompt_tokens_details?.cached_tokens);
  const cacheWriteTok = finite(usage?.prompt_tokens_details?.cache_write_tokens);
  const validCacheCounts = inTok !== null && (cachedTok ?? 0) + (cacheWriteTok ?? 0) <= inTok;
  const cacheKnown = validCacheCounts && cachedTok !== null && cacheWriteTok !== null;
  const actual = finite(usage?.cost);
  let estimate: number | null = null;
  if (p && inTok !== null && outTok !== null) {
    const read = validCacheCounts ? cachedTok ?? 0 : 0;
    const write = validCacheCounts ? cacheWriteTok ?? 0 : 0;
    // Missing write counts must not make a paid cache write look like a
    // discount. Use the default write rate as a conservative upper bound.
    const remainingRate = validCacheCounts && cacheWriteTok !== null
      ? p.in
      : Math.max(p.in, p.write);
    estimate = ((inTok - read - write) * remainingRate + read * p.read + write * p.write + outTok * p.out) / 1_000_000;
  }
  const usd = actual ?? estimate;
  console.log(JSON.stringify({
    tag: "or_cost",
    label,
    model,
    inTok,
    outTok,
    cachedTok,
    cacheWriteTok,
    cacheHit: cachedTok === null ? null : cachedTok > 0,
    reasoningTok: finite(usage?.completion_tokens_details?.reasoning_tokens),
    usd: usd === null ? null : Number(usd.toFixed(8)),
    costSource: actual !== null
      ? "provider"
      : estimate !== null
      ? "estimate"
      : "unknown",
    estimateBasis: actual !== null || estimate === null
      ? null
      : cacheKnown ? "cache-aware" : "conservative-cache-unknown",
  }));
}

// Thrown for non-ok responses that are not 429/5xx (e.g. 400/401/403/404).
// These must fail fast — no retry, no backoff sleep.
class NonRetryableError extends Error {}

export async function chat(opts: ChatOpts): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const maxRetries = opts.maxRetries ?? 2;
  const model = opts.model ?? MODELS.textDraft();
  const body = buildChatRequest(opts.messages, { ...opts, model });

  const started = performance.now();
  const totalTimeoutMs = opts.totalTimeoutMs ?? timeoutMs * (maxRetries + 1);
  const deadline = started + totalTimeoutMs;
  const lifecycle = new AbortController();
  const abortCaller = () => lifecycle.abort(opts.signal?.reason);
  if (opts.signal?.aborted) abortCaller();
  else opts.signal?.addEventListener("abort", abortCaller, { once: true });
  const totalTimer = setTimeout(() =>
    lifecycle.abort(
      new DOMException("OpenRouter total timeout", "TimeoutError"),
    ), totalTimeoutMs);
  let lastErr: unknown;
  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (lifecycle.signal.aborted) throw lifecycle.signal.reason;
      if (performance.now() >= deadline) {
        throw new DOMException("OpenRouter total timeout", "TimeoutError");
      }
      const controller = new AbortController();
      const signal = AbortSignal.any([lifecycle.signal, controller.signal]);
      const t = setTimeout(() =>
        controller.abort(
          new DOMException("OpenRouter attempt timeout", "TimeoutError"),
        ), timeoutMs);
      const attemptStarted = performance.now();
      let resp: Response | undefined;
      let phase = "headers";
      let delay: number | null = null;
      let outcome = "error";
      try {
        resp = await fetch(OR_ENDPOINT, {
          method: "POST",
          headers: orHeaders(),
          body: JSON.stringify(body),
          signal,
        });
        phase = "body";
        if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) {
          const failure = new Error(
            `OpenRouter ${resp.status} after ${attempt + 1} attempts`,
          );
          lastErr = failure;
          if (attempt === maxRetries) {
            throw new NonRetryableError(failure.message);
          }
          delay = retryDelayMs(
            resp.headers.get("Retry-After"),
            resp.status === 429
              ? Math.min(1500 * 2 ** attempt, 8000)
              : 1000 * 2 ** attempt,
            deadline - performance.now(),
          );
          if (delay === null) {
            throw new NonRetryableError(
              "OpenRouter retry delay exceeds remaining budget",
            );
          }
          outcome = "retry";
        } else {
          if (!resp.ok) {
            throw new NonRetryableError(`OpenRouter ${resp.status}`);
          }
          let json;
          try {
            json = await resp.json();
          } catch (err) {
            if (err instanceof SyntaxError) {
              throw new NonRetryableError(
                "Invalid JSON response from OpenRouter",
              );
            }
            throw err;
          }
          if (signal.aborted) throw signal.reason;
          const content = json?.choices?.[0]?.message?.content;
          logCost(model, json?.usage, opts.costLabel ?? "chat");
          if (typeof content !== "string" || content.length === 0) {
            throw new NonRetryableError("Empty content from OpenRouter");
          }
          outcome = "success";
          return content;
        }
      } catch (err) {
        if (lifecycle.signal.aborted) throw lifecycle.signal.reason;
        if (err instanceof NonRetryableError) throw err;
        lastErr = err;
        if (attempt === maxRetries) throw err;
        delay = retryDelayMs(
          null,
          controller.signal.aborted ? 500 : 750 * 2 ** attempt,
          deadline - performance.now(),
        );
        if (delay === null) {
          throw new Error("OpenRouter retry budget exhausted");
        }
        outcome = "retry";
      } finally {
        clearTimeout(t);
        // Abort releases an unread fetch body. Initiate cancellation without
        // waiting on a potentially stalled source's cancellation promise.
        controller.abort();
        if (resp?.body && !resp.bodyUsed) {
          void resp.body.cancel().catch(() => {});
        }
        console.log(JSON.stringify({
          tag: "or_attempt",
          label: opts.costLabel ?? "chat",
          model,
          attempt: attempt + 1,
          phase,
          status: resp?.status ?? null,
          outcome,
          elapsedMs: Math.round(performance.now() - attemptStarted),
          callElapsedMs: Math.round(performance.now() - started),
        }));
      }
      if (delay !== null) await abortableWait(delay, lifecycle.signal);
    }
    throw lastErr ?? new Error("OpenRouter call failed after retries");
  } finally {
    clearTimeout(totalTimer);
    opts.signal?.removeEventListener("abort", abortCaller);
  }
}
