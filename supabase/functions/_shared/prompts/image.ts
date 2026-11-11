import type { DishContract } from "../dish-contract.ts";

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

// The proposal's saved dish identity is shared with recipe completion. Legacy
// rows use their existing ingredients and cooking method directly; no text
// model is needed to prepare an image prompt.
function strings(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string")
    .map((x) => x.trim()).filter(Boolean).slice(0, max);
}

// Canon style prompt with the saved dish contract authoritative over color/form.
// The v5 composition (2026-07-28 eval) remains unchanged:
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
    workflowSections?: unknown;
    proposalSteps?: unknown;
    dishContract?: DishContract | null;
  },
): string {
  const plating = recipe.dishContract?.plating;
  const components = recipe.dishContract?.components ?? [];
  const fromGroups = ingredientNames(recipe.ingredientGroups);
  const names = fromGroups.length ? fromGroups : strings(recipe.proposalIngredients, 12);
  const fromSections = stepInstructions(recipe.workflowSections);
  const steps = fromSections.length ? fromSections : strings(recipe.proposalSteps, 10);
  return [
    `Hand-painted watercolour-and-ink illustration for an editorial cookbook: ${recipe.title}.`,
    ...(plating ? [`The finished dish, as plated: ${plating}`] : []),
    ...(components.length
      ? [
        `EVERY ONE of these components must be individually visible and painted in exactly this form — ${
          components.map(c => `${c.form}: ${c.appearance} (made from ${c.ingredientNames.join(", ")})`).join("; ")
        }. Do not substitute, merge or omit any of them, and never upgrade a humble form to a fancier one.`,
      ]
      : []),
    ...(!components.length && names.length
      ? [
        `The dish is made of: ${names.join(", ")}.`,
        `Preserve the ingredient's identity and use the cooking method to determine its final form; never turn ground meat or canned fish into steaks, fillets or whole cuts.`,
      ]
      : []),
    ...(!components.length && steps.length
      ? [`Cooking method (use this to determine finished forms): ${steps.join(" ")}`]
      : []),
    `The saved component identities, forms and colors above are authoritative. The style directions below describe how to paint them; never use the palette to recolor an ingredient or substitute a component.`,
    `Ignore any plate, bowl, surface, background or camera angle implied above — the rules below override it.`,
    `COMPOSITION: straight overhead, 90 degrees. One generous serving in a single shallow cream stoneware bowl. The bowl is huge: it fills about 85% of the square and its rim is cut off by at least one edge of the frame. Food mounds high and spills toward the rim.`,
    `ARRANGEMENT: loose and hand-piled — never a grid, never evenly spaced, never symmetrical, never a repeating pattern. Pieces overlap, clump and lean at different angles; a few sit proud of the pile; garnish lands scattered and off-centre; sauce pools unevenly and runs into the low spots.`,
    `COLOUR: deep, saturated, jewel-toned watercolor accents and high contrast, with natural food colors. The saved component description determines each ingredient's color. Black rice stays black, tomato-stained grains stay red, and naturally white grains stay warm white. Sauces retain their actual color, including white yogurt; show gloss only where the food is glossy. Browned crusts can have rich amber highlights and deep shadows. Avoid a uniformly dusty or washed-out rendering; retain every specified natural ingredient color, including beige legumes, grey fish skin and olive-green olives.`,
    `LINE: fine dark ink outline around every element, layered translucent washes inside, wet-on-wet bleed at the edges, crisp drawn texture on each ingredient (individual rice grains, broccoli florets stippled, meat fibres drawn).`,
    `GROUND: bare cream watercolour paper with visible tooth. Two or three loose sage-green and rust-orange watercolour washes bleed in from the corners behind the bowl, plus a scatter of ink splatter dots. ABSOLUTELY NO table, no wooden surface, no planks, no wood grain, no cloth, no linen, no board, no placemat, no cutlery, no props, no raw ingredients outside the bowl, no printed border, no white matte frame.`,
    `No text, no signature, no watermark, no people, no hands.`,
    `Square 1:1, full bleed: the paper and its washes run right to all four edges.`,
    `Match the artist's hand of the reference image — its palette, ink line, wash technique and paper — but do not copy its subject, its dish or its layout.`,
  ].join(" ");
}
