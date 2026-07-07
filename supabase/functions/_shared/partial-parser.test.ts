import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractPartialRecipes, stripCodeFences } from "./partial-parser.ts";

Deno.test("extracts one complete recipe object mid-stream", () => {
  const buf =
    '{"recipes":[{"title":"Pan Noodles","cuisine":"Thai"}, {"title":"Half';
  const out = extractPartialRecipes(buf);
  assertEquals(out.length, 1);
  assertEquals((out[0] as { title: string }).title, "Pan Noodles");
});

Deno.test("stripCodeFences removes markdown fence", () => {
  assertEquals(stripCodeFences('```json\n{"a":1}\n```'), '{"a":1}');
});
