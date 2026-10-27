import { describe, expect, test } from 'bun:test';

import { fillUntilSettled } from './fillPolling';

const noSleep = async () => {};

describe('fillUntilSettled', () => {
  test('returns immediately when the fill is not already running', async () => {
    let calls = 0;
    const out = await fillUntilSettled(async () => (calls++, { status: 'full' }), { sleep: noSleep });
    expect(out.status).toBe('full');
    expect(calls).toBe(1);
  });

  test('re-asks while another request is filling, then returns the final result', async () => {
    const waits: number[] = [];
    const answers = ['filling', 'filling', 'full'];
    const out = await fillUntilSettled(async () => ({ status: answers.shift()! }), {
      sleep: async (ms) => { waits.push(ms); },
    });
    expect(out.status).toBe('full');
    expect(waits).toEqual([3000, 3000]);
  });

  test('gives up with guidance after the attempt cap', async () => {
    let calls = 0;
    const error = await fillUntilSettled(async () => (calls++, { status: 'filling' }), { maxAttempts: 3, sleep: noSleep })
      .catch((e: Error) => e);
    expect((error as Error).message).toBe('Still finishing this recipe. Try again in a moment.');
    expect(calls).toBe(3);
  });

  test('call errors propagate without further polling', async () => {
    let calls = 0;
    const error = await fillUntilSettled(async () => { calls++; throw new Error('boom'); }, { sleep: noSleep })
      .catch((e: Error) => e);
    expect((error as Error).message).toBe('boom');
    expect(calls).toBe(1);
  });
});
