import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  compatibleCachedRecipe,
  fillSignature,
  validateFillContract,
} from "./fill-contract.ts";
import {
  contract,
  mismatch,
  storedRecipe,
  validRecipe,
} from "../fill-recipe/fixtures.ts";

Deno.test("observed microwave-to-stovetop recipe is rejected, including its time/effort drift", () => {
  const issues = validateFillContract(mismatch, contract).join(" ");
  assert(issues.includes("microwave"));
  assert(issues.includes("stovetop"));
  assert(issues.includes("12 minutes"));
  assert(issues.includes("sections"));
});
Deno.test("faithful microwave expansion is accepted", () => {
  assertEquals(validateFillContract(validRecipe(), contract), []);
});
Deno.test("microwave-safe equipment words cannot substitute for actual microwave steps", () => {
  const r = validRecipe();
  r.workflowSections = [{
    title: "Cook",
    objective: "Finish",
    steps: [{
      instruction:
        "Place eggs and sauce in a microwave-safe bowl. Cook until set.",
      durationMin: 5,
    }],
  }];
  assert(
    validateFillContract(r, contract).some((s) => s.includes("microwave")),
  );
});
Deno.test("same title cannot conceal a second appliance, changed servings, missing ingredients or long steps", () => {
  const r = validRecipe();
  r.servings = 4;
  r.workflowSections[1].steps[1] = {
    instruction: "Bake the flatbread in the oven.",
    durationMin: 20,
  };
  r.ingredientGroups[0].items = r.ingredientGroups[0].items.filter((i) =>
    i.item !== "feta"
  );
  const errors = validateFillContract(r, contract).join(" ");
  for (const expected of ["servings", "oven", "single step", "feta"]) {
    assert(errors.includes(expected));
  }
});
Deno.test("one-pan low-effort contract rejects a separate pan for a side", () => {
  const c = {
    ...contract,
    title: "Skillet Shakshuka Eggs",
    steps: ["Cook eggs in a skillet"],
  };
  const r = { ...validRecipe(), title: c.title };
  r.workflowSections = [{
    title: "Cook",
    objective: "Finish",
    steps: [
      { instruction: "Cook sauce and eggs in a skillet.", durationMin: 6 },
      { instruction: "Warm bread in a second dry skillet.", durationMin: 2 },
    ],
  }];
  assert(
    validateFillContract(r, c).some((s) => s.includes("one cooking vessel")),
  );
});
Deno.test("cache requires original proposal provenance and validates the full method", () => {
  assertEquals(compatibleCachedRecipe(storedRecipe(), contract), true);
  assertEquals(compatibleCachedRecipe(storedRecipe(mismatch), contract), false);
  assertEquals(
    compatibleCachedRecipe({
      ...storedRecipe(),
      proposal_steps: ["Cook in skillet"],
    }, contract),
    false,
  );
  assertEquals(
    compatibleCachedRecipe(
      { ...storedRecipe(), proposal_steps: undefined },
      contract,
    ),
    false,
  );
});
Deno.test("fill signatures distinguish equal titles/ingredients with different methods and serving contracts", async () => {
  const r = validRecipe();
  const a = await fillSignature(r, contract);
  assertEquals(
    a,
    await fillSignature(structuredClone(r), structuredClone(contract)),
  );
  assert(a !== await fillSignature(mismatch, contract));
  assert(a !== await fillSignature(r, { ...contract, servings: 4 }));
});

Deno.test("microwave eggs require preparation rather than intact unpierced yolks", () => {
  const r = validRecipe();
  r.workflowSections[1].steps[0].instruction = "Crack eggs into sauce, keeping yolks intact. Microwave until whites set.";
  assert(validateFillContract(r, contract).some(s => s.includes("pierce the yolks and whites")));
});

Deno.test("sequential durations cannot silently exceed total time", () => {
  const r = validRecipe();
  r.workflowSections[1].steps[0].durationMin = 10;
  assert(validateFillContract(r, contract).some(s => s.includes("Sequential")));
});

Deno.test("synthetic peanut-oil pantry addition is rejected by fill and cache under the saved brief", async () => {
  const { dinnerBrief } = await import('./dinner-brief.ts');
  const { buildLiveContext } = await import('./context.ts');
  const brief = dinnerBrief(buildLiveContext(contract.tier, { avoid_ingredients: ['peanut'] }, 'Peanut allergy.'));
  const r = validRecipe();
  r.ingredientGroups[0].items.push({ item: 'peanut oil', quantity: '1 tsp', notes: null, parsed: { canonical_name: 'peanut oil', canonical_key: 'peanut_oil', amount: 1, unit: 'tsp', category: 'Pantry' } });
  r.workflowSections[1].steps[1].instruction += ' Drizzle with peanut oil.';
  const c = { ...contract, brief };
  assert(validateFillContract(r, c).some(e => e.includes('peanut oil')));
  assertEquals(compatibleCachedRecipe(storedRecipe(r), c), false);
  assertEquals(compatibleCachedRecipe(storedRecipe(), c), true);
});
Deno.test("method negation is scoped: without burning does not erase a positive skillet", () => {
  const c = { ...contract, title: 'Skillet Shakshuka Eggs', steps: ['Heat sauce in a skillet'] };
  const r = { ...validRecipe(), title: c.title };
  r.workflowSections = [{title: 'Cook', objective: 'Finish', steps: [{ instruction: 'Heat the sauce in a skillet without letting it burn. Add eggs, feta and paprika; serve with flatbread. Do not use an oven.', durationMin: 12 }]}];
  assertEquals(validateFillContract(r, c), []);
  r.workflowSections[0].steps[0].instruction = 'Do not use a skillet. Microwave the eggs after whisking them.';
  assert(validateFillContract(r, c).some(e => e.includes('promised stovetop')));
});

Deno.test("without adding a toaster is a prohibition, not a required method", () => {
  const c = { ...contract, title: 'Skillet Eggs', steps: ['Cook eggs in a skillet', 'Serve bread without adding a toaster'] };
  const r = { ...validRecipe(), title: c.title };
  r.workflowSections = [{ title: 'Cook', objective: 'Finish', steps: [{ instruction: 'Cook sauce, paprika and eggs in a skillet. Add feta and serve flatbread. No oven required.', durationMin: 12 }] }];
  assertEquals(validateFillContract(r, c), []);
});

Deno.test("plural-subject concurrency is recognized without erasing sequential checks", () => {
  const r = validRecipe();
  r.workflowSections[1].steps[0].durationMin = 10;
  r.workflowSections[1].steps[0].instruction += " While the mushrooms cook, prepare the bowls.";
  assert(!validateFillContract(r, contract).some(s => s.includes("Sequential")));
  r.workflowSections[1].steps[0].instruction = "Prepare the bowls, then microwave the eggs after whisking.";
  assert(validateFillContract(r, contract).some(s => s.includes("Sequential")));
});

Deno.test("unsupported volume units cannot be relabeled into structured litre quantities", () => {
  const r = validRecipe();
  r.ingredientGroups[0].items.push({ item: 'water', quantity: '2 qt', notes: null, parsed: { canonical_name: 'water', canonical_key: 'water', amount: 2, unit: 'l', category: 'Other' } });
  assert(validateFillContract(r, contract).some(s => s.includes('volume unit')));
  const item = r.ingredientGroups[0].items.at(-1)!;
  item.parsed.amount = null; item.parsed.unit = null;
  assert(!validateFillContract(r, contract).some(s => s.includes('volume unit')));
});
