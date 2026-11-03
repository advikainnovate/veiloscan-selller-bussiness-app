import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { usePagedList } from '../../hooks/usePagedList';
import { day, money } from '../../lib/operations';
import { ORDER_FILTERS, qty, STOCK_ORDER_STATUS } from '../../lib/stock-orders';
import { storeOperationsService, type StockOrderList, type StockOrderRow } from '../../services/store-operations-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, ErrorState, FilterChips, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { compactStyles, CountTiles, Fab, ListTop, RowCard, Separator, TILE_COLORS, useListPadding } from '../../components/list/CompactList';
import { opsStyles } from '../../components/operations/OpsParts';
import { AlertCircleIcon, TruckIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

/** Inventory › Pending Stock: stock ordered from suppliers that hasn't fully arrived, as the panel's tab. */
export function PendingStockScreen({ navigation, route }: ScreenProps<'PendingStock'>) {
  const { hasPermission } = useAuth();
  const { current } = useStore();
  const listPadding = useListPadding();
  const allowed = hasPermission('pending-stock:manage');
  const storeId = allowed ? current?.id ?? '' : '';
  const [filter, setFilter] = useState(ORDER_FILTERS.some(f => f.value === route.params?.filter) ? route.params!.filter! : 'open');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const list = usePagedList<StockOrderRow, StockOrderList['counts']>(
    async page => {
      const res = await storeOperationsService.stockOrders(storeId, { filter, search: search || undefined, page, limit: PAGE_SIZE });
      return { items: res.items, total: res.total, extra: res.counts };
    },
    [storeId, filter, search],
    { enabled: !!storeId },
  );
  const c = list.extra;

  // Orders change on their own page (received, cancelled…).
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) list.refresh();
      focused.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="Pending Stock" onBack={navigation.goBack} />
        <ComingSoon label="Pending Stock" icon={TruckIcon} allowed={false} />
      </View>
    );
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title="Pending Stock" subtitle={current?.name ?? 'Inventory'} onBack={navigation.goBack} />
      <ListTop>
        <SearchBar value={searchInput} onChange={setSearchInput} placeholder="Order ID, supplier, reference…" />
        <CountTiles
          tiles={[
            { key: 'open', label: 'Open', count: c?.open ?? '–', ...TILE_COLORS.blue },
            { key: 'delayed', label: 'Delayed', count: c?.delayed ?? '–', ...TILE_COLORS.red },
            { key: 'value', label: 'Open value', count: c ? money(c.openAmount) : '–', info: true, ...TILE_COLORS.amber },
            { key: 'RECEIVED', label: 'Received', count: c?.received ?? '–', ...TILE_COLORS.green },
          ]}
          value={filter}
          onSelect={key => setFilter(key || 'open')}
          loading={list.loading && !c}
        />
        <FilterChips
          options={ORDER_FILTERS.map(f => ({ value: f.value, label: f.label, count: c && f.count ? c[f.count] : undefined }))}
          value={filter}
          onChange={setFilter}
        />
      </ListTop>

      {!storeId ? (
        <EmptyState icon={TruckIcon} title="No store yet" text="Stock orders show once you have a store." />
      ) : list.error && !list.items.length ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : (
        <FlatList
          data={list.loading && !list.items.length ? [] : list.items}
          keyExtractor={o => o.id}
          contentContainerStyle={listPadding}
          ItemSeparatorComponent={Separator}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            list.loading ? (
              <ListSkeleton rows={4} height={110} />
            ) : (
              <View style={compactStyles.empty}>
                <EmptyState
                  icon={TruckIcon}
                  title={search ? 'No stock orders match' : filter === 'delayed' ? 'Nothing is delayed' : 'No stock orders here'}
                  text={!search && filter === 'open' ? "Record stock you've ordered from suppliers. Receive it here when it arrives and it's added to inventory." : undefined}
                />
              </View>
            )
          }
          ListFooterComponent={list.loadingMore ? <ActivityIndicator color={colors.secondary} style={styles.more} /> : undefined}
          renderItem={({ item }) => <OrderCard order={item} onOpen={() => navigation.navigate('StockOrderDetail', { id: item.id })} />}
        />
      )}

      <Fab label="New Stock Order" onPress={() => navigation.navigate('StockOrderForm')} />
    </View>
  );
}

function OrderCard({ order: o, onOpen }: { order: StockOrderRow; onOpen: () => void }) {
  const st = STOCK_ORDER_STATUS[o.status];
  const pct = o.totalUnits > 0 ? Math.min(1, o.receivedUnits / o.totalUnits) : 0;
  return (
    <RowCard label={`Open ${o.idd}, ${o.supplierName}`} onPress={onOpen}>
      <View style={compactStyles.head}>
        <Text style={compactStyles.name} numberOfLines={1}>
          {o.supplierName}
        </Text>
        <Badge label={st.label} tone={st.tone} />
      </View>
      <Text style={compactStyles.meta} numberOfLines={1}>
        {[o.idd, day(o.orderDate), o.referenceNumber ? `Ref ${o.referenceNumber}` : o.warehouseTitle].filter(Boolean).join(' · ')}
      </Text>
      <View style={styles.units}>
        <Text style={styles.unitsText}>{`${qty(o.receivedUnits)} / ${qty(o.totalUnits)} units received`}</Text>
        <Text style={styles.amount}>{money(o.orderAmount)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
      <View style={styles.foot}>
        <Text style={compactStyles.meta}>{`${o.products} product${o.products === 1 ? '' : 's'}${o.status === 'CANCELLED' ? '' : ` · ${qty(o.pendingUnits)} pending`}`}</Text>
        {o.delayed ? (
          <View style={styles.delayed}>
            <AlertCircleIcon size={12} color={colors.error} />
            <Text style={styles.delayedText}>{`Delayed · expected ${day(o.expectedDate)}`}</Text>
          </View>
        ) : o.expectedDate ? (
          <Text style={compactStyles.meta}>{`Expected ${day(o.expectedDate)}`}</Text>
        ) : null}
      </View>
    </RowCard>
  );
}

const styles = StyleSheet.create({
  more: { marginVertical: 16 },
  units: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  unitsText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  amount: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  track: { height: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.background },
  fill: { height: '100%', borderRadius: 3, backgroundColor: '#10b981' },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  delayed: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.errorLight },
  delayedText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.error },
});
