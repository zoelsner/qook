import { deepStrictEqual, rejects, strictEqual } from "node:assert";
import { claimImageAttempt } from "./attempt.ts";

Deno.test("passes verified user and recipe to atomic RPC, preserves all outcomes", async () => {
  for (
    const result of [
      "claimed",
      "skip",
      "exhausted",
      "daily_limit",
      "not_found",
    ] as const
  ) {
    const admin = {
      rpc: (name: string, args: unknown) => {
        strictEqual(name, "claim_image_attempt");
        deepStrictEqual(args, {
          p_user_id: "verified-user",
          p_recipe_id: "recipe",
        });
        return Promise.resolve({ data: result, error: null });
      },
    };
    strictEqual(
      await claimImageAttempt(admin, "recipe", "verified-user"),
      result,
    );
  }
});
Deno.test("RPC failure never falls back to an unmetered claim", async () => {
  await rejects(
    () =>
      claimImageAttempt(
        {
          rpc: () =>
            Promise.resolve({
              data: null,
              error: new Error("missing migration"),
            }),
        },
        "r",
        "u",
      ),
    /missing migration/,
  );
});
Deno.test("missing or unknown RPC response fails closed", async () => {
  for (const data of [null, undefined, {}, "unexpected"]) {
    await rejects(
      () =>
        claimImageAttempt(
          { rpc: () => Promise.resolve({ data, error: null }) },
          "r",
          "u",
        ),
      /Invalid image claim response/,
    );
  }
});
