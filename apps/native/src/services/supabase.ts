import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

const url = (Constants.expoConfig?.extra?.supabaseUrl ??
  'https://placeholder.supabase.co') as string;
const anonKey = (Constants.expoConfig?.extra?.supabaseAnonKey ??
  'placeholder-anon-key') as string;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Pre-Phase-5 auth: the app has no sign-in UI yet, so live API calls ride an
// anonymous session. Phase 5 account linking upgrades it to a real account.
export async function ensureSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) return data.session.access_token;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.session?.access_token) {
    throw new Error('no_session');
  }
  return anon.session.access_token;
}

export type AppleSignInResult = 'ok' | 'canceled';

// Apple gets the SHA-256 hex digest of the raw nonce; Supabase gets the raw
// nonce and hashes it the same way to compare against the id token's claim.
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = `${Crypto.randomUUID()}${Crypto.randomUUID()}`;
  const hashed = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    raw,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return { raw, hashed };
}

/**
 * Native Sign in with Apple.
 *
 * Link-first: when the current session is ANONYMOUS we call linkIdentity(),
 * which hits POST /token?grant_type=id_token with link_identity:true. GoTrue's
 * linkIdentityToUser() attaches the Apple identity to the existing user id,
 * backfills auth.users.email from the Apple identity and flips is_anonymous to
 * false — so the quota ledger and profile row carry over.
 *
 * Every failure falls through to signInWithIdToken(), which signs into (or
 * creates) the Apple-owned user. That is safe: all recipe rows are global-cache
 * rows (recipes.user_id IS NULL), meal art is a public bucket, and every piece
 * of user-visible state is device-local AsyncStorage. Nothing the user can see
 * is tied to the Supabase user id.
 */
export async function signInWithApple(): Promise<AppleSignInResult> {
  const { raw, hashed } = await makeNonce();

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return 'canceled';
    throw e;
  }
  if (!credential.identityToken) throw new Error('apple_no_identity_token');

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user.is_anonymous) {
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: 'apple',
      token: credential.identityToken,
      nonce: raw,
    });
    if (!linkError) return 'ok';
    // Expected: 'identity_already_exists' (this Apple ID already owns an
    // account — returning user on a fresh install) or 'email_exists'.
    if (__DEV__) console.warn('[auth] link failed → sign in', linkError.code, linkError.message);
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: raw,
  });
  if (error) throw error;
  return 'ok';
}

export type EmailAuthResult = 'ok';

/** Create an account. Upgrades the anonymous session in place when there is
 *  one, so the user id (and its quota ledger) survives. Requires the project's
 *  "Confirm email" setting to be OFF — see the Phase 5 auth spec §3.1. */
export async function signUpWithEmail(email: string, password: string): Promise<EmailAuthResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user.is_anonymous) {
    const { error } = await supabase.auth.updateUser({ email, password });
    if (error) throw error; // email_exists → caller tells them to sign in
    return 'ok';
  }
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return 'ok';
}

export async function signInWithEmail(email: string, password: string): Promise<EmailAuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error; // replaces any anon session; safe — nothing user-visible is server-owned
  return 'ok';
}
