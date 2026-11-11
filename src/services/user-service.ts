import { api, STORE_HEADER } from '../lib/api';
import type { FeatureUsage } from './subscription-service';

// Management › Users (eshop-backend src/modules/users, /users): a seller's own
// staff accounts (SELLER_USER). The API scopes every call to the seller's team
// and only lets them hand out roles inside their own permissions.

export interface StaffUser {
  id: string;
  idd?: string | null;
  firstName: string | null;
  lastName: string | null;
  userDisplayName?: string | null;
  email: string | null;
  countryCode?: string | null;
  phoneNumber?: string | null;
  userType?: string | null;
  gender?: string | null;
  status: string;
  roleId?: string | null;
  parentUserId?: string | null;
  isEmailVerification?: boolean | null;
  isPhoneVerification?: boolean | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AssignableRole {
  id: string;
  roleTitle: string;
  roleDescription?: string | null;
}

export interface UserSession {
  id: string;
  startTime: string | null;
  logoutTime: string | null;
  isActive?: boolean | null;
  ipAddress?: string | null;
  deviceName?: string | null;
  deviceType?: string | null;
  browser?: string | null;
  os?: string | null;
}

export interface UserActivity {
  id: string;
  action: string;
  description?: string | null;
  createdAt: string;
}

export interface UserProfile {
  shortDescription?: string | null;
  displayPic?: { url?: string } | null;
}

export interface CreateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
  userType: 'SELLER_USER';
  password?: string;
  displayName?: string;
  gender?: string;
  roleId?: string;
  designationTitle?: string;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  gender?: string;
  status?: string;
}

const list = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : Array.isArray((value as { items?: unknown })?.items) ? ((value as { items: T[] }).items) : [];

export const userService = {
  /** Every staff account (the panel loads them all and filters on the device). */
  list: (): Promise<StaffUser[]> => api.get('/users', { params: { page: 1, limit: 500 } }).then(res => list<StaffUser>(res.data)),
  get: (id: string): Promise<StaffUser> => api.get(`/users/${id}`).then(res => res.data),
  create: (payload: CreateUserPayload): Promise<StaffUser> => api.post('/users', payload).then(res => res.data),
  update: (id: string, payload: UpdateUserPayload): Promise<StaffUser> => api.patch(`/users/${id}`, payload).then(res => res.data),
  /** Roles the signed-in seller may give out. */
  assignableRoles: (): Promise<AssignableRole[]> => api.get('/users/assignable-roles').then(res => list<AssignableRole>(res.data)),
  assignRole: (id: string, payload: { roleId: string; designationTitle?: string }) => api.post(`/users/${id}/role`, payload).then(res => res.data),
  setActive: (id: string, active: boolean) => api.patch(`/users/${id}/${active ? 'activate' : 'deactivate'}`).then(res => res.data),
  remove: (id: string) => api.delete(`/users/${id}`).then(res => res.data),
  profile: (id: string): Promise<UserProfile | null> => api.get(`/users/${id}/profile`).then(res => res.data ?? null),
  upsertProfile: (id: string, payload: { shortDescription?: string }) => api.put(`/users/${id}/profile`, payload).then(res => res.data),
  sessions: (id: string): Promise<UserSession[]> => api.get(`/users/${id}/sessions`).then(res => list<UserSession>(res.data)),
  activity: (id: string): Promise<UserActivity[]> => api.get(`/users/${id}/activity-logs`, { params: { limit: 50 } }).then(res => list<UserActivity>(res.data)),
  resendVerification: (id: string) => api.post(`/users/${id}/resend-verification`).then(res => res.data),
  /** The plan's staff-account allowance, if it has one. */
  staffUsage: (): Promise<FeatureUsage | null> =>
    api
      .get('/subscriptions/me/usage', { headers: { [STORE_HEADER]: '' } })
      .then(res => (res.data?.isPlatformAdmin ? null : ((res.data?.usage ?? []) as FeatureUsage[]).find(u => u.featureCode === 'STAFF_LIMIT') ?? null)),
};
