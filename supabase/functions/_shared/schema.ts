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
  quantity: z.string().nullish(),
  notes: z.string().nullish(),
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
  // Protein estimate is always present — the model can always produce a
  // realistic per-serving estimate, even for quick/simple dishes. Other
  // macros stay optional; nothing else forces the object itself to exist.
  nutrition: z.object({
    calories: z.number().int().nullish(),
    proteinG: z.number().int().nonnegative().max(300),
    carbG: z.number().int().nullish(),
    fatG: z.number().int().nullish(),
  }),
  notes: z.string().max(300).nullish(),
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
      "nutrition",
      "notes",
    ],
    properties: {
      title: { type: "string" },
      cuisine: { type: "string" },
      tier: {
        type: "string",
        enum: ["brain-is-fried", "after-work", "got-energy", "weekend-project"],
      },
      // No maxItems — Anthropic structured outputs reject it on arrays;
      // the Zod schema still caps tags at 8 after the stream.
      tags: { type: "array", items: { type: "string" } },
      timeMinutes: { type: "integer" },
      servings: { type: "integer" },
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
                required: ["item", "quantity", "notes", "parsed"],
                properties: {
                  item: { type: "string" },
                  quantity: { type: ["string", "null"] },
                  notes: { type: ["string", "null"] },
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
                      // anyOf, not `type: [..., null]` + enum — Anthropic's
                      // schema validator rejects enums on union types.
                      unit: {
                        anyOf: [
                          {
                            type: "string",
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
                            ],
                          },
                          { type: "null" },
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
                  durationMin: { type: "integer" },
                },
              },
            },
          },
        },
      },
      nutrition: {
        type: "object",
        additionalProperties: false,
        required: ["calories", "proteinG", "carbG", "fatG"],
        properties: {
          calories: { type: ["integer", "null"] },
          // Always present — no null branch, unlike the other macros.
          proteinG: { type: "integer" },
          carbG: { type: ["integer", "null"] },
          fatG: { type: ["integer", "null"] },
        },
      },
      notes: { type: ["string", "null"] },
    },
  },
} as const;

// Envelope for generate-recipe's streaming call: { recipes: [3 × Recipe] }.
// Matches ResponseEnvelope in generate-recipe/index.ts.
export const RecipeEnvelopeJsonSchema = {
  name: "RecipeEnvelope",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["recipes", "refusal"],
    properties: {
      // No minItems/maxItems: Anthropic structured outputs reject array
      // minItems > 1. The prompt asks for exactly 3 and the Zod envelope
      // (.length(3)) enforces it after the stream.
      recipes: {
        type: "array",
        items: RecipeJsonSchema.schema,
      },
      // Strict mode forces the model into { recipes: [...] } and can't emit
      // an alternate top-level shape for the safety-refusal path — so the
      // refusal rides inside the envelope instead. null unless the model is
      // refusing; when set, recipes is [].
      refusal: { type: ["string", "null"] },
    },
  },
} as const;

// --- Phase-1 "hand of 5" proposals (spec 2026-07-10) ---
// A proposal is the thin card payload: enough to render Treatment-01 without
// the full recipe body. Full ingredients/steps arrive later via fill-recipe.
export const Proposal = z.object({
  title: z.string().min(4),
  hook: z.string().min(4).max(140),
  timeMinutes: z.number().int().positive().max(240),
  proteinG: z.number().int().nonnegative().max(300),
  cuisine: z.string().min(2),
  // Card-back teaser (feature: flippable info back, 2026-07-12). Main
  // ingredient names only, no amounts — those are written at fill time.
  ingredientNames: z.array(z.string()).min(4).max(12),
  // High-level plan lines — 3 to 5 imperative sketch steps, not detailed
  // instructions (those are written at fill time).
  stepOutline: z.array(z.string()).min(3).max(5),
});
export type Proposal = z.infer<typeof Proposal>;

export const ProposalsEnvelope = z.object({
  proposals: z.array(Proposal).length(5),
  // null unless the model refuses on safety grounds; when set, proposals is [].
  refusal: z.string().nullish(),
});

// OpenRouter response_format for the phase-1 call. Luna (OpenAI) honours strict
// mode. No array minItems/maxItems (kept out for provider-portability); the
// prompt asks for exactly 5 and the Zod envelope enforces .length(5) after.
export const ProposalsEnvelopeJsonSchema = {
  name: "ProposalsEnvelope",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["proposals", "refusal"],
    properties: {
      proposals: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "title",
            "hook",
            "timeMinutes",
            "proteinG",
            "cuisine",
            "ingredientNames",
            "stepOutline",
          ],
          properties: {
            title: { type: "string" },
            hook: { type: "string" },
            timeMinutes: { type: "integer" },
            proteinG: { type: "integer" },
            cuisine: { type: "string" },
            // No minItems/maxItems — kept out for provider-portability, same
            // as the other arrays above; the Zod schema enforces 4-12/3-5
            // after the stream.
            ingredientNames: { type: "array", items: { type: "string" } },
            stepOutline: { type: "array", items: { type: "string" } },
          },
        },
      },
      refusal: { type: ["string", "null"] },
    },
  },
} as const;
