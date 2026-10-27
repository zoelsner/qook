export type StartupGate = 'onboarding' | 'signed-in' | 'signed-out' | 'unavailable';

export interface StartupSnapshot {
  onboardingShown: boolean;
  authMode: string | null;
  permanentSession: boolean;
}

// Session refresh can wait on an unreachable backend. Bound the whole startup
// read so a returning user always gets a recovery screen instead of a blank app.
export async function loadStartupGate(
  readSnapshot: () => Promise<StartupSnapshot>,
  timeoutMs = 10_000,
): Promise<StartupGate> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const snapshot = await Promise.race([
      readSnapshot(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Startup timed out')), timeoutMs);
      }),
    ]);
    if (!snapshot.onboardingShown) return 'onboarding';
    if (snapshot.permanentSession || snapshot.authMode === 'guest') return 'signed-in';
    return 'signed-out';
  } catch {
    return 'unavailable';
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
