import { api, STORE_HEADER } from '../lib/api';

// The seller's plan (eshop-backend src/modules/subscriptions, GET
// /subscriptions/me). Presentation only: the API enforces the same gates.
export interface MySubscription {
  plan: { planName?: string } | null;
  /** The plan includes All Stores (the consolidated dashboard). */
  consolidatedDashboard: boolean;
}

export const subscriptionService = {
  mine(): Promise<MySubscription> {
    // About the whole account, not the selected store.
    return api.get('/subscriptions/me', { headers: { [STORE_HEADER]: '' } }).then(res => res.data);
  },
};
