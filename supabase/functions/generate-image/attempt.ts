export type ImageClaim =
  | "claimed"
  | "skip"
  | "exhausted"
  | "daily_limit"
  | "not_found";

// The database atomically checks the user's rolling daily budget and the
// recipe's retry counter before recording either. Never fall back to a local
// counter-only claim if the migration/RPC is unavailable.
// deno-lint-ignore no-explicit-any
export async function claimImageAttempt(
  admin: any,
  recipeId: string,
  userId: string,
): Promise<ImageClaim> {
  const { data, error } = await admin.rpc("claim_image_attempt", {
    p_user_id: userId,
    p_recipe_id: recipeId,
  });
  if (error) throw error;
  if (
    data !== "claimed" && data !== "skip" && data !== "exhausted" &&
    data !== "daily_limit" && data !== "not_found"
  ) {
    throw new Error("Invalid image claim response");
  }
  return data;
}
