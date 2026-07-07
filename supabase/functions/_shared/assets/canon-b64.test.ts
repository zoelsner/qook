import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CANON_IMAGE_DATA_URL } from "./canon-b64.ts";

Deno.test("canon is a non-trivial png data url", () => {
  assert(CANON_IMAGE_DATA_URL.startsWith("data:image/png;base64,"));
  assert(CANON_IMAGE_DATA_URL.length > 2000); // real image, not a stub
});
