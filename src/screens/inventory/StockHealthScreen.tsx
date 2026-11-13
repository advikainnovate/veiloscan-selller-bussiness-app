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
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

/** Inventory › Stock Health: low, out-of-stock and healthy SKUs of the current store, as the panel's tab. */
export function StockHealthScreen({ navigation, route }: ScreenProps<'StockHealth'>) {
  const { t: tr } = useTranslation();
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
        <AppHeader title={tr('common.stockHealth')} onBack={navigation.goBack} />
        <ComingSoon label={tr('common.stockHealth')} icon={BoxIcon} allowed={false} />
      </View>
    );
  }

  const order = (ids: string[]) => navigation.navigate('StockOrderForm', { variantIds: ids });

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={tr('common.stockHealth')} subtitle={current?.name ?? tr('common.inventory')} onBack={navigation.goBack} />
      <ListTop>
        <SearchBar value={searchInput} onChange={setSearchInput} placeholder={tr('inventory.searchProductOrSku')} />
        <CountTiles
          tiles={[
            { key: 'all', label: tr('common.allSkus'), count: k?.totalSkus ?? '–', ...TILE_COLORS.slate },
            { key: 'low', label: tr('inventory.low'), count: k?.lowStock ?? '–', ...TILE_COLORS.amber },
            { key: 'out', label: tr('inventory.out'), count: k?.outOfStock ?? '–', ...TILE_COLORS.red },
            { key: 'healthy', label: tr('inventory.healthy'), count: k?.healthy ?? '–', ...TILE_COLORS.green },
          ]}
          value={filter}
          onSelect={key => setFilter((key || 'all') as HealthFilter)}
          loading={list.loading && !k}
        />
        <SummaryLine
          hint={
            filter === 'low'
              ? tr('inventory.atOrBelowTheirMinimumStock')
              : filter === 'out'
                ? tr('inventory.nothingAvailableToSell')
                : k
                  ? tr('inventory.skusAcrossProducts', { skus: tr('common.skuCount', { count: k.totalSkus }), products: tr('common.productCount', { count: k.totalProducts }) })
                  : tr('inventory.lowOutOfStockAndHealthy')
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
          <Pressable accessibilityRole="button" accessibilityLabel={tr('inventory.orderNeedstockcountLowOut', { needStockCount: needStock.length })} onPress={() => order(needStock.map(r => r.variantId))} style={[opsStyles.primaryBtn, styles.order]}>
            <TruckIcon size={15} color={colors.white} />
            <Text style={opsStyles.primaryBtnText}>{tr('inventory.orderNeedstockcountLowOut', { needStockCount: needStock.length })}</Text>
          </Pressable>
        ) : null}
      </ListTop>

      {!storeId ? (
        <EmptyState icon={BoxIcon} title={tr('common.noStoreYet')} text={tr('inventory.stockHealthShowsOnceYouHave')} />
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
                  title={search ? tr('inventory.nothingMatches') : filter === 'all' ? tr('inventory.noStockRecordsForThisStores') : tr('inventory.noLowercaseSkus', { lowerCase: HEALTH_FILTERS.find(f => f.value === filter)?.label.toLowerCase() })}
                  text={filter === 'all' && !search ? tr('inventory.stockAppearsHereOnceProductsSold') : undefined}
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
                { label: tr('common.viewProduct'), icon: EyeIcon, onPress: () => navigation.navigate('ProductDetail', { id: actionsFor.productId }) },
                { label: tr('inventory.viewInventory'), icon: WarehouseIcon, hidden: !canInventory || !actionsFor.inventoryId, onPress: () => navigation.navigate('StockDetail', { id: actionsFor.inventoryId }) },
                { label: tr('inventory.restockReceiveNow'), icon: PlusIcon, hidden: !canInventory, onPress: () => navigation.navigate('Inventory', { tab: 'stock' }) },
                { label: tr('inventory.createStockRequest'), icon: TruckIcon, hidden: !canPending, onPress: () => order([actionsFor.variantId]) },
              ]
            : []
        }
      />
    </View>
  );
}

function HealthCard({ row, onMore }: { row: StockHealthRow; onMore: () => void }) {
  const { t } = useTranslation();
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
        <Pressable accessibilityRole="button" accessibilityLabel={t('inventory.moreForProductname', { productName: row.productName })} hitSlop={10} onPress={onMore} style={compactStyles.more}>
          <Text style={compactStyles.dots}>⋮</Text>
        </Pressable>
      </View>
      <View style={styles.figures}>
        <Figure label={t('common.current')} value={`${qty(row.available)} ${row.uom}`} color={h.color} strong />
        <Figure label={t('inventory.minimum')} value={qty(row.minimum)} />
        <Figure label={t('inventory.reorder')} value={row.health === 'healthy' ? '—' : qty(row.suggestedReorder)} />
        <Figure label={t('common.pending')} value={row.pendingQty > 0 ? qty(row.pendingQty) : '—'} color={row.pendingQty > 0 ? '#0369a1' : undefined} />
      </View>
      <Text style={compactStyles.meta}>{row.lastSoldAt ? t('inventory.lastSoldOn', { date: day(row.lastSoldAt) }) : t('inventory.neverSold')}</Text>
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
