import { describe, expect, test } from 'bun:test';
import { buildRedealContext, REDEAL_CONTEXT_MAX } from './redealContext';

describe('buildRedealContext', () => {
  test('leads with the voice context and appends swipe steering', () => {
    const out = buildRedealContext({
      voiceContext: 'tired, craving spicy',
      summary: { keptTitles: ['Larb'], keptCuisines: ['Thai'], passedCuisines: ['Italian'] },
      excludeTitles: ['Larb', 'Cacio e Pepe'],
    });
    expect(out.startsWith('tired, craving spicy')).toBe(true);
    expect(out.length <= REDEAL_CONTEXT_MAX).toBe(true);
  });

  test('empty voice context still produces steering under the cap', () => {
    const out = buildRedealContext({
      voiceContext: '',
      summary: { keptTitles: [], keptCuisines: [], passedCuisines: ['Italian'] },
      excludeTitles: ['Cacio e Pepe'],
    });
    expect(out.length <= REDEAL_CONTEXT_MAX).toBe(true);
    expect(out.length > 0).toBe(true);
  });

  test('caps at 500 chars, preserving the voice context', () => {
    const voice = 'a'.repeat(200);
    const out = buildRedealContext({
      voiceContext: voice,
      summary: { keptTitles: [], keptCuisines: [], passedCuisines: [] },
      excludeTitles: Array.from({ length: 100 }, (_, i) => `Very Long Dish Title Number ${i}`),
    });
    expect(out.length <= REDEAL_CONTEXT_MAX).toBe(true);
    expect(out.startsWith(voice)).toBe(true);
  });
});
