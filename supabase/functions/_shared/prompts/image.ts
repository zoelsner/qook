export function buildImagePrompt(
  recipe: { title: string; ingredientGroups?: unknown },
): string {
  return [
    `Hand-painted watercolor illustration, editorial cookbook style, of ${recipe.title}.`,
    // Regen round (2026-07-08): first-round art read as a tiny plate lost on
    // a table — unreadable at thumbnail size and inside circular crops. The
    // dish must dominate the frame.
    `Composition: overhead view, one generous serving on a single plate, and the plate nearly fills the square canvas, touching the edges of the frame.`,
    `The food is the hero: large, identifiable at a glance even at thumbnail size.`,
    // Bake-off (2026-07-11): flash-lite-image follows instructions better and
    // is 2x cheaper / 3x faster than flash, but reads muted on the base
    // prompt. These two lines close the color/detail gap (verified against
    // the gold-standard turkey-lettuce-wraps hero, artifact bf3e857c).
    `Deep, saturated, jewel-toned color with strong tonal contrast: glossy highlights, rich wet-on-wet pigment — never muted, never dusty, never washed out.`,
    `Intricate, finely detailed brushwork: crisp texture on every ingredient, layered washes.`,
    `No props, no cutlery, no table setting, nothing outside the plate.`,
    `Soft cream paper visible only at the extreme corners. Restrained sage and rust watercolor accents, prussian blue for shadow only, used sparingly. Visible paper texture; light brush-stroke edges.`,
    `No text, no signature, no watermark, no people, no hands.`,
    `Square 1:1 aspect ratio.`,
    // style-reference directive (spec §3 step 2)
    `Match this artist's hand, do not copy subject or composition.`,
  ].join(" ");
}
