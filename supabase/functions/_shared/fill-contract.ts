import { ingredientConstraintErrors, type DinnerBrief } from "./dinner-brief.ts";
import { Recipe } from "./schema.ts";
import { TIER_RULES, type TierKey } from "./tiers.ts";

export type FillContract = {
  title: string;
  tier: TierKey;
  servings: number;
  maxMinutes: number;
  ingredients: string[];
  steps: string[];
  brief?: DinnerBrief;
};

// Persisted proposal fields are the contract, not today's mutable preferences.
export function contractFromRow(row: Record<string, unknown>, brief?: DinnerBrief): FillContract {
  const tier = row.energy_tier as TierKey;
  if (!TIER_RULES[tier]) throw new Error("Unknown proposal tier");
  if (
    !Number.isInteger(row.serves) || Number(row.serves) < 1 ||
    Number(row.serves) > 12 ||
    !Number.isFinite(row.total_time_min) || Number(row.total_time_min) <= 0
  ) {
    throw new Error("Invalid proposal servings or time");
  }
  return {
    ...(brief ? { brief } : {}),
    title: String(row.title),
    tier,
    servings: Number(row.serves),
    maxMinutes: Math.min(
      Number(row.total_time_min),
      TIER_RULES[tier].maxMinutes,
      brief?.maxMinutes ?? Infinity,
    ),
    ingredients: Array.isArray(row.proposal_ingredients)
      ? row.proposal_ingredients.map(String)
      : [],
    steps: Array.isArray(row.proposal_steps)
      ? row.proposal_steps.map(String)
      : [],
  };
}

// These guards cover explicit appliance promises; they are not a culinary or
// food-safety verifier. A microwave-safe bowl alone does not count as microwaving.
const METHOD_PATTERNS: Record<string, RegExp> = {
  microwave: /\bmicrowav(?:e(?![- ]safe)|es|ed|ing)\b/i,
  oven: /\boven\b|\b(?:bake|baking|roast|roasting|broil|broiling)\b/i,
  stovetop:
    /\b(?:skillet|saucepan|wok|stovetop|burner)\b|\b(?:pan[- ]fry|stir[- ]fry|saute|sauté|sear)\b|\b(?:medium|low|high)[- ](?:low[- ]|high[- ])?heat\b/i,
  toaster: /\btoaster\b/i,
  kettle: /\bkettle\b/i,
  airFryer: /\bair[- ]fry(?:er|ing)?\b/i,
  grill: /\bgrill(?:ing|ed)?\b/i,
  slowCooker: /\bslow[- ]cook(?:er|ing)\b|\bcrock[- ]?pot\b/i,
  pressureCooker: /\bpressure[- ]cook(?:er|ing)?\b|\binstant pot\b/i,
};

function methods(text: string): string[] {
  // Ignore explicit prohibitions rather than interpreting "do not use oven"
  // as a requirement. Instructions should state what to do, not alternatives.
  const positive = text.replace(/\b(?:do not|don't|never|no need to|without|no)\s+(?:(?:use|using|add|adding|need|needing|require|requiring)\s+)?(?:an?\s+|the\s+)?(?:microwave|oven|skillet|stovetop|toaster|air fryer|grill|slow cooker|pressure cooker|bake|roast|sear)\b/gi, "");
  return Object.entries(METHOD_PATTERNS).filter(([, re]) => re.test(positive))
    .map(([name]) => name);
}

function words(name: string): string[] {
  return name.toLowerCase().replace(/green onions?/g, "scallion").replace(
    /spring onions?/g,
    "scallion",
  )
    .replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean).map((w) =>
      w.endsWith("s") ? w.slice(0, -1) : w
    );
}

export function validateFillContract(
  recipe: Recipe,
  contract: FillContract,
): string[] {
  const errors: string[] = [];
  const rule = TIER_RULES[contract.tier];
  if (recipe.title !== contract.title) {
    errors.push("Keep the exact proposal title.");
  }
  if (recipe.tier !== contract.tier) {
    errors.push("Keep the proposal energy tier.");
  }
  if (recipe.servings !== contract.servings) {
    errors.push(`Keep the proposal's ${contract.servings} servings.`);
  }
  if (
    !Number.isFinite(contract.maxMinutes) ||
    recipe.timeMinutes > contract.maxMinutes
  ) {
    errors.push(
      `Total time including preparation and resting must not exceed the promised ${contract.maxMinutes} minutes.`,
    );
  }
  if (
    recipe.workflowSections.length > rule.sectionsMax ||
    recipe.workflowSections.some((s) =>
      s.steps.length > rule.stepsPerSectionMax
    )
  ) {
    errors.push(
      `Use at most ${rule.sectionsMax} sections and ${rule.stepsPerSectionMax} steps per section for this effort tier.`,
    );
  }
  const instructions = recipe.workflowSections.flatMap((s) =>
    s.steps.map((step) => step.instruction)
  ).join(". ");
  if (
    recipe.workflowSections.some((s) =>
      s.steps.some((step) => step.durationMin > recipe.timeMinutes)
    )
  ) {
    errors.push("A single step cannot take longer than the entire recipe.");
  }
  const stepMinutes = recipe.workflowSections.flatMap((s) => s.steps).reduce(
    (sum, s) => sum + s.durationMin,
    0,
  );
  if (
    stepMinutes > recipe.timeMinutes &&
    !/\b(?:meanwhile|while .{1,60}(?:cooks?|cooking|bakes?|baking|simmers?|simmering)|simultaneously|in parallel|at the same time)\b/i
      .test(instructions)
  ) {
    errors.push(
      "Sequential step durations exceed the total time; include all elapsed time or explicitly describe feasible overlapping work.",
    );
  }
  const promised = methods(`${contract.title}. ${contract.steps.join(". ")}`);
  const actual = methods(instructions);
  for (const method of promised) {
    if (!actual.includes(method)) {
      errors.push(
        `Preserve the promised ${method} method in the actual instructions.`,
      );
    }
  }
  if (promised.length) {
    for (const method of actual) {
      if (!promised.includes(method)) {
        errors.push(
          `Do not add ${method}; it was not part of the proposal's equipment/method.`,
        );
      }
    }
  }
  if (
    /\bno[- ]cook\b/i.test(contract.title + " " + contract.steps.join(" ")) &&
    actual.length
  ) {
    errors.push("This is a no-cook proposal; do not add a cooking appliance.");
  }
  if (contract.tier === "brain-is-fried") {
    const vessels = new Set<string>();
    if (
      /\b(?:skillet|frying pan|saute pan|sauté pan|wok)\b/i.test(instructions)
    ) vessels.add("pan");
    if (/\b(?:saucepan|pot)\b/i.test(instructions)) vessels.add("pot");
    if (/\b(?:sheet pan|baking (?:sheet|tray|dish))\b/i.test(instructions)) {
      vessels.add("tray");
    }
    if (
      vessels.size > 1 ||
      /\b(?:second|another|separate|additional) (?:dry )?(?:skillet|pan|pot|saucepan)\b/i
        .test(instructions)
    ) {
      errors.push(
        "This effort tier allows only one cooking vessel; do not add a second pan for a side.",
      );
    }
  }
  const items = recipe.ingredientGroups.flatMap((g) => g.items);
  for (const item of items) {
    // These volume units have no representation in the structured grammar.
    // Preserve the display quantity rather than silently relabeling it as l.
    if (/\b(?:qts?|quarts?|pts?|pints?|gallons?)\b/i.test(item.quantity ?? "") &&
      (item.parsed.amount !== null || item.parsed.unit !== null)) {
      errors.push(`Keep ${item.quantity} as display text with parsed.amount and parsed.unit null; its volume unit is outside the supported grammar. Do not relabel quarts/pints/gallons as litres.`);
    }
  }
  if (contract.brief) {
    errors.push(...contract.brief.conflicts);
    errors.push(...ingredientConstraintErrors(items.map(i => `${i.item} ${i.parsed.canonical_name}`), contract.brief));
    for (const method of actual) {
      if (contract.brief.onlyMethods.length && !contract.brief.onlyMethods.includes(method)) errors.push(`The saved dinner brief permits only ${contract.brief.onlyMethods.join(", ")}; do not add ${method}.`);
    }
    if (contract.brief.maxMinutes && recipe.timeMinutes > contract.brief.maxMinutes) errors.push(`Keep the saved ${contract.brief.maxMinutes}-minute dinner limit.`);
  }
  // Directly observed while rechecking the microwave-egg fix: the generator
  // preserved the appliance but told the cook to leave yolks intact. This is
  // a narrow guard, not general food-safety validation. Technique reference:
  // https://eggs.ca/recipes/basic-microwaved-eggs/
  if (actual.includes("microwave") && items.some(i => /^eggs?$/.test(i.parsed.canonical_name.toLowerCase()))) {
    const prepAndMethod = items.map(i => i.notes ?? "").join(". ") + ". " + instructions;
    const whisked = /\b(?:whisk|beat|beaten|scramble)\b/i.test(prepAndMethod);
    const pierced = /\b(?:pierce|puncture|prick)\b[^.]{0,100}\byolks?\b[^.]{0,60}\bwhites?\b/i.test(prepAndMethod);
    if (!whisked && !pierced) errors.push("Before microwaving unwhisked eggs, explicitly pierce the yolks and whites; do not leave them intact.");
  }
  if (
    contract.tier === "brain-is-fried" &&
    new Set(items.map((i) => i.parsed.canonical_key)).size > 6
  ) {
    errors.push(
      "This effort tier allows at most six distinct ingredients, including pantry additions.",
    );
  }
  // Quantities/prep may be added, but the named components cannot disappear.
  // Compare both grocery name and displayed form; retain meaningful words like
  // cooked/frozen when present rather than silently swapping pantry shortcuts.
  for (const name of contract.ingredients) {
    const expected = words(name).filter((w) =>
      !["jarred", "canned", "fresh", "large", "baby"].includes(w)
    );
    if (
      !items.some((i) => {
        const actualWords = words(
          `${i.item} ${i.parsed.canonical_name} ${i.notes ?? ""}`,
        );
        return expected.every((w) => actualWords.includes(w));
      })
    ) {
      errors.push(
        `Retain the promised ingredient and preparation form: ${name}.`,
      );
    }
  }
  return errors;
}

export function validateProposalBrief(contract: FillContract): string[] {
  const errors: string[] = [];
  if (contract.tier === "brain-is-fried" && new Set(contract.ingredients.map(name => name.trim().toLowerCase())).size > 6) {
    errors.push("The 15-minute card must include at most six ingredients, including pantry additions.");
  }
  if (!contract.brief) return errors;
  errors.push(...contract.brief.conflicts, ...ingredientConstraintErrors(contract.ingredients, contract.brief));
  if (contract.brief.maxMinutes && contract.maxMinutes > contract.brief.maxMinutes) errors.push("Preserve the dinner time limit.");
  if (contract.brief.onlyMethods.length) {
    for (const method of methods(contract.steps.join(". "))) {
      if (!contract.brief.onlyMethods.includes(method)) errors.push(`The dinner brief does not permit ${method}.`);
    }
  }
  return errors;
}

export function recipeFromStoredRow(
  row: Record<string, unknown>,
): Recipe | null {
  const result = Recipe.safeParse({
    title: row.title,
    cuisine: row.cuisine,
    tier: row.energy_tier,
    servings: row.serves,
    timeMinutes: row.total_time_min,
    ingredientGroups: row.ingredient_groups,
    workflowSections: row.workflow_sections,
    nutrition: row.nutrition,
    tags: row.tags ?? [],
    notes: row.notes,
  });
  return result.success ? result.data : null;
}

// Exact proposal provenance is required for cache reuse. Title/ingredient-only
// signatures cannot distinguish microwave from stovetop recipes or equipment.
export function compatibleCachedRecipe(
  row: Record<string, unknown>,
  contract: FillContract,
): boolean {
  const recipe = recipeFromStoredRow(row);
  return row.content_status === "full" && recipe !== null &&
    JSON.stringify(row.proposal_ingredients) ===
      JSON.stringify(contract.ingredients) &&
    JSON.stringify(row.proposal_steps) === JSON.stringify(contract.steps) &&
    validateFillContract(recipe, contract).length === 0;
}

export async function fillSignature(
  recipe: Recipe,
  contract: FillContract,
): Promise<string> {
  // Scope fill dedup to this version of the contract and the actual method.
  // No migration or change to the legacy/client signature contract is needed.
  const bytes = new TextEncoder().encode(
    JSON.stringify({ version: "fill-contract-v2", contract, recipe }),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}
