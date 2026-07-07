import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { toInstacartItem } from "./map.ts";

Deno.test("maps amount + unit", () => {
  assertEquals(
    toInstacartItem({
      name: "olive oil",
      quantityAmount: 2,
      quantityUnit: "tbsp",
      quantityText: "2 tbsp",
    }),
    { name: "olive oil", quantity: 2, unit: "tbsp", display_text: "2 tbsp" },
  );
});

Deno.test("defaults quantity 1 / unit each when unparsed", () => {
  assertEquals(toInstacartItem({ name: "lemon" }), {
    name: "lemon",
    quantity: 1,
    unit: "each",
    display_text: "lemon",
  });
});

Deno.test("count unit becomes each", () => {
  const r = toInstacartItem({ name: "egg", quantityAmount: 3, quantityUnit: "count" });
  assertEquals(r.unit, "each");
  assertEquals(r.quantity, 3);
});
