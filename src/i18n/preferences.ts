import AsyncStorage from '@react-native-async-storage/async-storage';
import { isLanguageCode, type LanguageCode } from './index';

// The language picked on this device (React Native's equivalent of
// localStorage), so the app opens in it before anyone signs in. Signed in, the
// account's preferred_language is the source of truth across devices.
const LANGUAGE_KEY = 'app.language';
// Set when a change couldn't reach the server (offline, older backend); the next
// sign-in sends it instead of taking the server's value.
const PENDING_SYNC_KEY = 'app.language.pendingSync';

export async function readSavedLanguage(): Promise<LanguageCode | null> {
  try {
    const value = await AsyncStorage.getItem(LANGUAGE_KEY);
    return isLanguageCode(value) ? value : null;
  } catch {
    return null;
  }
}

export async function saveLanguage(code: LanguageCode) {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, code);
  } catch {
    // The language still applies for this session.
  }
}

export async function hasPendingSync() {
  try {
    return (await AsyncStorage.getItem(PENDING_SYNC_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setPendingSync(pending: boolean) {
  try {
    if (pending) await AsyncStorage.setItem(PENDING_SYNC_KEY, '1');
    else await AsyncStorage.removeItem(PENDING_SYNC_KEY);
  } catch {
    // Retried on the next change.
  }
}
