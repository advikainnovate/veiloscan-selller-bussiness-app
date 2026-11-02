import { api } from '../lib/api';
import { DEVICE_TYPE } from '../config/env';
import type { SessionTokens, SessionUser } from '../lib/session';

export interface AuthResult extends SessionTokens {
  user: SessionUser;
  roles?: unknown;
  permissions?: string[];
}

// Every sign-in names the app: the API only accepts SELLER / SELLER_USER
// accounts for the "seller" panel.
const PANEL = 'seller';

export const authService = {
  login(email: string, password: string): Promise<AuthResult> {
    return api
      .post('/auth/login', { email, password, deviceType: DEVICE_TYPE, panel: PANEL })
      .then(res => res.data);
  },
  // Sign in with a one-time code instead of the password: the code goes to
  // the account's email and phone.
  sendLoginOtp(identifier: string): Promise<{ message: string }> {
    return api.post('/auth/login-otp/send', { identifier, panel: PANEL }).then(res => res.data);
  },
  verifyLoginOtp(identifier: string, otp: string): Promise<AuthResult> {
    return api
      .post('/auth/login-otp/verify', { identifier, otp, deviceType: DEVICE_TYPE, panel: PANEL })
      .then(res => res.data);
  },
  // Emails a 6-digit reset code. The answer is the same whether or not the
  // account exists, so it can't be used to probe for emails.
  forgotPassword(email: string): Promise<{ message: string }> {
    return api.post('/auth/forgot-password', { email }).then(res => res.data);
  },
  resetPassword(email: string, otp: string, newPassword: string): Promise<{ message?: string }> {
    return api.post('/auth/reset-password', { email, otp, newPassword }).then(res => res.data);
  },
  logout() {
    return api.post('/auth/logout').then(res => res.data);
  },
  me(): Promise<SessionUser & { roles?: unknown; permissions?: string[] }> {
    return api.get('/auth/me').then(res => res.data);
  },
};
