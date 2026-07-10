import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as AppleAuthentication from 'expo-apple-authentication';

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

/**
 * Native Sign in with Apple. Replaces the current (anon) session with a
 * permanent Apple-backed session. The anon user id is intentionally discarded:
 * recipes are global-cache rows and all plan/prefs/cook state is client-local,
 * so nothing the user can see is lost. See design-apple-auth.md §0/§2.
 */
export async function signInWithApple(): Promise<AppleSignInResult> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return 'canceled';
    throw e;
  }
  if (!credential.identityToken) throw new Error('apple_no_identity_token');
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
  return 'ok';
}
