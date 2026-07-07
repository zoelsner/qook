# Phase 2 — Backend Live Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the six empty Supabase Edge Function directories into a working live-AI backend so the Qook app generates real recipes, hero images, and Instacart shopping lists instead of running on 24 mock fixtures.

**Architecture:** Deno Edge Functions on Supabase. Pure-TS `_shared/` layer (OpenRouter fetch wrapper, Zod schema, tier rules, prompts, DB persistence, camelCase↔snake_case mappers) is consumed by four functions: `generate-recipe` (SSE stream of 3 recipes), `generate-image` (commit-gated canon-loop watercolor), `shopping-share` (Instacart Create Shopping List), `delete-account`. The React Native client flips `apiMode` from `mock` to `live` and consumes the recipe SSE stream on the loading screen. All AI egress goes through a single OpenRouter key held in Supabase secrets.

**Tech Stack:** Deno / Supabase Edge Functions, `@supabase/supabase-js@2` (npm specifier in Deno), Zod (deno.land/x), OpenRouter chat/completions API, `google/gemini-3.1-flash-image` (images), `anthropic/claude-haiku-4.5` (draft) + `anthropic/claude-sonnet-5` (polish), Instacart IDP `products_link`, Expo 54 / React Native / `react-native-sse` (client), Zustand store, `bun` for client-side assertion scripts.

## Global Constraints

- **Runtime:** Edge Functions are **Deno**, not Node. Imports are URL or `npm:` specifiers only. Secrets come from `Deno.env.get(...)`. No `process.env`, no `require`, no bare npm imports.
- **Pinned import specifiers (use these exact strings everywhere):**
  - Zod: `import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";`
  - Supabase JS: `import { createClient } from "npm:@supabase/supabase-js@2";`
  - HTTP serve: use `Deno.serve(...)` (built-in; do NOT import `std/http/server.ts` — it is deprecated).
- **Text models (spec §4.3):** draft `anthropic/claude-haiku-4.5`; polish fallback `anthropic/claude-sonnet-5`. Image model (spec §3): `google/gemini-3.1-flash-image`. All three are overridable via env (`OR_TEXT_MODEL`, `OR_POLISH_MODEL`, `OR_IMAGE_MODEL`) but these are the defaults.
- **DB column names are authoritative** (from `supabase/migrations/20260421000000_init_schema.sql`). The `recipes` table stores structured columns — `ingredient_groups`, `workflow_sections`, `timeline` (all jsonb arrays), `total_time_min`, `image_storage_path`, `image_status`, `energy_tier`, `signature`, `serves`, `difficulty`, `cuisine`, `title`, `notes`, `source`, `user_id`, `use_count`. **There is no `content` column and no `hero_image_url` column** — section-ai.md is wrong on both; follow section-backend.md §6.4 and the migration.
- **Recipe dedup:** SHA-256 signature. Globally-cached recipes are `user_id IS NULL` with a unique index on `signature` (partial: `where user_id is null and signature is not null`). Persist AI recipes as global cache rows (`user_id: null`) exactly like section-backend.md §6.3; on signature hit, call `increment_use_count` RPC instead of inserting.
- **Rate limits (spec §4.2):** 10 generations/user/day, 30/user/month, enforced **before any AI call**, by counting rows in `generation_sessions` filtered by `user_id` and `created_at` window (mechanism per section-backend.md §8.3). Over limit → HTTP 429 with typed error body.
- **Client Recipe type is camelCase** (`packages/shared/src/types/recipe.ts`): `ingredients`, `steps`, `timeline`, `timeMinutes`, `servings`, `heroImageUrl`, `imageStatus`, `dietaryTags`, etc. The DB is snake_case. Every function that returns recipes to the client must map DB row → client `Recipe`. This mapping lives in one place: `_shared/recipe-map.ts`.
- **Typed errors (spec §6):** every function returns `{ code: string, message: string }` on failure (JSON body, or an SSE `error` event for `generate-recipe`). Never leak raw stack traces to the client.
- **Structured ingredients (audit §4):** every ingredient the model emits carries `parsed { canonical_name, canonical_key, category, amount, unit }`. Categorization happens at generation time; the client-side `categorizeIngredient.ts` regex stays as the runtime safety net (no change to it in this plan).
- **Canon asset (spec §3, decided in this plan):** the hand-picked canon watercolor reference ships as a **committed repo asset** at `supabase/functions/_shared/assets/canon.png`, base64-inlined at deploy via a generated `canon-b64.ts` (Edge Functions cannot read arbitrary bundled binary files reliably; an inlined base64 string is the portable choice). Zach supplies the PNG; until then the plan uses a placeholder-generation step that is explicitly gated on a real asset.
- **Secrets are never printed.** `OPENROUTER_API_KEY` already exists in `.env.local` (do not cat it). Move it to Supabase secrets by referencing `.env.local`, never echoing the value.
- **Test pattern (no framework in repo):** client/shared assertion scripts live under `scripts/` and run with `bun run scripts/<name>.ts` (exit non-zero on failure). Edge Function logic is checked with `deno check` and a `deno test` smoke file colocated under the function or `_shared`. Gates: `bun run typecheck` / `bun run lint` per workspace; `deno check` for Deno files.
- **Cost checkpoints:** any task that fires a real paid OpenRouter call is a **STOP-AND-CONFIRM** checkpoint — do not batch-run past it. Real-call tasks are explicitly labeled `[COST]`.
- **YAGNI:** build only what spec §8 Phase 2 lists. No cohort batch, no pg_cron, no paywall, no realtime image push beyond what `generate-image` needs. `generate-deck-batch` and `warm-start-import` stay empty this phase.

---

### Task 1: `_shared/schema.ts` — Zod Recipe schema with structured ingredients + JSON Schema export

**Files:**
- Create: `supabase/functions/_shared/schema.ts`
- Test: `supabase/functions/_shared/schema.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `export const ParsedIngredient` (Zod), `export const RecipeIngredientItem`, `export const RecipeIngredientGroup`, `export const RecipeWorkflowStep`, `export const RecipeWorkflowSection`, `export const EnergyTier`, `export const Recipe` (Zod object), `export type Recipe = z.infer<typeof Recipe>`.
  - `export const RecipeJsonSchema` — `{ name, strict, schema }` object literal for OpenRouter `response_format.json_schema`, kept in manual sync with the Zod schema.
  - Recipe fields (match client `Recipe` field names where they overlap, minus DB-generated ones): `title`, `cuisine`, `tier`, `tags`, `timeMinutes`, `servings`, `ingredientGroups`, `workflowSections`, optional `nutrition`, optional `notes`.
  - Ingredient item shape: `{ item, quantity?, notes?, parsed: { canonical_name, canonical_key, category, amount, unit } }`.

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/_shared/schema.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Recipe, RecipeJsonSchema } from "./schema.ts";

const VALID = {
  title: "Miso-Butter Salmon with Sesame Rice",
  cuisine: "Japanese",
  tier: "after-work",
  tags: ["fish", "weeknight"],
  timeMinutes: 28,
  servings: 2,
  ingredientGroups: [
    {
      title: "Main",
      role: "main",
      items: [
        {
          item: "salmon fillet",
          quantity: "2 fillets",
          parsed: {
            canonical_name: "salmon",
            canonical_key: "salmon",
            category: "Protein",
            amount: 2,
            unit: "count",
          },
        },
      ],
    },
  ],
  workflowSections: [
    {
      title: "Cook",
      objective: "Sear the salmon",
      steps: [{ instruction: "Sear skin-side down until crisp", durationMin: 6 }],
    },
  ],
};

Deno.test("Recipe parses a valid structured recipe", () => {
  const r = Recipe.parse(VALID);
  assertEquals(r.ingredientGroups[0].items[0].parsed.canonical_key, "salmon");
});

Deno.test("Recipe rejects an ingredient missing parsed", () => {
  const bad = structuredClone(VALID);
  // deno-lint-ignore no-explicit-any
  delete (bad.ingredientGroups[0].items[0] as any).parsed;
  const res = Recipe.safeParse(bad);
  assertEquals(res.success, false);
});

Deno.test("RecipeJsonSchema requires parsed on ingredient items", () => {
  const itemProps =
    RecipeJsonSchema.schema.properties.ingredientGroups.items.properties.items
      .items;
  assertEquals(itemProps.required.includes("parsed"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supabase/functions/_shared && deno test schema.test.ts`
Expected: FAIL — `Module not found "./schema.ts"`.

- [ ] **Step 3: Write the schema implementation**

```ts
// supabase/functions/_shared/schema.ts
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// Grocery categories — must stay identical to the DB `grocery_category` enum
// and the client GroceryCategory union.
export const GroceryCategory = z.enum([
  "Produce",
  "Dairy",
  "Pantry",
  "Protein",
  "Frozen",
  "Bakery",
  "Other",
]);

export const ParsedIngredient = z.object({
  canonical_name: z.string().min(1),
  canonical_key: z.string().regex(/^[a-z0-9_]+$/),
  category: GroceryCategory,
  amount: z.number().nullable(),
  unit: z
    .enum(["g", "kg", "oz", "lb", "tsp", "tbsp", "cup", "count", "ml", "l"])
    .nullable(),
});

export const RecipeIngredientItem = z.object({
  item: z.string().min(1),
  quantity: z.string().optional(),
  notes: z.string().optional(),
  parsed: ParsedIngredient,
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
  nutrition: z
    .object({
      calories: z.number().int().optional(),
      proteinG: z.number().int().optional(),
      carbG: z.number().int().optional(),
      fatG: z.number().int().optional(),
    })
    .optional(),
  notes: z.string().max(300).optional(),
});

export type Recipe = z.infer<typeof Recipe>;

// JSON Schema for OpenRouter `response_format`. Kept in manual sync with the
// Zod schema above (small surface; simpler than a converter).
export const RecipeJsonSchema = {
  name: "Recipe",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "cuisine",
      "tier",
      "tags",
      "timeMinutes",
      "servings",
      "ingredientGroups",
      "workflowSections",
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
                required: ["item", "parsed"],
                properties: {
                  item: { type: "string" },
                  quantity: { type: "string" },
                  notes: { type: "string" },
                  parsed: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "canonical_name",
                      "canonical_key",
                      "category",
                      "amount",
                      "unit",
                    ],
                    properties: {
                      canonical_name: { type: "string" },
                      canonical_key: { type: "string" },
                      category: {
                        type: "string",
                        enum: [
                          "Produce",
                          "Dairy",
                          "Pantry",
                          "Protein",
                          "Frozen",
                          "Bakery",
                          "Other",
                        ],
                      },
                      amount: { type: ["number", "null"] },
                      unit: {
                        type: ["string", "null"],
                        enum: [
                          "g",
                          "kg",
                          "oz",
                          "lb",
                          "tsp",
                          "tbsp",
                          "cup",
                          "count",
                          "ml",
                          "l",
                          null,
                        ],
                      },
                    },
                  },
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd supabase/functions/_shared && deno test schema.test.ts`
Expected: PASS — `ok | 3 passed | 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/schema.ts supabase/functions/_shared/schema.test.ts
git commit -m "feat(edge): structured Recipe Zod schema + JSON Schema export

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `_shared/tiers.ts` — TIER_RULES

**Files:**
- Create: `supabase/functions/_shared/tiers.ts`
- Test: `supabase/functions/_shared/tiers.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export const TIER_RULES` (record keyed by the four energy tiers, each `{ label, maxMinutes, sectionsMax, stepsPerSectionMax, directive }`); `export type TierKey = keyof typeof TIER_RULES`; `export function tierFromActiveMinutes(m: number): TierKey`.

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/_shared/tiers.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { TIER_RULES, tierFromActiveMinutes } from "./tiers.ts";

Deno.test("tier ceilings", () => {
  assertEquals(TIER_RULES["brain-is-fried"].maxMinutes, 15);
  assertEquals(TIER_RULES["weekend-project"].maxMinutes, 180);
});

Deno.test("tierFromActiveMinutes boundaries", () => {
  assertEquals(tierFromActiveMinutes(15), "brain-is-fried");
  assertEquals(tierFromActiveMinutes(16), "after-work");
  assertEquals(tierFromActiveMinutes(45), "got-energy");
  assertEquals(tierFromActiveMinutes(46), "weekend-project");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supabase/functions/_shared && deno test tiers.test.ts`
Expected: FAIL — `Module not found "./tiers.ts"`.

- [ ] **Step 3: Write the implementation**

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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd supabase/functions/_shared && deno test tiers.test.ts`
Expected: PASS — `ok | 2 passed | 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/tiers.ts supabase/functions/_shared/tiers.test.ts
git commit -m "feat(edge): TIER_RULES constant

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `_shared/openrouter.ts` — fetch wrapper (retries, timeout, response_format, cost logging)

**Files:**
- Create: `supabase/functions/_shared/openrouter.ts`
- Test: `supabase/functions/_shared/openrouter.test.ts`

**Interfaces:**
- Consumes: `RecipeJsonSchema` from `./schema.ts`.
- Produces:
  - `export const MODELS` — `{ textDraft(): string, textPolish(): string, image(): string }` reading env with the Global-Constraints defaults.
  - `export function orHeaders(): Record<string,string>`.
  - `export type ChatMsg = { role: "system"|"user"|"assistant"; content: string }`.
  - `export type ChatOpts` and `export async function chat(opts: ChatOpts): Promise<string>` — non-streaming, retries, timeout, optional `response_format`, cost logging via `logCost`.
  - `export function logCost(model: string, usage: { prompt_tokens?: number; completion_tokens?: number } | undefined, label: string): void` — `console.log` a single structured line; the runtime captures it in function logs.
  - `export const OR_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"`.

- [ ] **Step 1: Write the failing test**

`chat()` needs the network, so the test stubs `globalThis.fetch` and asserts on retry + parse behavior. Cost logging is asserted by capturing `console.log`.

```ts
// supabase/functions/_shared/openrouter.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supabase/functions/_shared && deno test --allow-env --allow-net openrouter.test.ts`
Expected: FAIL — `Module not found "./openrouter.ts"`.

- [ ] **Step 3: Write the implementation**

```ts
// supabase/functions/_shared/openrouter.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd supabase/functions/_shared && deno test --allow-env --allow-net openrouter.test.ts`
Expected: PASS — `ok | 3 passed | 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/openrouter.ts supabase/functions/_shared/openrouter.test.ts
git commit -m "feat(edge): OpenRouter fetch wrapper with retries + cost logging

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `_shared/openrouter-stream.ts` — SSE streaming variant

**Files:**
- Create: `supabase/functions/_shared/openrouter-stream.ts`
- Test: `supabase/functions/_shared/openrouter-stream.test.ts`

**Interfaces:**
- Consumes: `orHeaders`, `MODELS`, `OR_ENDPOINT` from `./openrouter.ts`.
- Produces:
  - `export type StreamHandlers = { onDelta?, onPartial?, onDone?, onError? }`.
  - `export async function chatStream(messages, handlers, opts): Promise<string>` — POSTs with `stream:true`, parses SSE `data:` lines, accumulates full text, invokes handlers.

- [ ] **Step 1: Write the failing test**

Stub `fetch` to return a `ReadableStream` of SSE chunks; assert deltas accumulate and `onDone` fires with the full text.

```ts
// supabase/functions/_shared/openrouter-stream.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supabase/functions/_shared && deno test --allow-env --allow-net openrouter-stream.test.ts`
Expected: FAIL — `Module not found "./openrouter-stream.ts"`.

- [ ] **Step 3: Write the implementation**

```ts
// supabase/functions/_shared/openrouter-stream.ts
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
    clearTimeout(timeout);
    throw new Error(
      `Stream open failed: ${resp.status} ${
        await resp.text().catch(() => "")
      }`,
    );
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
      reader.releaseLock();
    } catch {
      /* no-op */
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd supabase/functions/_shared && deno test --allow-env --allow-net openrouter-stream.test.ts`
Expected: PASS — `ok | 1 passed | 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/openrouter-stream.ts supabase/functions/_shared/openrouter-stream.test.ts
git commit -m "feat(edge): OpenRouter SSE streaming wrapper

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `_shared/prompts/live.ts` — live 3-recipe prompt with structured-ingredient directive

**Files:**
- Create: `supabase/functions/_shared/prompts/live.ts`
- Test: `supabase/functions/_shared/prompts/live.test.ts`

**Interfaces:**
- Consumes: `TIER_RULES`, `TierKey` from `../tiers.ts`.
- Produces:
  - `export type LiveContext = { tier: TierKey; householdSize: number; avoidIngredients: string[]; lovedCuisines: string[]; recentLikedTitles: string[]; voiceContext?: string; kitchenTools: string[] }`.
  - `export function buildLiveSystemPrompt(): string`.
  - `export function buildLiveUserPrompt(ctx: LiveContext): string`.
  - The user prompt MUST embed the structured-ingredient directive (audit §4) and ask for `{ "recipes": Recipe[] }` of length 3.

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/_shared/prompts/live.test.ts
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildLiveSystemPrompt, buildLiveUserPrompt } from "./live.ts";

Deno.test("system prompt has safety refusal clause", () => {
  const s = buildLiveSystemPrompt();
  assert(s.includes("refusal"));
});

Deno.test("user prompt carries tier ceiling and structured-ingredient directive", () => {
  const p = buildLiveUserPrompt({
    tier: "after-work",
    householdSize: 2,
    avoidIngredients: ["cilantro"],
    lovedCuisines: ["Thai", "Italian"],
    recentLikedTitles: ["Miso Salmon"],
    kitchenTools: ["skillet", "pot"],
  });
  assert(p.includes("30")); // after-work ceiling
  assert(p.includes("parsed.category"));
  assert(p.includes("canonical_key"));
  assert(p.includes("cilantro"));
  assert(p.includes('"recipes"'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supabase/functions/_shared && deno test prompts/live.test.ts`
Expected: FAIL — `Module not found "./live.ts"`.

- [ ] **Step 3: Write the implementation**

```ts
// supabase/functions/_shared/prompts/live.ts
import { TIER_RULES, type TierKey } from "../tiers.ts";

export type LiveContext = {
  tier: TierKey;
  householdSize: number;
  avoidIngredients: string[];
  lovedCuisines: string[]; // top by pref score
  recentLikedTitles: string[]; // last 5 swipe-liked
  voiceContext?: string; // iOS transcript, 10s max
  kitchenTools: string[]; // intersection of user tools + whitelist
};

export function buildLiveSystemPrompt(): string {
  return [
    "You are Qook's live recipe concierge.",
    "A real person opened the app right now and wants 3 dinner ideas for tonight.",
    "Output STRICT JSON, no prose, no markdown.",
    "Treat voice context as the most important signal — it's what the user just said out loud about their evening.",
    "Draw inspiration from their loved cuisines and recent likes, but don't repeat them verbatim.",
    'Safety: if voice context mentions self-harm, unsafe food practices, or requests dangerous behavior, return exactly: { "refusal": "Let\'s plan something nourishing instead. Can you tell me what you have in the fridge?" } and nothing else.',
  ].join(" ");
}

const STRUCTURED_INGREDIENT_DIRECTIVE = [
  "For EVERY ingredient, populate `parsed` with:",
  "- `parsed.category` using EXACTLY this grammar:",
  "  Produce: fresh vegetables, fruits, fresh herbs.",
  "  Protein: meat, poultry, fish, eggs, tofu, tempeh, dry legumes.",
  "  Dairy: milk, butter, cheese, yogurt, cream, mayo.",
  "  Pantry: oils, vinegars, dry goods, canned goods, spices, sauces, dry herbs.",
  "  Frozen: anything labeled frozen, frozen vegetables.",
  "  Bakery: breads, tortillas, pita.",
  "  Other: use sparingly, only if none of the above fit.",
  "- `parsed.canonical_name`: the shortest unambiguous grocery-store name. \"extra-virgin olive oil\" → \"olive oil\"; \"english cucumber\" → \"cucumber\"; \"red bell pepper\" → \"bell pepper\". Drop intensifiers, sizes, and ripeness qualifiers unless load-bearing (\"baby potatoes\" stays \"baby potatoes\").",
  "- `parsed.canonical_key`: `canonical_name` lowercased with spaces replaced by underscores; only [a-z0-9_].",
  "- `parsed.amount`: numeric quantity or null if not measurable.",
  "- `parsed.unit`: one of g, kg, oz, lb, tsp, tbsp, cup, count, ml, l, or null. Use \"count\" for whole countable items.",
].join("\n");

export function buildLiveUserPrompt(ctx: LiveContext): string {
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
    `Loved cuisines (priority order): ${
      ctx.lovedCuisines.join(", ") || "open"
    }.`,
    ctx.recentLikedTitles.length
      ? `Recently liked (match the energy, don't duplicate):\n${
        ctx.recentLikedTitles.map((t, i) => `  ${i + 1}. ${t}`).join("\n")
      }`
      : "No recent swipe data — give a confident mix.",
    ``,
    ctx.voiceContext
      ? `USER JUST SAID (voice context, weight heavily): "${ctx.voiceContext}"`
      : `No voice context — pick confidently based on the above.`,
    ``,
    `Spread the 3 across different cuisines unless voice context pins one.`,
    `One of the 3 should be the "safe" play (most aligned with recent likes).`,
    `One should be a gentle stretch — a cuisine or technique they haven't had in the last 5.`,
    `One should feel like today's mood (match voice tone if given).`,
    ``,
    STRUCTURED_INGREDIENT_DIRECTIVE,
    ``,
    `Every step needs a concrete durationMin > 0 and specific doneness cues ("until edges curl", NOT "until done").`,
    `Return JSON shape: { "recipes": Recipe[] } with exactly 3 recipes.`,
  ].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd supabase/functions/_shared && deno test prompts/live.test.ts`
Expected: PASS — `ok | 2 passed | 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/prompts/live.ts supabase/functions/_shared/prompts/live.test.ts
git commit -m "feat(edge): live 3-recipe prompt with structured-ingredient directive

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `_shared/partial-parser.ts` — stream partial-recipe extractor

**Files:**
- Create: `supabase/functions/_shared/partial-parser.ts`
- Test: `supabase/functions/_shared/partial-parser.test.ts`

**Interfaces:**
- Consumes: `Recipe` from `./schema.ts`.
- Produces: `export function extractPartialRecipes(buf: string): unknown[]` — peels whole `{...}` objects from the streaming `{"recipes":[ ...` buffer; returns objects that pass `Recipe.partial()`. `export function stripCodeFences(s: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/_shared/partial-parser.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractPartialRecipes, stripCodeFences } from "./partial-parser.ts";

Deno.test("extracts one complete recipe object mid-stream", () => {
  const buf =
    '{"recipes":[{"title":"Pan Noodles","cuisine":"Thai"}, {"title":"Half';
  const out = extractPartialRecipes(buf);
  assertEquals(out.length, 1);
  assertEquals((out[0] as { title: string }).title, "Pan Noodles");
});

Deno.test("stripCodeFences removes markdown fence", () => {
  assertEquals(stripCodeFences('```json\n{"a":1}\n```'), '{"a":1}');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supabase/functions/_shared && deno test partial-parser.test.ts`
Expected: FAIL — `Module not found "./partial-parser.ts"`.

- [ ] **Step 3: Write the implementation**

```ts
// supabase/functions/_shared/partial-parser.ts
import { Recipe } from "./schema.ts";

export function stripCodeFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function extractPartialRecipes(buf: string): unknown[] {
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
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0 && objStart >= 0) {
        const slice = buf.slice(objStart, i + 1);
        try {
          const obj = JSON.parse(slice);
          const preview = Recipe.partial().safeParse(obj);
          if (preview.success) out.push(preview.data);
        } catch {
          /* incomplete — skip */
        }
        objStart = -1;
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd supabase/functions/_shared && deno test partial-parser.test.ts`
Expected: PASS — `ok | 2 passed | 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/partial-parser.ts supabase/functions/_shared/partial-parser.test.ts
git commit -m "feat(edge): streaming partial-recipe extractor

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: `_shared/recipe-map.ts` — DB row ⇄ client Recipe + persist + signature

**Files:**
- Create: `supabase/functions/_shared/recipe-map.ts`
- Test: `supabase/functions/_shared/recipe-map.test.ts`

**Interfaces:**
- Consumes: `Recipe` (Zod) from `./schema.ts`.
- Produces:
  - `export type ClientRecipe` — the subset of the client `Recipe` type this backend returns: `{ id, title, cuisine, tier, tags, timeMinutes, servings, difficulty, ingredients, steps, timeline, notes?, heroImageUrl?, imageStatus, source, createdAt, updatedAt }`. (Client `slug`, `signature`, `dietaryTags` etc. are tolerated-optional; the client maps defensively.)
  - `export function computeSignature(r: Recipe): Promise<string>` — canonical string then SHA-256 hex via Web Crypto. Canonical form MUST match the client's `canonicalizeRecipeForSignature` (title/cuisine lowercased+trimmed, tier, sorted lowercased ingredient item names).
  - `export function toRecipeInsert(r: Recipe, signature: string)` — object with **DB snake_case columns**: `{ user_id: null, signature, title, cuisine, serves, total_time_min, difficulty, energy_tier, ingredient_groups, workflow_sections, timeline: [], notes, source: 'ai', image_status: 'pending' }`.
  - `export function dbRowToClientRecipe(row: Record<string, unknown>): ClientRecipe` — maps DB row → camelCase client shape, builds `heroImageUrl` from `image_storage_path` + the public bucket URL base (env `SUPABASE_MEAL_IMAGES_BASE` or derive from `SUPABASE_URL`).

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/_shared/recipe-map.test.ts
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeSignature,
  dbRowToClientRecipe,
  toRecipeInsert,
} from "./recipe-map.ts";

const R = {
  title: "Pan-Fried Gnocchi",
  cuisine: "Italian",
  tier: "after-work" as const,
  tags: [],
  timeMinutes: 25,
  servings: 2,
  ingredientGroups: [
    {
      title: "Main",
      role: "main" as const,
      items: [
        {
          item: "gnocchi",
          parsed: {
            canonical_name: "gnocchi",
            canonical_key: "gnocchi",
            category: "Pantry" as const,
            amount: 1,
            unit: "lb" as const,
          },
        },
      ],
    },
  ],
  workflowSections: [
    {
      title: "Crisp",
      objective: "Brown the gnocchi",
      steps: [{ instruction: "Fry until golden", durationMin: 8 }],
    },
  ],
};

Deno.test("computeSignature is deterministic hex", async () => {
  const a = await computeSignature(R);
  const b = await computeSignature(R);
  assertEquals(a, b);
  assert(/^[0-9a-f]{64}$/.test(a));
});

Deno.test("toRecipeInsert uses snake_case DB columns", () => {
  const ins = toRecipeInsert(R, "sig123");
  assertEquals(ins.energy_tier, "after-work");
  assertEquals(ins.total_time_min, 25);
  assertEquals(ins.serves, 2);
  assert(Array.isArray(ins.ingredient_groups));
  assertEquals(ins.user_id, null);
  assertEquals(ins.image_status, "pending");
});

Deno.test("dbRowToClientRecipe maps to camelCase and builds heroImageUrl", () => {
  Deno.env.set("SUPABASE_MEAL_IMAGES_BASE", "https://cdn.test/meal-images");
  const client = dbRowToClientRecipe({
    id: "abc",
    title: "Pan-Fried Gnocchi",
    cuisine: "Italian",
    energy_tier: "after-work",
    serves: 2,
    total_time_min: 25,
    difficulty: "Medium",
    ingredient_groups: R.ingredientGroups,
    workflow_sections: R.workflowSections,
    timeline: [],
    image_status: "ready",
    image_storage_path: "abc.png",
    source: "ai",
    created_at: "2026-07-06T00:00:00Z",
    updated_at: "2026-07-06T00:00:00Z",
  });
  assertEquals(client.timeMinutes, 25);
  assertEquals(client.servings, 2);
  assertEquals(client.tier, "after-work");
  assertEquals(client.heroImageUrl, "https://cdn.test/meal-images/abc.png");
  assertEquals(client.ingredients[0].items[0].item, "gnocchi");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supabase/functions/_shared && deno test --allow-env recipe-map.test.ts`
Expected: FAIL — `Module not found "./recipe-map.ts"`.

- [ ] **Step 3: Write the implementation**

```ts
// supabase/functions/_shared/recipe-map.ts
import type { Recipe } from "./schema.ts";

export type ClientRecipe = {
  id: string;
  title: string;
  cuisine: string;
  tier: string;
  tags: string[];
  timeMinutes: number;
  servings: number;
  difficulty: string;
  ingredients: unknown[]; // ingredientGroups shape (client calls it `ingredients`)
  steps: unknown[]; // workflowSections shape (client calls it `steps`)
  timeline: unknown[];
  notes?: string;
  heroImageUrl?: string;
  imageStatus: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

// Canonical string for SHA-256 dedup. MUST match the client's
// canonicalizeRecipeForSignature (packages/shared/src/domain/signature.ts):
// title/cuisine lowercased+trimmed, tier, sorted lowercased ingredient names.
function canonicalize(r: Recipe): string {
  const ingredientKeys = r.ingredientGroups
    .flatMap((g) => g.items.map((it) => it.item.toLowerCase().trim()))
    .filter(Boolean)
    .sort();
  return JSON.stringify({
    title: r.title.toLowerCase().trim(),
    cuisine: r.cuisine.toLowerCase().trim(),
    tier: r.tier,
    ingredients: ingredientKeys,
  });
}

export async function computeSignature(r: Recipe): Promise<string> {
  const data = new TextEncoder().encode(canonicalize(r));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Maps model output → snake_case columns for `public.recipes` insert.
// Difficulty is derived from tier if the model didn't emit one.
function difficultyForTier(tier: string): string {
  if (tier === "brain-is-fried" || tier === "after-work") return "Easy";
  if (tier === "got-energy") return "Medium";
  return "Advanced";
}

export function toRecipeInsert(r: Recipe, signature: string) {
  return {
    user_id: null as string | null,
    signature,
    title: r.title,
    cuisine: r.cuisine,
    serves: r.servings,
    total_time_min: r.timeMinutes,
    difficulty: difficultyForTier(r.tier),
    energy_tier: r.tier,
    ingredient_groups: r.ingredientGroups,
    workflow_sections: r.workflowSections,
    timeline: [] as unknown[],
    notes: r.notes ?? null,
    source: "ai" as const,
    image_status: "pending" as const,
  };
}

function mealImagesBase(): string {
  const explicit = Deno.env.get("SUPABASE_MEAL_IMAGES_BASE");
  if (explicit) return explicit.replace(/\/$/, "");
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/meal-images`;
}

export function dbRowToClientRecipe(
  row: Record<string, unknown>,
): ClientRecipe {
  const path = row.image_storage_path as string | null | undefined;
  return {
    id: String(row.id),
    title: String(row.title),
    cuisine: String(row.cuisine),
    tier: String(row.energy_tier),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    timeMinutes: Number(row.total_time_min ?? 0),
    servings: Number(row.serves ?? 0),
    difficulty: String(row.difficulty ?? "Medium"),
    ingredients: (row.ingredient_groups as unknown[]) ?? [],
    steps: (row.workflow_sections as unknown[]) ?? [],
    timeline: (row.timeline as unknown[]) ?? [],
    notes: (row.notes as string | undefined) ?? undefined,
    heroImageUrl: path ? `${mealImagesBase()}/${path}` : undefined,
    imageStatus: String(row.image_status ?? "pending"),
    source: String(row.source ?? "ai"),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd supabase/functions/_shared && deno test --allow-env recipe-map.test.ts`
Expected: PASS — `ok | 3 passed | 0 failed`.

- [ ] **Step 5: Verify the signature contract against the client**

Confirm the canonical form still matches the client. Read `packages/shared/src/domain/signature.ts` and check the JSON object keys/order (`title`, `cuisine`, `tier`, `ingredients`) and the lowercase+trim+sort behavior line up with `canonicalize` above.
Expected: identical field order and normalization. If the client differs, update `canonicalize` to match the client (client is source of truth for dedup).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/recipe-map.ts supabase/functions/_shared/recipe-map.test.ts
git commit -m "feat(edge): recipe DB<->client mapper, signature, insert builder

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: `_shared/errors.ts` + `_shared/rate-limit.ts` — typed errors + quota

**Files:**
- Create: `supabase/functions/_shared/errors.ts`
- Create: `supabase/functions/_shared/rate-limit.ts`
- Test: `supabase/functions/_shared/rate-limit.test.ts`

**Interfaces:**
- `errors.ts` produces: `export type ApiError = { code: string; message: string }`; `export function errorResponse(code: string, message: string, status: number): Response` (JSON body `{ code, message }`); `export const ERRORS` map of the standard codes used across functions: `RATE_LIMITED`, `UNAUTHORIZED`, `VALIDATION`, `GENERATION_FAILED`, `EMPTY_LIST`, `INSTACART_DOWN`, `IMAGE_FAILED`, `NOT_FOUND`, `BAD_REQUEST`.
- `rate-limit.ts` produces: `export async function checkQuota(admin, userId): Promise<{ ok: true } | { ok: false; scope: "day" | "month" }>` — counts `generation_sessions` rows for `userId` in the last 24h and last 30 days; over 10/day or 30/month → `{ ok: false, scope }`. `admin` is a `SupabaseClient`.

- [ ] **Step 1: Write the failing test**

The count query is stubbed via a minimal fake client so the test needs no DB.

```ts
// supabase/functions/_shared/rate-limit.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkQuota } from "./rate-limit.ts";

// Fake supabase client: returns a canned count per call, in order.
function fakeClient(counts: number[]) {
  let i = 0;
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                gte: () =>
                  Promise.resolve({ count: counts[i++], error: null }),
              };
            },
          };
        },
      };
    },
    // deno-lint-ignore no-explicit-any
  } as any;
}

Deno.test("under both limits → ok", async () => {
  // first call = daily count, second = monthly count
  const res = await checkQuota(fakeClient([3, 12]), "u1");
  assertEquals(res, { ok: true });
});

Deno.test("over daily limit → day scope", async () => {
  const res = await checkQuota(fakeClient([10, 12]), "u1");
  assertEquals(res, { ok: false, scope: "day" });
});

Deno.test("over monthly limit → month scope", async () => {
  const res = await checkQuota(fakeClient([2, 30]), "u1");
  assertEquals(res, { ok: false, scope: "month" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supabase/functions/_shared && deno test rate-limit.test.ts`
Expected: FAIL — `Module not found "./rate-limit.ts"`.

- [ ] **Step 3: Write both implementations**

```ts
// supabase/functions/_shared/errors.ts
export type ApiError = { code: string; message: string };

export const ERRORS = {
  RATE_LIMITED: "rate_limited",
  UNAUTHORIZED: "unauthorized",
  VALIDATION: "validation",
  GENERATION_FAILED: "generation_failed",
  EMPTY_LIST: "empty_list",
  INSTACART_DOWN: "instacart_down",
  IMAGE_FAILED: "image_failed",
  NOT_FOUND: "not_found",
  BAD_REQUEST: "bad_request",
} as const;

export function errorResponse(
  code: string,
  message: string,
  status: number,
): Response {
  return new Response(JSON.stringify({ code, message } satisfies ApiError), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
```

```ts
// supabase/functions/_shared/rate-limit.ts
// deno-lint-ignore no-explicit-any
type Admin = any;

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;
const DAILY_MAX = 10;
const MONTHLY_MAX = 30;

async function countSince(admin: Admin, userId: string, sinceMs: number) {
  const since = new Date(Date.now() - sinceMs).toISOString();
  const { count, error } = await admin
    .from("generation_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

export async function checkQuota(
  admin: Admin,
  userId: string,
): Promise<{ ok: true } | { ok: false; scope: "day" | "month" }> {
  const daily = await countSince(admin, userId, DAY_MS);
  if (daily >= DAILY_MAX) return { ok: false, scope: "day" };
  const monthly = await countSince(admin, userId, MONTH_MS);
  if (monthly >= MONTHLY_MAX) return { ok: false, scope: "month" };
  return { ok: true };
}
```

Note: the fake client in the test collapses `.select().eq().gte()` — the real `select` with `{ count, head }` options resolves the same shape. Both count calls hit the same chain; the fake returns the array values in order.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd supabase/functions/_shared && deno test rate-limit.test.ts`
Expected: PASS — `ok | 3 passed | 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/errors.ts supabase/functions/_shared/rate-limit.ts supabase/functions/_shared/rate-limit.test.ts
git commit -m "feat(edge): typed errors + per-user generation quota

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: `_shared/supabase.ts` + `_shared/context.ts` — clients + LiveContext builder

**Files:**
- Create: `supabase/functions/_shared/supabase.ts`
- Create: `supabase/functions/_shared/context.ts`
- Test: `supabase/functions/_shared/context.test.ts`

**Interfaces:**
- `supabase.ts` produces: `export function serviceClient()` (service-role, no session persist); `export function userClient(authHeader: string)` (anon key + forwarded auth header); `export async function requireUser(req: Request): Promise<{ user, client }>` — throws a `Response(401)` when no valid user.
- `context.ts` produces: `export function buildLiveContext(tier: TierKey, prefs: Record<string, unknown> | null, voiceContext: string | undefined): LiveContext` — maps a `user_preferences` row (+ tier + trimmed voice context) into the `LiveContext` the live prompt needs. `kitchenTools` = intersection of `prefs.cooking_tools` with the tool whitelist; `lovedCuisines` = first 3 of `prefs.cuisine_preferences`; `avoidIngredients` = `prefs.avoid_ingredients`; `householdSize` = `prefs.household_size ?? 2`. `recentLikedTitles` = `[]` for v1 (no swipe history wired this phase).

- [ ] **Step 1: Write the failing test** (pure `buildLiveContext`, no network)

```ts
// supabase/functions/_shared/context.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildLiveContext } from "./context.ts";

Deno.test("buildLiveContext maps a prefs row", () => {
  const ctx = buildLiveContext(
    "after-work",
    {
      household_size: 3,
      cuisine_preferences: ["Thai", "Italian", "Mexican", "Greek"],
      avoid_ingredients: ["cilantro"],
      cooking_tools: ["skillet", "wok", "blowtorch"],
    },
    "  something warm  ",
  );
  assertEquals(ctx.householdSize, 3);
  assertEquals(ctx.lovedCuisines, ["Thai", "Italian", "Mexican"]);
  assertEquals(ctx.avoidIngredients, ["cilantro"]);
  assertEquals(ctx.voiceContext, "something warm");
  // blowtorch is not on the whitelist → dropped
  assertEquals(ctx.kitchenTools.includes("blowtorch"), false);
  assertEquals(ctx.kitchenTools.includes("skillet"), true);
});

Deno.test("buildLiveContext tolerates null prefs", () => {
  const ctx = buildLiveContext("brain-is-fried", null, undefined);
  assertEquals(ctx.householdSize, 2);
  assertEquals(ctx.lovedCuisines, []);
  assertEquals(ctx.voiceContext, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supabase/functions/_shared && deno test context.test.ts`
Expected: FAIL — `Module not found "./context.ts"`.

- [ ] **Step 3: Write both implementations**

```ts
// supabase/functions/_shared/supabase.ts
import { createClient } from "npm:@supabase/supabase-js@2";

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export function userClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    },
  );
}

export async function requireUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) throw new Response("Unauthorized", { status: 401 });
  const client = userClient(auth);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Response("Unauthorized", { status: 401 });
  return { user: data.user, client };
}
```

```ts
// supabase/functions/_shared/context.ts
import type { TierKey } from "./tiers.ts";
import type { LiveContext } from "./prompts/live.ts";

// Tools the recipes may assume. Matches the whitelist in section-ai.md §2.3.
const TOOL_WHITELIST = [
  "stovetop",
  "oven",
  "knife",
  "cutting board",
  "sheet pan",
  "skillet",
  "pot",
  "wok",
  "blender",
  "food processor",
];

export function buildLiveContext(
  tier: TierKey,
  prefs: Record<string, unknown> | null,
  voiceContext: string | undefined,
): LiveContext {
  const cuisines = Array.isArray(prefs?.cuisine_preferences)
    ? (prefs!.cuisine_preferences as unknown[]).map(String)
    : [];
  const avoid = Array.isArray(prefs?.avoid_ingredients)
    ? (prefs!.avoid_ingredients as unknown[]).map(String)
    : [];
  const tools = Array.isArray(prefs?.cooking_tools)
    ? (prefs!.cooking_tools as unknown[])
      .map(String)
      .filter((t) => TOOL_WHITELIST.includes(t))
    : [];
  const trimmedVoice = voiceContext?.trim();

  return {
    tier,
    householdSize: typeof prefs?.household_size === "number"
      ? (prefs!.household_size as number)
      : 2,
    avoidIngredients: avoid,
    lovedCuisines: cuisines.slice(0, 3),
    recentLikedTitles: [], // swipe history not wired this phase
    voiceContext: trimmedVoice && trimmedVoice.length ? trimmedVoice : undefined,
    kitchenTools: tools,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd supabase/functions/_shared && deno test context.test.ts`
Expected: PASS — `ok | 2 passed | 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/supabase.ts supabase/functions/_shared/context.ts supabase/functions/_shared/context.test.ts
git commit -m "feat(edge): supabase clients + LiveContext builder

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: `generate-recipe/index.ts` — SSE stream of 3 recipes, validate, persist, rate-limit

**Files:**
- Create: `supabase/functions/generate-recipe/index.ts`
- Create: `supabase/functions/generate-recipe/deno.json` (optional import map; see step)
- Test: `supabase/functions/generate-recipe/persist.test.ts` (tests the persist helper in isolation)

**Interfaces:**
- Consumes: everything from `_shared/*` built above.
- Produces: an HTTP handler. **Request body:** `{ tier: EnergyTier, context?: string }` (exactly what the client's `generateRecipesForEnergy` sends — see `apps/native/src/services/api.ts:148`). **Response:** `text/event-stream` with events:
  - `event: ready` — `{ status: "generating" }`
  - `event: title` — `{ index, title }` (one per recipe title as it completes streaming — powers the loading screen, spec §4.4)
  - `event: partial` — `{ recipes: <partial recipe objects> }`
  - `event: final` — `{ recipes: ClientRecipe[] }` (the mapped, persisted recipes with real ids)
  - `event: error` — `{ code, message }`
  - `event: done` — `{}`
- Also produces `export async function persistRecipes(admin, recipes: Recipe[]): Promise<string[]>` (exported for the test) — signature dedup: on hit call `increment_use_count` RPC + reuse id; else insert via `toRecipeInsert` and collect new id.

- [ ] **Step 1: Write the failing test for `persistRecipes`**

```ts
// supabase/functions/generate-recipe/persist.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { persistRecipes } from "./index.ts";

const R = {
  title: "Sesame Soba",
  cuisine: "Japanese",
  tier: "after-work" as const,
  tags: [],
  timeMinutes: 20,
  servings: 2,
  ingredientGroups: [
    {
      title: "Main",
      role: "main" as const,
      items: [
        {
          item: "soba noodles",
          parsed: {
            canonical_name: "soba noodles",
            canonical_key: "soba_noodles",
            category: "Pantry" as const,
            amount: 8,
            unit: "oz" as const,
          },
        },
      ],
    },
  ],
  workflowSections: [
    {
      title: "Cook",
      objective: "Boil noodles",
      steps: [{ instruction: "Boil until tender", durationMin: 6 }],
    },
  ],
};

// Fake admin: no existing signature → insert returns a new id.
function fakeAdmin() {
  return {
    from(_t: string) {
      return {
        select() {
          return {
            eq() {
              return {
                is() {
                  return {
                    maybeSingle: () =>
                      Promise.resolve({ data: null, error: null }),
                  };
                },
              };
            },
          };
        },
        insert(_row: unknown) {
          return {
            select() {
              return {
                single: () =>
                  Promise.resolve({ data: { id: "new-id" }, error: null }),
              };
            },
          };
        },
      };
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
    // deno-lint-ignore no-explicit-any
  } as any;
}

Deno.test("persistRecipes inserts new recipe and returns id", async () => {
  const ids = await persistRecipes(fakeAdmin(), [R]);
  assertEquals(ids, ["new-id"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supabase/functions/generate-recipe && deno test --allow-env persist.test.ts`
Expected: FAIL — `Module not found "./index.ts"`.

- [ ] **Step 3: Write the function**

```ts
// supabase/functions/generate-recipe/index.ts
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { chatStream } from "../_shared/openrouter-stream.ts";
import {
  buildLiveSystemPrompt,
  buildLiveUserPrompt,
} from "../_shared/prompts/live.ts";
import { Recipe } from "../_shared/schema.ts";
import { serviceClient, userClient } from "../_shared/supabase.ts";
import { buildLiveContext } from "../_shared/context.ts";
import { checkQuota } from "../_shared/rate-limit.ts";
import { extractPartialRecipes, stripCodeFences } from "../_shared/partial-parser.ts";
import {
  computeSignature,
  dbRowToClientRecipe,
  toRecipeInsert,
} from "../_shared/recipe-map.ts";
import { ERRORS } from "../_shared/errors.ts";

const RequestBody = z.object({
  tier: z.enum([
    "brain-is-fried",
    "after-work",
    "got-energy",
    "weekend-project",
  ]),
  context: z.string().optional(),
});

const ResponseEnvelope = z.object({ recipes: z.array(Recipe).length(3) });

// deno-lint-ignore no-explicit-any
type Admin = any;

export async function persistRecipes(
  admin: Admin,
  recipes: Recipe[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const r of recipes) {
    const signature = await computeSignature(r);
    const { data: existing } = await admin
      .from("recipes")
      .select("id")
      .eq("signature", signature)
      .is("user_id", null)
      .maybeSingle();
    if (existing) {
      ids.push(existing.id);
      await admin.rpc("increment_use_count", { recipe_id: existing.id });
    } else {
      const { data: inserted, error } = await admin
        .from("recipes")
        .insert(toRecipeInsert(r, signature))
        .select("id")
        .single();
      if (error) throw error;
      ids.push(inserted.id);
    }
  }
  return ids;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const uc = userClient(authHeader);
  const { data: { user } } = await uc.auth.getUser();
  if (!user) {
    return new Response(
      JSON.stringify({ code: ERRORS.UNAUTHORIZED, message: "Sign in required." }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const admin = serviceClient();

  // Rate limit BEFORE any AI call.
  const quota = await checkQuota(admin, user.id);
  if (!quota.ok) {
    return new Response(
      JSON.stringify({
        code: ERRORS.RATE_LIMITED,
        message: quota.scope === "day"
          ? "You've hit today's recipe limit — back tomorrow."
          : "You've hit this month's recipe limit.",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  const parsedBody = RequestBody.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return new Response(
      JSON.stringify({ code: ERRORS.BAD_REQUEST, message: "Bad request body." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const { tier, context } = parsedBody.data;

  // Record a session row so the quota window counts this generation.
  await admin.from("generation_sessions").insert({
    user_id: user.id,
    flavor_mode: "comfort",
    effort_mode: "standard",
    energy_tier: tier,
    recipe_count: 3,
    voice_context: context ?? null,
    status: "generating",
  });

  const { data: prefs } = await admin
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const liveCtx = buildLiveContext(tier, prefs ?? null, context);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );

      send("ready", { status: "generating" });
      const emittedTitles = new Set<number>();

      try {
        const full = await chatStream(
          [
            { role: "system", content: buildLiveSystemPrompt() },
            { role: "user", content: buildLiveUserPrompt(liveCtx) },
          ],
          {
            onPartial: (buf) => {
              const partials = extractPartialRecipes(buf);
              if (partials.length) {
                send("partial", { recipes: partials });
                partials.forEach((p, i) => {
                  const title = (p as { title?: string }).title;
                  if (title && !emittedTitles.has(i)) {
                    emittedTitles.add(i);
                    send("title", { index: i, title });
                  }
                });
              }
            },
          },
          { temperature: 0.75, timeoutMs: 22_000 },
        );

        const raw = JSON.parse(stripCodeFences(full));
        if (raw && typeof raw === "object" && "refusal" in raw) {
          send("error", { code: ERRORS.VALIDATION, message: String(raw.refusal) });
          controller.close();
          return;
        }
        const result = ResponseEnvelope.safeParse(raw);
        if (!result.success) {
          send("error", {
            code: ERRORS.VALIDATION,
            message: "The kitchen produced something odd — try again.",
          });
          controller.close();
          return;
        }

        const ids = await persistRecipes(admin, result.data.recipes);

        // Re-read persisted rows and map to client shape (real ids + status).
        const { data: rows } = await admin
          .from("recipes")
          .select("*")
          .in("id", ids);
        const byId = new Map(
          (rows ?? []).map((r: Record<string, unknown>) => [r.id, r]),
        );
        const clientRecipes = ids
          .map((id) => byId.get(id))
          .filter((r): r is Record<string, unknown> => Boolean(r))
          .map(dbRowToClientRecipe);

        send("final", { recipes: clientRecipes });
        send("done", {});
      } catch (err) {
        send("error", {
          code: ERRORS.GENERATION_FAILED,
          message: "The kitchen is busy — try again in a minute.",
        });
        console.error("generate-recipe error", String(err));
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

- [ ] **Step 4: Run the persist test to verify it passes**

Run: `cd supabase/functions/generate-recipe && deno test --allow-env persist.test.ts`
Expected: PASS — `ok | 1 passed | 0 failed`.

- [ ] **Step 5: Typecheck the whole function graph**

Run: `cd supabase/functions && deno check generate-recipe/index.ts`
Expected: no errors (all `_shared` imports resolve, types line up).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/generate-recipe/index.ts supabase/functions/generate-recipe/persist.test.ts
git commit -m "feat(edge): generate-recipe SSE stream with dedup persist + rate limit

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Secrets, local stack, and deploy workflow

**Files:**
- Create: `docs/superpowers/plans/phase2-deploy-notes.md` (record the exact commands you ran and their output; not code, an ops log)
- Modify: `apps/native/app.json` (real Supabase URL + anon key into `extra`, still `apiMode: "mock"` — the live flip is Task 14)

**Interfaces:** none (ops task). Prerequisite: Supabase CLI installed and the project linked. `bun` installed (spec Phase 0). Docker running (for `supabase start`).

- [ ] **Step 1: Confirm tooling is present**

Run: `supabase --version && deno --version && bun --version`
Expected: all three print versions. If `supabase` is missing: `brew install supabase/tap/supabase`. If `deno` is missing: `brew install deno`. If `bun` is missing: `curl -fsSL https://bun.sh/install | bash` (spec §8 Phase 0 calls for bun on this machine).

- [ ] **Step 2: Start the local stack**

Run: `cd /Users/zachoelsner/Projects/qook && supabase start`
Expected: prints local `API URL`, `anon key`, `service_role key`. Copy the anon key and API URL for step 6. Migrations in `supabase/migrations/` apply automatically.

- [ ] **Step 3: Set the OpenRouter secret for local serve**

Local Edge Functions read secrets from `supabase/functions/.env`. Create it by **copying the value from `.env.local` without printing it**:

Run:
```bash
cd /Users/zachoelsner/Projects/qook
grep '^OPENROUTER_API_KEY=' .env.local > supabase/functions/.env
echo "supabase/functions/.env" >> .gitignore
```
Expected: `supabase/functions/.env` exists with the key line; it is gitignored. Do NOT `cat` it.

- [ ] **Step 4: Serve functions locally and smoke the wiring (no AI call yet)**

Run: `cd /Users/zachoelsner/Projects/qook && supabase functions serve generate-recipe --env-file supabase/functions/.env`
In another shell, hit it unauthenticated:
```bash
curl -i -X POST http://127.0.0.1:54321/functions/v1/generate-recipe \
  -H "Content-Type: application/json" -d '{"tier":"after-work"}'
```
Expected: `401` with body `{"code":"unauthorized","message":"Sign in required."}`. This proves the function boots and auth-guards before spending money.

- [ ] **Step 5: Set the production secret (when ready to deploy)**

Run (references `.env.local`, never prints the value):
```bash
cd /Users/zachoelsner/Projects/qook
supabase secrets set --env-file .env.local
```
Expected: `Finished supabase secrets set.` Confirm with `supabase secrets list` (shows names + digests, not values). Ensure `.env.local` contains only keys meant for prod (at minimum `OPENROUTER_API_KEY`); if it holds extras, instead run `supabase secrets set OPENROUTER_API_KEY="$(grep '^OPENROUTER_API_KEY=' .env.local | cut -d= -f2-)"`.

- [ ] **Step 6: Put the real Supabase URL + anon key into `app.json`**

Edit `apps/native/app.json`, replacing the placeholder `extra` values (leave `apiMode` as `"mock"` for now):

```json
    "extra": {
      "supabaseUrl": "https://<your-project-ref>.supabase.co",
      "supabaseAnonKey": "<your-anon-key>",
      "apiMode": "mock"
    }
```

- [ ] **Step 7: Deploy the function (after the smoke test in Task 13 passes)**

Run:
```bash
cd /Users/zachoelsner/Projects/qook
supabase functions deploy generate-recipe --no-verify-jwt
```
(`--no-verify-jwt` because the function does its own `auth.getUser()`; the platform JWT gate would otherwise reject the anon-key call before our handler runs.)
Expected: `Deployed Function generate-recipe`. Record output in the deploy notes file.

- [ ] **Step 8: Commit the app.json + gitignore change**

```bash
git add apps/native/app.json .gitignore
git commit -m "chore: wire real Supabase project config; gitignore functions env

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Client — `react-native-sse` consumer + live `generateRecipesForEnergy`, loading screen streams titles

**Files:**
- Modify: `apps/native/package.json` (add `react-native-sse` dependency)
- Create: `apps/native/src/services/generateRecipeStream.ts`
- Modify: `apps/native/src/services/api.ts:140-153` (live branch of `generateRecipesForEnergy`)
- Modify: `apps/native/src/stores/generationSession.ts` (add streamed-titles state)
- Modify: `apps/native/src/features/eat/GenerationLoadingScreen.tsx` (render streamed titles)
- Create: `scripts/test-generate-stream.ts` (bun assertion script for the SSE event parser)

**Interfaces:**
- Consumes: the `generate-recipe` SSE contract from Task 10 (`ready` / `title` / `partial` / `final` / `error` / `done`).
- Produces:
  - `generateRecipeStream.ts`: `export type StreamCallbacks = { onTitle?: (index: number, title: string) => void; onError?: (code: string, message: string) => void }`; `export async function streamRecipes(tier: EnergyTier, context: string | undefined, cb: StreamCallbacks): Promise<Recipe[]>` — opens the SSE connection with the auth token, forwards `title` events to `cb.onTitle`, resolves with the `final` recipes array, rejects on `error`.
  - `generationSession.ts`: adds `streamedTitles: string[]` + `pushTitle(index, title)` action.
  - `api.ts`: the live branch of `generateRecipesForEnergy` delegates to `streamRecipes` (falls back to a plain non-stream call only if SSE connection fails — see step).

- [ ] **Step 1: Add the dependency**

Run: `cd /Users/zachoelsner/Projects/qook && bun add react-native-sse --cwd apps/native` (or `cd apps/native && npm install react-native-sse` if the repo uses npm workspaces — check the lockfile: `ls apps/native/../../bun.lockb package-lock.json`).
Expected: `react-native-sse` appears in `apps/native/package.json` dependencies.

- [ ] **Step 2: Write the failing bun assertion for the event parser**

Extract the pure event-routing logic into a testable function. Write `scripts/test-generate-stream.ts`:

```ts
// scripts/test-generate-stream.ts
// Run: bun run scripts/test-generate-stream.ts
import { routeStreamEvent } from '../apps/native/src/services/generateRecipeStream';

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  passed++;
}

const titles: Array<[number, string]> = [];
let finalRecipes: unknown[] | null = null;
let err: { code: string; message: string } | null = null;

const cb = {
  onTitle: (i: number, t: string) => titles.push([i, t]),
  onFinal: (r: unknown[]) => (finalRecipes = r),
  onError: (code: string, message: string) => (err = { code, message }),
};

routeStreamEvent('title', JSON.stringify({ index: 0, title: 'Sesame Soba' }), cb);
assert(titles.length === 1 && titles[0][1] === 'Sesame Soba', 'title routed');

routeStreamEvent('final', JSON.stringify({ recipes: [{ id: 'x' }] }), cb);
assert(finalRecipes !== null && finalRecipes!.length === 1, 'final routed');

routeStreamEvent('error', JSON.stringify({ code: 'rate_limited', message: 'slow down' }), cb);
assert(err !== null && err!.code === 'rate_limited', 'error routed');

console.log(`OK — ${passed} assertions passed`);
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd /Users/zachoelsner/Projects/qook && bun run scripts/test-generate-stream.ts`
Expected: FAIL — cannot resolve `routeStreamEvent` (module/exports don't exist yet).

- [ ] **Step 4: Write `generateRecipeStream.ts`**

```ts
// apps/native/src/services/generateRecipeStream.ts
import Constants from 'expo-constants';
import EventSource from 'react-native-sse';
import type { EnergyTier, Recipe } from '@qook/shared';
import { supabase } from './supabase';

export type StreamCallbacks = {
  onTitle?: (index: number, title: string) => void;
  onFinal?: (recipes: unknown[]) => void;
  onError?: (code: string, message: string) => void;
};

// Pure router — exported for the bun assertion script.
export function routeStreamEvent(
  event: string,
  data: string,
  cb: StreamCallbacks
): void {
  try {
    const payload = JSON.parse(data);
    if (event === 'title') cb.onTitle?.(payload.index, payload.title);
    else if (event === 'final') cb.onFinal?.(payload.recipes ?? []);
    else if (event === 'error') {
      cb.onError?.(payload.code ?? 'generation_failed', payload.message ?? 'Something went wrong.');
    }
  } catch {
    /* malformed event — ignore */
  }
}

export async function streamRecipes(
  tier: EnergyTier,
  context: string | undefined,
  cb: StreamCallbacks
): Promise<Recipe[]> {
  const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('no_session');

  const url = `${supabaseUrl}/functions/v1/generate-recipe`;

  return new Promise<Recipe[]>((resolve, reject) => {
    const es = new EventSource(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, context: context?.trim() || undefined }),
      pollingInterval: 0,
    });

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      es.removeAllEventListeners();
      es.close();
      fn();
    };

    (['title', 'final', 'error'] as const).forEach((evt) => {
      es.addEventListener(evt, (e) => {
        routeStreamEvent(evt, (e as { data?: string }).data ?? '{}', {
          onTitle: cb.onTitle,
          onFinal: (recipes) => finish(() => resolve(recipes as Recipe[])),
          onError: (code, message) => {
            cb.onError?.(code, message);
            finish(() => reject(new Error(message)));
          },
        });
      });
    });

    es.addEventListener('error', () => {
      // Connection-level failure (not a server `error` event) → reject so the
      // caller can fall back to a non-stream path.
      finish(() => reject(new Error('stream_connection_error')));
    });
  });
}
```

- [ ] **Step 5: Run the bun assertion to verify it passes**

Run: `cd /Users/zachoelsner/Projects/qook && bun run scripts/test-generate-stream.ts`
Expected: PASS — `OK — 3 assertions passed`.

- [ ] **Step 6: Add streamed-titles state to the store**

In `apps/native/src/stores/generationSession.ts`, add to the interface and store:

```ts
// add to GenerationSessionState interface:
  streamedTitles: string[];
  pushTitle: (index: number, title: string) => void;
```

```ts
// add to the create(...) initial state (next to recipes: []):
  streamedTitles: [],
```

```ts
// add this action (next to setStreaming):
  pushTitle: (index, title) =>
    set((s) => {
      const next = s.streamedTitles.slice();
      next[index] = title;
      return { streamedTitles: next };
    }),
```

Also reset `streamedTitles: []` inside both `start` and `reset` (alongside `recipes: []`).

- [ ] **Step 7: Wire the live branch in `api.ts`**

Replace the live branch of `generateRecipesForEnergy` (currently `apps/native/src/services/api.ts:148-152`) with a streaming call that pushes titles into the store and falls back to a blocking call on connection error:

```ts
// apps/native/src/services/api.ts — replace the live branch body of generateRecipesForEnergy
  const { streamRecipes } = await import('./generateRecipeStream');
  const { useGenerationSession } = await import('../stores/generationSession');
  try {
    return await streamRecipes(tier, context, {
      onTitle: (index, title) =>
        useGenerationSession.getState().pushTitle(index, title),
      onError: () => {
        /* surfaced via thrown error below */
      },
    });
  } catch (streamErr) {
    if ((streamErr as Error).message !== 'stream_connection_error') throw streamErr;
    // Fallback: non-stream invoke (same edge fn returns SSE, so use a plain
    // fetch that reads the `final` event out of the buffered stream).
    const { data, error } = await supabase.functions.invoke('generate-recipe', {
      body: { tier, context: context?.trim() || undefined },
    });
    if (error) throw error;
    return (data as { recipes: Recipe[] }).recipes;
  }
```

Note: the fallback path relies on `functions.invoke` buffering the SSE body; if that proves unreliable in testing, the accepted alternative is to surface the connection error to the user with a "Try again" (spec §6 partial-results behavior). Keep the fallback minimal.

- [ ] **Step 8: Render streamed titles on the loading screen**

In `apps/native/src/features/eat/GenerationLoadingScreen.tsx`, subscribe to `streamedTitles` and show them as they arrive (spec §4.4 — titles stream in place of the static stage labels once any title exists):

```tsx
// add near the other store selectors:
  const streamedTitles = useGenerationSession((s) => s.streamedTitles);
```

```tsx
// replace the BodyText stage line block with:
        {streamedTitles.filter(Boolean).length > 0 ? (
          streamedTitles.filter(Boolean).map((t, i) => (
            <BodyText
              key={i}
              size={15}
              color={palette.textSecondary}
              weight="medium"
            >
              {t}
            </BodyText>
          ))
        ) : (
          <BodyText size={14} color={palette.textSecondary} weight="medium">
            {STAGES[stage].label}
          </BodyText>
        )}
```

- [ ] **Step 9: Typecheck + lint the client**

Run: `cd /Users/zachoelsner/Projects/qook/apps/native && bun run typecheck && bun run lint`
Expected: both green. (If `react-native-sse` lacks types, add a minimal `declare module 'react-native-sse'` in `apps/native/src/types/` — the package ships its own types as of recent versions, so verify first.)

- [ ] **Step 10: Commit**

```bash
git add apps/native/package.json apps/native/src/services/generateRecipeStream.ts apps/native/src/services/api.ts apps/native/src/stores/generationSession.ts apps/native/src/features/eat/GenerationLoadingScreen.tsx scripts/test-generate-stream.ts
git commit -m "feat(client): live SSE recipe stream with streamed titles on loading screen

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: `[COST]` Smoke test — one real text generation call

**Files:**
- Create: `scripts/smoke-generate-recipe.ts` (bun; hits the local function with a real access token)

**Interfaces:** none new; exercises the deployed/served `generate-recipe`.

> **STOP-AND-CONFIRM:** this task spends real OpenRouter money (~$0.02). Confirm with Zach before running. Eyeball the output before proceeding to any further real call.

- [ ] **Step 1: Ensure the local stack + function are running**

Run (two shells): `supabase start` (if not already) and `supabase functions serve generate-recipe --env-file supabase/functions/.env`.
Expected: function serving on `http://127.0.0.1:54321/functions/v1/generate-recipe`.

- [ ] **Step 2: Create a test user + access token**

Run:
```bash
cd /Users/zachoelsner/Projects/qook
supabase auth admin create-user --email smoke@qook.test --password 'Smoke!2026' 2>/dev/null || true
```
Then get a token by signing in via the local auth endpoint:
```bash
curl -s -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: <LOCAL_ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"email":"smoke@qook.test","password":"Smoke!2026"}' | grep -o '"access_token":"[^"]*"'
```
Expected: an `access_token` value. (The `handle_new_user` trigger auto-creates the profile + prefs rows.)

- [ ] **Step 3: Fire one real generation and capture the stream**

Run:
```bash
curl -N -X POST http://127.0.0.1:54321/functions/v1/generate-recipe \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"tier":"after-work","context":"something warm and quick"}'
```
Expected: a stream of `event: ready`, several `event: title` and `event: partial`, then one `event: final` with 3 recipes carrying real ids, then `event: done`. No `event: error`.

- [ ] **Step 4: Eyeball quality + cost**

Confirm: 3 distinct recipes, each ingredient has a `parsed` block with a valid `category` and `canonical_key`, `timeMinutes <= 30`. Check the function logs for the `or_cost` line and confirm `usd` is ~$0.01–0.03.
Expected: recipes look like real dinners; cost within budget.

- [ ] **Step 5: Verify DB persistence + dedup**

Run:
```bash
supabase db query "select id, title, energy_tier, signature, use_count from public.recipes order by created_at desc limit 3;"
```
Then re-run Step 3 with the identical body and confirm the same signatures return with incremented `use_count` (dedup working).
Expected: second run reuses cached rows (`use_count` incremented), does not insert duplicates.

- [ ] **Step 6: Commit the smoke script**

```bash
git add scripts/smoke-generate-recipe.ts
git commit -m "test: real text-generation smoke script (manual, cost-gated)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 14: Flip client to live mode and walk the Tonight flow in the simulator

**Files:**
- Modify: `apps/native/app.json` (`extra.apiMode: "live"`)

**Interfaces:** none.

> This flow will trigger the real generation call again (Task 13's cost note applies). Keep it to one walk.

- [ ] **Step 1: Flip the flag**

Edit `apps/native/app.json`: change `"apiMode": "mock"` → `"apiMode": "live"`.

- [ ] **Step 2: Point the client at the local (or deployed) stack**

Ensure `extra.supabaseUrl` / `extra.supabaseAnonKey` in `app.json` are the running stack's values (local `http://127.0.0.1:54321` won't work from a device but works from the iOS simulator on the same host; use the local anon key).

- [ ] **Step 3: Run the app and walk Find dinner → energy → loading → review**

Run: `cd /Users/zachoelsner/Projects/qook/apps/native && bun run ios`
Expected: sign in, open Find dinner, pick an energy tier, and on the loading screen watch recipe **titles stream in** (not just the static spinner), then land on the review screen with 3 real recipes.

- [ ] **Step 4: Record the result**

Note in `docs/superpowers/plans/phase2-deploy-notes.md`: did titles stream? did review show 3 recipes? any typed error toast?
Expected: streaming titles visible, 3 recipes on review.

- [ ] **Step 5: Commit the flag flip (only after the walk succeeds)**

```bash
git add apps/native/app.json docs/superpowers/plans/phase2-deploy-notes.md
git commit -m "feat(client): flip apiMode to live after successful Tonight walk

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 15: `shopping-share/index.ts` — Instacart Create Shopping List (with fallbacks)

**Files:**
- Create: `supabase/functions/shopping-share/index.ts`
- Create: `supabase/functions/shopping-share/map.ts` (pure item mapper — testable)
- Test: `supabase/functions/shopping-share/map.test.ts`
- Modify: `apps/native/src/lib/shoppingShare.ts` (add `createInstacartShoppingList`)
- Create: `scripts/test-shopping-share.ts` (bun; the 7 edge-case assertions, spec §7)

**Interfaces:**
- `map.ts` produces: `export type InstacartItem = { name: string; quantity: number; unit: string; display_text: string }`; `export function toInstacartItem(item: ClientGroceryItem): InstacartItem`; `export type ClientGroceryItem = { name: string; quantityAmount?: number; quantityUnit?: string; quantityText?: string }`.
- `index.ts` request: `{ items: ClientGroceryItem[] }`. Response: `{ url: string, source: "instacart" | "search_fallback" }` or typed error. Empty list → `422 { code: "empty_list" }`. Instacart 5xx/network error → build the search-URL fallback and return `200 { url, source: "search_fallback" }`.
- Client `createInstacartShoppingList(items: GroceryItem[]): Promise<string>` — calls the edge function, returns a URL to `Linking.openURL`; on any failure falls back to the existing `openInstacart` search path.

- [ ] **Step 1: Write the failing test for the mapper**

```ts
// supabase/functions/shopping-share/map.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { toInstacartItem } from "./map.ts";

Deno.test("maps amount + unit", () => {
  assertEquals(
    toInstacartItem({
      name: "olive oil",
      quantityAmount: 2,
      quantityUnit: "tbsp",
      quantityText: "2 tbsp",
    }),
    { name: "olive oil", quantity: 2, unit: "tbsp", display_text: "2 tbsp" },
  );
});

Deno.test("defaults quantity 1 / unit each when unparsed", () => {
  assertEquals(toInstacartItem({ name: "lemon" }), {
    name: "lemon",
    quantity: 1,
    unit: "each",
    display_text: "lemon",
  });
});

Deno.test("count unit becomes each", () => {
  const r = toInstacartItem({ name: "egg", quantityAmount: 3, quantityUnit: "count" });
  assertEquals(r.unit, "each");
  assertEquals(r.quantity, 3);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd supabase/functions/shopping-share && deno test map.test.ts`
Expected: FAIL — `Module not found "./map.ts"`.

- [ ] **Step 3: Write `map.ts`**

```ts
// supabase/functions/shopping-share/map.ts
export type ClientGroceryItem = {
  name: string;
  quantityAmount?: number;
  quantityUnit?: string;
  quantityText?: string;
};

export type InstacartItem = {
  name: string;
  quantity: number;
  unit: string;
  display_text: string;
};

export function toInstacartItem(item: ClientGroceryItem): InstacartItem {
  const rawUnit = item.quantityUnit;
  const unit = !rawUnit || rawUnit === "count" ? "each" : rawUnit;
  return {
    name: item.name,
    quantity: item.quantityAmount ?? 1,
    unit,
    display_text: item.quantityText || item.name,
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd supabase/functions/shopping-share && deno test map.test.ts`
Expected: PASS — `ok | 3 passed | 0 failed`.

- [ ] **Step 5: Write `index.ts`**

```ts
// supabase/functions/shopping-share/index.ts
import { toInstacartItem, type ClientGroceryItem } from "./map.ts";
import { requireUser } from "../_shared/supabase.ts";
import { ERRORS, errorResponse } from "../_shared/errors.ts";

const INSTACART_ENDPOINT =
  "https://connect.instacart.com/idp/v1/products/products_link";

function searchFallbackUrl(items: ClientGroceryItem[]): string {
  const q = items.map((i) => i.name.trim()).filter(Boolean).join(", ");
  return `https://www.instacart.com/store/s?k=${encodeURIComponent(q)}`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    await requireUser(req);
  } catch (resp) {
    return resp as Response;
  }

  const body = (await req.json().catch(() => null)) as
    | { items?: ClientGroceryItem[] }
    | null;
  const items = body?.items ?? [];

  if (items.length === 0) {
    return errorResponse(ERRORS.EMPTY_LIST, "Nothing to shop yet.", 422);
  }

  const key = Deno.env.get("INSTACART_IDP_KEY");
  const j = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  // No key configured → honest search fallback, never dead-end.
  if (!key) {
    return j({ url: searchFallbackUrl(items), source: "search_fallback" });
  }

  try {
    const resp = await fetch(INSTACART_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Tonight's list — Qook",
        line_items: items.slice(0, 50).map(toInstacartItem),
      }),
    });
    if (!resp.ok) throw new Error(`instacart ${resp.status}`);
    const data = await resp.json();
    const url = data?.products_link_url ?? data?.url;
    if (!url) throw new Error("missing url");
    return j({ url, source: "instacart" });
  } catch (err) {
    console.error("shopping-share instacart error", String(err));
    // Instacart down → search fallback (spec §6, audit §3 edge case 3).
    return j({ url: searchFallbackUrl(items), source: "search_fallback" });
  }
});
```

- [ ] **Step 6: Write the client `createInstacartShoppingList`**

Add to `apps/native/src/lib/shoppingShare.ts` (keep `openInstacart` as the fallback it already is):

```ts
// apps/native/src/lib/shoppingShare.ts — add near openInstacart
import { supabase } from '../services/supabase';

export async function createInstacartShoppingList(
  items: GroceryItem[]
): Promise<void> {
  if (items.length === 0) {
    Alert.alert('Nothing to shop yet', 'Add items to your list first.');
    return;
  }
  try {
    const { data, error } = await supabase.functions.invoke('shopping-share', {
      body: {
        items: items.map((i) => ({
          name: i.name,
          quantityAmount: i.quantityAmount,
          quantityUnit: i.quantityUnit,
          quantityText: i.quantityText,
        })),
      },
    });
    if (error || !data?.url) throw error ?? new Error('no_url');
    openUrl(data.url as string);
  } catch {
    // Edge fn unreachable → local search-URL fallback (never dead-end).
    openInstacart(items);
  }
}
```

- [ ] **Step 7: Write the 7-edge-case bun assertion script**

```ts
// scripts/test-shopping-share.ts
// Run: bun run scripts/test-shopping-share.ts
// Mirrors the Deno mapper so the 7 edge cases (spec §7 / audit §3) are asserted
// against the same mapping contract the edge function uses.
type Item = { name: string; quantityAmount?: number; quantityUnit?: string; quantityText?: string };
function toInstacartItem(item: Item) {
  const unit = !item.quantityUnit || item.quantityUnit === 'count' ? 'each' : item.quantityUnit;
  return { name: item.name, quantity: item.quantityAmount ?? 1, unit, display_text: item.quantityText || item.name };
}
function searchFallbackUrl(items: Item[]) {
  const q = items.map((i) => i.name.trim()).filter(Boolean).join(', ');
  return `https://www.instacart.com/store/s?k=${encodeURIComponent(q)}`;
}

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  passed++;
}

// 1. amount + unit preserved
assert(toInstacartItem({ name: 'flour', quantityAmount: 2, quantityUnit: 'cup', quantityText: '2 cup' }).quantity === 2, 'amount preserved');
// 2. missing quantity → 1/each
assert(toInstacartItem({ name: 'lemon' }).unit === 'each', 'default unit each');
// 3. count → each
assert(toInstacartItem({ name: 'egg', quantityAmount: 3, quantityUnit: 'count' }).unit === 'each', 'count→each');
// 4. display_text falls back to name
assert(toInstacartItem({ name: 'salt' }).display_text === 'salt', 'display_text fallback');
// 5. empty list → fallback URL has empty query
assert(searchFallbackUrl([]) === 'https://www.instacart.com/store/s?k=', 'empty list url');
// 6. >50 items truncation (mapper is per-item; truncation is caller-side — assert slice logic)
const many = Array.from({ length: 60 }, (_, i) => ({ name: `item${i}` }));
assert(many.slice(0, 50).length === 50, '>50 truncates to 50');
// 7. names with commas/spaces encode safely in fallback
assert(searchFallbackUrl([{ name: 'red, ripe tomato' }]).includes('%2C'), 'comma encoded');

console.log(`OK — ${passed} assertions passed`);
```

- [ ] **Step 8: Run mapper test + bun assertions**

Run: `cd supabase/functions/shopping-share && deno test map.test.ts`
Then: `cd /Users/zachoelsner/Projects/qook && bun run scripts/test-shopping-share.ts`
Expected: Deno `ok | 3 passed`; bun `OK — 7 assertions passed`.

- [ ] **Step 9: Typecheck client + deploy**

Run: `cd /Users/zachoelsner/Projects/qook/apps/native && bun run typecheck`
Then: `cd /Users/zachoelsner/Projects/qook && supabase functions deploy shopping-share --no-verify-jwt`
Expected: typecheck green; `Deployed Function shopping-share`.

> **Instacart IDP key:** `.env.local` does NOT yet contain an Instacart key. The function degrades gracefully to the search fallback without it. Before the key exists, `source` will always be `"search_fallback"`. When Zach self-serve-signs-up for an IDP key, add `INSTACART_IDP_KEY` to `.env.local` and run `supabase secrets set INSTACART_IDP_KEY=...` (never printed). Confirm the endpoint host (`connect.instacart.com` vs a regional host) against current Instacart Developer Platform docs at that time.

- [ ] **Step 10: Commit**

```bash
git add supabase/functions/shopping-share/index.ts supabase/functions/shopping-share/map.ts supabase/functions/shopping-share/map.test.ts apps/native/src/lib/shoppingShare.ts scripts/test-shopping-share.ts
git commit -m "feat: Instacart Create Shopping List edge fn + client + fallbacks

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 16: Canon asset — inline the style reference for `generate-image`

**Files:**
- Create: `supabase/functions/_shared/assets/canon-b64.ts` (base64 string of the hand-picked canon PNG)
- Create: `scripts/inline-canon.ts` (bun; reads a PNG → writes `canon-b64.ts`)
- Test: `supabase/functions/_shared/assets/canon-b64.test.ts`

**Interfaces:**
- Produces: `export const CANON_IMAGE_DATA_URL: string` — a `data:image/png;base64,...` string usable directly as an OpenRouter `image_url`.

> **BLOCKER:** this task needs the real canon PNG Zach hand-picks (spec §3 step 2). Do not fabricate one. If the asset is not yet chosen, stop here and flag it — `generate-image` (Task 17) can be written but not smoke-tested until the canon exists. The wobble/seed pipeline lives at `apps/native/assets/meals-seed/v2/`; the canon is a separate deliberate pick.

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/_shared/assets/canon-b64.test.ts
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CANON_IMAGE_DATA_URL } from "./canon-b64.ts";

Deno.test("canon is a non-trivial png data url", () => {
  assert(CANON_IMAGE_DATA_URL.startsWith("data:image/png;base64,"));
  assert(CANON_IMAGE_DATA_URL.length > 2000); // real image, not a stub
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd supabase/functions/_shared/assets && deno test canon-b64.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the inliner script and run it against the real PNG**

```ts
// scripts/inline-canon.ts
// Run: bun run scripts/inline-canon.ts <path-to-canon.png>
import { readFileSync, writeFileSync } from 'fs';

const src = process.argv[2];
if (!src) { console.error('usage: inline-canon.ts <canon.png>'); process.exit(1); }
const b64 = readFileSync(src).toString('base64');
const out = `// AUTO-GENERATED by scripts/inline-canon.ts — do not edit by hand.
export const CANON_IMAGE_DATA_URL =
  "data:image/png;base64,${b64}";
`;
writeFileSync('supabase/functions/_shared/assets/canon-b64.ts', out);
console.log(`Wrote canon-b64.ts (${b64.length} base64 chars)`);
```

Run: `cd /Users/zachoelsner/Projects/qook && bun run scripts/inline-canon.ts <path-to-canon.png>`
Expected: `Wrote canon-b64.ts (...)`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd supabase/functions/_shared/assets && deno test canon-b64.test.ts`
Expected: PASS — `ok | 1 passed`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/assets/canon-b64.ts supabase/functions/_shared/assets/canon-b64.test.ts scripts/inline-canon.ts
git commit -m "feat(edge): inline canon style-reference asset for image gen

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 17: `generate-image/index.ts` — canon-loop watercolor, commit-gated, store PNG

**Files:**
- Create: `supabase/functions/_shared/prompts/image.ts` (tweaked watercolor prompt, spec §3)
- Create: `supabase/functions/generate-image/index.ts`
- Test: `supabase/functions/_shared/prompts/image.test.ts`

**Interfaces:**
- `image.ts` produces: `export function buildImagePrompt(recipe: { title: string; ingredientGroups?: unknown }): string` — the tweaked watercolor prompt with the three §3 tweaks + "match this artist's hand, do not copy subject or composition".
- `index.ts` request: `{ recipeId: string }` (service-role auth only — fired by client on "Cook tonight" via `functions.invoke`, or by another edge fn). Reads the recipe row, builds the prompt, calls `google/gemini-3.1-flash-image` via OpenRouter chat/completions with `modalities: ["image","text"]` and message content `[{type:"image_url", image_url:{url: CANON_IMAGE_DATA_URL}}, {type:"text", text: prompt}]`, uploads PNG to `meal-images` bucket at `<recipeId>.png`, writes `image_storage_path` + `image_status: "ready"` to the row. On failure: `image_status: "failed"` and return typed error; client shows the letter-vignette (client-side, restyle plan). Includes `or_cost`-style image cost log.

- [ ] **Step 1: Write the failing test for the prompt**

```ts
// supabase/functions/_shared/prompts/image.test.ts
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildImagePrompt } from "./image.ts";

Deno.test("image prompt carries the three §3 tweaks and the style directive", () => {
  const p = buildImagePrompt({ title: "Miso-Butter Salmon" });
  assert(/single plate|one serving|centered/i.test(p));
  assert(/outer 15%|clean cream/i.test(p));
  assert(/at most two/i.test(p));
  assert(/match this artist'?s hand/i.test(p));
  assert(p.includes("Miso-Butter Salmon"));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd supabase/functions/_shared && deno test prompts/image.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `image.ts`**

```ts
// supabase/functions/_shared/prompts/image.ts
export function buildImagePrompt(
  recipe: { title: string; ingredientGroups?: unknown },
): string {
  return [
    `Hand-painted watercolor illustration, editorial cookbook style, of ${recipe.title}.`,
    // §3 tweak (a): composition
    `Composition: a single plate, one serving, the dish centered.`,
    // §3 tweak (b): clean margin
    `The outer 15% of the canvas stays clean cream paper on all sides.`,
    // §3 tweak (c): accents
    `At most two small watercolor accents outside the plate.`,
    `Soft cream paper background, restrained sage and rust watercolor accents, prussian blue for shadow only, used sparingly. Visible paper texture; light brush-stroke edges so the food reads as the subject.`,
    `No text, no signature, no watermark, no people, no hands.`,
    `Square 1:1 aspect ratio.`,
    // style-reference directive (spec §3 step 2)
    `Match this artist's hand, do not copy subject or composition.`,
  ].join(" ");
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd supabase/functions/_shared && deno test prompts/image.test.ts`
Expected: PASS — `ok | 1 passed`.

- [ ] **Step 5: Write `generate-image/index.ts`**

```ts
// supabase/functions/generate-image/index.ts
import { serviceClient } from "../_shared/supabase.ts";
import { buildImagePrompt } from "../_shared/prompts/image.ts";
import { CANON_IMAGE_DATA_URL } from "../_shared/assets/canon-b64.ts";
import { MODELS, OR_ENDPOINT, orHeaders } from "../_shared/openrouter.ts";
import { ERRORS, errorResponse } from "../_shared/errors.ts";

const IMAGE_PRICE_USD = 0.068; // google/gemini-3.1-flash-image, spec §3

function extractImageBytes(json: unknown): { bytes: Uint8Array; mime: string } {
  // deno-lint-ignore no-explicit-any
  const msg = (json as any)?.choices?.[0]?.message;
  const first = Array.isArray(msg?.images) ? msg.images[0] : null;
  const url = first?.image_url?.url ?? first?.url ?? null;
  if (!url || typeof url !== "string") throw new Error("no image url in response");
  if (url.startsWith("data:")) {
    const [header, b64] = url.split(",");
    const mime = header.match(/data:([^;]+)/)?.[1] ?? "image/png";
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return { bytes, mime };
  }
  throw new Error("non-data image url; expected inline b64");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  // Service-role only (fired on "Cook tonight" or by another edge fn).
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return errorResponse(ERRORS.UNAUTHORIZED, "Service role required.", 401);
  }

  const { recipeId } = (await req.json().catch(() => ({}))) as {
    recipeId?: string;
  };
  if (!recipeId) {
    return errorResponse(ERRORS.BAD_REQUEST, "recipeId required.", 400);
  }

  const admin = serviceClient();
  await admin.from("recipes").update({ image_status: "generating" }).eq(
    "id",
    recipeId,
  );

  const { data: row, error } = await admin
    .from("recipes")
    .select("id, title, ingredient_groups")
    .eq("id", recipeId)
    .single();
  if (error || !row) {
    await admin.from("recipes").update({
      image_status: "failed",
      image_error: "recipe_not_found",
    }).eq("id", recipeId);
    return errorResponse(ERRORS.NOT_FOUND, "Recipe not found.", 404);
  }

  const prompt = buildImagePrompt({
    title: row.title as string,
    ingredientGroups: row.ingredient_groups,
  });

  try {
    const resp = await fetch(OR_ENDPOINT, {
      method: "POST",
      headers: orHeaders(),
      body: JSON.stringify({
        model: MODELS.image(),
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: CANON_IMAGE_DATA_URL } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`image gen ${resp.status}: ${await resp.text()}`);
    const json = await resp.json();
    const { bytes, mime } = extractImageBytes(json);

    const path = `${recipeId}.png`;
    const up = await admin.storage.from("meal-images").upload(path, bytes, {
      contentType: mime,
      upsert: true,
      cacheControl: "31536000",
    });
    if (up.error) throw up.error;

    await admin.from("recipes").update({
      image_status: "ready",
      image_storage_path: path,
      image_updated_at: new Date().toISOString(),
      last_image_prompt: prompt,
    }).eq("id", recipeId);

    console.log(
      JSON.stringify({
        tag: "or_cost",
        label: "image",
        model: MODELS.image(),
        usd: IMAGE_PRICE_USD,
      }),
    );
    return new Response(JSON.stringify({ ok: true, path }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    await admin.from("recipes").update({
      image_status: "failed",
      image_error: String(err).slice(0, 400),
    }).eq("id", recipeId);
    console.error("generate-image error", String(err));
    // Client renders letter-vignette on failed status (restyle plan, spec §6).
    return errorResponse(ERRORS.IMAGE_FAILED, "Image generation failed.", 502);
  }
});
```

- [ ] **Step 6: Typecheck the function graph**

Run: `cd supabase/functions && deno check generate-image/index.ts`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/prompts/image.ts supabase/functions/_shared/prompts/image.test.ts supabase/functions/generate-image/index.ts
git commit -m "feat(edge): canon-loop watercolor image generation, commit-gated

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 18: `[COST]` Smoke test — one real image generation call

**Files:** none (manual smoke).

> **STOP-AND-CONFIRM:** spends ~$0.068. Requires the real canon asset (Task 16) to exist. Confirm with Zach before running.

- [ ] **Step 1: Deploy the function + confirm the canon secret path**

Run: `cd /Users/zachoelsner/Projects/qook && supabase functions deploy generate-image --no-verify-jwt`
Expected: `Deployed Function generate-image`. (Canon is inlined in code, not a secret.)

- [ ] **Step 2: Pick a real recipe id**

Run: `supabase db query "select id, title from public.recipes order by created_at desc limit 1;"`
Expected: one row; copy the id.

- [ ] **Step 3: Fire one real image call (service role)**

Run:
```bash
curl -X POST "http://127.0.0.1:54321/functions/v1/generate-image" \
  -H "Authorization: Bearer <LOCAL_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"<RECIPE_ID>"}'
```
Expected: `{"ok":true,"path":"<id>.png"}`; a `or_cost` image log line.

- [ ] **Step 4: Verify the stored image + row update**

Run: `supabase db query "select image_status, image_storage_path from public.recipes where id='<RECIPE_ID>';"`
Then open the public URL: `http://127.0.0.1:54321/storage/v1/object/public/meal-images/<RECIPE_ID>.png` in a browser.
Expected: `image_status = ready`, path set; image loads and matches the watercolor canon style (clean cream margin, single centered plate).

- [ ] **Step 5: Verify graceful failure returns null-ish image**

Temporarily point `OR_IMAGE_MODEL` at an invalid model, fire again on a fresh recipe, confirm `image_status = failed` and the function returns `502 {code:"image_failed"}` (client will render the letter-vignette). Restore the env after.
Expected: failed status persisted, typed error returned, no crash.

---

### Task 19: `delete-account/index.ts` — auth user deletion + cascade

**Files:**
- Create: `supabase/functions/delete-account/index.ts`

**Interfaces:**
- Request: authenticated user (their own JWT). Deletes `auth.users` row for the caller via the admin API; all owned rows cascade (verified below). Response: `200 { ok: true }` or typed error.

- [ ] **Step 1: Verify the cascade in the migrations**

Read `supabase/migrations/20260421000000_init_schema.sql`. Confirm: `profiles.id references auth.users(id) on delete cascade`, and every user-owned table (`user_preferences`, `recipes` where `user_id` set, `user_saved_recipes`, `weekly_decks`, `deck_items`, `generation_sessions`, `generation_items`, `grocery_items`) references `profiles(id)` (or a parent) `on delete cascade`.
Expected: deleting the `auth.users` row cascades to `profiles` and onward to all owned rows. Globally-cached recipes (`user_id IS NULL`) are correctly NOT deleted. Record this confirmation as a comment in the function.

- [ ] **Step 2: Write the function**

```ts
// supabase/functions/delete-account/index.ts
// Cascade verified 2026-07-06 against 20260421000000_init_schema.sql:
// auth.users -> profiles (on delete cascade) -> all user-owned tables
// (user_preferences, user_saved_recipes, weekly_decks, deck_items,
// generation_sessions, generation_items, grocery_items) and user-owned
// recipes. Global-cache recipes (user_id IS NULL) are preserved.
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { ERRORS, errorResponse } from "../_shared/errors.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  let userId: string;
  try {
    const { user } = await requireUser(req);
    userId = user.id;
  } catch (resp) {
    return resp as Response;
  }

  const admin = serviceClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("delete-account error", error.message);
    return errorResponse(
      ERRORS.GENERATION_FAILED,
      "Could not delete account. Try again.",
      500,
    );
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 3: Typecheck**

Run: `cd supabase/functions && deno check delete-account/index.ts`
Expected: no errors.

- [ ] **Step 4: Manual smoke (local)**

Create a throwaway user, capture its token, POST to the function, then confirm the profile + owned rows are gone:
```bash
curl -X POST "http://127.0.0.1:54321/functions/v1/delete-account" \
  -H "Authorization: Bearer <THROWAWAY_TOKEN>"
supabase db query "select count(*) from public.profiles where id='<THROWAWAY_USER_ID>';"
```
Expected: `{"ok":true}`; profile count `0`.

- [ ] **Step 5: Deploy + commit**

```bash
cd /Users/zachoelsner/Projects/qook
supabase functions deploy delete-account --no-verify-jwt
git add supabase/functions/delete-account/index.ts
git commit -m "feat(edge): delete-account with verified cascade

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 20: Final verification pass

**Files:** none (verification only).

- [ ] **Step 1: All Deno tests green**

Run: `cd /Users/zachoelsner/Projects/qook/supabase/functions && deno test --allow-env --allow-net`
Expected: every `*.test.ts` passes.

- [ ] **Step 2: All Deno functions typecheck**

Run:
```bash
cd /Users/zachoelsner/Projects/qook/supabase/functions
deno check generate-recipe/index.ts generate-image/index.ts shopping-share/index.ts delete-account/index.ts
```
Expected: no errors.

- [ ] **Step 3: Client bun assertion scripts green**

Run:
```bash
cd /Users/zachoelsner/Projects/qook
bun run scripts/test-generate-stream.ts
bun run scripts/test-shopping-share.ts
```
Expected: both print `OK — N assertions passed`.

- [ ] **Step 4: Client typecheck + lint green (existing bar, spec §7)**

Run: `cd /Users/zachoelsner/Projects/qook/apps/native && bun run typecheck && bun run lint`
Then: `cd /Users/zachoelsner/Projects/qook/packages/shared && bun run typecheck`
Expected: all green.

- [ ] **Step 5: Confirm the four functions are deployed**

Run: `supabase functions list`
Expected: `generate-recipe`, `generate-image`, `shopping-share`, `delete-account` all present. (`generate-deck-batch`, `warm-start-import` remain empty — out of scope.)

- [ ] **Step 6: Final commit if anything is uncommitted**

```bash
cd /Users/zachoelsner/Projects/qook
git status
# stage only Phase 2 files you created/modified, by explicit path; never git add -A
```

---

## Self-Review

**1. Spec coverage (§8 Phase 2 scope items 1–11):**
- (1) `openrouter.ts` wrapper → Task 3 (+ streaming Task 4). ✓
- (2) `schema.ts` with structured ingredients + JSON Schema → Task 1. ✓
- (3) `tiers.ts` TIER_RULES → Task 2. ✓
- (4) `prompts/live.ts` with structured directive, Haiku draft / Sonnet-5 polish defaults → Task 5 (models set in Task 3 `MODELS`). ✓ (Polish path: `MODELS.textPolish()` returns `claude-sonnet-5`; the plan does not wire an automatic polish retry loop — see Open Question 1.)
- (5) `generate-recipe` SSE, Zod-validate, persist w/ signature dedup, rate limits 10/day 30/month → Tasks 8, 10. ✓
- (6) secrets + deploy + local workflow → Task 11. ✓
- (7) client live flip + streaming titles → Tasks 12, 14. ✓
- (8) `shopping-share` Instacart + client + fallbacks + empty-list 422 → Task 15. ✓
- (9) `generate-image` canon-loop, commit-gated, store PNG, cost log → Tasks 16, 17. ✓
- (10) smoke tests with cost checkpoints (text, Tonight flow, image) → Tasks 13, 14, 18. ✓
- (11) `delete-account` cascade → Task 19. ✓
- Error handling §6 (typed errors, SSE partial behavior, image null-graceful) → `errors.ts` (Task 8), used across all functions; image failure returns typed error + `failed` status. ✓ Circuit-breaker flag: **intentionally deferred** — see Open Question 2.

**2. Placeholder scan:** No "TBD/TODO/implement later"; every code step has complete code. Two deliberate BLOCKER gates (canon asset Task 16, Instacart key note Task 15) are flagged with explicit fallback behavior, not placeholders.

**3. Type consistency:** `Recipe` (Zod, camelCase) is the single model-output type; `dbRowToClientRecipe` is the only DB→client mapper; `computeSignature`/`toRecipeInsert`/`persistRecipes` share the same signature contract; `ERRORS` codes are shared across all functions; `LiveContext` is produced by `buildLiveContext` and consumed by `buildLiveUserPrompt`; `toInstacartItem` shape matches between the Deno test and the bun mirror. `MODELS.textPolish()` name is used consistently. No divergent method names found.

**Open questions (flag to orchestrator):**
1. **Polish retry loop not wired.** Spec §4.3 lists Sonnet-5 as a polish fallback; section-ai.md §7.4 has a full `withPolish` gate. This plan validates with Zod and errors out on failure rather than auto-polishing, to keep Phase 2 tight (YAGNI) and avoid a second synchronous AI call inside the SSE window. If Zach wants the polish path in v1, add a Task between 10 and 13 porting `withPolish` + `validateRecipe`. Recommend deferring.
2. **Circuit breaker deferred.** section-ai.md §3.4 needs a new `ai_circuit` table + RPC (a migration). Spec §6 only asks for the flag "per section-ai.md design." Since migrations are frozen this phase and the wrapper already fails fast on timeout/429, I scoped the breaker out and note it. Add a migration + `breaker.ts` if desired.
3. **`react-native-sse` behavior with POST bodies** on Hermes/New Architecture is the highest client risk. Task 12 includes a connection-error fallback; if the library misbehaves, the fallback (surface error + "Try again") is the spec §6 behavior.
