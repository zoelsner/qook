// Pull the ingredient names out of the stored ingredient_groups jsonb.
// Defensive: the column is untyped at this boundary, and older rows may
// predate the current shape. Names only — the item strings already carry
// the form words that matter ("ground beef", "canned tuna").
function ingredientNames(groups: unknown, max = 12): string[] {
  if (!Array.isArray(groups)) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    const items = (group as { items?: unknown })?.items;
    if (!Array.isArray(items)) continue;
    for (const entry of items) {
      const item = (entry as { item?: unknown })?.item;
      if (typeof item !== "string") continue;
      const name = item.trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      names.push(name);
      if (names.length >= max) return names;
    }
  }
  return names;
}

// Step instructions out of the stored workflow_sections jsonb — same
// defensive posture as ingredientNames.
function stepInstructions(sections: unknown, max = 10): string[] {
  if (!Array.isArray(sections)) return [];
  const out: string[] = [];
  for (const section of sections) {
    const steps = (section as { steps?: unknown })?.steps;
    if (!Array.isArray(steps)) continue;
    for (const step of steps) {
      const instruction = (step as { instruction?: unknown })?.instruction;
      if (typeof instruction !== "string" || !instruction.trim()) continue;
      out.push(instruction.trim());
      if (out.length >= max) return out;
    }
  }
  return out;
}

// Describe-then-paint, v2 (2026-07-28). Two changes over the 2026-07-13 version:
//  1. Structured output — `components` is the faithfulness contract (the image
//     model is told each one must be individually visible in that exact form),
//     `plating` is the arrangement. The old free prose re-specified composition
//     ("mounded in the center of the plate") and cancelled the image prompt's
//     crop rules.
//  2. Skeleton fallback — art fires at deal time on a `content_status:'proposal'`
//     row whose ingredient_groups/workflow_sections are still '[]'. The names and
//     steps DO exist, in proposal_ingredients/proposal_steps. Without this the
//     model was describing a dish it only knew the title of.
export type PlateSpec = { components: string[]; plating: string };

export const PlateSpecJsonSchema = {
  name: "PlateSpec",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["components", "plating"],
    properties: {
      components: { type: "array", items: { type: "string" } },
      plating: { type: "string" },
    },
  },
} as const;

function strings(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, max);
}

export function buildPlateDescriptionRequest(recipe: {
  title: string;
  ingredientGroups?: unknown;
  workflowSections?: unknown;
  proposalIngredients?: unknown;
  proposalSteps?: unknown;
}): string {
  const fromGroups = ingredientNames(recipe.ingredientGroups);
  const fromSections = stepInstructions(recipe.workflowSections);
  const names = fromGroups.length ? fromGroups : strings(recipe.proposalIngredients, 12);
  const steps = fromSections.length ? fromSections : strings(recipe.proposalSteps, 10);
  return [
    `You are a food stylist briefing a watercolour illustrator who has never seen this dish.`,
    `Return JSON only.`,
    ``,
    `\`components\`: 3 to 5 strings. One per thing that is actually visible on the plate, most prominent first.`,
    `Each string names the component AND the exact cooked form and colour, in pigment words — "six round browned turkey meatballs, crusted deep amber", "jade-green beans, blistered at the tips", "a glossy mahogany pan sauce pooling underneath".`,
    `Honesty: meatballs stay round balls, mince stays crumbled, flaked fish stays flaked, a stew stays saucy. Never upgrade a humble form to a fancier one, never invent a component the recipe does not have, never merge two components into one.`,
    ``,
    `\`plating\`: ONE sentence describing how those components sit together — asymmetric and hand-piled, something spilling or tucked or spooned over something else, garnish landing off-centre. Never a tidy grid, ring, or even scatter.`,
    ``,
    `Forbidden everywhere: any mention of a plate, bowl, table, surface, wood, linen, board, background, cutlery, cookware, packaging, brands, lighting, camera, portion counts for the eater, or cooking instructions. Food only.`,
    ``,
    `Dish: ${recipe.title}`,
    names.length ? `Ingredients: ${names.join(", ")}` : ``,
    steps.length ? `Method: ${steps.join(" ")}` : ``,
  ]
    .filter((line, i, all) => line !== "" || (i > 0 && all[i - 1] !== ""))
    .join("\n");
}

// v5 prompt (2026-07-28 eval). Three structural changes over v3:
//  - a COMPONENTS contract (faithfulness): named forms the model may not merge,
//    substitute or omit. Fixes "meatballs painted as crumbles".
//  - an explicit override line after the free-text plating note, so a stray
//    "in the center of the plate" cannot cancel the COMPOSITION rules.
//  - GROUND is now a positive spec (cream paper + corner washes + splatter) plus
//    a hard negative list. The old prompt never said "no wooden surface", and the
//    canon reference is a picture of a plate on wooden planks.
export function buildImagePrompt(
  recipe: {
    title: string;
    ingredientGroups?: unknown;
    proposalIngredients?: unknown;
    plateSpec?: PlateSpec | null;
  },
): string {
  const plating = recipe.plateSpec?.plating?.trim();
  const components = (recipe.plateSpec?.components ?? [])
    .map((c) => String(c).trim())
    .filter(Boolean);
  const fromGroups = ingredientNames(recipe.ingredientGroups);
  const names = components.length
    ? []
    : (fromGroups.length ? fromGroups : strings(recipe.proposalIngredients, 12));
  return [
    `Hand-painted watercolour-and-ink illustration for an editorial cookbook: ${recipe.title}.`,
    ...(plating ? [`The finished dish, as plated: ${plating}`] : []),
    ...(components.length
      ? [
        `EVERY ONE of these components must be individually visible and painted in exactly this form — ${
          components.join("; ")
        }. Do not substitute, merge or omit any of them, and never upgrade a humble form to a fancier one.`,
      ]
      : []),
    ...(names.length
      ? [
        `The dish is made of: ${names.join(", ")}.`,
        `Depict each ingredient in its actual prepared form — flaked fish stays flaked, ground meat stays crumbled; never upgrade an ingredient to steaks, fillets or whole cuts.`,
      ]
      : []),
    `Ignore any plate, bowl, surface, background or camera angle implied above — the rules below override it.`,
    `COMPOSITION: straight overhead, 90 degrees. One generous serving in a single shallow cream stoneware bowl. The bowl is huge: it fills about 85% of the square and its rim is cut off by at least one edge of the frame. Food mounds high and spills toward the rim.`,
    `ARRANGEMENT: loose and hand-piled — never a grid, never evenly spaced, never symmetrical, never a repeating pattern. Pieces overlap, clump and lean at different angles; a few sit proud of the pile; garnish lands scattered and off-centre; sauce pools unevenly and runs into the low spots.`,
    `COLOUR: deep, saturated, jewel-toned, high contrast. Sauces are lacquered mahogany, burnt amber or deep chilli red with near-black pools in the shadows and hard white gloss highlights on top. Greens are vivid jade and emerald, not olive. Grains and starches are bright warm white. NEVER muted, dusty, grey, beige, khaki or washed out.`,
    `LINE: fine dark ink outline around every element, layered translucent washes inside, wet-on-wet bleed at the edges, crisp drawn texture on each ingredient (individual rice grains, broccoli florets stippled, meat fibres drawn).`,
    `GROUND: bare cream watercolour paper with visible tooth. Two or three loose sage-green and rust-orange watercolour washes bleed in from the corners behind the bowl, plus a scatter of ink splatter dots. ABSOLUTELY NO table, no wooden surface, no planks, no wood grain, no cloth, no linen, no board, no placemat, no cutlery, no props, no raw ingredients outside the bowl, no printed border, no white matte frame.`,
    `No text, no signature, no watermark, no people, no hands.`,
    `Square 1:1, full bleed: the paper and its washes run right to all four edges.`,
    `Match the artist's hand of the reference image — its palette, ink line, wash technique and paper — but do not copy its subject, its dish or its layout.`,
  ].join(" ");
}
