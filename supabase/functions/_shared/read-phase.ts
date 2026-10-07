// A deadline for read-only work. It must never be attached to mutation clients:
// cancellation cannot establish whether a database write committed.
type TimerHandle = number | ReturnType<typeof setTimeout>;
export type PhaseTimers = {
  now(): number;
  set(callback: () => void, ms: number): TimerHandle;
  clear(id: TimerHandle): void;
};
const realTimers: PhaseTimers = {
  now: () => performance.now(),
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (id) => clearTimeout(id),
};

export function readPhase(options: {
  timeoutMs: number;
  signal?: AbortSignal;
  fetch?: typeof fetch;
  timers?: PhaseTimers;
}) {
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) throw new RangeError("Invalid read deadline");
  const timers = options.timers ?? realTimers;
  const controller = new AbortController();
  const deadline = timers.now() + options.timeoutMs;
  const expire = () => controller.abort(new DOMException("Read phase expired", "TimeoutError"));
  const cancel = () => controller.abort(new DOMException("Request cancelled", "AbortError"));
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener("abort", cancel, { once: true });
  const timer = controller.signal.aborted ? undefined : timers.set(expire, options.timeoutMs);
  const active = () => {
    if (timers.now() >= deadline && !controller.signal.aborted) expire();
    controller.signal.throwIfAborted();
  };
  const gatedFetch: typeof fetch = async (input, init) => {
    active();
    const existing = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const signal = existing ? AbortSignal.any([controller.signal, existing]) : controller.signal;
    if (signal.aborted) throw new DOMException("Read request cancelled", "AbortError");
    try {
      return await (options.fetch ?? globalThis.fetch)(input, { ...init, signal });
    } catch {
      // Auth SDK logs fetch exceptions internally. Never pass private network
      // details or a caller-supplied cancellation reason into that logger.
      if (controller.signal.aborted) throw controller.signal.reason;
      throw new DOMException("Read request failed", signal.aborted ? "AbortError" : "NetworkError");
    }
  };
  return {
    signal: controller.signal,
    fetch: gatedFetch,
    async run<T>(task: () => Promise<T>): Promise<T> {
      active();
      let onAbort!: () => void;
      const interrupted = new Promise<never>((_, reject) => {
        onAbort = () => reject(controller.signal.reason);
        controller.signal.addEventListener("abort", onAbort, { once: true });
      });
      const work = Promise.resolve().then(() => { active(); return task(); }).then((value) => {
        active();
        return value;
      });
      try {
        return await Promise.race([work, interrupted]);
      } finally {
        controller.signal.removeEventListener("abort", onAbort);
      }
    },
    dispose() {
      if (timer !== undefined) timers.clear(timer);
      options.signal?.removeEventListener("abort", cancel);
      controller.abort(new DOMException("Read phase complete", "AbortError"));
    },
  };
}
