import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { abortableWait, retryDelayMs } from "./provider-wait.ts";

Deno.test("Retry-After accepts seconds/date and never shortens a delay beyond budget", () => {
  const now = Date.UTC(2026, 9, 7, 12);
  assertEquals(retryDelayMs("2", 750, 3000, now), 2000);
  assertEquals(retryDelayMs("0", 750, 3000, now), 0);
  assertEquals(retryDelayMs("0.25", 750, 3000, now), 250);
  assertEquals(
    retryDelayMs(new Date(now + 2000).toUTCString(), 750, 3000, now),
    2000,
  );
  assertEquals(
    retryDelayMs(new Date(now - 2000).toUTCString(), 750, 3000, now),
    0,
  );
  for (const value of [null, "", "garbage", "-2", "NaN", "Infinity"]) {
    assertEquals(retryDelayMs(value, 750, 3000, now), 750);
  }
  for (
    const value of [
      "3",
      "999999",
      "9".repeat(400),
      new Date(now + 5000).toUTCString(),
    ]
  ) {
    assertEquals(retryDelayMs(value, 750, 3000, now), null);
  }
  assertEquals(retryDelayMs(null, 750, 500, now), null);
});

Deno.test("retry wait cancels immediately and clears its timer", async () => {
  const c = new AbortController();
  const waiting = abortableWait(60_000, c.signal);
  c.abort(new Error("caller cancelled"));
  await assertRejects(() => waiting, Error, "caller cancelled");
  await assertRejects(
    () => abortableWait(60_000, c.signal),
    Error,
    "caller cancelled",
  );
});
