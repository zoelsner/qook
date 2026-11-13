import { describe, expect, test } from 'bun:test';
import { FunctionCallError } from '../../services/functionError';
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
  test('maps sign_in_required to sign-in guidance', () => {
    expect(generationErrorMessage(new Error('sign_in_required'))).toBe('Sign in to generate dinners.');
  });
  test('maps a sign_in_required reply to sign-in guidance', () => {
    expect(generationErrorMessage(new FunctionCallError('sign_in_required', { code: 'sign_in_required', status: 403 })))
      .toBe('Sign in to generate dinners.');
  });
  test('preserves server quota guidance and provides a fallback for raw codes', () => {
    const guidance = 'You’ve reached today’s limit. Try again tomorrow.';
    expect(generationErrorMessage(new FunctionCallError(guidance, { code: 'rate_limited', status: 429 }))).toBe(guidance);
    for (const error of [new Error('no_recipes'), new Error(''), undefined,
      new Error('Edge Function returned a non-2xx status code'),
      new Error('Relay Error invoking the Edge Function'),
      new Error('Bad request body.'), new Error('Request cancelled.')]) {
      expect(generationErrorMessage(error)).toBe(
        'The kitchen couldn’t deal this hand. Try again in a moment.',
      );
    }
  });
  test('never shows model refusals or other free text', () => {
    const refusal = 'I’m sorry, but I can’t help with that request.';
    for (const error of [
      new FunctionCallError(refusal, { code: 'validation', status: 422 }),
      new FunctionCallError('Function failed due to not having enough compute resources', { code: 'WORKER_LIMIT', status: 546 }),
      new FunctionCallError('The kitchen is busy — try again in a minute.', { code: 'generation_failed', status: 500 }),
      new Error(refusal),
    ]) {
      expect(generationErrorMessage(error)).toBe('The kitchen couldn’t deal this hand. Try again in a moment.');
    }
  });
});
