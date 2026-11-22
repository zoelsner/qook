import { describe, expect, test } from 'bun:test';
import { hasAppleIdentity } from './appleIdentity';

describe('hasAppleIdentity', () => {
  test('returns true when Apple is in identities or app_metadata', () => {
    expect(hasAppleIdentity({ identities: [{ provider: 'apple' }] })).toBe(true);
    expect(hasAppleIdentity({ app_metadata: { provider: 'apple' } })).toBe(true);
    expect(hasAppleIdentity({ app_metadata: { providers: ['email', 'apple'] } })).toBe(true);
  });

  test('returns false for email-only, anonymous, or missing users', () => {
    expect(hasAppleIdentity(null)).toBe(false);
    expect(hasAppleIdentity(undefined)).toBe(false);
    expect(hasAppleIdentity({ app_metadata: { provider: 'email', providers: ['email'] } })).toBe(
      false,
    );
  });
});
