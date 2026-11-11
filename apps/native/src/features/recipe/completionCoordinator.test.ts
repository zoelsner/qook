import { describe, expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';
import { createCompletionCoordinator } from './completionCoordinator';
const proposal = { id: 'p', contentStatus: 'proposal', generationSessionId: 'saved-brief' } as Recipe;
const full = { ...proposal, id: 'redirect', contentStatus: 'full' } as Recipe;

describe('shared recipe completion', () => {
  test('keep, detail and repeated retry taps share one request and retained association', async () => {
    let calls = 0;
    let finish!: (value: { recipeId: string }) => void;
    const c = createCompletionCoordinator({ fill: r => { calls++; expect(r.generationSessionId).toBe('saved-brief'); return new Promise(resolve => { finish = resolve; }); }, fetch: async () => ({ ...full, generationSessionId: undefined }), adopt: (_id, r) => expect(r.generationSessionId).toBe('saved-brief') });
    const first = c.complete(proposal);
    expect(c.complete(proposal)).toBe(first);
    await Promise.resolve();
    expect(c.get('p').status).toBe('pending');
    finish({ recipeId: 'redirect' });
    expect((await first).id).toBe('redirect');
    expect(calls).toBe(1);
    expect(c.get('p').status).toBe('ready');
  });
  test('closing and reopening during a request does not interrupt completion', async () => {
    let listeners = 0; let release!: (value: { recipeId: string }) => void;
    const c = createCompletionCoordinator({ fill: () => new Promise(resolve => { release = resolve; }), fetch: async () => full, adopt: () => {} });
    const unsubscribe = c.subscribe(() => listeners++);
    const task = c.complete(proposal);
    unsubscribe();
    await Promise.resolve();
    const reopened = c.complete(proposal);
    expect(reopened).toBe(task);
    release({ recipeId: full.id }); await reopened;
    expect(c.get('p').recipe?.id).toBe(full.id);
    expect(listeners).toBe(1);
  });
  test('network failure remains visible; explicit retry uses original brief and adopts once', async () => {
    let calls = 0, adopted = 0;
    const c = createCompletionCoordinator({ fill: async r => { expect(r.generationSessionId).toBe('saved-brief'); if (++calls === 1) throw new Error('Check your connection'); return { recipeId: full.id }; }, fetch: async () => full, adopt: () => adopted++ });
    await c.complete(proposal).then(() => { throw new Error('Expected failure'); }, error => expect(error.message).toBe('Check your connection'));
    expect(c.get('p').status).toBe('error');
    expect(c.get('p').message).toBe('Check your connection');
    await c.complete(proposal);
    expect(calls).toBe(2); expect(adopted).toBe(1);
  });
  test('synchronous failure also clears pending and allows another attempt', async () => {
    let calls = 0;
    const c = createCompletionCoordinator({ fill: () => { if (++calls === 1) throw new Error('Interrupted'); return Promise.resolve({ recipeId: full.id }); }, fetch: async () => full, adopt: () => {} });
    await c.complete(proposal).then(() => { throw new Error('Expected failure'); }, error => expect(error.message).toBe('Interrupted'));
    await c.complete(proposal); expect(calls).toBe(2);
  });
  test('a missing or still-proposal result never reports ready or adopts', async () => {
    let adopted = false;
    const c = createCompletionCoordinator({ fill: async () => ({ recipeId: 'p' }), fetch: async () => proposal, adopt: () => { adopted = true; } });
    await c.complete(proposal).then(() => { throw new Error('Expected failure'); }, error => expect(error.message.includes('unfinished')).toBe(true));
    expect(c.get('p').status).toBe('error'); expect(adopted).toBe(false);
  });
});
