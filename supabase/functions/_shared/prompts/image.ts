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
