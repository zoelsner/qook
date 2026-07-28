import { describe, expect, test } from 'bun:test';

import { authErrorMessage } from './authErrorMessage';

// __DEV__ is a Metro global; bun's runtime doesn't define it.
(globalThis as Record<string, unknown>).__DEV__ = false;

const FALLBACK = 'Something went wrong. Please try again.';

const CASES: [string, string][] = [
  ['email_exists', 'That email is already on an account. Sign in instead.'],
  ['user_already_exists', 'That email is already on an account. Sign in instead.'],
  ['invalid_credentials', 'Email or password is incorrect.'],
  ['weak_password', 'Password must be at least 8 characters.'],
  ['validation_failed', "That doesn't look like a valid email."],
  ['email_address_invalid', "That doesn't look like a valid email."],
  ['over_request_rate_limit', 'Too many attempts. Try again in a few minutes.'],
  ['over_email_send_rate_limit', 'Too many attempts. Try again in a few minutes.'],
  ['email_address_not_authorized', "We couldn't finish sign-up. Try Sign in with Apple."],
  ['email_not_confirmed', 'Check your email to confirm your account.'],
];

describe('authErrorMessage', () => {
  for (const [code, message] of CASES) {
    test(`maps ${code} to its copy`, () => {
      expect(authErrorMessage({ code })).toBe(message);
    });
  }

  test('falls back for unknown, absent and non-error inputs', () => {
    expect(authErrorMessage({ code: 'some_new_gotrue_code' })).toBe(FALLBACK);
    expect(authErrorMessage({ code: undefined })).toBe(FALLBACK);
    expect(authErrorMessage(new Error('boom'))).toBe(FALLBACK);
    expect(authErrorMessage(null)).toBe(FALLBACK);
    expect(authErrorMessage('invalid_credentials')).toBe(FALLBACK);
  });
});
