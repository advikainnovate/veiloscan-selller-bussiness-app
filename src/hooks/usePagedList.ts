import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { extractErrorMessage } from '../lib/api';

/**
 * A server-paged list that grows as it scrolls: page 1 on load (and when
 * `deps` change), the next page on `loadMore`, page 1 again on `refresh`.
 * `fetchPage` returns that page's items with the overall total; `extra`
 * carries anything else the response holds (counts, KPIs).
 */
export function usePagedList<T, X = undefined>(
  fetchPage: (page: number) => Promise<{ items: T[]; total: number; extra?: X }>,
  deps: DependencyList,
  { enabled = true, key = (item: T) => String((item as { id?: unknown }).id) }: { enabled?: boolean; key?: (item: T) => string } = {},
) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [extra, setExtra] = useState<X | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const keyRef = useRef(key);
  keyRef.current = key;
  // Only the latest request may set state.
  const request = useRef(0);

  const load = useCallback(async (mode: 'first' | 'refresh' | 'more', nextPage: number) => {
    const id = ++request.current;
    if (mode === 'first') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    if (mode === 'more') setLoadingMore(true);
    try {
      const res = await fetchRef.current(nextPage);
      if (id !== request.current) return;
      setItems(prev => {
        if (mode !== 'more') return res.items;
        const seen = new Set(prev.map(keyRef.current));
        return [...prev, ...res.items.filter(i => !seen.has(keyRef.current(i)))];
      });
      setTotal(res.total);
      setExtra(res.extra);
      setPage(nextPage);
      setError(null);
    } catch (err) {
      if (id === request.current && mode !== 'more') setError(extractErrorMessage(err));
    } finally {
      if (id === request.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    load('first', 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, load, ...deps]);

  const hasMore = items.length < total;
  return {
    items,
    total,
    extra,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    refresh: () => load('refresh', 1),
    retry: () => load('first', 1),
    loadMore: () => {
      if (hasMore && !loadingMore && !loading) load('more', page + 1);
    },
  };
}
