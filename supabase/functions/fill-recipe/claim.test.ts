import { deepStrictEqual, rejects, strictEqual } from "node:assert";
import { claimFillAttempt } from "./claim.ts";

Deno.test("passes the recipe to the atomic RPC and preserves all outcomes", async () => {
  for (const result of ["claimed", "busy", "done", "exhausted", "not_found"] as const) {
    const admin = {
      rpc: (name: string, args: unknown) => {
        strictEqual(name, "claim_fill_attempt");
        deepStrictEqual(args, { p_recipe_id: "recipe" });
        return Promise.resolve({ data: result, error: null });
      },
    };
    strictEqual(await claimFillAttempt(admin, "recipe"), result);
  }
});
Deno.test("RPC failure never falls back to an unclaimed fill", async () => {
  await rejects(
    () => claimFillAttempt({ rpc: () => Promise.resolve({ data: null, error: new Error("missing migration") }) }, "r"),
    /missing migration/,
  );
});
Deno.test("missing or unknown RPC response fails closed", async () => {
  for (const data of [null, undefined, {}, "unexpected"]) {
    await rejects(
      () => claimFillAttempt({ rpc: () => Promise.resolve({ data, error: null }) }, "r"),
      /Invalid fill claim response/,
    );
  }
});
