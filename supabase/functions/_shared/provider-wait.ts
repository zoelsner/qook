// Respect a valid server delay in full. An excessive delay is a stop condition,
// never permission to retry earlier than the provider requested.
export function retryDelayMs(
  header: string | null,
  fallbackMs: number,
  remainingMs: number,
  nowMs = Date.now(),
): number | null {
  let delay = fallbackMs;
  if (header?.trim()) {
    const value = header.trim();
    if (/^\d+(?:\.\d+)?$/.test(value)) {
      delay = Number(value) * 1000;
    } else if (!/^[+-]?\d/.test(value) || value.includes(",")) {
      const date = Date.parse(value);
      if (Number.isFinite(date)) delay = Math.max(0, date - nowMs);
    }
  }
  return Number.isFinite(delay) && delay < remainingMs ? delay : null;
}

export function abortableWait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
