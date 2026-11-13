import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import i18n, { DEFAULT_LANGUAGE, isLanguageCode, type LanguageCode } from '../i18n';
import { hasPendingSync, readSavedLanguage, saveLanguage, setPendingSync } from '../i18n/preferences';
import { useAuth } from './AuthContext';

type SyncState = 'local' | 'synced' | 'pending';

interface LanguageContextValue {
  language: LanguageCode;
  /** False until the saved language has been restored (the splash waits for it). */
  ready: boolean;
  /** Whether a language was ever picked on this device (otherwise it's the English default). */
  chosen: boolean;
  /** 'synced': saved on the account; 'pending': saved here, sent at the next sign-in; 'local': signed out. */
  sync: SyncState;
  /** Switches the whole app at once (no reload), remembers it here and saves it on the account. */
  setLanguage: (code: LanguageCode) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * The interface language. Order of precedence:
 *  1. a change made while signed in that hasn't reached the server yet,
 *  2. the account's preferred_language (follows the user across devices),
 *  3. the language picked on this device (e.g. during Get Started),
 *  4. English — so existing users see no change until they pick one.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { status, user, updateMe } = useAuth();
  const [language, setLanguageState] = useState<LanguageCode>(() => (isLanguageCode(i18n.language) ? i18n.language : DEFAULT_LANGUAGE));
  const [ready, setReady] = useState(false);
  const [chosen, setChosen] = useState(false);
  const [sync, setSync] = useState<SyncState>('local');
  // The user + language last reconciled with the server, so each sign-in syncs once.
  const reconciled = useRef<string | null>(null);

  const apply = useCallback(async (code: LanguageCode) => {
    if (i18n.language !== code) await i18n.changeLanguage(code);
    setLanguageState(code);
  }, []);

  useEffect(() => {
    let cancelled = false;
    readSavedLanguage().then(async saved => {
      if (cancelled) return;
      if (saved) {
        setChosen(true);
        await apply(saved);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const pushToAccount = useCallback(
    async (code: LanguageCode) => {
      try {
        await updateMe({ preferredLanguage: code });
        await setPendingSync(false);
        setSync('synced');
      } catch {
        // Offline, or a backend without the field yet: keep it here, send it next time.
        await setPendingSync(true);
        setSync('pending');
      }
    },
    [updateMe],
  );

  // On sign-in (and session restore), line the device up with the account.
  useEffect(() => {
    if (!ready) return;
    if (status !== 'signedIn' || !user?.id) {
      reconciled.current = null;
      setSync('local');
      return;
    }
    if (reconciled.current === user.id) return;
    reconciled.current = user.id;
    const server = isLanguageCode(user.preferredLanguage) ? user.preferredLanguage : null;
    (async () => {
      const local = await readSavedLanguage();
      if (local && (await hasPendingSync()) && local !== server) {
        await pushToAccount(local);
      } else if (server) {
        await setPendingSync(false);
        await saveLanguage(server);
        setChosen(true);
        await apply(server);
        setSync('synced');
      } else if (local) {
        // Picked here before the account had one (e.g. Get Started): save it on the account.
        await pushToAccount(local);
      } else {
        setSync('synced');
      }
    })();
  }, [ready, status, user?.id, user?.preferredLanguage, apply, pushToAccount]);

  const setLanguage = useCallback(
    async (code: LanguageCode) => {
      setChosen(true);
      await apply(code);
      await saveLanguage(code);
      // Signed out, it's this device's default: at sign-in an account that already
      // has a language (from another device) keeps it; one without takes this.
      if (status !== 'signedIn') return;
      if (user?.preferredLanguage === code) {
        await setPendingSync(false);
        setSync('synced');
        return;
      }
      await pushToAccount(code);
    },
    [apply, status, user?.preferredLanguage, pushToAccount],
  );

  const value = useMemo(() => ({ language, ready, chosen, sync, setLanguage }), [language, ready, chosen, sync, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
