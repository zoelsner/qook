// A fill already running for this recipe answers 202 { status: 'filling' }.
// Fill is idempotent, so wait and re-ask until it reports anything else.
// Pure (no RN imports) so it runs under `bun test`.
export async function fillUntilSettled<T extends { status: string }>(
  call: () => Promise<T>,
  { waitMs = 3000, maxAttempts = 20, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) } = {}
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const result = await call();
    if (result.status !== 'filling') return result;
    if (attempt >= maxAttempts) throw new Error('Still finishing this recipe. Try again in a moment.');
    await sleep(waitMs);
  }
}
