import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

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
