import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

// Tokens live in the Keychain / Android Keystore, never in AsyncStorage.
// Without "Remember me" they are kept in memory only, so the sign-in ends
// when the app is closed.
const KEYCHAIN_SERVICE = 'com.veiloscan.business.session';
const USER_KEY = 'session.user';
const ONBOARDED_KEY = 'app.onboarded';

export interface SessionUser {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  userType?: string;
  /** The interface language saved on the account ('en' | 'hi'); null until chosen. */
  preferredLanguage?: string | null;
  [key: string]: unknown;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

let tokens: SessionTokens | null = null;
let persistent = true;

export function getAccessToken() {
  return tokens?.accessToken ?? null;
}

export function getRefreshToken() {
  return tokens?.refreshToken ?? null;
}

/** Loads a remembered sign-in into memory; the saved user, if there is one. */
export async function restoreSession(): Promise<SessionUser | null> {
  try {
    const saved = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    if (!saved) return null;
    tokens = JSON.parse(saved.password) as SessionTokens;
    persistent = true;
    const rawUser = await AsyncStorage.getItem(USER_KEY);
    return rawUser ? (JSON.parse(rawUser) as SessionUser) : {};
  } catch {
    await clearSession();
    return null;
  }
}

export async function saveSession(next: SessionTokens, user: SessionUser | undefined, remember: boolean) {
  tokens = { accessToken: next.accessToken, refreshToken: next.refreshToken };
  persistent = remember;
  if (remember) {
    await Keychain.setGenericPassword('session', JSON.stringify(tokens), {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    if (user) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
    await AsyncStorage.removeItem(USER_KEY);
  }
}

// The backend rotates the refresh token on every refresh and invalidates the
// previous one, so the new pair must be persisted too.
export async function updateTokens(next: SessionTokens) {
  tokens = { accessToken: next.accessToken, refreshToken: next.refreshToken };
  if (persistent) {
    await Keychain.setGenericPassword('session', JSON.stringify(tokens), {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  }
}

export async function saveUser(user: SessionUser) {
  if (persistent) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearSession() {
  tokens = null;
  await Promise.allSettled([
    Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE }),
    AsyncStorage.removeItem(USER_KEY),
  ]);
}

// Whether the Get Started screen has been seen; after that the app opens on login.
export async function hasOnboarded() {
  return (await AsyncStorage.getItem(ONBOARDED_KEY)) === '1';
}

export async function setOnboarded() {
  await AsyncStorage.setItem(ONBOARDED_KEY, '1');
}
