import {
  compatibleCachedRecipe,
  type FillContract,
} from "../_shared/fill-contract.ts";

// A title match alone can silently replace a microwave card with a stovetop
// recipe. Require the same stored proposal plus a valid full recipe contract.
export function firstCacheHitId(
  rows: Record<string, unknown>[] | null,
  contract: FillContract,
): string | null {
  const match = rows?.find((row) => compatibleCachedRecipe(row, contract));
  return match ? String(match.id) : null;
}

// Each title keeps its own five-candidate cap. A global IN/limit query can
// starve a less-popular title. Fetches are read-only and results retain input
// order even when requests finish out of order. A failed read is not a miss.
export async function readProposalCandidates(
  // deno-lint-ignore no-explicit-any
  admin: any,
  titles: string[],
): Promise<Record<string, unknown>[][]> {
  const results = await Promise.all(titles.map((title) =>
    admin
      .from("recipes")
      .select("*")
      .eq("title", title)
      .is("user_id", null)
      .eq("content_status", "full")
      .order("use_count", { ascending: false })
      .limit(5)
  ));
  if (results.some((result) => result.error)) {
    throw new Error("Proposal cache lookup failed");
  }
  return results.map((result) => result.data ?? []);
}
