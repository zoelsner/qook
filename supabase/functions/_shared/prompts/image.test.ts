import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildImagePrompt } from "./image.ts";

Deno.test("image prompt carries the three §3 tweaks and the style directive", () => {
  const p = buildImagePrompt({ title: "Miso-Butter Salmon" });
  assert(/single plate|one serving|centered/i.test(p));
  assert(/outer 15%|clean cream/i.test(p));
  assert(/at most two/i.test(p));
  assert(/match this artist'?s hand/i.test(p));
  assert(p.includes("Miso-Butter Salmon"));
});
