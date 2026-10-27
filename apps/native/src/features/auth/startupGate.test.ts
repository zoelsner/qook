import { describe, expect, test } from 'bun:test';
import { loadStartupGate, type StartupSnapshot } from './startupGate';

const signedOut: StartupSnapshot = {
  onboardingShown: true,
  authMode: null,
  permanentSession: false,
};

describe('startup recovery', () => {
  test('a stalled session refresh reaches recovery instead of hanging', async () => {
    const result = await loadStartupGate(() => new Promise(() => {}), 5);
    expect(result).toBe('unavailable');
  });

  test('a failed read never grants signed-in access', async () => {
    expect(await loadStartupGate(() => Promise.reject(new Error('Offline')))).toBe('unavailable');
  });

  test('a late session result cannot replace the timeout result', async () => {
    let finish!: (snapshot: StartupSnapshot) => void;
    const pending = new Promise<StartupSnapshot>((resolve) => { finish = resolve; });
    const result = await loadStartupGate(() => pending, 5);
    finish({ ...signedOut, permanentSession: true });
    expect(result).toBe('unavailable');
  });

  test('retry after a failure can reach the verified session', async () => {
    expect(await loadStartupGate(() => Promise.reject(new Error('Offline')))).toBe('unavailable');
    expect(await loadStartupGate(async () => ({ ...signedOut, permanentSession: true }))).toBe('signed-in');
  });

  test('preserves onboarding, guest, and signed-out routing', async () => {
    expect(await loadStartupGate(async () => ({ ...signedOut, onboardingShown: false }))).toBe('onboarding');
    expect(await loadStartupGate(async () => ({ ...signedOut, authMode: 'guest' }))).toBe('signed-in');
    expect(await loadStartupGate(async () => signedOut)).toBe('signed-out');
    expect(await loadStartupGate(async () => ({ ...signedOut, authMode: 'apple' }))).toBe('signed-out');
    expect(await loadStartupGate(async () => ({ ...signedOut, authMode: 'email' }))).toBe('signed-out');
  });
});
