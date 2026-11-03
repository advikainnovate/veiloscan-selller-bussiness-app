import { api, STORE_HEADER } from '../lib/api';

// The seller's stores (eshop-backend src/modules/store, GET /stores), for
// the store switcher. Needs stores:view.

export interface StoreOption {
  id: string;
  name: string;
  code: string | null;
  status: string | null;
}

export const storeService = {
  list(): Promise<StoreOption[]> {
    // Sent without a store, so a store that's gone can't block the list.
    return api.get('/stores', { headers: { [STORE_HEADER]: '' } }).then(res =>
      (Array.isArray(res.data) ? res.data : []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        name: typeof r.name === 'string' && r.name ? r.name : 'Store',
        code: typeof r.code === 'string' ? r.code : null,
        status: typeof r.status === 'string' ? r.status : null,
      })),
    );
  },
};
