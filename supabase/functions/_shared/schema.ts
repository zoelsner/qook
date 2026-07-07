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
  nutrition: z
    .object({
      calories: z.number().int().nullish(),
      proteinG: z.number().int().nullish(),
      carbG: z.number().int().nullish(),
      fatG: z.number().int().nullish(),
    })
    .nullish(),
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
        type: ["object", "null"],
        additionalProperties: false,
        required: ["calories", "proteinG", "carbG", "fatG"],
        properties: {
          calories: { type: ["integer", "null"] },
          proteinG: { type: ["integer", "null"] },
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
