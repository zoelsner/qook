import { afterEach, describe, expect, test } from 'bun:test';
import {
  _resetRequestedArtIds,
  hasRequestedRecipeArt,
  isRecipeArtMissing,
  markRecipeArtRequested,
  shouldPollRecipeArt,
} from './recipeArtState';

afterEach(() => _resetRequestedArtIds());

describe('recipe art poll state (spotlight-first)', () => {
  test('polls a pending row ONLY after this client requested it', () => {
    expect(shouldPollRecipeArt({ id: 'r1', imageStatus: 'pending' })).toBe(false);
    markRecipeArtRequested('r1');
    expect(shouldPollRecipeArt({ id: 'r1', imageStatus: 'pending' })).toBe(true);
  });

  test('polls a generating row regardless of request (cache-hit from another session)', () => {
    expect(shouldPollRecipeArt({ id: 'r2', imageStatus: 'generating' })).toBe(true);
  });

  test('a pending row with no id never polls (guards the infinite-poll trap)', () => {
    expect(shouldPollRecipeArt({ imageStatus: 'pending' })).toBe(false);
  });

  test('stops once remote or local art exists, even if requested', () => {
    markRecipeArtRequested('r3');
    expect(
      shouldPollRecipeArt({ id: 'r3', imageStatus: 'generating', heroImageUrl: 'https://cdn/x.jpg' }),
    ).toBe(false);
    expect(
      shouldPollRecipeArt({ id: 'r3', imageStatus: 'pending', localImageKey: 'miso-salmon' }),
    ).toBe(false);
  });

  test('failed art is missing but never polls', () => {
    markRecipeArtRequested('r4');
    expect(isRecipeArtMissing({ imageStatus: 'failed' })).toBe(true);
    expect(shouldPollRecipeArt({ id: 'r4', imageStatus: 'failed' })).toBe(false);
  });

  test('mark/has round-trips', () => {
    expect(hasRequestedRecipeArt('r5')).toBe(false);
    markRecipeArtRequested('r5');
    expect(hasRequestedRecipeArt('r5')).toBe(true);
  });
});
