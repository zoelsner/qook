// Supabase AuthError.code → user-facing copy. Anything unmapped falls back to
// the generic line; we never surface a raw GoTrue message.
const MESSAGES: Record<string, string> = {
  email_exists: 'That email is already on an account. Sign in instead.',
  user_already_exists: 'That email is already on an account. Sign in instead.',
  invalid_credentials: 'Email or password is incorrect.',
  weak_password: 'Password must be at least 8 characters.',
  validation_failed: "That doesn't look like a valid email.",
  email_address_invalid: "That doesn't look like a valid email.",
  over_request_rate_limit: 'Too many attempts. Try again in a few minutes.',
  over_email_send_rate_limit: 'Too many attempts. Try again in a few minutes.',
  email_address_not_authorized: "We couldn't finish sign-up. Try Sign in with Apple.",
  email_not_confirmed: 'Check your email to confirm your account.',
};

const FALLBACK = 'Something went wrong. Please try again.';

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code !== 'string') return FALLBACK;
  if (code === 'email_address_not_authorized' && __DEV__) {
    console.warn(
      '[auth] email_address_not_authorized — confirmations are on, or the built-in SMTP only delivers to org team members'
    );
  }
  return MESSAGES[code] ?? FALLBACK;
}
