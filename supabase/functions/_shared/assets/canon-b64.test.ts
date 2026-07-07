import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CANON_IMAGE_DATA_URL } from "./canon-b64.ts";

Deno.test("canon is a non-trivial jpeg data url", () => {
  // The canon source asset is JPEG data (despite its .png filename);
  // the inliner detects MIME from magic bytes.
  assert(CANON_IMAGE_DATA_URL.startsWith("data:image/jpeg;base64,"));
  assert(CANON_IMAGE_DATA_URL.length > 2000); // real image, not a stub
});
