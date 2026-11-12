import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '../config/env';
import { DEMO_MODE } from '../demo/flag';
import { clearSession, getAccessToken, getRefreshToken, updateTokens, type SessionTokens } from './session';

// The app names itself, so the API skips the web forms' Cloudflare Turnstile
// check (a browser widget the app can't show) for its sign-in requests.
export const CLIENT_APP_HEADER = 'X-Client-App';
export const CLIENT_APP = 'veiloscan-business';

export const api = axios.create({ baseURL: API_URL, timeout: 20000, headers: { [CLIENT_APP_HEADER]: CLIENT_APP } });

// Store screenshots: a made-up store instead of the server (development builds only).
if (__DEV__ && DEMO_MODE) {
  api.defaults.adapter = require('../demo/demo-api').demoAdapter;
}

// The store picked in the header (as the Seller Panel's store switcher):
// store-linked lists (orders, customers, products, reports…) are narrowed
// to it. The backend only honours one of the seller's own stores.
export const STORE_HEADER = 'X-Store-Id';
let requestStoreId: string | null = null;

export function setRequestStoreId(id: string | null) {
  requestStoreId = id;
}

api.interceptors.request.use(config => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (requestStoreId && !config.headers.has(STORE_HEADER)) config.headers.set(STORE_HEADER, requestStoreId);
  return config;
});

// Called when the session can't be renewed, so the app can return to login.
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<SessionTokens> | null = null;

async function expireSession() {
  await clearSession();
  onSessionExpired?.();
}

api.interceptors.response.use(
  response => {
    // Backend wraps every response as { success, code, message, data }.
    // Unwrap it here so the rest of the app can read res.data directly.
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const status = error.response?.status;
    const isAuthRoute =
      originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/refresh-token');

    if (status !== 401 || isAuthRoute || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      await expireSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${API_URL}/auth/refresh-token`, { refreshToken })
          .then(res => res.data.data as SessionTokens)
          .finally(() => {
            refreshPromise = null;
          });
      }
      const data = await refreshPromise;
      await updateTokens(data);
      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      await expireSession();
      return Promise.reject(refreshError);
    }
  },
);

export function extractErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ message?: string | string[] }>;
  if (axiosError?.isAxiosError && !axiosError.response) {
    return 'Unable to reach VeiloScan. Check your internet connection and try again.';
  }
  const data = axiosError?.response?.data;
  if (Array.isArray(data?.message)) return data.message.join(', ');
  return data?.message || (error as Error)?.message || 'Something went wrong';
}

/** The backend's machine-readable reason for a refused request, if any. */
export function extractErrorCode(error: unknown): unknown {
  return (error as { response?: { data?: { errorCode?: unknown } } })?.response?.data?.errorCode;
}
