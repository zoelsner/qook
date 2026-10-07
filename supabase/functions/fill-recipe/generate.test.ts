import {
  assert,
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { generateConsistentFill } from "./generate.ts";
import { contract, mismatch, validRecipe } from "./fixtures.ts";
import { buildLiveContext } from "../_shared/context.ts";
import {
  dbRowToClientRecipe,
  toFillUpdate,
  toSkeletonInsert,
} from "../_shared/recipe-map.ts";
import { firstCacheHitId } from "../generate-proposals/cache.ts";
import { storedRecipe } from "./fixtures.ts";

Deno.test("observed failure is corrected once; accepted card servings survive preference changes", async () => {
  let calls = 0;
  const ctx = buildLiveContext(contract.tier, { household_size: 4 }, undefined);
  const result = await generateConsistentFill(
    contract,
    ctx,
    null,
    async (opts) => {
      calls++;
      const prompt = opts.messages[1].content;
      assert(prompt.includes("Serves: 2."));
      assert(!prompt.includes("Available tools: stovetop"));
      assertEquals(opts.maxRetries, 0);
      if (calls === 2) {
        assert(
          prompt.includes("Preserve the promised microwave"),
        );
      }
      return JSON.stringify(calls === 1 ? mismatch : validRecipe());
    },
  );
  assertEquals(calls, 2);
  assertEquals(result.servings, 2);
});
Deno.test("repeated inconsistency fails closed after two attempts without returning bad instructions", async () => {
  let calls = 0;
  await assertRejects(
    () =>
      generateConsistentFill(
        contract,
        buildLiveContext(contract.tier, null, undefined),
        null,
        () => {
          calls++;
          return Promise.resolve(JSON.stringify(mismatch));
        },
      ),
    Error,
    "did not match",
  );
  assertEquals(calls, 2);
});
Deno.test("malformed JSON gets one correction; transport failure does not trigger another paid attempt", async () => {
  let calls = 0;
  await generateConsistentFill(
    contract,
    buildLiveContext(contract.tier, null, undefined),
    null,
    () => {
      return Promise.resolve(
        ++calls === 1 ? "not json" : JSON.stringify(validRecipe()),
      );
    },
  );
  assertEquals(calls, 2);
  calls = 0;
  await assertRejects(
    () =>
      generateConsistentFill(
        contract,
        buildLiveContext(contract.tier, null, undefined),
        null,
        () => {
          calls++;
          return Promise.reject(new Error("network"));
        },
      ),
    Error,
    "network",
  );
  assertEquals(calls, 1);
});
Deno.test("proposal to corrected fill to persisted row to rendered step data preserves microwave method", async () => {
  const result = await generateConsistentFill(
    contract,
    buildLiveContext(contract.tier, null, undefined),
    null,
    () => Promise.resolve(JSON.stringify(validRecipe())),
  );
  const skeleton = toSkeletonInsert(
    {
      title: contract.title,
      cuisine: "Middle Eastern",
      timeMinutes: 12,
      proteinG: 17,
      hook: "Eggs",
      ingredientNames: contract.ingredients,
      stepOutline: contract.steps,
    },
    contract.tier,
    2,
  );
  const row = {
    ...skeleton,
    ...toFillUpdate(result, "test-signature"),
    id: "test-id",
    created_at: "2026-10-03T00:00:00Z",
    updated_at: "2026-10-03T00:00:00Z",
  };
  const client = dbRowToClientRecipe(row, []);
  const rendered = client.steps.flatMap((s) =>
    s.steps.map((step) => step.instruction)
  ).join(" ");
  assert(rendered.includes("Microwave until bubbling"));
  assert(!/skillet|stovetop/.test(rendered));
  assertEquals(client.contentStatus, "full");
  assertEquals(
    firstCacheHitId([storedRecipe(mismatch), row], contract),
    "test-id",
  );
});

Deno.test("schema correction identifies the notes field and its bound", async () => {
  let calls = 0;
  await generateConsistentFill(contract, buildLiveContext(contract.tier, null, undefined), null, opts => {
    calls++;
    if (calls === 2) { assert(opts.messages[1].content.includes('notes:')); assert(opts.messages[1].content.includes('300')); }
    const r = validRecipe(); if (calls === 1) r.notes = 'x'.repeat(301);
    return Promise.resolve(JSON.stringify(r));
  });
  assertEquals(calls, 2);
});
