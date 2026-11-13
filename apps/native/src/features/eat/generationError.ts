import { FunctionCallError } from '../../services/functionError';

export function generationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  const code = error instanceof FunctionCallError ? error.code : undefined;
  if (message === 'sign_in_required' || code === 'sign_in_required') return 'Sign in to generate dinners.';
  if (/^(no_session|network request failed|failed to fetch)$/i.test(message) ||
      /failed to send a request to the edge function/i.test(message)) {
    return 'We couldn’t connect to the kitchen. Check your connection and try again.';
  }
  // Only quota guidance is shown verbatim: the server writes it. A
  // `validation` reply can carry the model's own refusal text, and any other
  // message may be a raw code, a gateway reply or a developer string.
  if (code === 'rate_limited' && message) return message;
  return 'The kitchen couldn’t deal this hand. Try again in a moment.';
}
