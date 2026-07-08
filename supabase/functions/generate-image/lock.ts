// Cost-control double-spend guard. The conditional UPDATE ... WHERE
// image_status = 'pending' is atomic in Postgres: exactly one caller flips a
// given recipe out of 'pending', so only that caller pays for generation.
// This maps the update's returned rows to a control decision. Kept in its own
// module (no Deno.serve, no npm imports) so it unit-tests under `deno test`
// without --allow-net.
export function lockOutcome(
  updatedRows: { id: string }[] | null,
): "claimed" | "skip" {
  return updatedRows && updatedRows.length > 0 ? "claimed" : "skip";
}
