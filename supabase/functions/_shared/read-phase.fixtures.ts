import type { PhaseTimers } from "./read-phase.ts";

// Explicit clock advancement gives deterministic expiry without wall-clock sleeps.
export class ManualClock implements PhaseTimers {
  time = 0;
  next = 1;
  timers = new Map<number, { at: number; callback: () => void }>();
  now = () => this.time;
  set = (callback: () => void, ms: number) => {
    const id = this.next++;
    this.timers.set(id, { at: this.time + ms, callback });
    return id;
  };
  clear: PhaseTimers["clear"] = (id) => { this.timers.delete(Number(id)); };
  advance(ms: number) {
    this.time += ms;
    for (const [id, timer] of [...this.timers]) {
      if (timer.at <= this.time) { this.timers.delete(id); timer.callback(); }
    }
  }
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export async function flush() {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}
