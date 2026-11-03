import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { formatQuantity } from '../../lib/inventory';
import { dateTime, day } from '../../lib/operations';
import { baseHint, formatQty, movementLabel, movementTone, signed, stockStatus, type StockOperation } from '../../lib/stock';
import { inventoryService, STOCK_TYPES } from '../../services/products-service';
import { stockService } from '../../services/stock-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ErrorState, FilterChips, ListSkeleton } from '../../components/list/ListParts';
import { LinkButton, NoData, OpsCard, opsStyles } from '../../components/operations/OpsParts';
import { StockOperationSheet } from '../../components/inventory/StockOperationSheet';
import { StockSettingsSheet } from '../products/editor/InventoryStep';
import { WarehouseIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

const LEDGER_RANGES = [
  { value: '', label: 'All dates' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: '90', label: 'Last 90 days' },
];

const ACTIONS: { op: StockOperation; label: string }[] = [
  { op: 'adjust', label: 'Count / Adjust' },
  { op: 'block', label: 'Damage / Block' },
  { op: 'transfer', label: 'Transfer' },
  { op: 'return', label: 'Return' },
];

const RESERVATION_TONE = { RESERVED: 'orange', FULFILLED: 'green', RELEASED: 'slate', CANCELLED: 'slate', EXPIRED: 'red' } as const;

/** One SKU's stock in one warehouse: balance, levels, lots, reservations and ledger. */
export function StockDetailScreen({ navigation, route }: ScreenProps<'StockDetail'>) {
  const { id } = route.params;
  const { hasPermission } = useAuth();
  const allowed = hasPermission('product-inventory:manage');
  const { data, error, loading, refreshing, reload } = useFetch(() => (allowed ? stockService.get(id) : Promise.resolve(null)), [id, allowed]);
  const [operation, setOperation] = useState<StockOperation | null>(null);
  const [settings, setSettings] = useState(false);
  const [range, setRange] = useState('');
  const [loadedAt] = useState(() => Date.now());
  const uoms = useFetch(() => (settings ? inventoryService.uoms() : Promise.resolve([])), [settings]);
  const config = useFetch(() => (settings && data ? inventoryService.stockConfig(data.productId) : Promise.resolve(null)), [settings, data?.productId]);

  const ledger = useMemo(() => {
    const entries = data?.ledger ?? [];
    if (!range) return entries;
    const now = new Date(loadedAt);
    const from = range === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1).getTime() : loadedAt - Number(range) * 86400000;
    return entries.filter(e => new Date(e.createdAt).getTime() >= from);
  }, [data, range, loadedAt]);

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="Stock" onBack={navigation.goBack} />
        <ComingSoon label="Inventory" icon={WarehouseIcon} allowed={false} />
      </View>
    );
  }
  if (loading || !data) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="Stock" onBack={navigation.goBack} />
        {loading ? (
          <View style={opsStyles.content}>
            <ListSkeleton rows={4} height={110} />
          </View>
        ) : (
          <ErrorState message={error ?? 'Stock record not found.'} onRetry={() => reload()} />
        )}
      </View>
    );
  }

  const status = stockStatus(data.stockStatus);
  const unitName = STOCK_TYPES.find(t => t.value === data.stockType)?.label.toLowerCase() ?? String(data.stockType).toLowerCase();
  const openReservations = data.reservations.filter(r => r.status === 'RESERVED');
  const q = (v: number) => formatQty(v, data);
  const sub = (v: number, text: string) => baseHint(v, data) ?? text;

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={data.productName} subtitle={`${data.sku} · ${data.warehouseTitle}`} onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={opsStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      >
        <View style={styles.head}>
          <View style={opsStyles.rowBetween}>
            <Text style={styles.name}>{data.productName}</Text>
            <Badge label={status.label} tone={status.tone} />
          </View>
          <Text style={opsStyles.meta}>{`SKU ${data.sku}${data.variantLabel ? ` · ${data.variantLabel}` : ''}`}</Text>
          <View style={opsStyles.row}>
            <WarehouseIcon size={14} color={colors.textMuted} />
            <Text style={opsStyles.meta}>{`${data.warehouseTitle} · counted in ${unitName} (${data.baseUom}) · ${data.idd}`}</Text>
          </View>
          {hasPermission('products-master:manage') ? <LinkButton label="View product" onPress={() => navigation.navigate('ProductDetail', { id: data.productId })} /> : null}
        </View>

        <Button title="Receive Stock" onPress={() => setOperation('receive')} />
        <View style={opsStyles.chipRow}>
          {ACTIONS.map(a => (
            <Pressable key={a.op} accessibilityRole="button" onPress={() => setOperation(a.op)} style={opsStyles.smallBtn}>
              <Text style={opsStyles.smallBtnText}>{a.label}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={() => setOperation('levels')} style={opsStyles.smallBtn}>
            <Text style={opsStyles.smallBtnText}>Stock Levels</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setSettings(true)} style={opsStyles.smallBtn}>
            <Text style={opsStyles.smallBtnText}>Stock Settings</Text>
          </Pressable>
        </View>

        <View style={styles.tiles}>
          <Tile label="On hand" value={q(data.onHand)} sub={sub(data.onHand, 'Physically in the warehouse')} />
          <Tile label="Reserved for orders" value={q(data.reserved)} sub={sub(data.reserved, 'Allocated to open orders')} />
          <Tile label="Blocked" value={q(data.blocked)} sub={sub(data.blocked, 'Damaged or blocked stock')} />
          <Tile
            label="Available"
            value={q(data.available)}
            sub={sub(data.available, 'On hand − reserved − blocked')}
            color={data.available <= 0 ? colors.error : data.stockStatus === 'LOW_STOCK' ? colors.warningDark : colors.successDark}
          />
        </View>

        <OpsCard title="Stock Levels" action={<LinkButton label="Edit" onPress={() => setOperation('levels')} />}>
          <View style={styles.levels}>
            <Level label="Minimum" value={q(data.minimum)} />
            <Level label="Maximum" value={data.maximum === null ? '—' : q(data.maximum)} />
            <Level label="Reorder quantity" value={q(data.reorder)} />
          </View>
          <Text style={opsStyles.muted}>At or below the minimum the stock shows as Low stock with a reorder suggestion.</Text>
        </OpsCard>

        <OpsCard
          title={`Lots / Batches (${data.lots.length})`}
          description={data.tracksLots ? "Stock goes out by the product's FIFO / FEFO rule." : 'Lots appear when stock is received with lot details.'}
        >
          {!data.lots.length ? (
            <NoData text="No lots. Receive stock with lot details to track batches, expiry, etc." />
          ) : (
            data.lots.map((l, i) => (
              <View key={l.id} style={[i > 0 && opsStyles.listRow, styles.entry]}>
                <View style={opsStyles.rowBetween}>
                  <Text style={opsStyles.title}>{l.lotNumber ?? l.batchNumber ?? l.idd}</Text>
                  <Badge label={l.status.charAt(0) + l.status.slice(1).toLowerCase()} tone={l.status === 'ACTIVE' ? 'green' : l.status === 'BLOCKED' ? 'violet' : 'slate'} />
                </View>
                <Text style={opsStyles.meta}>
                  {`${l.batchNumber && l.lotNumber ? `Batch ${l.batchNumber} · ` : ''}${q(l.remainingQty)} left of ${q(l.receivedQty)}${l.expiryDate ? ` · expires ${day(l.expiryDate)}` : ''}${
                    l.manufactureDate ? ` · made ${day(l.manufactureDate)}` : ''
                  }`}
                </Text>
              </View>
            ))
          )}
        </OpsCard>

        <OpsCard title={`Reservations (${openReservations.length} open)`} description="Held for orders until they're delivered or cancelled.">
          {!data.reservations.length ? (
            <NoData text="No reservations. There is no stock reserved for open orders." />
          ) : (
            data.reservations.map((r, i) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                disabled={!r.orderId || !hasPermission('orders:manage')}
                onPress={() => r.orderId && navigation.navigate('OrderDetail', { id: r.orderId })}
                style={[opsStyles.rowBetween, i > 0 && opsStyles.listRow]}
              >
                <View style={styles.flex}>
                  <Text style={opsStyles.title}>{r.orderNumber ?? r.idd}</Text>
                  <Text style={opsStyles.meta}>{dateTime(r.fulfilledAt ?? r.releasedAt ?? r.cancelledAt ?? r.reservedAt)}</Text>
                </View>
                <View style={styles.right}>
                  <Text style={opsStyles.amount}>{q(r.baseReservedQty)}</Text>
                  <Badge label={r.status.charAt(0) + r.status.slice(1).toLowerCase()} tone={RESERVATION_TONE[r.status] ?? 'slate'} />
                </View>
              </Pressable>
            ))
          )}
        </OpsCard>

        <OpsCard title="Stock Ledger" description={`Every movement of this stock, newest first (quantities in ${data.baseUom}).`}>
          <FilterChips options={LEDGER_RANGES} value={range} onChange={setRange} />
          {!ledger.length ? (
            <NoData text={range ? 'Nothing in this date range.' : 'Receipts, sales and counts of this stock appear here.'} />
          ) : (
            ledger.map((e, i) => {
              const [bg, fg] = movementTone(e.type);
              return (
                <View key={e.id} style={[styles.entry, i > 0 ? opsStyles.listRow : styles.firstEntry]}>
                  <View style={opsStyles.rowBetween}>
                    <View style={[styles.moveTag, { backgroundColor: bg }]}>
                      <Text style={[styles.moveText, { color: fg }]}>{movementLabel(e.type)}</Text>
                    </View>
                    <Text style={opsStyles.meta}>{dateTime(e.createdAt)}</Text>
                  </View>
                  <Text style={opsStyles.meta}>
                    {`Qty ${formatQuantity(e.enteredQuantity ?? e.legacyQuantity ?? 0)} ${e.enteredUom ?? data.baseUom} · on hand ${signed(e.onHandDelta)} · reserved ${signed(e.reservedDelta)} · blocked ${signed(e.blockedDelta)}`}
                  </Text>
                  <Text style={styles.after}>
                    {`After: ${e.onHandAfter === null ? '—' : formatQuantity(e.onHandAfter)} / ${e.reservedAfter === null ? '—' : formatQuantity(e.reservedAfter)} / ${
                      e.blockedAfter === null ? '—' : formatQuantity(e.blockedAfter)
                    }`}
                  </Text>
                  {e.referenceId || e.reason || e.notes || e.performedBy ? (
                    <Text style={opsStyles.muted}>{[e.referenceId, e.reason ?? e.notes, e.performedBy ? `by ${e.performedBy}` : null].filter(Boolean).join(' · ')}</Text>
                  ) : null}
                </View>
              );
            })
          )}
        </OpsCard>
      </ScrollView>

      <StockOperationSheet
        operation={operation}
        balance={data}
        lots={data.lots}
        onClose={() => setOperation(null)}
        onDone={() => {
          setOperation(null);
          reload();
        }}
      />
      {settings && config.data ? (
        <StockSettingsSheet
          productId={data.productId}
          skus={config.data.variants.map(v => ({ id: v.id, label: `${v.label} · ${v.sku}` }))}
          uoms={uoms.data ?? []}
          initialScope={data.productVariantId}
          onClose={() => setSettings(false)}
          onSaved={() => {
            setSettings(false);
            reload();
          }}
        />
      ) : null}
    </View>
  );
}

function Tile({ label, value, sub, color = colors.text }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={opsStyles.muted} numberOfLines={2}>
        {sub}
      </Text>
    </View>
  );
}

function Level({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.level}>
      <Text style={opsStyles.muted}>{label}</Text>
      <Text style={styles.levelValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  head: { gap: 4 },
  name: { flex: 1, fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, padding: 12, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  tileValue: { fontFamily: fonts.extrabold, fontSize: 19 },
  tileLabel: { marginTop: 2, fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  levels: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  level: { flex: 1, padding: 10, borderRadius: radius.md, backgroundColor: colors.background },
  levelValue: { marginTop: 2, fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  entry: { gap: 4, paddingVertical: 8 },
  firstEntry: { marginTop: 8 },
  right: { alignItems: 'flex-end', gap: 4 },
  moveTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  moveText: { fontFamily: fonts.semibold, fontSize: 12 },
  after: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
});
