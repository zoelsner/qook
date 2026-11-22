export interface AuthUserLike {
  identities?: { provider?: string }[] | null;
  app_metadata?: { provider?: unknown; providers?: unknown } | null;
}

export function hasAppleIdentity(user: AuthUserLike | null | undefined): boolean {
  if (!user) return false;
  if (user.identities?.some((i) => i.provider === 'apple')) return true;
  if (user.app_metadata?.provider === 'apple') return true;
  if (
    Array.isArray(user.app_metadata?.providers) &&
    user.app_metadata.providers.includes('apple')
  ) {
    return true;
  }
  return false;
}
