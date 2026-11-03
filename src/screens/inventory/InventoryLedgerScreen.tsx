import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { formatQuantity } from '../../lib/inventory';
import { dateTime } from '../../lib/operations';
import { MOVEMENT_TYPES, moved, movementLabel, movementTone, signed } from '../../lib/stock';
import { direction, enteredLabel, filterLedger, referenceLabel } from '../../lib/inventory-ledger';
import { inventoryLedgerService, type LedgerRow } from '../../services/inventory-ledger-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Sheet } from '../../components/ui/Sheet';
import { SelectField } from '../../components/form/Fields';
import { EmptyState, ErrorState, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { compactStyles, CountTiles, ListTop, RowCard, Separator, SummaryLine, TILE_COLORS, useListPadding } from '../../components/list/CompactList';
import { Detail, opsStyles } from '../../components/operations/OpsParts';
import { ClipboardListIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

const PAGE = 40;
const TYPE_OPTIONS = MOVEMENT_TYPES.map(t => ({ value: t, label: movementLabel(t) }));

/** Catalog › Inventory Ledger: every stock movement, newest first. Entries come from stock operations and orders — never edited. */
export function InventoryLedgerScreen({ navigation }: ScreenProps<'InventoryLedger'>) {
  const { hasPermission } = useAuth();
  const listPadding = useListPadding();
  const allowed = hasPermission('inventory-transactions:manage');
  const { data, error, loading, reload } = useFetch(() => (allowed ? inventoryLedgerService.list() : Promise.resolve([])), [allowed]);
  const [search, setSearch] = useState('');
  const [dir, setDir] = useState('');
  const [type, setType] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<LedgerRow | null>(null);

  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const items = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => filterLedger(items, { search, direction: dir, type, warehouse }), [items, search, dir, type, warehouse]);
  const count = (d: string) => items.filter(e => direction(e) === d).length;
  const warehouses = useMemo(() => [...new Set(items.map(e => e.warehouseTitle).filter((w): w is string => !!w))].sort().map(w => ({ value: w, label: w })), [items]);
  const isFiltered = !!(search.trim() || dir || type || warehouse);
  const reset = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setShown(PAGE);
  };

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="Inventory Ledger" onBack={navigation.goBack} />
        <ComingSoon label="Inventory Ledger" icon={ClipboardListIcon} allowed={false} />
      </View>
    );
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title="Inventory Ledger" subtitle="Catalog" onBack={navigation.goBack} />
      <ListTop>
        <SearchBar value={search} onChange={reset(setSearch)} placeholder="Search product, SKU, reference…" />
        <CountTiles
          tiles={[
            { key: 'total', label: 'Movements', count: items.length, info: true, ...TILE_COLORS.orange },
            { key: 'in', label: 'Stock in', count: count('in'), ...TILE_COLORS.green },
            { key: 'out', label: 'Stock out', count: count('out'), ...TILE_COLORS.red },
            { key: 'hold', label: 'Holds', count: count('hold'), ...TILE_COLORS.amber },
          ]}
          value={dir}
          onSelect={reset(setDir)}
          loading={loading && !data}
        />
        <View style={styles.filters}>
          <View style={styles.flex}>
            <SelectField label="Movement" value={type} options={TYPE_OPTIONS} onChange={reset(setType)} placeholder="All movements" allowClear="All movements" />
          </View>
          {warehouses.length > 1 ? (
            <View style={styles.flex}>
              <SelectField label="Warehouse" value={warehouse} options={warehouses} onChange={reset(setWarehouse)} placeholder="All warehouses" allowClear="All warehouses" />
            </View>
          ) : null}
        </View>
        <SummaryLine
          hint="Every stock movement, newest first. Added by stock operations and orders — never edited."
          filtered={isFiltered}
          shown={rows.length}
          total={items.length}
          noun="movement"
          onClear={() => {
            setSearch('');
            setDir('');
            setType('');
            setWarehouse('');
            setShown(PAGE);
          }}
        />
      </ListTop>

      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={loading && !data ? [] : rows.slice(0, shown)}
          keyExtractor={e => e.id}
          contentContainerStyle={listPadding}
          ItemSeparatorComponent={Separator}
          onEndReached={() => setShown(n => (n < rows.length ? n + PAGE : n))}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} tintColor={colors.secondary} colors={[colors.secondary]} />}
          ListEmptyComponent={
            loading && !data ? (
              <ListSkeleton rows={5} height={86} />
            ) : (
              <View style={compactStyles.empty}>
                <EmptyState
                  icon={ClipboardListIcon}
                  title={isFiltered ? 'No movements match' : 'No stock movements yet'}
                  text={isFiltered ? 'Try another filter or search term.' : 'Receipts, sales, counts, damage, transfers and returns appear here as they happen.'}
                />
              </View>
            )
          }
          ListFooterComponent={rows.length > shown ? <Text style={[opsStyles.muted, styles.more]}>{`Showing ${shown} of ${rows.length} — scroll for more`}</Text> : undefined}
          renderItem={({ item: e }) => <LedgerCard entry={e} onPress={() => setOpen(e)} />}
        />
      )}

      <LedgerSheet
        entry={open}
        onClose={() => setOpen(null)}
        onStock={
          open?.inventoryId && hasPermission('product-inventory:manage')
            ? () => {
                const id = open.inventoryId!;
                setOpen(null);
                navigation.navigate('StockDetail', { id });
              }
            : undefined
        }
        onOrder={
          open?.orderId && hasPermission('orders:manage')
            ? () => {
                const id = open.orderId!;
                setOpen(null);
                navigation.navigate('OrderDetail', { id });
              }
            : undefined
        }
      />
    </View>
  );
}

function LedgerCard({ entry: e, onPress }: { entry: LedgerRow; onPress: () => void }) {
  const [bg, fg] = movementTone(e.type);
  const qty = moved(e) ?? (e.legacyQuantity ? (direction(e) === 'out' ? -1 : 1) * Math.abs(Number(e.legacyQuantity)) : null);
  return (
    <RowCard label={`Open ${movementLabel(e.type)} for ${e.productName ?? 'item'}`} onPress={onPress}>
      <View style={compactStyles.head}>
        <View style={[compactStyles.thumb, { backgroundColor: bg }]}>
          <ClipboardListIcon size={16} color={fg} />
        </View>
        <View style={styles.flex}>
          <Text style={compactStyles.name} numberOfLines={1}>
            {e.productName ?? '—'}
          </Text>
          <Text style={compactStyles.meta} numberOfLines={1}>
            {[e.sku, e.warehouseTitle].filter(Boolean).join(' · ') || '—'}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={[styles.qty, qty && qty < 0 ? styles.neg : styles.pos]}>{signed(qty)}</Text>
          {e.enteredUom ? <Text style={compactStyles.meta}>{e.enteredUom}</Text> : null}
        </View>
      </View>
      <View style={compactStyles.chips}>
        <Text style={[compactStyles.chip, { backgroundColor: bg, color: fg }]}>{movementLabel(e.type)}</Text>
        {e.onHandAfter !== null ? <Text style={compactStyles.chip}>{`On hand ${formatQuantity(e.onHandAfter)}`}</Text> : null}
        <Text style={[compactStyles.meta, styles.flex]} numberOfLines={1}>
          {`${dateTime(e.createdAt)}${e.performedBy ? ` · ${e.performedBy}` : ''}`}
        </Text>
      </View>
    </RowCard>
  );
}

function Delta({ label, value, after }: { label: string; value: number | null; after: number | null }) {
  return (
    <View style={styles.delta}>
      <Text style={styles.deltaLabel}>{label}</Text>
      <Text style={[styles.deltaValue, value ? (value > 0 ? styles.pos : styles.neg) : styles.zero]}>{signed(value)}</Text>
      <Text style={compactStyles.meta}>{after === null ? '—' : `→ ${formatQuantity(after)}`}</Text>
    </View>
  );
}

function LedgerSheet({ entry: e, onClose, onStock, onOrder }: { entry: LedgerRow | null; onClose: () => void; onStock?: () => void; onOrder?: () => void }) {
  return (
    <Sheet
      visible={!!e}
      title={e ? movementLabel(e.type) : ''}
      subtitle={e ? `${e.productName ?? '—'}${e.sku ? ` · ${e.sku}` : ''}` : undefined}
      onClose={onClose}
      footer={
        onStock || onOrder ? (
          <View style={styles.actions}>
            {onStock ? (
              <Pressable accessibilityRole="button" onPress={onStock} style={[opsStyles.smallBtn, styles.grow]}>
                <Text style={opsStyles.smallBtnText}>Open stock record</Text>
              </Pressable>
            ) : null}
            {onOrder ? (
              <Pressable accessibilityRole="button" onPress={onOrder} style={[opsStyles.primaryBtn, styles.grow]}>
                <Text style={opsStyles.primaryBtnText}>Open order</Text>
              </Pressable>
            ) : null}
          </View>
        ) : undefined
      }
    >
      {e ? (
        <View style={styles.sheet}>
          <View style={styles.deltas}>
            <Delta label="On hand" value={e.onHandDelta} after={e.onHandAfter} />
            <Delta label="Reserved" value={e.reservedDelta} after={e.reservedAfter} />
            <Delta label="Blocked" value={e.blockedDelta} after={e.blockedAfter} />
          </View>
          <Detail label="Quantity" value={enteredLabel(e, v => formatQuantity(v))} />
          {e.baseQuantity !== null && e.baseUom && e.enteredUom !== e.baseUom ? <Detail label="In base unit" value={`${formatQuantity(e.baseQuantity)} ${e.baseUom}`} /> : null}
          <Detail label="Warehouse" value={e.warehouseTitle} />
          {e.lotNumber || e.batchNumber ? <Detail label="Lot / batch" value={[e.lotNumber, e.batchNumber].filter(Boolean).join(' · ')} /> : null}
          {e.totalCost ? <Detail label="Cost" value={`₹${formatQuantity(e.totalCost, 2)}${e.unitCost ? ` (₹${formatQuantity(e.unitCost, 2)} each)` : ''}`} /> : null}
          <Detail label="Reason" value={e.reason} />
          <Detail label="Reference" value={referenceLabel(e)} />
          {e.notes ? <Detail label="Notes" value={e.notes} /> : null}
          <Detail label="When" value={dateTime(e.createdAt)} />
          <Detail label="By" value={e.performedBy} />
          <Text style={opsStyles.muted}>Ledger entries can't be edited or deleted. Quantities are in each SKU's base unit.</Text>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grow: { flexGrow: 1, justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: 8 },
  right: { alignItems: 'flex-end' },
  qty: { fontFamily: fonts.bold, fontSize: 15 },
  pos: { color: '#047857' },
  neg: { color: colors.error },
  zero: { color: colors.textMuted },
  more: { textAlign: 'center', paddingVertical: 14 },
  sheet: { gap: 12 },
  deltas: { flexDirection: 'row', gap: 8 },
  delta: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.background },
  deltaLabel: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.4, color: colors.textSecondary, textTransform: 'uppercase' },
  deltaValue: { fontFamily: fonts.bold, fontSize: 17 },
  actions: { flexDirection: 'row', gap: 8 },
});
