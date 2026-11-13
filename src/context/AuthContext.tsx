import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setSessionExpiredHandler } from '../lib/api';
import { clearSession, restoreSession, saveSession, saveUser, type SessionUser } from '../lib/session';
import { canUseSellerApp, notSellerMessage } from '../lib/seller-access';
import { grants, usablePermissions } from '../lib/access-policy';
import { authService, type AuthResult } from '../services/auth-service';
import { stopPush } from '../lib/push';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  permissions: string[];
  /** The role titles, e.g. "Store Manager" (staff); usually one. */
  roles: string[];
  /** Fetches the signed-in user again, e.g. after editing the profile. */
  refreshUser: () => Promise<void>;
  /** Saves the user's own preferences (PATCH /auth/me) and takes the answer as the signed-in user. */
  updateMe: (payload: { preferredLanguage?: string }) => Promise<void>;
  /** Whether the user's role allows `permission` (e.g. 'orders:manage'). */
  hasPermission: (permission: string) => boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  loginWithOtp: (identifier: string, otp: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Role titles from /auth/me ([{ roleTitle }]) or plain strings. */
function roleTitles(roles: unknown): string[] {
  if (!Array.isArray(roles)) return [];
  return roles.map(r => (typeof r === 'string' ? r : String((r as { roleTitle?: unknown })?.roleTitle ?? ''))).filter(Boolean);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  const signOutLocally = useCallback(() => {
    setUser(null);
    setPermissions([]);
    setRoles([]);
    setStatus('signedOut');
  }, []);

  // A remembered sign-in is checked with /auth/me before it is trusted.
  useEffect(() => {
    setSessionExpiredHandler(signOutLocally);

    (async () => {
      const savedUser = await restoreSession();
      if (!savedUser) {
        setStatus('signedOut');
        return;
      }
      try {
        // Permissions drive access; role titles are only shown.
        const { roles: freshRoles, permissions: freshPermissions, ...freshUser } = await authService.me();
        if (!canUseSellerApp(freshUser.userType)) throw new Error(notSellerMessage());
        setUser(freshUser);
        setPermissions(freshPermissions ?? []);
        setRoles(roleTitles(freshRoles));
        await saveUser(freshUser);
        setStatus('signedIn');
      } catch {
        await clearSession();
        signOutLocally();
      }
    })();

    return () => setSessionExpiredHandler(null);
  }, [signOutLocally]);

  const startSession = useCallback(async (data: AuthResult, remember: boolean) => {
    // The API already refuses non-seller accounts; this is a backstop.
    if (!canUseSellerApp(data.user?.userType)) throw new Error(notSellerMessage());
    await saveSession(data, data.user, remember);
    setUser(data.user);
    setPermissions(data.permissions ?? []);
    setRoles(roleTitles(data.roles));
    setStatus('signedIn');
  }, []);

  const refreshUser = useCallback(async () => {
    const { roles: freshRoles, permissions: freshPermissions, ...freshUser } = await authService.me();
    setUser(freshUser);
    setPermissions(freshPermissions ?? []);
    setRoles(roleTitles(freshRoles));
    await saveUser(freshUser);
  }, []);

  const updateMe = useCallback(async (payload: { preferredLanguage?: string }) => {
    const { roles: freshRoles, permissions: freshPermissions, ...freshUser } = await authService.updateMe(payload);
    setUser(freshUser);
    if (freshPermissions) setPermissions(freshPermissions);
    if (freshRoles) setRoles(roleTitles(freshRoles));
    await saveUser(freshUser);
  }, []);

  const login = useCallback(
    async (email: string, password: string, remember: boolean) => {
      await startSession(await authService.login(email, password), remember);
    },
    [startSession],
  );

  const loginWithOtp = useCallback(
    async (identifier: string, otp: string, remember: boolean) => {
      await startSession(await authService.verifyLoginOtp(identifier, otp), remember);
    },
    [startSession],
  );

  const logout = useCallback(async () => {
    // While still signed in, so the backend knows whose device it is.
    await stopPush();
    try {
      await authService.logout();
    } catch {
      // Signed out locally either way.
    }
    await clearSession();
    signOutLocally();
  }, [signOutLocally]);

  const usable = useMemo(() => usablePermissions(permissions), [permissions]);
  const hasPermission = useCallback((permission: string) => grants(usable, permission), [usable]);

  const value = useMemo(
    () => ({ status, user, permissions, roles, refreshUser, updateMe, hasPermission, login, loginWithOtp, logout }),
    [status, user, permissions, roles, refreshUser, updateMe, hasPermission, login, loginWithOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
