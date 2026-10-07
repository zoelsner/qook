import { assert, assertEquals, assertRejects, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { readPhase } from "./read-phase.ts";
import { ManualClock, deferred, flush } from "./read-phase.fixtures.ts";

Deno.test("read phase returns at expiry even when fetch ignores cancellation and later succeeds", async () => {
  const clock = new ManualClock(), late = deferred<Response>();
  let calls = 0;
  const phase = readPhase({ timeoutMs: 100, timers: clock, fetch: () => { calls++; return late.promise; } });
  try {
    const result = phase.run(() => phase.fetch("http://qook.test/"));
    await flush();
    clock.advance(100);
    await assertRejects(() => result, DOMException, "Read phase expired");
    late.resolve(new Response("late"));
    await flush();
    await assertRejects(() => phase.fetch("http://qook.test/"), DOMException);
    assertEquals(calls, 1);
  } finally { phase.dispose(); }
  assertEquals(clock.timers.size, 0);
});

Deno.test("read phase preserves query signals and headers and sanitizes fetch failures", async () => {
  const caller = new AbortController(), query = new AbortController(), clock = new ManualClock();
  let received!: Request;
  const phase = readPhase({ timeoutMs: 100, signal: caller.signal, timers: clock, fetch: (input, init) => {
    received = new Request(input, init);
    return Promise.resolve(new Response("ready"));
  } });
  try {
    await phase.run(() => phase.fetch(new Request("http://qook.test/", { headers: { Authorization: "Bearer synthetic" }, signal: query.signal })));
    assertEquals(received.headers.get("Authorization"), "Bearer synthetic");
    assertEquals(received.signal.aborted, false);
    query.abort("PRIVATE query");
    assertEquals(received.signal.aborted, true);
    await assertRejects(() => phase.fetch("http://qook.test/", { signal: query.signal }), DOMException, "Read request cancelled");
  } finally { phase.dispose(); }
  const failing = readPhase({ timeoutMs: 100, timers: clock, fetch: () => Promise.reject(new Error("PRIVATE network")) });
  try { await assertRejects(() => failing.fetch("http://qook.test/"), DOMException, "Read request failed"); }
  finally { failing.dispose(); }
});

Deno.test("caller cancellation is immediate, pre-aborted work never starts, and listeners are removed", async () => {
  const caller = new AbortController(), clock = new ManualClock();
  let added = 0, removed = 0, calls = 0;
  const add = caller.signal.addEventListener.bind(caller.signal), remove = caller.signal.removeEventListener.bind(caller.signal);
  caller.signal.addEventListener = (...args: Parameters<typeof add>) => { added++; add(...args); };
  caller.signal.removeEventListener = (...args: Parameters<typeof remove>) => { removed++; remove(...args); };
  const phase = readPhase({ timeoutMs: 100, signal: caller.signal, timers: clock });
  try {
    const result = phase.run(() => new Promise<never>(() => {}));
    caller.abort("PRIVATE caller");
    await assertRejects(() => result, DOMException, "Request cancelled");
  } finally { phase.dispose(); }
  assertEquals({ added, removed, timers: clock.timers.size }, { added: 1, removed: 1, timers: 0 });
  const already = readPhase({ timeoutMs: 100, signal: caller.signal, timers: clock });
  try { await assertRejects(() => already.run(async () => { calls++; }), DOMException); }
  finally { already.dispose(); }
  assertEquals(calls, 0);
  assertEquals(clock.timers.size, 0);
});

Deno.test("read phase rejects expired work before a delayed timer fires and clears successful timers", async () => {
  const clock = new ManualClock(), phase = readPhase({ timeoutMs: 100, timers: clock });
  try {
    assertEquals(await phase.run(async () => 3), 3);
    clock.time = 101;
    await assertRejects(() => phase.run(async () => 4), DOMException);
    assert(phase.signal.aborted);
  } finally { phase.dispose(); }
  assertEquals(clock.timers.size, 0);
  for (const timeoutMs of [0, -1, NaN, Infinity]) assertThrows(() => readPhase({ timeoutMs }), RangeError);
});
