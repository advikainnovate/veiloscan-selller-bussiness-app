import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { shortRupees } from '../../lib/sales-report';
import {
  canResubmit,
  canToggle,
  filterWarehouses,
  WAREHOUSE_FILTERS,
  WAREHOUSE_STATUS,
  WAREHOUSE_STOCK,
  WAREHOUSE_TYPES,
  warehouseRows,
  warehouseTypeLabel,
  type WarehouseFilters,
  type WarehouseLifecycle,
  type WarehouseRow,
} from '../../lib/catalog';
import { warehouseMasterService } from '../../services/catalog-service';
import { productSkuService } from '../../services/products-service';
import { stockService } from '../../services/stock-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Sheet } from '../../components/ui/Sheet';
import { SelectField } from '../../components/form/Fields';
import { EmptyState, ErrorState, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { ActionSheet, compactStyles, CountTiles, Fab, ListTop, RowCard, Separator, SummaryLine, TILE_COLORS, useListPadding } from '../../components/list/CompactList';
import { confirmAction, opsStyles, ReasonSheet } from '../../components/operations/OpsParts';
import { BanIcon, BuildingIcon, CheckCircleIcon, EditIcon, EyeIcon, RefreshIcon, SlidersIcon, TrashIcon, WarehouseIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

const PAGE_SIZE = 10;

/** Catalog › Warehouses: warehouses, retail stores and dark stores, checked by VeiloScan before they hold stock. */
export function WarehousesScreen({ navigation }: ScreenProps<'Warehouses'>) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const listPadding = useListPadding();
  const allowed = hasPermission('warehouse-master:manage');
  const { data, error, loading, reload } = useFetch(() => (allowed ? warehouseMasterService.list() : Promise.resolve([])), [allowed]);
  // Stock figures are extras: without them the list still shows.
  const stock = useFetch(() => (allowed ? stockService.list().catch(() => []) : Promise.resolve([])), [allowed]);
  const skus = useFetch(() => (allowed ? productSkuService.list().catch(() => []) : Promise.resolve([])), [allowed]);
  const [filters, setFilters] = useState<WarehouseFilters>(WAREHOUSE_FILTERS);
  const [moreFilters, setMoreFilters] = useState(false);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [actionsFor, setActionsFor] = useState<WarehouseRow | null>(null);
  const [resubmitting, setResubmitting] = useState<WarehouseRow | null>(null);

  const refreshAll = useCallback(() => {
    reload();
    stock.reload();
  }, [reload, stock]);
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) refreshAll();
      focused.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const priceBySku = useMemo(() => new Map((skus.data ?? []).map(s => [String(s.id), Number(s.businessPrice) || 0])), [skus.data]);
  const rows = useMemo(() => warehouseRows(data ?? [], stock.data ?? [], priceBySku), [data, stock.data, priceBySku]);
  const filtered = useMemo(() => filterWarehouses(rows, filters), [rows, filters]);
  const states = useMemo(() => [...new Set(rows.map(r => String(r.state ?? '')).filter(Boolean))].sort().map(s => ({ value: s, label: s })), [rows]);
  const needsAction = rows.filter(r => canResubmit(r.lifecycle) || r.lifecycle === 'SUSPENDED');
  const lowItems = (stock.data ?? []).filter(r => r.available > 0 && r.minimum > 0 && r.available <= r.minimum).length;
  const count = (s: WarehouseLifecycle[]) => rows.filter(r => s.includes(r.lifecycle)).length;
  const isFiltered = Object.values(filters).some(Boolean);
  const extra = [filters.state, filters.type].filter(Boolean).length;
  const set = <K extends keyof WarehouseFilters>(k: K, v: WarehouseFilters[K]) => {
    setFilters(f => ({ ...f, [k]: v }));
    setShown(PAGE_SIZE);
  };

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="Warehouses" onBack={navigation.goBack} />
        <ComingSoon label="Warehouses" icon={WarehouseIcon} allowed={false} />
      </View>
    );
  }

  async function toggle(row: WarehouseRow) {
    const off = row.lifecycle === 'ACTIVE';
    if (!(await confirmAction(`${off ? 'Deactivate' : 'Activate'} "${String(row.facilityTitle)}"?`, undefined, off ? 'Deactivate' : 'Activate', off))) return;
    try {
      await warehouseMasterService.update(row.id, { status: off ? 0 : 1 });
      toast(`Warehouse ${off ? 'deactivated' : 'activated'}`);
      refreshAll();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function remove(row: WarehouseRow) {
    if (!(await confirmAction('Delete warehouse?', `"${String(row.facilityTitle)}" will be removed from this list. Deactivate it instead if you only want to take it out of use.`, 'Delete', true))) return;
    try {
      await warehouseMasterService.remove(row.id);
      toast('Warehouse deleted');
      refreshAll();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  const statusTile = (key: WarehouseLifecycle | 'AWAITING', label: string, n: number, c: keyof typeof TILE_COLORS) => ({ key, label, count: n, ...TILE_COLORS[c] });

  return (
    <View style={opsStyles.screen}>
      <AppHeader title="Warehouses" subtitle="Catalog" onBack={navigation.goBack} />
      <ListTop>
        <SearchBar value={filters.search} onChange={v => set('search', v)} placeholder="Search by name, code or city…" />
        <CountTiles
          tiles={[
            statusTile('ACTIVE', 'Active', count(['ACTIVE']), 'green'),
            statusTile('AWAITING', 'Awaiting', count(['PENDING_APPROVAL', 'UNDER_REVIEW']), 'blue'),
            statusTile('REJECTED', 'Rejected', count(['REJECTED', 'INFO_REQUESTED']), 'red'),
            statusTile('INACTIVE', 'Inactive', count(['INACTIVE', 'SUSPENDED']), 'slate'),
          ]}
          value={filters.status === 'PENDING_APPROVAL' ? 'AWAITING' : filters.status}
          onSelect={k => set('status', k === 'AWAITING' ? 'PENDING_APPROVAL' : k)}
          loading={loading && !data}
        />
        <View style={styles.figures}>
          <Text style={styles.figure}>{`Stock value ${shortRupees(rows.reduce((s, r) => s + r.stockValue, 0))}`}</Text>
          <Text style={styles.figure}>{`Units ${rows.reduce((s, r) => s + r.totalAvailable, 0).toLocaleString('en-IN')}`}</Text>
          <Text style={[styles.figure, lowItems ? styles.warn : null]}>{`Low stock items ${lowItems}`}</Text>
        </View>
        <SummaryLine
          hint={filters.status ? WAREHOUSE_STATUS[filters.status as WarehouseLifecycle].hint : 'New warehouses are checked by VeiloScan before you can stock them.'}
          filtered={isFiltered}
          shown={filtered.length}
          total={rows.length}
          noun="warehouse"
          onClear={() => setFilters(WAREHOUSE_FILTERS)}
          extra={
            <Pressable accessibilityRole="button" accessibilityLabel="More filters" hitSlop={8} onPress={() => setMoreFilters(true)} style={styles.filterBtn}>
              <SlidersIcon size={14} color={extra ? colors.secondary : colors.textSecondary} />
              <Text style={[styles.filterText, extra ? styles.accent : null]}>{extra ? `Filters (${extra})` : 'Filters'}</Text>
            </Pressable>
          }
        />
      </ListTop>

      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={loading && !data ? [] : filtered.slice(0, shown)}
          keyExtractor={r => r.id}
          contentContainerStyle={listPadding}
          ItemSeparatorComponent={Separator}
          refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refreshAll} />}
          onEndReached={() => setShown(n => (n < filtered.length ? n + PAGE_SIZE : n))}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            needsAction.length && !isFiltered ? (
              <View style={styles.attention}>
                <Text style={styles.attentionTitle}>{`${needsAction.length} warehouse${needsAction.length === 1 ? ' needs' : 's need'} your attention`}</Text>
                {needsAction.map(r => (
                  <Pressable key={r.id} accessibilityRole="link" onPress={() => navigation.navigate('WarehouseDetail', { id: r.id })}>
                    <Text style={styles.attentionText} numberOfLines={2}>
                      <Text style={styles.attentionName}>{String(r.facilityTitle)}</Text>
                      {` — ${WAREHOUSE_STATUS[r.lifecycle].label.toLowerCase()}${r.reviewNote ? `: ${String(r.reviewNote)}` : ''}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            loading && !data ? (
              <ListSkeleton rows={4} height={96} />
            ) : (
              <View style={compactStyles.empty}>
                <EmptyState icon={WarehouseIcon} title={isFiltered ? 'No warehouses match' : 'No warehouses found'} text={isFiltered ? 'Try another filter or search term.' : 'Add a warehouse to start stocking products.'} />
              </View>
            )
          }
          renderItem={({ item }) => <WarehouseCard row={item} onOpen={() => navigation.navigate('WarehouseDetail', { id: item.id })} onMore={() => setActionsFor(item)} />}
        />
      )}

      <Fab label="Add Warehouse" onPress={() => navigation.navigate('WarehouseForm')} />

      <Sheet visible={moreFilters} title="Filters" onClose={() => setMoreFilters(false)}>
        <SelectField label="Location" value={filters.state} options={states} onChange={v => set('state', v)} allowClear="All Locations" placeholder="All Locations" />
        <SelectField label="Type" value={filters.type} options={WAREHOUSE_TYPES} onChange={v => set('type', v)} allowClear="All Types" placeholder="All Types" />
        <SelectField
          label="Status"
          value={filters.status}
          options={(Object.keys(WAREHOUSE_STATUS) as WarehouseLifecycle[]).map(k => ({ value: k, label: WAREHOUSE_STATUS[k].label }))}
          onChange={v => set('status', v)}
          allowClear="All Status"
          placeholder="All Status"
        />
      </Sheet>

      <ActionSheet
        visible={!!actionsFor}
        title={String(actionsFor?.facilityTitle ?? '')}
        subtitle={actionsFor ? String(actionsFor.facilityCode) : undefined}
        onClose={() => setActionsFor(null)}
        actions={
          actionsFor
            ? [
                { label: 'View', icon: EyeIcon, onPress: () => navigation.navigate('WarehouseDetail', { id: actionsFor.id }) },
                { label: 'Edit', icon: EditIcon, onPress: () => navigation.navigate('WarehouseForm', { id: actionsFor.id }) },
                { label: 'Resubmit for review', icon: RefreshIcon, hidden: !canResubmit(actionsFor.lifecycle), onPress: () => setResubmitting(actionsFor) },
                {
                  label: actionsFor.lifecycle === 'ACTIVE' ? 'Deactivate' : 'Activate',
                  icon: actionsFor.lifecycle === 'ACTIVE' ? BanIcon : CheckCircleIcon,
                  hidden: !canToggle(actionsFor.lifecycle),
                  onPress: () => toggle(actionsFor),
                },
                { label: 'Delete', icon: TrashIcon, danger: true, onPress: () => remove(actionsFor) },
              ]
            : []
        }
      />

      <ReasonSheet
        visible={!!resubmitting}
        title="Resubmit for review?"
        message="Make sure you've updated the warehouse with what VeiloScan asked for."
        label="Note for the reviewer (optional)"
        confirmLabel="Resubmit"
        required={false}
        maxLength={1000}
        onClose={() => setResubmitting(null)}
        onConfirm={async note => {
          try {
            await warehouseMasterService.resubmit(resubmitting!.id, note);
            toast('Warehouse resubmitted for review');
            setResubmitting(null);
            refreshAll();
          } catch (err) {
            toast(extractErrorMessage(err), 'error');
          }
        }}
      />
    </View>
  );
}

function WarehouseCard({ row, onOpen, onMore }: { row: WarehouseRow; onOpen: () => void; onMore: () => void }) {
  const status = WAREHOUSE_STATUS[row.lifecycle];
  const stock = WAREHOUSE_STOCK[row.stockStatus];
  return (
    <RowCard label={`Open ${String(row.facilityTitle)}`} onPress={onOpen}>
      <View style={compactStyles.head}>
        <View style={[compactStyles.thumb, styles.icon]}>
          <BuildingIcon size={17} color="#4f46e5" />
        </View>
        <View style={styles.flex}>
          <Text style={compactStyles.name} numberOfLines={1}>
            {String(row.facilityTitle)}
          </Text>
          <Text style={compactStyles.meta} numberOfLines={1}>
            {[row.facilityCode, warehouseTypeLabel(row.facilityType), row.city ? `${String(row.city)}${row.state ? `, ${String(row.state)}` : ''}` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Badge label={status.label} tone={status.tone} />
        <Pressable accessibilityRole="button" accessibilityLabel={`More for ${String(row.facilityTitle)}`} hitSlop={10} onPress={onMore} style={compactStyles.more}>
          <Text style={compactStyles.dots}>⋮</Text>
        </Pressable>
      </View>
      <View style={styles.stockRow}>
        <Text style={compactStyles.line}>{`${row.totalAvailable.toLocaleString('en-IN')} units · ₹${row.stockValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}</Text>
        <Text style={[styles.stockStatus, { color: stock.color }]}>{stock.label}</Text>
      </View>
      {row.contactPerson || row.isDefault ? (
        <Text style={compactStyles.meta} numberOfLines={1}>
          {[row.contactPerson ? `Manager: ${String(row.contactPerson)}` : null, row.isDefault ? 'Default warehouse' : null].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      {row.reviewNote && row.lifecycle !== 'ACTIVE' ? (
        <Text style={[compactStyles.meta, styles.note]} numberOfLines={2}>
          {String(row.reviewNote)}
        </Text>
      ) : null}
    </RowCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  accent: { color: colors.secondary },
  warn: { color: colors.warningDark },
  icon: { backgroundColor: '#eef2ff' },
  figures: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  figure: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  stockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stockStatus: { fontFamily: fonts.semibold, fontSize: 11.5 },
  note: { color: colors.warningDark },
  attention: { gap: 4, marginBottom: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: '#fed7aa', backgroundColor: '#fff7ed' },
  attentionTitle: { fontFamily: fonts.semibold, fontSize: 13, color: '#9a3412' },
  attentionText: { fontFamily: fonts.regular, fontSize: 12, color: '#9a3412' },
  attentionName: { fontFamily: fonts.semibold, textDecorationLine: 'underline' },
});
