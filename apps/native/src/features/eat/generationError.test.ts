import { describe, expect, test } from 'bun:test';
import { generationErrorMessage } from './generationError';

describe('generation error guidance', () => {
  test('session and transport failures give connection guidance on initial attempt and retry', () => {
    for (const message of ['no_session', 'Network request failed', 'Failed to fetch',
      'Failed to send a request to the Edge Function']) {
      expect(generationErrorMessage(new Error(message))).toBe(
        'We couldn’t connect to the kitchen. Check your connection and try again.',
      );
    }
  });
  test('preserves server quota guidance and provides a fallback for raw codes', () => {
    const guidance = 'You’ve reached today’s limit. Try again tomorrow.';
    expect(generationErrorMessage(new Error(guidance))).toBe(guidance);
    for (const error of [new Error('no_recipes'), new Error(''), undefined]) {
      expect(generationErrorMessage(error)).toBe(
        'The kitchen couldn’t deal this hand. Try again in a moment.',
      );
    }
  });
});
