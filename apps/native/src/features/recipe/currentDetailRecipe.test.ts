import { expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';
import { currentDetailRecipe } from './currentDetailRecipe';

test('art polling replaces the pending image after recipe completion', () => {
  const completed = { id: 'full', contentStatus: 'full', imageStatus: 'pending', generationSessionId: 'brief' } as Recipe;
  const fresh = { ...completed, generationSessionId: undefined, imageStatus: 'ready', heroImageUrl: 'synthetic-art.jpg' } as Recipe;
  const shown = currentDetailRecipe(completed, fresh);
  expect(shown?.heroImageUrl).toBe('synthetic-art.jpg');
  expect(shown?.imageStatus).toBe('ready');
  expect(shown?.generationSessionId).toBe('brief');
});
test('a stale proposal or another ID does not overwrite a completed redirect', () => {
  const full = { id: 'redirect', contentStatus: 'full' } as Recipe;
  expect(currentDetailRecipe(full, { id: 'old', contentStatus: 'proposal' } as Recipe)).toBe(full);
  expect(currentDetailRecipe(full, { id: 'old', contentStatus: 'full' } as Recipe)).toBe(full);
  expect(currentDetailRecipe(full, null)).toBe(full);
  expect(currentDetailRecipe(undefined, full)).toBe(full);
});
