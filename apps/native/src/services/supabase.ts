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
