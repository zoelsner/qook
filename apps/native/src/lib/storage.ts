import AsyncStorage from '@react-native-async-storage/async-storage';

export const StorageKeys = {
  onboardingShown: 'qook.onboarding.shown',
  signedIn: 'qook.auth.signedIn',
  authMode: 'qook.auth.mode',
} as const;

export type AuthMode = 'apple' | 'guest';

export async function readFlag(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === '1';
  } catch {
    return false;
  }
}

export async function writeFlag(key: string, value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* swallow — non-fatal */
  }
}

export async function readString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writeString(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    /* swallow — non-fatal */
  }
}

export async function clearAuthFlags(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([StorageKeys.signedIn, StorageKeys.authMode]);
  } catch {
    /* non-fatal */
  }
}
