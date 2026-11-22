import { describe, expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';
import { IDLE_COMPLETION, type CompletionState } from './completionCoordinator';
import { collectIncompleteShopMeals, getRecipeReadiness } from './recipeReadiness';

const baseRecipe = (id: string, overrides: Partial<Recipe> = {}): Recipe =>
  ({
    id,
    title: `Dish ${id}`,
    contentStatus: 'full',
    ingredients: [],
    ...overrides,
  }) as Recipe;

describe('getRecipeReadiness', () => {
  test('full recipes are always ready', () => {
    expect(getRecipeReadiness(baseRecipe('a'), IDLE_COMPLETION)).toBe('ready');
    expect(
      getRecipeReadiness(baseRecipe('a', { generationError: 'stale' }), {
        status: 'error',
        message: 'stale',
      }),
    ).toBe('ready');
  });

  test('in-flight proposals report finishing even if a prior error was saved', () => {
    expect(
      getRecipeReadiness(
        baseRecipe('a', { contentStatus: 'proposal', generationError: 'old error' }),
        { status: 'pending' },
      ),
    ).toBe('finishing');
  });

  test('terminal refusal reports fresh-idea', () => {
    expect(
      getRecipeReadiness(baseRecipe('a', { contentStatus: 'proposal' }), {
        status: 'error',
        message: 'Please choose a new dinner idea.',
      }),
    ).toBe('fresh-idea');
    expect(
      getRecipeReadiness(
        baseRecipe('a', {
          contentStatus: 'proposal',
          generationError: 'Please choose a new dinner idea.',
        }),
        IDLE_COMPLETION,
      ),
    ).toBe('fresh-idea');
  });

  test('retryable errors report retry from completion state or persisted error', () => {
    expect(
      getRecipeReadiness(baseRecipe('a', { contentStatus: 'proposal' }), {
        status: 'error',
        message: 'Try again.',
      }),
    ).toBe('retry');
    expect(
      getRecipeReadiness(
        baseRecipe('a', { contentStatus: 'proposal', generationError: 'Try again.' }),
        IDLE_COMPLETION,
      ),
    ).toBe('retry');
  });

  test('idle proposals without an error report unfinished (nothing actively running)', () => {
    expect(
      getRecipeReadiness(baseRecipe('a', { contentStatus: 'proposal' }), IDLE_COMPLETION),
    ).toBe('unfinished');
  });
});

describe('collectIncompleteShopMeals', () => {
  test('returns every incomplete meal with its distinct readiness state', () => {
    const ready = baseRecipe('ready', { contentStatus: 'full' });
    const finishing = baseRecipe('finishing', { contentStatus: 'proposal' });
    const unfinished = baseRecipe('unfinished', { contentStatus: 'proposal' });
    const retry = baseRecipe('retry', { contentStatus: 'proposal' });
    const refused = baseRecipe('refused', { contentStatus: 'proposal' });
    const states: Record<string, CompletionState> = {
      finishing: { status: 'pending' },
      retry: { status: 'error', message: 'Temporary error' },
      refused: { status: 'error', message: 'Please choose a new dinner idea.' },
    };

    const result = collectIncompleteShopMeals(
      [ready, finishing, unfinished, retry, refused],
      (id) => states[id] ?? IDLE_COMPLETION,
    );

    expect(result.map((entry) => [entry.recipe.id, entry.readiness])).toEqual([
      ['finishing', 'finishing'],
      ['unfinished', 'unfinished'],
      ['retry', 'retry'],
      ['refused', 'fresh-idea'],
    ]);
  });
});
