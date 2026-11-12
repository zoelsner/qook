import { describe, expect, test } from 'bun:test';
import { SAMPLE_HAND } from './sampleHand';

describe('SAMPLE_HAND', () => {
  test('is a full hand of five distinct recipes', () => {
    expect(SAMPLE_HAND.length).toBe(5);
    expect(new Set(SAMPLE_HAND.map((r) => r.id)).size).toBe(5);
  });

  // CardArt only fetches a recipe when it has neither a remote URL nor bundled
  // art; every sample card must render from bundled art so a signed-out user
  // never causes a backend read.
  test('every card has bundled art', () => {
    for (const r of SAMPLE_HAND) {
      expect(Boolean(r.localImageKey)).toBe(true);
      expect(r.imageStatus).toBe('ready');
    }
  });
});
