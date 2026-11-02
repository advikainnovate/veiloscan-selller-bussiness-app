import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setSessionExpiredHandler } from '../lib/api';
import { clearSession, restoreSession, saveSession, saveUser, type SessionUser } from '../lib/session';
import { canUseSellerApp, NOT_SELLER_MESSAGE } from '../lib/seller-access';
import { grants, usablePermissions } from '../lib/access-policy';
import { authService, type AuthResult } from '../services/auth-service';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  permissions: string[];
  /** Whether the user's role allows `permission` (e.g. 'orders:manage'). */
  hasPermission: (permission: string) => boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  loginWithOtp: (identifier: string, otp: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const signOutLocally = useCallback(() => {
    setUser(null);
    setPermissions([]);
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
        // Roles aren't kept: permissions drive access in the app.
        const { roles: _roles, permissions: freshPermissions, ...freshUser } = await authService.me();
        if (!canUseSellerApp(freshUser.userType)) throw new Error(NOT_SELLER_MESSAGE);
        setUser(freshUser);
        setPermissions(freshPermissions ?? []);
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
    if (!canUseSellerApp(data.user?.userType)) throw new Error(NOT_SELLER_MESSAGE);
    await saveSession(data, data.user, remember);
    setUser(data.user);
    setPermissions(data.permissions ?? []);
    setStatus('signedIn');
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
    () => ({ status, user, permissions, hasPermission, login, loginWithOtp, logout }),
    [status, user, permissions, hasPermission, login, loginWithOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
