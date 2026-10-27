import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// Public culinary identity only. User context and dietary preferences belong
// in the private dinner brief, never in this shared recipe/image contract.
export const DishContractSchema = z.object({
  version: z.literal(1),
  components: z.array(z.object({
    ingredientNames: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
    form: z.string().trim().min(1).max(120),
    appearance: z.string().trim().min(1).max(160),
  }).strict()).min(1).max(6),
  plating: z.string().trim().min(1).max(240),
}).strict();

export type DishContract = z.infer<typeof DishContractSchema>;

// Keep provider-side arrays portable. Runtime bounds above reject unusable
// identity instead of silently truncating the dish someone already saw.
export const DishContractJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "components", "plating"],
  properties: {
    version: { type: "integer", enum: [1] },
    components: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ingredientNames", "form", "appearance"],
        properties: {
          ingredientNames: { type: "array", items: { type: "string" } },
          form: { type: "string" },
          appearance: { type: "string" },
        },
      },
    },
    plating: { type: "string" },
  },
} as const;

export function sameDishContract(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null;
  const left = DishContractSchema.safeParse(a);
  const right = DishContractSchema.safeParse(b);
  return left.success && right.success &&
    JSON.stringify(left.data) === JSON.stringify(right.data);
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function ingredientNoun(name: string): string | null {
  const words = name.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/)
    .filter(word => word && !/^(?:raw|ground|minced|cooked|canned|fresh|frozen|boneless|skinless|whole|large|small|fillets?|steaks?)$/.test(word));
  return words.length ? words.map(escapeRegex).join("\\s+") : null;
}

// These are deliberately narrow contradiction guards, not a semantic food
// verifier. Scope opposite forms to the component's ingredient: crumbled feta
// beside turkey meatballs must not be treated as crumbled turkey.
export function validateDishForms(dish: DishContract, instructions: string): string[] {
  const errors: string[] = [];
  for (const component of dish.components) {
    const form = component.form.toLowerCase();
    for (const ingredient of component.ingredientNames) {
      const noun = ingredientNoun(ingredient);
      if (!noun) continue;
      const subject = `(?:the\\s+)?(?:ground\\s+|minced\\s+)?${noun}`;
      let opposite: RegExp | null = null;
      if (/\b(?:meatballs?|balls?|patties|patty)\b/.test(form)) {
        // Crumbling the promised ingredient instead of forming it is the
        // specific regression this pipeline previously produced.
        opposite = new RegExp(`\\b(?:crumble|crumbling|crumbled)\\s+${subject}\\b|\\b${subject}\\s+(?:into|as)\\s+(?:fine\\s+)?crumbles\\b|\\b(?:brown|cook|fry|sauté|saute)\\s+${subject}\\b(?:\\s+in\\s+(?:a|the)\\s+(?:hot\\s+)?(?:skillet|pan))?\\s*(?:,\\s*|\\s+(?:while|and)\\s+)break(?:ing)?\\s+(?:it|the\\s+meat)\\s+up\\b`, "i");
      } else if (/\b(?:crumbles?|crumbled|mince)\b/.test(form)) {
        opposite = new RegExp(`\\b(?:form|shape|roll)\\s+${subject}\\s+into\\s+(?:small\\s+|round\\s+)?(?:meatballs?|balls?|patties)\\b|\\bserve\\s+${subject}\\s+as\\s+(?:whole\\s+)?(?:fillets?|steaks?)\\b`, "i");
      } else if (/\b(?:flaked|shredded)\b/.test(form)) {
        // Searing a fillet before flaking is legitimate. Only an explicit
        // instruction to serve it whole contradicts this finished form.
        opposite = new RegExp(`\\bserve\\s+${subject}\\s+(?:as\\s+)?(?:a\\s+|an\\s+)?whole\\s+(?:fillets?|steaks?|pieces?)\\b`, "i");
      }
      const contradicts = opposite && [...instructions.matchAll(new RegExp(opposite.source, "ig"))].some(match => {
        const prefix = instructions.slice(Math.max(0, (match.index ?? 0) - 20), match.index);
        return !/\b(?:do not|don't|never|not)\s*$/i.test(prefix);
      });
      if (contradicts) {
        errors.push(`Preserve the finished form of ${ingredient}: ${component.form}; do not replace it with an explicitly different form.`);
      }
    }
  }
  return [...new Set(errors)];
}

export function validateDishContract(
  value: unknown,
  ingredientNames: string[],
  steps?: string[],
): string[] {
  const result = DishContractSchema.safeParse(value);
  if (!result.success) return ["Use a valid version-1 dish contract with bounded, nonempty culinary components and plating."];
  const names = new Set(ingredientNames.map(name => name.trim()));
  const errors: string[] = [];
  for (const component of result.data.components) {
    for (const name of component.ingredientNames) {
      if (!names.has(name)) errors.push(`Dish component must reference a listed proposal ingredient exactly: ${name}.`);
    }
  }
  if (steps) errors.push(...validateDishForms(result.data, steps.join(". ")));
  return [...new Set(errors)];
}
