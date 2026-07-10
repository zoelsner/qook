import { describe, expect, test } from 'bun:test';
import { isRecipeArtMissing, shouldPollRecipeArt } from './recipeArtState';

describe('recipe art refresh state', () => {
  test('polls while generated art is pending or generating', () => {
    expect(
      shouldPollRecipeArt({ imageStatus: 'pending' }),
    ).toBe(true);
    expect(
      shouldPollRecipeArt({ imageStatus: 'generating' }),
    ).toBe(true);
  });

  test('stops polling once remote or local art exists', () => {
    expect(
      shouldPollRecipeArt({
        imageStatus: 'generating',
        heroImageUrl: 'https://cdn.test/meal.jpg',
      }),
    ).toBe(false);
    expect(
      shouldPollRecipeArt({ imageStatus: 'pending', localImageKey: 'miso-salmon' }),
    ).toBe(false);
  });

  test('fetches a missing failed record once but does not poll forever', () => {
    const failed = { imageStatus: 'failed' as const };
    expect(isRecipeArtMissing(failed)).toBe(true);
    expect(shouldPollRecipeArt(failed)).toBe(false);
  });
});
