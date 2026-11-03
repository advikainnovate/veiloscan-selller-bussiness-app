import { api } from '../lib/api';

// The signed-in user's own account (eshop-backend users + seller sales team),
// as the Seller Panel's My Profile page.

export type Rec = Record<string, unknown>;

export type SalesTeamStanding = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SalesTeamState {
  standing: SalesTeamStanding;
  canRequest: boolean;
  /** Their Sales Team account, once approved. */
  salesTeam: { salesId: string; status: string; createdAt: string } | null;
  salesPortalUrl: string | null;
  history: { id: string; status: Exclude<SalesTeamStanding, 'NONE'>; requestNote: string | null; decisionNote: string | null; createdAt: string; decidedAt: string | null }[];
}

export const profileService = {
  /** Photo, bio and documents (user_profiles). */
  get: (userId: string): Promise<Rec | null> => api.get(`/users/${userId}/profile`).then(r => r.data ?? null),
  /** Name, display name and gender. */
  updateUser: (userId: string, payload: Rec) => api.patch(`/users/${userId}`, payload).then(r => r.data),
  upsert: (userId: string, payload: Rec) => api.put(`/users/${userId}/profile`, payload).then(r => r.data),
  salesTeam: (): Promise<SalesTeamState> => api.get('/seller/sales-team').then(r => r.data),
  requestSalesTeam: (note?: string): Promise<SalesTeamState> => api.post('/seller/sales-team/request', { note: note || undefined }).then(r => r.data),
};
