export type FillClaim = "claimed" | "busy" | "done" | "exhausted" | "not_found";

// The database atomically serializes fills of one recipe and caps attempts.
// Never fall back to an unclaimed fill if the migration/RPC is unavailable.
// deno-lint-ignore no-explicit-any
export async function claimFillAttempt(admin: any, recipeId: string): Promise<FillClaim> {
  const { data, error } = await admin.rpc("claim_fill_attempt", { p_recipe_id: recipeId });
  if (error) throw error;
  if (
    data !== "claimed" && data !== "busy" && data !== "done" &&
    data !== "exhausted" && data !== "not_found"
  ) {
    throw new Error("Invalid fill claim response");
  }
  return data;
}
