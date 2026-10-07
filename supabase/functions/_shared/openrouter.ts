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
  textDraft: () => Deno.env.get("OR_TEXT_MODEL") ?? "openai/gpt-5.6-luna",
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
  // reserves the model's full output window (65k on gpt-5.6-luna) and 402s
  // any key whose remaining budget can't cover that reservation.
  maxTokens?: number; // default 8192
  costLabel?: string; // for log line
  // OpenRouter unified reasoning control. gpt-5.6-* reason by DEFAULT (355-1622
  // reasoning tokens observed, 8-43s wall clock). "low" caps that budget and
  // collapses the latency tail without measurable quality loss.
  reasoning?: { effort: "low" | "medium" | "high" };
};

// Approx OpenRouter USD pricing per 1M tokens (2026-07-31); used only for
// the cost log line, never for billing logic. Luna is OpenAI list price —
// OpenRouter's limited-time promo currently bills half this.
const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  "openai/gpt-5.6-luna": { in: 0.2, out: 1.2 },
  "anthropic/claude-sonnet-5": { in: 2, out: 10 },
};

export type ProviderUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
  completion_tokens_details?: { reasoning_tokens?: number };
};

export function logCost(
  model: string,
  usage: ProviderUsage | undefined,
  label: string,
): void {
  const finite = (n: unknown): number | null =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
  const p = PRICE_PER_M[model];
  const inTok = finite(usage?.prompt_tokens);
  const outTok = finite(usage?.completion_tokens);
  const actual = finite(usage?.cost);
  const estimate = p && inTok !== null && outTok !== null
    ? (inTok / 1_000_000) * p.in + (outTok / 1_000_000) * p.out
    : null;
  const usd = actual ?? estimate;
  console.log(JSON.stringify({
    tag: "or_cost",
    label,
    model,
    inTok,
    outTok,
    reasoningTok: finite(usage?.completion_tokens_details?.reasoning_tokens),
    usd: usd === null ? null : Number(usd.toFixed(8)),
    costSource: actual !== null
      ? "provider"
      : estimate !== null
      ? "estimate"
      : "unknown",
  }));
}

// Thrown for non-ok responses that are not 429/5xx (e.g. 400/401/403/404).
// These must fail fast — no retry, no backoff sleep.
class NonRetryableError extends Error {}

export async function chat(opts: ChatOpts): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const maxRetries = opts.maxRetries ?? 2;
  const model = opts.model ?? MODELS.textDraft();
  const body = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 8192,
    ...(opts.jsonSchema && {
      response_format: { type: "json_schema", json_schema: opts.jsonSchema },
    }),
    ...(opts.reasoning && { reasoning: opts.reasoning }),
  };

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
