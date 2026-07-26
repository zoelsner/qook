import { usePrefs } from '../stores/prefs';
import { ensureSession, supabase } from './supabase';
import { userPreferencesRow } from './userPreferencesPayload';

export async function syncUserPreferences(): Promise<void> {
  await ensureSession();

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('no_session');

  const prefs = usePrefs.getState();
  const { error } = await supabase.from('user_preferences').upsert(
    {
      user_id: userId,
      ...userPreferencesRow(prefs),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    if (__DEV__) console.warn('[preferences] sync failed', error.message);
    throw new Error(
      "We couldn't save your preferences. Check your connection and try again."
    );
  }
}
