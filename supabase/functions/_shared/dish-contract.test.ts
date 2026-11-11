import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  DishContractSchema,
  sameDishContract,
  validateDishContract,
  validateDishForms,
  type DishContract,
} from "./dish-contract.ts";

const meatballs: DishContract = {
  version: 1,
  components: [{ ingredientNames: ["ground turkey"], form: "round turkey meatballs", appearance: "browned amber with a green herb finish" }],
  plating: "Meatballs piled loosely beside the vegetables.",
};

Deno.test("dish identity is bounded, trims whitespace, and never clamps components", () => {
  const parsed = DishContractSchema.parse({ ...meatballs, plating: "  Loosely piled.  " });
  assertEquals(parsed.plating, "Loosely piled.");
  for (const invalid of [
    { ...meatballs, version: 2 },
    { ...meatballs, privateContext: "private" },
    { ...meatballs, components: [] },
    { ...meatballs, components: Array(7).fill(meatballs.components[0]) },
    { ...meatballs, components: [{ ...meatballs.components[0], form: " " }] },
    { ...meatballs, components: [{ ...meatballs.components[0], appearance: "a".repeat(161) }] },
    { ...meatballs, plating: "a".repeat(241) },
  ]) assertEquals(DishContractSchema.safeParse(invalid).success, false);
});

Deno.test("dish references must belong to the normalized proposal ingredient list", () => {
  assertEquals(validateDishContract(meatballs, ["ground turkey", "feta"]), []);
  assert(validateDishContract(meatballs, ["turkey breast"]).some(error => error.includes("ground turkey")));
  assert(validateDishContract({ ...meatballs, components: [{ ...meatballs.components[0], ingredientNames: ["invented sauce"] }] }, ["ground turkey"]).length > 0);
  assert(validateDishContract({ ...meatballs, version: 3 }, ["ground turkey"]).length > 0);
});

Deno.test("cache comparison preserves dish identity and permits only null legacy pairs", () => {
  assertEquals(sameDishContract(null, undefined), true);
  assertEquals(sameDishContract(meatballs, structuredClone(meatballs)), true);
  assertEquals(sameDishContract(meatballs, null), false);
  assertEquals(sameDishContract({ version: 3 }, { version: 3 }), false);
  assertEquals(sameDishContract(meatballs, { ...meatballs, plating: "Serve in a tidy line." }), false);
  assertEquals(sameDishContract(meatballs, { ...meatballs, components: [{ ...meatballs.components[0], form: "turkey crumbles" }] }), false);
});

Deno.test("finished turkey meatballs reject explicit crumbling without banning crumbled feta", () => {
  assertEquals(validateDishForms(meatballs, "Shape the ground turkey into meatballs. Sear until golden and finish with crumbled feta."), []);
  assertEquals(validateDishForms(meatballs, "Crumble the feta over the turkey meatballs."), []);
  assertEquals(validateDishForms(meatballs, "Do not crumble the ground turkey. Shape it into round meatballs instead."), []);
  assertEquals(validateDishForms(meatballs, "Brown the turkey meatballs without breaking them up. Finish with crumbled feta."), []);
  assertEquals(validateDishForms(meatballs, "Brown the ground turkey without breaking it up."), []);
  assertEquals(validateDishForms(meatballs, "Brown the ground turkey, without breaking it up."), []);
  assert(validateDishForms(meatballs, "Crumble the ground turkey into a hot skillet.").length > 0);
  assert(validateDishForms(meatballs, "Brown the ground turkey, breaking it up with a spatula.").length > 0);
  assert(validateDishForms(meatballs, "Cook the ground turkey in a skillet while breaking it up with a spatula.").length > 0);
  assert(validateDishContract(meatballs, ["ground turkey"], ["Crumble the ground turkey into a hot skillet."]).length > 0);
});

Deno.test("flaked fish may start as a fillet and sit beside whole tomatoes", () => {
  const fish: DishContract = { version: 1, components: [{ ingredientNames: ["salmon fillet"], form: "flaked salmon", appearance: "pink flakes" }], plating: "Salmon scattered over rice beside whole tomatoes." };
  assertEquals(validateDishForms(fish, "Sear the salmon fillet, then flake it with a fork. Serve beside whole tomatoes."), []);
  assert(validateDishForms(fish, "Serve the salmon as a whole fillet.").length > 0);
});
