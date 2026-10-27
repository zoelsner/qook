// Interpret the conditional image-attempt UPDATE result. The caller supplies
// both eligible statuses and the observed attempt counter to the atomic claim.
// This maps the update's returned rows to a control decision. Kept in its own
// module (no Deno.serve, no npm imports) so it unit-tests under `deno test`
// without --allow-net.
export function lockOutcome(
  updatedRows: { id: string }[] | null,
): "claimed" | "skip" {
  return updatedRows && updatedRows.length > 0 ? "claimed" : "skip";
}
