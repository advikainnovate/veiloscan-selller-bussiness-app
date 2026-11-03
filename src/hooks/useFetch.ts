import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { extractErrorMessage } from '../lib/api';
import { STORE_PENDING, useStore } from '../context/StoreContext';

export interface FetchState<T> {
  data: T | undefined;
  error: string | null;
  /** First load (no data yet). */
  loading: boolean;
  /** Pull-to-refresh in progress. */
  refreshing: boolean;
  /** Reload; `asRefresh` drives the pull-to-refresh spinner. */
  reload: (asRefresh?: boolean) => Promise<void>;
}

/**
 * Loads data with `fetcher` and reloads when `deps` change or the store is
 * switched. Keeps the last data on a failed reload, so a dropped connection
 * doesn't blank a list.
 */
export function useFetch<T>(fetcher: () => Promise<T>, deps: DependencyList): FetchState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  // Only the latest request may set state.
  const requestId = useRef(0);

  const reload = useCallback(async (asRefresh = false) => {
    const id = ++requestId.current;
    if (asRefresh) setRefreshing(true);
    try {
      const result = await fetcherRef.current();
      if (id !== requestId.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(extractErrorMessage(err));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const { storeKey } = useStore();
  const loadedFor = useRef(storeKey);
  useEffect(() => {
    // Another store's data mustn't linger while this one's loads.
    if (loadedFor.current !== storeKey) {
      loadedFor.current = storeKey;
      setData(undefined);
      setError(null);
    }
    setLoading(true);
    // Wait for the store, so a list doesn't first load for every store.
    if (storeKey === STORE_PENDING) return;
    reload();
    // Reload when the caller's inputs or the store change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, storeKey]);

  return { data, error, loading: loading && data === undefined, refreshing, reload };
}
