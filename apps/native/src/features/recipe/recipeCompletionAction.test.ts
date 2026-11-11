import { describe, expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';
import { createCompletionCoordinator } from './completionCoordinator';
import { recipeCompletionAction } from './recipeCompletionAction';

const proposal = { id: 'legacy', contentStatus: 'proposal' } as Recipe;
const full = { ...proposal, contentStatus: 'full' } as Recipe;
const legacyMessage = 'This older dinner card has no saved brief. Choose a new dinner idea to keep your requirements.';

describe('unfinished recipe recovery', () => {
  test('terminal server guidance routes missing, incomplete and mismatched cards to a fresh idea', () => {
    for (const message of [
      legacyMessage,
      'This dinner card is incomplete — choose a new dinner idea.',
      'This saved recipe does not match its dinner idea — choose a new dinner idea.',
    ]) expect(recipeCompletionAction(proposal, { status: 'error', message })).toBe('fresh-idea');
  });

  test('network and ordinary unfinished errors keep the retry action', () => {
    for (const message of ['Check your connection', 'The recipe is still unfinished. Try again.']) {
      expect(recipeCompletionAction(proposal, { status: 'error', message })).toBe('retry');
    }
  });

  test('missing session hints alone never declare an old card unusable', () => {
    expect(recipeCompletionAction(proposal, { status: 'idle' })).toBe('retry');
  });

  test('pending completion offers neither retry nor a fresh-idea action', () => {
    expect(recipeCompletionAction(proposal, { status: 'pending', message: legacyMessage })).toBe(null);
  });

  test('persisted server recovery works before a new completion attempt', () => {
    expect(recipeCompletionAction({ ...proposal, generationError: legacyMessage }, { status: 'idle' })).toBe('fresh-idea');
  });

  test('a terminal refusal reaches recovery without fetching or replacing the saved card', async () => {
    let fills = 0, fetches = 0, adoptions = 0;
    const coordinator = createCompletionCoordinator({
      fill: async () => { fills++; throw new Error(legacyMessage); },
      fetch: async () => { fetches++; return full; },
      adopt: () => { adoptions++; },
    });
    await coordinator.complete(proposal).then(() => { throw new Error('Expected refusal'); }, () => {});
    expect(recipeCompletionAction(proposal, coordinator.get(proposal.id))).toBe('fresh-idea');
    expect(fills).toBe(1);
    expect(fetches).toBe(0);
    expect(adoptions).toBe(0);
  });

  test('completed recipes ignore stale failure messages and never call fill', async () => {
    let fills = 0;
    const coordinator = createCompletionCoordinator({
      fill: async () => { fills++; return { recipeId: full.id }; },
      fetch: async () => full,
      adopt: () => { throw new Error('No completed recipe should be replaced'); },
    });
    expect(await coordinator.complete(full)).toBe(full);
    expect(recipeCompletionAction(full, { status: 'error', message: legacyMessage })).toBe(null);
    expect(fills).toBe(0);
  });
});
