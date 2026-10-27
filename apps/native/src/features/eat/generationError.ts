export function generationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (/^(no_session|network request failed|failed to fetch)$/i.test(message) ||
      /failed to send a request to the edge function/i.test(message)) {
    return 'We couldn’t connect to the kitchen. Check your connection and try again.';
  }
  // Keep useful server messages (including quota guidance); hide raw codes.
  if (!message || /^[a-z]+(?:_[a-z]+)+$/.test(message)) {
    return 'The kitchen couldn’t deal this hand. Try again in a moment.';
  }
  return message;
}
