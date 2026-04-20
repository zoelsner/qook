# Qook Fresh Build — AI Architecture (`section-ai.md`)

**Owner:** ai-architect
**Target:** TestFlight 2026-05-24
**Scope:** Hybrid generation architecture (pre-gen cohort decks + live on-demand), OpenRouter integration on Supabase Edge, prompts, streaming, images, cost, safety.

---

## 1. Hybrid architecture overview

Two generation paths coexist. They write to different tables and serve different UX moments. This separation is intentional: cohort decks are cheap/shared/cacheable; live generation is expensive/personal/realtime.

```
                           OPENROUTER
                               ^
                               | (single API key, all AI egress)
                               |
   +---------------------------+------------------------------+
   |                           |                              |
   |  PRE-GEN (COHORT)         |        LIVE (ON-DEMAND)      |
   |                           |                              |
   |  pg_cron -> supabase      |   mobile -> supabase         |
   |  edge fn:                 |   edge fn:                   |
   |  generate-deck-batch      |   generate-recipe            |
   |  (Sun 02:00 UTC)          |   (<10s SLA, SSE streaming)  |
   |        |                  |        |                     |
   |        v                  |        v                     |
   |  4 tiers x 12 recipes     |   3 recipes (user ctx)       |
   |        |                  |        |                     |
   |        v                  |        v                     |
   |  cohort_decks (row)       |   generated_recipes (rows)   |
   |  storage: decks/W/T.json  |   + user_recipe_pool (join)  |
   |        |                  |        |                     |
   |        v                  |        v                     |
   |  batch image job (48x)    |   image gated to "save"      |
   |  meal-images/<id>.png     |   meal-images/<id>.png       |
   |                           |                              |
   +---------------------------+------------------------------+
                               |
                               v
                          SUPABASE DB + REALTIME
                               |
                               v
                        EXPO APP (RN client)
                     - Tonight: read cohort_decks
                     - Eat: stream live generation
                     - Images: realtime subscribe on recipe row
```

### Read/write paths

| Surface                      | Source                                                          | Latency target   |
| ---------------------------- | --------------------------------------------------------------- | ---------------- |
| Tonight / Meal Plan          | `cohort_decks` row for `(week_iso, tier)` then variety-pick 3   | <200ms (cached)  |
| Eat "Generate Fresh"         | Edge fn `generate-recipe` streaming SSE then 3 recipes          | <10s to ready    |
| Recipe hero images           | `recipes.hero_image_url` then realtime subscribe                | 4-15s after text |
| Cookbook / Saved             | `user_recipe_pool` join `generated_recipes`                     | <200ms           |

### Why both

- **Cohort decks** give every free user a usable Tonight screen with zero per-user AI cost. 48 recipes/week x 52 weeks = ~$112/yr total compute for the *entire user base*. First-open works offline-ish (JSON blob mirror) and does not melt if we get Hacker News'd.
- **Live generation** is where "voice context" and personalization land. This is the feature users will talk about. Gate it behind a rate limit (see section 6) so cost scales sanely.

---

## 2. Prompt architecture

All prompts return **strict JSON** matching a shared schema. We enforce via OpenRouter's `response_format: { type: "json_schema", json_schema: {...} }` where the upstream model supports it (Anthropic does via OpenRouter's passthrough), and via post-parse Zod validation as a belt-and-suspenders.

### 2.1 Shared Zod schema (used by both prompts and validator)

```ts
// supabase/functions/_shared/schema.ts
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

export const RecipeIngredientItem = z.object({
  item: z.string().min(1),
  quantity: z.string().optional(),
  notes: z.string().optional(),
});

export const RecipeIngredientGroup = z.object({
  title: z.string().min(1),
  role: z.enum(["main", "side", "sauce", "garnish", "other"]),
  items: z.array(RecipeIngredientItem).min(1),
});

export const RecipeWorkflowStep = z.object({
  instruction: z.string().min(1),
  durationMin: z.number().int().positive(),
});

export const RecipeWorkflowSection = z.object({
  title: z.string().min(1),
  objective: z.string().min(1),
  steps: z.array(RecipeWorkflowStep).min(1),
});

export const EnergyTier = z.enum([
  "brain-is-fried",
  "after-work",
  "got-energy",
  "weekend-project",
]);

export const Recipe = z.object({
  title: z.string().min(4),
  cuisine: z.string().min(2),
  tier: EnergyTier,
  tags: z.array(z.string()).max(8).default([]),
  timeMinutes: z.number().int().positive().max(240),
  servings: z.number().int().positive().max(12),
  ingredientGroups: z.array(RecipeIngredientGroup).min(1),
  workflowSections: z.array(RecipeWorkflowSection).min(1),
  nutrition: z.object({
    calories: z.number().int().optional(),
    proteinG: z.number().int().optional(),
    carbG: z.number().int().optional(),
    fatG: z.number().int().optional(),
  }).optional(),
  notes: z.string().max(300).optional(),
});

export type Recipe = z.infer<typeof Recipe>;

// JSON Schema for OpenRouter response_format.
// Kept manually in sync with Zod; simpler than zod-to-json-schema for this small surface.
export const RecipeJsonSchema = {
  name: "Recipe",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "title", "cuisine", "tier", "tags", "timeMinutes",
      "servings", "ingredientGroups", "workflowSections",
    ],
    properties: {
      title: { type: "string", minLength: 4 },
      cuisine: { type: "string", minLength: 2 },
      tier: {
        type: "string",
        enum: ["brain-is-fried", "after-work", "got-energy", "weekend-project"],
      },
      tags: { type: "array", items: { type: "string" }, maxItems: 8 },
      timeMinutes: { type: "integer", minimum: 1, maximum: 240 },
      servings: { type: "integer", minimum: 1, maximum: 12 },
      ingredientGroups: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "role", "items"],
          properties: {
            title: { type: "string" },
            role: {
              type: "string",
              enum: ["main", "side", "sauce", "garnish", "other"],
            },
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["item"],
                properties: {
                  item: { type: "string" },
                  quantity: { type: "string" },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
      },
      workflowSections: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "objective", "steps"],
          properties: {
            title: { type: "string" },
            objective: { type: "string" },
            steps: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["instruction", "durationMin"],
                properties: {
                  instruction: { type: "string" },
                  durationMin: { type: "integer", minimum: 1 },
                },
              },
            },
          },
        },
      },
      nutrition: {
        type: "object",
        additionalProperties: false,
        properties: {
          calories: { type: "integer" },
          proteinG: { type: "integer" },
          carbG: { type: "integer" },
          fatG: { type: "integer" },
        },
      },
      notes: { type: "string", maxLength: 300 },
    },
  },
} as const;
```

### 2.2 Energy tier then time/complexity enforcement

```ts
// supabase/functions/_shared/tiers.ts
export const TIER_RULES = {
  "brain-is-fried": {
    label: "Brain is fried",
    maxMinutes: 15,
    sectionsMax: 2,
    stepsPerSectionMax: 3,
    directive:
      "15 minutes OR LESS. One pan or zero pans. Max 6 ingredients. No prep that needs a knife for more than 30 seconds. Think: microwave, toaster, kettle. This is for a human who just got off a bad shift.",
  },
  "after-work": {
    label: "After work",
    maxMinutes: 30,
    sectionsMax: 3,
    stepsPerSectionMax: 4,
    directive:
      "30 minutes total, active hands-on time only. 2 vessels max. Allows a skillet plus a pot of rice, sheet pan plus salad, stir-fry plus quick grain. Satisfying but not a project.",
  },
  "got-energy": {
    label: "Got energy",
    maxMinutes: 45,
    sectionsMax: 4,
    stepsPerSectionMax: 5,
    directive:
      "45 minutes active time. Up to 3 components (main + side + vegetable). Can include one technique that needs attention (braising, searing with pan sauce, roasting with a glaze). Cook is engaged but not sprinting.",
  },
  "weekend-project": {
    label: "Weekend project",
    maxMinutes: 180,
    sectionsMax: 6,
    stepsPerSectionMax: 6,
    directive:
      "60+ minutes total, often with passive time. Multiple components, advanced techniques welcome: homemade sauce, dough, slow braise, butchery, confit. The cook WANTS to be in the kitchen.",
  },
} as const;

export type TierKey = keyof typeof TIER_RULES;

export function tierFromActiveMinutes(m: number): TierKey {
  if (m <= 15) return "brain-is-fried";
  if (m <= 30) return "after-work";
  if (m <= 45) return "got-energy";
  return "weekend-project";
}
```

### 2.3 Cohort batch prompt (Haiku, 12 recipes per tier)

Called Sunday 02:00 UTC, once per tier. Given last week's deck titles (variety hash), produce 12 distinct recipes in that tier.

```ts
// supabase/functions/_shared/prompts/cohort.ts
import { TIER_RULES, type TierKey } from "../tiers.ts";

export function buildCohortSystemPrompt() {
  return [
    "You are Qook's weekly cohort deck generator.",
    "You produce arrays of dinner recipes for home cooks who use a meal-planning app.",
    "Output is STRICT JSON. No prose, no markdown, no apology, no preamble.",
    "Every recipe must plate as a complete dinner for 2-4 people.",
    "Do not invent obscure ingredients unless they are core to the named cuisine.",
    "Never include a tool the user hasn't indicated they own. Assume: stovetop, oven, knife, cutting board, sheet pan, skillet, pot. Nothing else.",
    "Quality bar: a skeptical home cook should look at any recipe and say 'yes, I'd make that on a Tuesday'.",
  ].join(" ");
}

export function buildCohortUserPrompt(args: {
  tier: TierKey;
  weekIso: string;          // "2026-W19"
  count: number;            // 12
  avoidTitles: string[];    // last week's 12 titles
  cuisineDiversity: string[]; // required spread, e.g. ["Italian","Thai","Mexican",...]
}) {
  const rule = TIER_RULES[args.tier];
  return [
    `Generate exactly ${args.count} distinct dinner recipes for tier "${args.tier}".`,
    `Tier directive: ${rule.directive}`,
    `Hard ceiling: timeMinutes must be <= ${rule.maxMinutes}.`,
    `Workflow: at most ${rule.sectionsMax} sections, ${rule.stepsPerSectionMax} steps each.`,
    `Every step needs a concrete durationMin > 0 and specific doneness cues ("until edges curl", "when rice absorbs all liquid", NOT "until done").`,
    ``,
    `Cuisine spread requirement: spread across at least ${Math.min(args.cuisineDiversity.length, 8)} distinct cuisines from this bank: ${args.cuisineDiversity.join(", ")}.`,
    `Protein spread: at least 6 different proteins across the 12 recipes. At least 1 vegetarian (tofu, paneer, beans, or mushroom-forward).`,
    ``,
    `Variety constraint - do NOT duplicate or closely echo these titles from last week:`,
    ...args.avoidTitles.map((t, i) => `  ${i + 1}. ${t}`),
    ``,
    `ingredientGroups must use practical titles ("Main", "Rice", "Sauce", "Greens"). At least one group role="main".`,
    `For tier "brain-is-fried" and "after-work": one-pot / simple two-component meals are FINE and encouraged.`,
    `For tier "got-energy" and "weekend-project": deliver a full plated meal (main + side + vegetable).`,
    ``,
    `Quantity field must always include unit for measured ingredients ("2 tbsp", "1 cup", "3 cloves"). Bare numbers only for whole countable items ("2" eggs, "1" lemon).`,
    `Title: specific and appetizing, no filler adjectives ("Comfort", "Quick", "Bold"). Example good: "Miso-Butter Salmon with Sesame Rice". Example bad: "Delicious Salmon Bowl".`,
    `notes: 1 sentence explaining why this dish is appealing (texture, flavor hook, occasion). No cooking tips.`,
    ``,
    `Return JSON of shape: { "recipes": Recipe[] } where Recipe matches the schema you were given.`,
    `Week: ${args.weekIso}.`,
  ].join("\n");
}

export const CuisineBank = [
  "Italian", "Thai", "Mexican", "Japanese", "Korean", "Indian",
  "Vietnamese", "Chinese", "Greek", "Spanish", "American",
  "Middle Eastern", "Mediterranean", "French", "Peruvian", "Filipino",
];
```

### 2.4 Live personalized prompt (Haiku, 3 recipes)

Streamed. Takes user preferences + optional voice context + recent likes.

```ts
// supabase/functions/_shared/prompts/live.ts
import { TIER_RULES, type TierKey } from "../tiers.ts";

export type LiveContext = {
  tier: TierKey;
  householdSize: number;
  avoidIngredients: string[];
  lovedCuisines: string[];       // top 3 by pref score
  recentLikedTitles: string[];   // last 5 swipe-liked
  voiceContext?: string;         // iOS transcript, 10s max
  kitchenTools: string[];        // intersection of user tools + whitelist
};

export function buildLiveSystemPrompt() {
  return [
    "You are Qook's live recipe concierge.",
    "A real person opened the app right now and wants 3 dinner ideas for tonight.",
    "Output STRICT JSON, no prose.",
    "Treat voice context as the most important signal - it's what the user just said out loud about their evening.",
    "Draw inspiration from their loved cuisines and recent likes, but don't repeat them verbatim.",
    "Safety: if voice context mentions self-harm, unsafe food practices, or requests dangerous behavior, return exactly: { \"refusal\": \"Let's plan something nourishing instead. Can you tell me what you have in the fridge?\" } and nothing else.",
  ].join(" ");
}

export function buildLiveUserPrompt(ctx: LiveContext) {
  const rule = TIER_RULES[ctx.tier];
  const avoid = ctx.avoidIngredients.length
    ? ctx.avoidIngredients.join(", ")
    : "none";
  const tools = ctx.kitchenTools.length
    ? ctx.kitchenTools.join(", ")
    : "stovetop, oven, skillet, pot";

  return [
    `Generate exactly 3 dinner recipes for tier "${ctx.tier}" (${rule.label}).`,
    `Tier directive: ${rule.directive}`,
    `timeMinutes ceiling: ${rule.maxMinutes}.`,
    ``,
    `Serves: ${ctx.householdSize}.`,
    `Avoid ingredients: ${avoid}.`,
    `Available tools: ${tools}. Do not require anything outside this set.`,
    `Loved cuisines (priority order): ${ctx.lovedCuisines.join(", ") || "open"}.`,
    ctx.recentLikedTitles.length
      ? `Recently liked (match the energy, don't duplicate):\n${ctx.recentLikedTitles.map((t, i) => `  ${i + 1}. ${t}`).join("\n")}`
      : "No recent swipe data - give a confident mix.",
    ``,
    ctx.voiceContext
      ? `USER JUST SAID (voice context, weight heavily): "${ctx.voiceContext}"`
      : `No voice context - pick confidently based on the above.`,
    ``,
    `Spread the 3 across different cuisines unless voice context pins one.`,
    `One of the 3 should be the "safe" play (most aligned with recent likes).`,
    `One should be a gentle stretch - a cuisine or technique they haven't had in the last 5.`,
    `One should feel like today's mood (match voice tone if given).`,
    ``,
    `Return JSON shape: { "recipes": Recipe[] }.`,
  ].join("\n");
}
```

### 2.5 Image prompt (Seedream 4.5, watercolor)

Locked template. Called per recipe after text lands.

```ts
// supabase/functions/_shared/prompts/image.ts
import type { Recipe } from "../schema.ts";

const PALETTE_DIRECTIVE =
  "Cream paper background with bold asymmetric sage green and rust orange watercolor wash zones. Prussian blue shadow accents. Occasional gold-leaf detail. Visible paper texture and brush-stroke edges where water meets pigment.";

function pickSubjectIngredients(recipe: Recipe, limit = 5): string[] {
  const scored: Array<{ item: string; score: number }> = [];
  for (const group of recipe.ingredientGroups) {
    const weight =
      group.role === "main" ? 4
      : group.role === "side" ? 3
      : group.role === "sauce" ? 2
      : 1;
    for (const it of group.items) {
      scored.push({ item: it.item, score: weight });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);
}

export function buildImagePrompt(recipe: Recipe): string {
  const subjects = pickSubjectIngredients(recipe);
  const subjectClause = subjects.length
    ? `${recipe.title} - featuring ${subjects.join(", ")}`
    : recipe.title;

  return [
    `Hand-painted watercolor illustration, editorial cookbook style.`,
    `Richly detailed ${subjectClause} rendered with fine brushwork.`,
    PALETTE_DIRECTIVE,
    `Composition: overhead 3/4 view of the plated dish on a rustic surface. Generous negative space on the upper-right quadrant for typography.`,
    `The food must look deliberately painted, not photographic - visible pigment pooling, soft wet-on-wet edges, occasional fine ink linework on accents.`,
    `Only the ingredients described here; do not invent extra components or garnish.`,
    `No text, no signature, no watermark, no people, no hands.`,
    `Square 1:1 aspect ratio.`,
  ].join(" ");
}
```

### 2.6 Polish prompt (Sonnet fallback)

Only called if the Haiku draft fails validation or a confidence heuristic. See section 7 for trigger conditions.

```ts
// supabase/functions/_shared/prompts/polish.ts
export function buildPolishPrompt(
  draftRecipeJson: string,
  validationErrors: string[],
) {
  return [
    `You are a senior recipe editor rescuing a draft that failed validation.`,
    `Produce a corrected recipe in the same JSON schema you were given.`,
    `Do NOT change cuisine, protein identity, or overall dish concept.`,
    `Do fix:`,
    ...validationErrors.map((e) => `  - ${e}`),
    ``,
    `Also tighten step instructions so each has a concrete doneness cue ("until edges crisp", not "until done") and a realistic durationMin.`,
    `Return only the corrected Recipe JSON.`,
    ``,
    `DRAFT:`,
    draftRecipeJson,
  ].join("\n");
}
```

---

## 3. OpenRouter integration (Deno / Supabase Edge)

All edge functions share a single wrapper. Retries on transient failures, timeouts, SSE support, structured-output enforcement, lightweight circuit breaker in Postgres.

### 3.1 `lib/openrouter.ts` fetch wrapper

```ts
// supabase/functions/_shared/openrouter.ts
import { Recipe, RecipeJsonSchema } from "./schema.ts";

const OR_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

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
  textPolish: () => Deno.env.get("OR_POLISH_MODEL") ?? "anthropic/claude-sonnet-4.6",
  image: () => Deno.env.get("OR_IMAGE_MODEL") ?? "bytedance-seed/seedream-4.5",
} as const;

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export type ChatOpts = {
  model?: string;
  messages: ChatMsg[];
  jsonSchema?: typeof RecipeJsonSchema | { name: string; schema: unknown; strict?: boolean };
  maxRetries?: number;        // default 2
  timeoutMs?: number;         // default 30_000 for batch, 20_000 for live
  temperature?: number;       // default 0.7 draft, 0.4 polish
};

export async function chat(opts: ChatOpts): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const maxRetries = opts.maxRetries ?? 2;
  const body = {
    model: opts.model ?? MODELS.textDraft(),
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
        // Honor Retry-After if present, else exponential backoff.
        const retryAfter = Number(resp.headers.get("Retry-After") ?? 0);
        const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(1500 * 2 ** attempt, 8000);
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
      if (typeof content !== "string" || content.length === 0) {
        throw new Error("Empty content from OpenRouter");
      }
      return content;
    } catch (err) {
      lastErr = err;
      if (controller.signal.aborted) {
        await sleep(500);
        continue;
      }
      if (attempt === maxRetries) throw err;
      await sleep(750 * 2 ** attempt);
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr ?? new Error("OpenRouter call failed after retries");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
```

### 3.2 Streaming variant - used by live `generate-recipe`

```ts
// supabase/functions/_shared/openrouter-stream.ts
import { orHeaders, MODELS } from "./openrouter.ts";

export type StreamHandlers = {
  onDelta?: (text: string) => void;          // raw token delta
  onPartial?: (partialJson: string) => void; // cumulative JSON buffer
  onDone?: (fullText: string) => void;
  onError?: (err: Error) => void;
};

const OR_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export async function chatStream(
  messages: { role: string; content: string }[],
  handlers: StreamHandlers,
  opts: { model?: string; temperature?: number; timeoutMs?: number } = {},
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 25_000);

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
    throw new Error(`Stream open failed: ${resp.status} ${await resp.text().catch(() => "")}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  try {
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
        } catch { /* malformed chunk - skip */ }
      }
    }
    handlers.onDone?.(full);
    return full;
  } catch (err) {
    handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
    throw err;
  } finally {
    clearTimeout(timeout);
    try { reader.releaseLock(); } catch { /* no-op */ }
  }
}
```

### 3.3 Image generation wrapper

```ts
// supabase/functions/_shared/openrouter-image.ts
import { orHeaders, MODELS } from "./openrouter.ts";
const OR_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export type ImageResult = { bytes: Uint8Array; mime: string };

export async function generateImage(prompt: string, opts: { timeoutMs?: number } = {}): Promise<ImageResult> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45_000);

  try {
    const resp = await fetch(OR_ENDPOINT, {
      method: "POST",
      headers: orHeaders(),
      body: JSON.stringify({
        model: MODELS.image(),
        messages: [{ role: "user", content: prompt }],
        modalities: ["image"],
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`Image gen ${resp.status}: ${await resp.text()}`);
    }
    const json = await resp.json();
    const msg = json?.choices?.[0]?.message;
    const first = Array.isArray(msg?.images) ? msg.images[0] : null;
    const url =
      first?.image_url?.url ??
      first?.imageUrl?.url ??
      first?.url ??
      null;
    if (!url) throw new Error("Image response missing url");

    if (url.startsWith("data:")) {
      const [header, b64] = url.split(",");
      const mimeMatch = header.match(/data:([^;]+)/);
      const mime = mimeMatch?.[1] ?? "image/png";
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return { bytes, mime };
    }
    const binResp = await fetch(url);
    if (!binResp.ok) throw new Error(`Image fetch ${binResp.status}`);
    const bytes = new Uint8Array(await binResp.arrayBuffer());
    return { bytes, mime: binResp.headers.get("content-type") ?? "image/png" };
  } finally {
    clearTimeout(t);
  }
}
```

### 3.4 Circuit breaker (Postgres-backed)

When OpenRouter misbehaves we want to fail fast for a few minutes rather than pile up queued requests.

```sql
-- migration: ai_circuit.sql
create table public.ai_circuit (
  key text primary key,           -- e.g. 'openrouter.text', 'openrouter.image'
  failures int not null default 0,
  opened_until timestamptz
);
insert into public.ai_circuit(key) values ('openrouter.text'), ('openrouter.image')
  on conflict do nothing;
```

```ts
// supabase/functions/_shared/breaker.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const admin = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const THRESHOLD = 5;
const OPEN_MINUTES = 3;

export async function checkBreaker(key: string) {
  const { data } = await admin().from("ai_circuit").select("opened_until").eq("key", key).single();
  if (data?.opened_until && new Date(data.opened_until) > new Date()) {
    throw new Error(`circuit_open:${key}`);
  }
}

export async function recordFailure(key: string) {
  const { data } = await admin().rpc("ai_breaker_fail", { p_key: key, p_threshold: THRESHOLD, p_open_mins: OPEN_MINUTES });
  return data;
}
export async function recordSuccess(key: string) {
  await admin().from("ai_circuit").update({ failures: 0, opened_until: null }).eq("key", key);
}
```

```sql
-- rpc
create or replace function ai_breaker_fail(p_key text, p_threshold int, p_open_mins int) returns void as $$
declare cur int;
begin
  update ai_circuit set failures = failures + 1 where key = p_key returning failures into cur;
  if cur >= p_threshold then
    update ai_circuit set opened_until = now() + (p_open_mins || ' minutes')::interval, failures = 0 where key = p_key;
  end if;
end; $$ language plpgsql;
```

Wrap the public `chat()` and `generateImage()` calls in `checkBreaker` / `recordSuccess` / `recordFailure`. Keep it dead simple - no half-open state; after `opened_until` passes the next call tries naturally.

---

## 4. Streaming strategy (Edge to mobile)

### 4.1 Edge function: SSE passthrough with server-side JSON parsing

```ts
// supabase/functions/generate-recipe/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { chatStream } from "../_shared/openrouter-stream.ts";
import { buildLiveSystemPrompt, buildLiveUserPrompt, type LiveContext } from "../_shared/prompts/live.ts";
import { Recipe } from "../_shared/schema.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const ResponseEnvelope = z.object({ recipes: z.array(Recipe).length(3) });

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Rate limit (see section 6) - throws 429 if over budget.
  await checkDailyQuota(user.id);

  const ctx = (await req.json()) as LiveContext;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      send("ready", { status: "generating" });

      try {
        const full = await chatStream(
          [
            { role: "system", content: buildLiveSystemPrompt() },
            { role: "user", content: buildLiveUserPrompt(ctx) },
          ],
          {
            onDelta: (d) => send("delta", { text: d }),
            onPartial: (buf) => {
              const partials = extractPartialRecipes(buf);
              if (partials.length) send("partial", { recipes: partials });
            },
          },
          { temperature: 0.75, timeoutMs: 22_000 },
        );

        const parsed = JSON.parse(stripCodeFences(full));
        const result = ResponseEnvelope.safeParse(parsed);
        if (!result.success) {
          send("error", { reason: "validation", detail: result.error.issues.slice(0, 3) });
          controller.close();
          return;
        }

        // Persist.
        const ids = await persistRecipes(supabase, user.id, result.data.recipes);

        // Kick off async image jobs (don't block close).
        for (const id of ids) {
          supabase.functions.invoke("generate-image", { body: { recipeId: id } }).catch(() => {});
        }

        send("final", { recipes: result.data.recipes, ids });
        send("done", {});
      } catch (err) {
        send("error", { reason: "generation_failed", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
```

Helpers `extractPartialRecipes`, `stripCodeFences`, `persistRecipes`, `checkDailyQuota` live in `_shared/live-helpers.ts`.

### 4.2 Partial parser

The model streams an object of shape `{ "recipes": [...] }`. We peel off whole recipe objects as they close so the UI can render early.

```ts
// supabase/functions/_shared/partial-parser.ts
import { Recipe } from "./schema.ts";

export function extractPartialRecipes(buf: string): unknown[] {
  // Find "recipes": [  and scan forward counting braces.
  const start = buf.indexOf('"recipes"');
  if (start < 0) return [];
  const arrStart = buf.indexOf("[", start);
  if (arrStart < 0) return [];
  const out: unknown[] = [];
  let depth = 0;
  let objStart = -1;
  let inStr = false;
  let escaped = false;
  for (let i = arrStart + 1; i < buf.length; i++) {
    const ch = buf[i];
    if (inStr) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") { if (depth === 0) objStart = i; depth++; continue; }
    if (ch === "}") {
      depth--;
      if (depth === 0 && objStart >= 0) {
        const slice = buf.slice(objStart, i + 1);
        try {
          const obj = JSON.parse(slice);
          // Best-effort shape check - don't fail partials hard.
          const preview = Recipe.partial().safeParse(obj);
          if (preview.success) out.push(preview.data);
        } catch { /* incomplete - skip */ }
        objStart = -1;
      }
    }
  }
  return out;
}
```

### 4.3 Mobile client - SSE consumer in RN

Expo doesn't have first-class EventSource. Use `react-native-sse` (maintained, binary-free) or hand-rolled `fetch` + ReadableStream in Hermes.

```ts
// apps/native/lib/ai/useGenerateRecipe.ts
import EventSource from "react-native-sse";
import { useCallback, useRef, useState } from "react";
import { supabase } from "../supabase";

type Phase =
  | "idle" | "collecting_context" | "generating"
  | "streaming_recipes" | "finalizing" | "ready" | "error";

export function useGenerateRecipe() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [partial, setPartial] = useState<unknown[]>([]);
  const [final, setFinal] = useState<{ id: string; recipe: unknown }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const run = useCallback(async (ctx: unknown) => {
    setPhase("generating");
    setPartial([]);
    setFinal(null);
    setError(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setPhase("error"); setError("no_session"); return; }

    const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-recipe`;
    const es = new EventSource(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(ctx),
      pollingInterval: 0,
    });
    esRef.current = es;

    es.addEventListener("partial", (e) => {
      try {
        const { recipes } = JSON.parse(e.data as string);
        setPhase("streaming_recipes");
        setPartial(recipes);
      } catch { /* skip */ }
    });
    es.addEventListener("final", (e) => {
      try {
        const payload = JSON.parse(e.data as string);
        setFinal(payload.recipes.map((r: unknown, i: number) => ({ id: payload.ids[i], recipe: r })));
        setPhase("finalizing");
      } catch { setPhase("error"); setError("bad_final"); }
    });
    es.addEventListener("done", () => {
      setPhase("ready");
      es.close();
    });
    es.addEventListener("error", (e) => {
      setPhase("error");
      setError(String((e as { message?: string }).message ?? "stream_error"));
      es.close();
    });
  }, []);

  const cancel = useCallback(() => {
    esRef.current?.close();
    setPhase("idle");
  }, []);

  return { phase, partial, final, error, run, cancel };
}
```

### 4.4 Fallback

If SSE fails (corporate captive portal, iOS Low Data Mode), the hook falls back to a non-streaming call to `generate-recipe-blocking` (same code path, `stream: false`, 20s SLA, returns full array). Detect by `es.addEventListener("error", ...)` on the *connection* (not a parse error) and swap to `fetch()`.

---

## 5. Image generation pipeline

### 5.1 Timing

Text recipes are saved with `image_status='pending'`, `hero_image_url=null`. The UI shows a watercolor placeholder (shared SVG, ambient animation). An async job fills in the real image; mobile subscribes to the `recipes` row via Supabase Realtime and swaps the image when `image_status='ready'`.

### 5.2 `generate-image` Edge Function

```ts
// supabase/functions/generate-image/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateImage } from "../_shared/openrouter-image.ts";
import { buildImagePrompt } from "../_shared/prompts/image.ts";
import { Recipe } from "../_shared/schema.ts";

serve(async (req) => {
  const { recipeId } = await req.json() as { recipeId: string };
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  await admin.from("recipes").update({ image_status: "generating" }).eq("id", recipeId);

  const { data: row, error } = await admin.from("recipes").select("*").eq("id", recipeId).single();
  if (error || !row) return j({ ok: false, error: "recipe_not_found" }, 404);

  let recipe: Recipe;
  try {
    recipe = Recipe.parse(row.content);
  } catch {
    await admin.from("recipes").update({ image_status: "failed", image_error: "bad_content" }).eq("id", recipeId);
    return j({ ok: false, error: "bad_content" }, 422);
  }

  const prompt = buildImagePrompt(recipe);
  let attempt = 0, lastErr: unknown;
  while (attempt < 3) {
    try {
      const { bytes, mime } = await generateImage(prompt, { timeoutMs: 45_000 });
      const path = `recipes/${recipeId}.png`;
      const up = await admin.storage.from("meal-images").upload(path, bytes, {
        contentType: mime, upsert: true, cacheControl: "31536000",
      });
      if (up.error) throw up.error;
      const { data: pub } = admin.storage.from("meal-images").getPublicUrl(path);
      await admin.from("recipes").update({
        image_status: "ready",
        hero_image_url: pub.publicUrl,
        image_updated_at: new Date().toISOString(),
      }).eq("id", recipeId);
      return j({ ok: true, url: pub.publicUrl });
    } catch (e) {
      lastErr = e;
      attempt++;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  await admin.from("recipes").update({
    image_status: "failed",
    image_error: String(lastErr).slice(0, 400),
  }).eq("id", recipeId);
  return j({ ok: false, error: "exhausted_retries" }, 502);
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
```

### 5.3 Batch mode (weekly cron) - 48 images, concurrency 4

Called from `generate-deck-batch` after all 48 recipes land.

```ts
// supabase/functions/_shared/image-batch.ts
export async function runImageBatch(recipeIds: string[], concurrency = 4) {
  const queue = [...recipeIds];
  const workers: Promise<void>[] = [];
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push((async () => {
      while (queue.length) {
        const id = queue.shift()!;
        try {
          const resp = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-image`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` , "Content-Type": "application/json" },
              body: JSON.stringify({ recipeId: id }),
            },
          );
          const body = await resp.json();
          results.push({ id, ok: !!body.ok, error: body.error });
        } catch (e) {
          results.push({ id, ok: false, error: String(e) });
        }
      }
    })());
  }
  await Promise.all(workers);
  return results;
}
```

### 5.4 Live "gate image behind save"

For live-generated recipes, we **don't** fire images eagerly. The 3 recipes show with placeholders. When the user taps Save or the recipe enters the Meal Plan, THEN we invoke `generate-image`. This halves live AI cost (see section 6).

### 5.5 Realtime notification

```ts
// apps/native/lib/ai/useRecipeImage.ts
import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export function useRecipeImage(recipeId: string, initial?: string | null) {
  const [url, setUrl] = useState<string | null>(initial ?? null);
  useEffect(() => {
    if (url) return;
    const ch = supabase.channel(`recipe:${recipeId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "recipes", filter: `id=eq.${recipeId}`,
      }, (payload) => {
        const next = (payload.new as { hero_image_url?: string })?.hero_image_url;
        if (next) setUrl(next);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [recipeId, url]);
  return url;
}
```

---

## 6. Cost model

All figures as of 2026-04-20 OpenRouter pricing. Haiku 4.5 = $0.80 in / $4 out per 1M tok. Sonnet 4.6 = $3 in / $15 out. Seedream 4.5 = $0.04/image.

### 6.1 Per-call cost

- **Cohort recipe (Haiku batch):** ~1,200 input tok (system+prompt) + ~1,200 output tok/recipe. 12 recipes batched in one request: ~1,200 + 14,400 out ~= $0.058 per tier per week. x4 tiers = **$0.23/week batch text**.
- **Live recipe triple (Haiku stream):** ~1,500 in + ~3,600 out ~= **$0.016 per triple**.
- **Polish (Sonnet, rare):** ~2,000 in + 1,500 out ~= $0.029 per call. Expected trigger rate 5-10%.
- **Image (Seedream):** **$0.04 each**.

### 6.2 Baseline (cohort cron only, no users)

| Line item                                | Weekly | Monthly | Yearly |
| ---------------------------------------- | ------ | ------- | ------ |
| 4 tiers x 12 recipes text (Haiku)        | $0.23  | $1.00   | $12    |
| 48 cohort images (Seedream)              | $1.92  | $8.30   | $100   |
| **Total baseline**                       | $2.15  | **$9.30** | **$112** |

### 6.3 Live AI per active user

Assume a "light" user does 2 fresh generations/week; a "heavy" user does 5.

| Persona  | Gens/wk | Text $/wk | If all images $/wk | If image-gated-to-save $/wk |
| -------- | ------- | --------- | ------------------- | -------------------------- |
| Light    | 2       | $0.032    | $0.24 + $0.032 = $0.27 | $0.08 + $0.032 = $0.11  |
| Heavy    | 5       | $0.08     | $0.60 + $0.08  = $0.68 | $0.20 + $0.08  = $0.28  |

(Image-gated math assumes user saves ~1/3 of generated recipes.)

### 6.4 TestFlight scenarios

Assume 100 active testers, distribution 70% light / 30% heavy:

- **Text-only live:** 100 x (0.7x$0.032 + 0.3x$0.08) x 4.3 wks ~= **$20/mo**.
- **With save-gated images:** ~= **$65/mo**.
- **With eager images on every live gen:** ~= **$160/mo**.

Plus $9/mo baseline = total **$29-$169/mo** for TestFlight. Ship with **save-gated images** - user doesn't miss them at swipe time; the watercolor placeholder actually looks good.

### 6.5 Mitigations (all in-code)

1. **Daily user quota**: 10 live generations/day enforced at edge before any AI call.
2. **Cohort deck TTL**: 7 days. Never regen until next Sunday.
3. **Dedup hash**: identical `(tier, loved_cuisines, voice_hash)` inside 4 hours returns cached triple (small `live_cache` table).
4. **Sonnet polish caps**: max 15% of drafts. If a single session crosses this the rest fail gracefully to the Haiku draft (accept minor imperfections over unbounded spend).
5. **Image concurrency 4**: prevents runaway parallel spending during batch.

---

## 7. Quality & safety

### 7.1 Structured output enforcement (layered)

1. OpenRouter `response_format: json_schema` (primary).
2. `stripCodeFences` removes accidental markdown.
3. `Recipe.parse()` Zod validation.
4. If Zod fails: collect error paths then call polish prompt with Sonnet then re-validate.
5. If polish still fails: return the recipe as `status='draft_invalid'` and log - don't show user garbage.

### 7.2 Content safety

```ts
// supabase/functions/_shared/safety.ts
const RED_FLAG_PATTERNS = [
  /\b(poison|kill myself|overdose|self.harm|unsafe for me)\b/i,
  /\b(eat.*raw.*chicken|undercook.*pork|raw.*ground.*beef)\b/i,
  /\b(bleach|cleaning product|chemical).*\b(eat|drink|consume)\b/i,
];

export function screenVoiceContext(text: string): { ok: true } | { ok: false; kind: "self_harm" | "unsafe_food" | "chemical" } {
  if (RED_FLAG_PATTERNS[0].test(text)) return { ok: false, kind: "self_harm" };
  if (RED_FLAG_PATTERNS[1].test(text)) return { ok: false, kind: "unsafe_food" };
  if (RED_FLAG_PATTERNS[2].test(text)) return { ok: false, kind: "chemical" };
  return { ok: true };
}
```

Voice context fails then edge fn returns `{ refusal, gentleRedirect }` event, mobile shows a polite "let's pick something else" screen. No AI call made.

### 7.3 Hallucination checks

Run after Zod parse:

```ts
// supabase/functions/_shared/validators.ts
import { TIER_RULES } from "./tiers.ts";
import type { Recipe } from "./schema.ts";

export function validateRecipe(r: Recipe): { ok: true } | { ok: false; errors: string[] } {
  const errs: string[] = [];
  const rule = TIER_RULES[r.tier];
  if (r.timeMinutes > rule.maxMinutes + 5) errs.push(`timeMinutes ${r.timeMinutes} exceeds tier ceiling ${rule.maxMinutes}`);
  if (r.workflowSections.length > rule.sectionsMax) errs.push(`too many sections for tier`);
  if (!r.ingredientGroups.some((g) => g.role === "main")) errs.push(`no main ingredient group`);
  if (r.workflowSections.some((s) => s.steps.some((x) => x.durationMin <= 0))) errs.push(`step durationMin must be > 0`);
  if (r.title.length < 8) errs.push(`title too short`);
  if (/\b(quick|bold|comfort|easy|elevated)\b/i.test(r.title.split(" ")[0])) errs.push(`title starts with filler adjective`);
  if (errs.length) return { ok: false, errors: errs };
  return { ok: true };
}
```

### 7.4 Polish trigger

```ts
// supabase/functions/_shared/polish-gate.ts
import { Recipe } from "./schema.ts";
import { validateRecipe } from "./validators.ts";
import { buildPolishPrompt } from "./prompts/polish.ts";
import { chat, MODELS } from "./openrouter.ts";
import { RecipeJsonSchema } from "./schema.ts";

export async function withPolish(raw: unknown): Promise<Recipe> {
  const first = Recipe.safeParse(raw);
  if (!first.success) {
    return await polishAndReturn(JSON.stringify(raw), first.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }
  const v = validateRecipe(first.data);
  if (!v.ok) {
    return await polishAndReturn(JSON.stringify(first.data), v.errors);
  }
  return first.data;
}

async function polishAndReturn(json: string, errors: string[]): Promise<Recipe> {
  const out = await chat({
    model: MODELS.textPolish(),
    messages: [
      { role: "system", content: "You are a senior recipe editor. Return only corrected JSON." },
      { role: "user", content: buildPolishPrompt(json, errors) },
    ],
    jsonSchema: RecipeJsonSchema,
    temperature: 0.3,
    timeoutMs: 25_000,
  });
  return Recipe.parse(JSON.parse(out));
}
```

---

## 8. Streaming UX states (mobile state machine)

```
 +--------+  user taps "Generate"
 |  idle  |----------------------------+
 +--------+                            |
                                       v
                         +----------------------+
                         | collecting_context   |
                         | (voice mic or type)  |
                         +------+---------------+
                                |  submit
                                v
 +--------------------+   SSE open
 |    generating      |<------------
 | (shimmer painting, |
 |  no text yet)      |
 +------+-------------+
        |  first "partial" event
        v
 +--------------------+
 | streaming_recipes  |  titles + cuisine appear one-by-one
 | (fill cards        |  ingredients stream in
 |  progressively)    |  steps stream in
 +------+-------------+
        |  "final" event
        v
 +--------------------+
 |   finalizing       |  images still generating; placeholder shown
 | (persist confirm)  |
 +------+-------------+
        |  "done"
        v
 +--------------------+
 |       ready        |  user can swipe/save
 +--------------------+

Error branches:
- network_error from any state -> error + retry chip
- validation failure on "final" -> error + "try again" (auto-retry once silently with higher temperature)
- refusal -> refusal screen, skip AI
```

### Loading choreography

- **generating**: watercolor brush stroke SVG animating left-to-right (2s loop). Palette: sage over cream.
- **streaming_recipes**: each recipe card has a subtle shimmer on unfilled fields. Title -> cuisine -> notes -> ingredients -> steps appear with 300ms stagger and `{ damping: 30, stiffness: 400 }` spring.
- **finalizing**: a single "saving your trio" microcopy under the cards.
- **ready**: haptic `Haptics.ImpactFeedbackStyle.Soft`, swipe enabled.

---

## 9. Voice context ingestion

**Pick: iOS on-device Speech Recognition (SFSpeechRecognizer / Expo `expo-speech-recognition`).**

Why:
- **Free** - no per-minute cost.
- **Offline-capable** on iOS 13+.
- **Privacy** - transcript never leaves the device until the user taps submit.
- **Latency** - finalizes in <1s after user stops speaking; we can show live transcript during the 10s cap.

Flow:
1. Mobile shows mic; user taps + holds (or tap-to-start, tap-to-stop).
2. `expo-speech-recognition` returns rolling transcript; show it live.
3. Auto-cut at 12 seconds; auto-submit at 10s of silence.
4. Final transcript then pass as `voiceContext` string in the `generate-recipe` request body.
5. Screen transcript client-side before submit (profanity OK; safety screening runs server-side too).

Fallbacks considered and rejected:
- **Whisper (OpenAI direct)**: $0.006/minute audio + latency + extra API key + a PII'd audio blob crossing network. Not worth.
- **OpenRouter ASR**: adds a hop. No quality win over iOS native for 10s prompts.
- **Deepgram**: overkill for our 10s cap.

Revisit if: Android support lands (v2) - at that point evaluate Whisper via OpenRouter for cross-platform.

---

## 10. Future AI features (parked, v2+)

| Feature                     | One-liner                                              | Why deferred                  |
| --------------------------- | ------------------------------------------------------ | ----------------------------- |
| Image style presets         | User picks illustrated / photographic / warm-toned     | Seedream watercolor is brand  |
| Card display settings       | Toggle calories / protein / etc on swipe cards         | UI complexity, not AI-bound   |
| Recipe ranking tournament   | Tinder-style bracket on liked recipes                  | Post-TestFlight               |
| Multi-turn refinement       | "Make it spicier" / "swap rice for noodles"            | Needs session state + UX      |
| Pantry-aware generation     | User types/photographs fridge then recipes from that   | Needs image classifier        |
| Shared household preference | Household average of picky-eater constraints           | Needs household schema first  |

Flag in code with `FUTURE_FEATURE` comments at relevant edge function entry points so we don't accidentally build parts of them.

---

## 11. Ordered build plan

### Week 1 (ends 2026-04-27) - Plumbing

- [ ] Supabase project created, `meal-images` bucket, `recipes` + `cohort_decks` + `ai_circuit` + `live_cache` tables (coordinate w/ backend architect on schema).
- [ ] `_shared/schema.ts`, `_shared/tiers.ts`, `_shared/openrouter.ts`, `_shared/openrouter-stream.ts`, `_shared/openrouter-image.ts` - copy-paste-ready.
- [ ] Env: `OPENROUTER_API_KEY`, `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME`, model overrides.
- [ ] `generate-image` edge function deployed, smoke-tested with a stub recipe. **Ship one real image end-to-end before anything else** (reuses existing cost-checkpoint rule).
- [ ] `validate-recipe` + `withPolish` helpers.

### Week 2 (ends 2026-05-04) - Cohort pipeline

- [ ] `generate-deck-batch` edge function: 12 recipes/tier x 4 tiers then `cohort_decks` table + JSON mirror to Storage.
- [ ] pg_cron Sunday 02:00 UTC job calling it.
- [ ] Batch image runner (concurrency 4).
- [ ] Variety-hash logic (last week's titles).
- [ ] Mobile Tonight screen reads current cohort deck; variety-pick 3 for display.
- [ ] Manual test: run cron once mid-week, verify 48 recipes + 48 images land in <6 min.

### Week 3 (ends 2026-05-11) - Live generation + voice

- [ ] `generate-recipe` edge function with SSE streaming.
- [ ] `partial-parser.ts` tested on recorded Haiku streams.
- [ ] Mobile `useGenerateRecipe` hook + Eat "Generate Fresh" screen.
- [ ] iOS voice context (expo-speech-recognition), 10s mic UI.
- [ ] Save-gated image trigger (recipe save then invoke `generate-image`).
- [ ] Daily quota enforcement (10/user/day).
- [ ] Polish fallback wired and tested on 20 intentionally-broken drafts.

### Week 4 (ends 2026-05-18) - Hardening

- [ ] Circuit breaker hit under fault injection.
- [ ] Dedup cache: identical triple request within 4h returns cached.
- [ ] Error states in UI (refusal, validation fail, network).
- [ ] Cost dashboard: SQL view summing daily AI spend per surface.
- [ ] Soak: run batch + 200 simulated live requests back-to-back.

### Week 5 (ends 2026-05-24) - TestFlight

- [ ] Internal build cut Monday.
- [ ] Real-user dogfood Tue-Thu: watch Sonnet polish rate, image failure rate, quota trips.
- [ ] External TestFlight Fri.

---

## 12. Open questions / risks

1. **OpenRouter `response_format` support on Haiku passthrough.** OpenRouter claims json_schema support for Anthropic but behavior drifted in the past. **Mitigation**: Zod is the ground truth; schema is a hint.
2. **SSE over Supabase Edge.** Deno deploy supports streamed responses, but some CDNs buffer SSE and break delta delivery. **Mitigation**: `X-Accel-Buffering: no` header; non-streaming fallback endpoint.
3. **Seedream consistency.** Style can drift ~10% of the time (photorealistic sneaks in). **Mitigation**: stronger prompt prefixes, consider running a style classifier on outputs pre-upload (v2).
4. **Voice privacy perception.** Even though transcript is on-device, users may worry. **Mitigation**: mic button says "Private - processed on your phone." Don't log the transcript server-side; log only a 64-char hash.
5. **Cold-start latency.** First request/day to a Supabase edge fn cold-starts ~800ms. **Mitigation**: warmer ping from the cron (run a dummy generate-recipe at 06:00 UTC Mon-Fri).
6. **Haiku 4.5 vs 4.6 choice.** Sonnet 4.6 is locked for polish. If Haiku 4.5 drafts too often fail then move to Haiku 4.6 at +20% cost. Track draft-failure rate as KPI.
7. **Cost ceiling.** What is the hard monthly budget? Today we're assuming ~$200/mo cap in TestFlight. If Zach wants <$50/mo, we kill live images entirely for free tier and image only on save.
8. **No Android path yet.** Voice module is iOS-only. Keep interface abstract so swap-in is a module replacement, not a rewrite.

---

*End of `section-ai.md`.*
