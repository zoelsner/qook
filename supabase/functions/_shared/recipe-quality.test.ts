import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildLiveContext } from "./context.ts";
import { dinnerBrief } from "./dinner-brief.ts";
import { compatibleCachedRecipe, validateFillContract, validateProposalBrief } from "./fill-contract.ts";
import { contract, storedRecipe, validRecipe } from "../fill-recipe/fixtures.ts";

Deno.test("quality fixture: seven-ingredient low-effort card fails before cache/persistence, six remains allowed", () => {
  const ingredients = ["tomato", "egg", "feta", "bread", "paprika", "oil", "salt"];
  assert(validateProposalBrief({ ...contract, ingredients }).some(error => error.includes("six ingredients")));
  assertEquals(validateProposalBrief({ ...contract, ingredients: ingredients.slice(0, 6) }), []);
  assertEquals(validateProposalBrief({ ...contract, tier: "after-work", ingredients }), []);
});

Deno.test("quality fixture: literal ingredient exclusion remains private and blocks proposal, fill and saved matching", () => {
  const brief = dinnerBrief(buildLiveContext(contract.tier, null, "No sesame. 12 minutes for two."));
  const original = JSON.stringify(brief), c = { ...contract, brief };
  assert(validateProposalBrief({ ...c, ingredients: [...c.ingredients, "tahini"] }).some(error => error.includes("tahini")));
  const r = validRecipe();
  r.ingredientGroups[0].items.push({item:"tahini",quantity:"1 tsp",notes:null,parsed:{canonical_name:"tahini",canonical_key:"tahini",amount:1,unit:"tsp",category:"Pantry"}});
  r.workflowSections[1].steps[1].instruction += " Add tahini.";
  assert(validateFillContract(r,c).some(error => error.includes("tahini")));
  assertEquals(compatibleCachedRecipe(storedRecipe(r),c),false);
  assertEquals(JSON.stringify(brief),original);
});

Deno.test("quality fixture: ready-cooked ingredient promise cannot become raw preparation in a fill or saved recipe", () => {
  const c = {...contract,ingredients:[...contract.ingredients,"cooked rice"]};
  const r = validRecipe();
  r.ingredientGroups[0].items.push({item:"rice",quantity:"1 cup",notes:null,parsed:{canonical_name:"rice",canonical_key:"rice",amount:1,unit:"cup",category:"Pantry"}});
  r.workflowSections[1].steps[1].instruction += " Add rice.";
  const row = () => ({...storedRecipe(r),proposal_ingredients:c.ingredients});
  assert(validateFillContract(r,c).some(error => error.includes("cooked rice")));
  assertEquals(compatibleCachedRecipe(row(),c),false);
  r.ingredientGroups[0].items.at(-1)!.notes="ready-cooked";
  assertEquals(validateFillContract(r,c),[]);
  assertEquals(compatibleCachedRecipe(row(),c),true);
});

Deno.test("quality fixture: saved matching retains servings, elapsed-time ceiling and proposal provenance", () => {
  const row = storedRecipe();
  assertEquals(compatibleCachedRecipe(row,contract),true);
  assertEquals(compatibleCachedRecipe(row,{...contract,servings:4}),false);
  assertEquals(compatibleCachedRecipe(row,{...contract,maxMinutes:10}),false);
  assertEquals(compatibleCachedRecipe({...row,proposal_steps:["Sear in skillet"]},contract),false);
});
