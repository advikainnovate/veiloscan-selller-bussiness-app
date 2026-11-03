import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { usePagedList } from '../../hooks/usePagedList';
import { day } from '../../lib/operations';
import { HEALTH, HEALTH_FILTERS, qty, variantLabel, type HealthFilter } from '../../lib/stock-orders';
import { storeOperationsService, type StockHealth, type StockHealthRow } from '../../services/store-operations-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, ErrorState, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { ActionSheet, compactStyles, CountTiles, ListTop, RowCard, Separator, SummaryLine, TILE_COLORS, useListPadding } from '../../components/list/CompactList';
import { opsStyles } from '../../components/operations/OpsParts';
import { BoxIcon, EyeIcon, PlusIcon, TruckIcon, WarehouseIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

/** Inventory › Stock Health: low, out-of-stock and healthy SKUs of the current store, as the panel's tab. */
export function StockHealthScreen({ navigation, route }: ScreenProps<'StockHealth'>) {
  const { hasPermission } = useAuth();
  const { current } = useStore();
  const listPadding = useListPadding();
  const allowed = hasPermission('store-operations:manage');
  const canPending = hasPermission('pending-stock:manage');
  const canInventory = hasPermission('product-inventory:manage') || hasPermission('products-master:manage');
  const storeId = allowed ? current?.id ?? '' : '';
  const initial = HEALTH_FILTERS.some(f => f.value === route.params?.filter) ? (route.params!.filter as HealthFilter) : 'all';
  const [filter, setFilter] = useState<HealthFilter>(initial);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [actionsFor, setActionsFor] = useState<StockHealthRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const list = usePagedList<StockHealthRow, StockHealth['kpis']>(
    async page => {
      const res = await storeOperationsService.stockHealth(storeId, { filter, search: search || undefined, page, limit: PAGE_SIZE });
      return { items: res.items, total: res.total, extra: res.kpis };
    },
    [storeId, filter, search],
    { enabled: !!storeId, key: r => r.variantId },
  );
  const k = list.extra;
  const needStock = list.items.filter(r => r.health !== 'healthy');

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="Stock Health" onBack={navigation.goBack} />
        <ComingSoon label="Stock Health" icon={BoxIcon} allowed={false} />
      </View>
    );
  }

  const order = (ids: string[]) => navigation.navigate('StockOrderForm', { variantIds: ids });

  return (
    <View style={opsStyles.screen}>
      <AppHeader title="Stock Health" subtitle={current?.name ?? 'Inventory'} onBack={navigation.goBack} />
      <ListTop>
        <SearchBar value={searchInput} onChange={setSearchInput} placeholder="Search product or SKU…" />
        <CountTiles
          tiles={[
            { key: 'all', label: 'All SKUs', count: k?.totalSkus ?? '–', ...TILE_COLORS.slate },
            { key: 'low', label: 'Low', count: k?.lowStock ?? '–', ...TILE_COLORS.amber },
            { key: 'out', label: 'Out', count: k?.outOfStock ?? '–', ...TILE_COLORS.red },
            { key: 'healthy', label: 'Healthy', count: k?.healthy ?? '–', ...TILE_COLORS.green },
          ]}
          value={filter}
          onSelect={key => setFilter((key || 'all') as HealthFilter)}
          loading={list.loading && !k}
        />
        <SummaryLine
          hint={
            filter === 'low'
              ? 'At or below their minimum stock.'
              : filter === 'out'
                ? 'Nothing available to sell.'
                : k
                  ? `${k.totalSkus} SKU${k.totalSkus === 1 ? '' : 's'} across ${k.totalProducts} product${k.totalProducts === 1 ? '' : 's'}.`
                  : 'Low, out-of-stock and healthy products at a glance.'
          }
          filtered={filter !== 'all' || !!search}
          shown={list.total}
          total={k?.totalSkus ?? list.total}
          noun="SKU"
          onClear={() => {
            setFilter('all');
            setSearchInput('');
          }}
        />
        {canPending && needStock.length ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Order ${needStock.length} low / out`} onPress={() => order(needStock.map(r => r.variantId))} style={[opsStyles.primaryBtn, styles.order]}>
            <TruckIcon size={15} color={colors.white} />
            <Text style={opsStyles.primaryBtnText}>{`Order ${needStock.length} low / out`}</Text>
          </Pressable>
        ) : null}
      </ListTop>

      {!storeId ? (
        <EmptyState icon={BoxIcon} title="No store yet" text="Stock health shows once you have a store." />
      ) : list.error && !list.items.length ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : (
        <FlatList
          data={list.loading && !list.items.length ? [] : list.items}
          keyExtractor={r => r.variantId}
          contentContainerStyle={listPadding}
          ItemSeparatorComponent={Separator}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            list.loading ? (
              <ListSkeleton rows={5} height={86} />
            ) : (
              <View style={compactStyles.empty}>
                <EmptyState
                  icon={BoxIcon}
                  title={search ? 'Nothing matches' : filter === 'all' ? "No stock records for this store's products" : `No ${HEALTH_FILTERS.find(f => f.value === filter)?.label.toLowerCase()} SKUs`}
                  text={filter === 'all' && !search ? 'Stock appears here once products sold in this store have inventory.' : undefined}
                />
              </View>
            )
          }
          ListFooterComponent={list.loadingMore ? <ActivityIndicator color={colors.secondary} style={styles.more} /> : undefined}
          renderItem={({ item }) => <HealthCard row={item} onMore={() => setActionsFor(item)} />}
        />
      )}

      <ActionSheet
        visible={!!actionsFor}
        title={actionsFor?.productName ?? ''}
        subtitle={actionsFor ? actionsFor.sku : undefined}
        onClose={() => setActionsFor(null)}
        actions={
          actionsFor
            ? [
                { label: 'View Product', icon: EyeIcon, onPress: () => navigation.navigate('ProductDetail', { id: actionsFor.productId }) },
                { label: 'View Inventory', icon: WarehouseIcon, hidden: !canInventory || !actionsFor.inventoryId, onPress: () => navigation.navigate('StockDetail', { id: actionsFor.inventoryId }) },
                { label: 'Restock (receive now)', icon: PlusIcon, hidden: !canInventory, onPress: () => navigation.navigate('Inventory', { tab: 'stock' }) },
                { label: 'Create Stock Request', icon: TruckIcon, hidden: !canPending, onPress: () => order([actionsFor.variantId]) },
              ]
            : []
        }
      />
    </View>
  );
}

function HealthCard({ row, onMore }: { row: StockHealthRow; onMore: () => void }) {
  const h = HEALTH[row.health];
  const variant = variantLabel(row.combination);
  return (
    <RowCard label={`${row.productName}, ${h.label}`} onPress={onMore}>
      <View style={compactStyles.head}>
        <View style={compactStyles.thumb}>{row.imageUrl ? <Image source={{ uri: row.imageUrl }} style={compactStyles.thumbImage} /> : <BoxIcon size={16} color={colors.textMuted} />}</View>
        <View style={styles.flex}>
          <Text style={compactStyles.name} numberOfLines={1}>
            {row.productName}
          </Text>
          <Text style={compactStyles.meta} numberOfLines={1}>
            {[variant, row.sku].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Badge label={h.label} tone={h.tone} />
        <Pressable accessibilityRole="button" accessibilityLabel={`More for ${row.productName}`} hitSlop={10} onPress={onMore} style={compactStyles.more}>
          <Text style={compactStyles.dots}>⋮</Text>
        </Pressable>
      </View>
      <View style={styles.figures}>
        <Figure label="Current" value={`${qty(row.available)} ${row.uom}`} color={h.color} strong />
        <Figure label="Minimum" value={qty(row.minimum)} />
        <Figure label="Reorder" value={row.health === 'healthy' ? '—' : qty(row.suggestedReorder)} />
        <Figure label="Pending" value={row.pendingQty > 0 ? qty(row.pendingQty) : '—'} color={row.pendingQty > 0 ? '#0369a1' : undefined} />
      </View>
      <Text style={compactStyles.meta}>{`Last sold ${row.lastSoldAt ? day(row.lastSoldAt) : 'never'}`}</Text>
    </RowCard>
  );
}

function Figure({ label, value, color, strong }: { label: string; value: string; color?: string; strong?: boolean }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figLabel}>{label}</Text>
      <Text style={[styles.figValue, strong && styles.strong, color ? { color } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  order: { alignSelf: 'stretch', justifyContent: 'center' },
  more: { marginVertical: 16 },
  figures: { flexDirection: 'row', gap: 6, marginTop: 4, padding: 8, borderRadius: radius.md, backgroundColor: colors.background },
  figure: { flex: 1, minWidth: 0 },
  figLabel: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.textMuted },
  figValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  strong: { fontFamily: fonts.extrabold, fontSize: 14 },
});
