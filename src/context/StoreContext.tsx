import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setRequestStoreId } from '../lib/api';
import { storeService, type StoreOption } from '../services/store-service';
import { useAuth } from './AuthContext';

/** `storeKey` while the store list is loading: data waits rather than load for every store first. */
export const STORE_PENDING = 'pending';

interface StoreContextValue {
  /** The seller's stores; empty when they have none or the list couldn't load. */
  stores: StoreOption[];
  /** The picked store, or the first one; null with no stores (lists then span all stores). */
  current: StoreOption | null;
  select: (id: string) => void;
  /** Reloads the store list. */
  refresh: () => Promise<void>;
  /** Changes whenever the store does: data hooks reload on it. */
  storeKey: string;
}

// Without a provider (screens rendered alone) nothing is narrowed and nothing waits.
const StoreContext = createContext<StoreContextValue>({
  stores: [],
  current: null,
  select: () => {},
  refresh: async () => {},
  storeKey: '',
});

const keyFor = (userId: string | undefined) => `app.currentStoreId.${userId ?? 'me'}`;

/**
 * The store the app works in, as the Seller Panel's header switcher: picked
 * once, remembered on the phone per user, and sent with every request.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const userId = user?.id;
  const [stores, setStores] = useState<StoreOption[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [list, saved] = await Promise.all([
      // Without stores:view (or offline) the app still works, across all stores.
      storeService.list().catch(() => [] as StoreOption[]),
      AsyncStorage.getItem(keyFor(userId)).catch(() => null),
    ]);
    const picked = list.find(s => s.id === saved) ?? list[0] ?? null;
    // Before the state change, so the reloads it triggers already carry the store.
    setRequestStoreId(picked?.id ?? null);
    setSelectedId(picked?.id ?? null);
    setStores(list);
  }, [userId]);

  useEffect(() => {
    if (status === 'signedIn') {
      load();
      return;
    }
    setRequestStoreId(null);
    setStores(null);
    setSelectedId(null);
  }, [status, load]);

  const select = useCallback(
    (id: string) => {
      setRequestStoreId(id);
      setSelectedId(id);
      AsyncStorage.setItem(keyFor(userId), id).catch(() => {});
    },
    [userId],
  );

  const value = useMemo<StoreContextValue>(() => {
    const list = stores ?? [];
    const current = list.find(s => s.id === selectedId) ?? list[0] ?? null;
    return {
      stores: list,
      current,
      select,
      refresh: load,
      storeKey: status === 'signedIn' && stores === null ? STORE_PENDING : current?.id ?? '',
    };
  }, [stores, selectedId, select, load, status]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}
