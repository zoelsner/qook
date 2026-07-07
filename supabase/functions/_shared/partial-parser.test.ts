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

Deno.test("ignores trailing non-recipe objects", () => {
  // Same structural trace as the reviewer's example
  // ('{"recipes":[{"title":"A"}],"meta":{"count":1}}'), but with a title
  // that satisfies Recipe's `title: z.string().min(4)` so the assertion
  // exercises the array-bound scan fix rather than tripping on an
  // unrelated schema-validation rejection.
  const buf = '{"recipes":[{"title":"Soup"}],"meta":{"count":1}}';
  const out = extractPartialRecipes(buf);
  assertEquals(out.length, 1);
  assertEquals((out[0] as { title: string }).title, "Soup");
});

Deno.test("handles escaped quotes and braces inside strings", () => {
  const title = 'Mom\'s {best} "chili"';
  const escapedTitle = title.replace(/"/g, '\\"');
  const buf =
    `{"recipes":[{"title":"${escapedTitle}"},{"title":"Half`;
  const out = extractPartialRecipes(buf);
  assertEquals(out.length, 1);
  assertEquals((out[0] as { title: string }).title, title);
});
