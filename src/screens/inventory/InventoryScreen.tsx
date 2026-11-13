import React, { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { formatQuantity } from '../../lib/inventory';
import { DEFAULT_PRESET, RANGE_PRESETS, shortRupees, type RangePreset } from '../../lib/sales-report';
import { dateTime } from '../../lib/operations';
import {
  baseHint,
  formatQty,
  heldFor,
  LEDGER_GROUPS,
  moved,
  movementLabel,
  movementTone,
  reorderQty,
  reservationOrderStatus,
  signed,
  STOCK_STATUS,
  stockStatus,
  type StockOperation,
} from '../../lib/stock';
import { warehouseService } from '../../services/products-service';
import { stockService, type LedgerGroup, type Reservation, type StockBalance, type StockStatus } from '../../services/stock-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Sheet } from '../../components/ui/Sheet';
import { SelectField } from '../../components/form/Fields';
import { EmptyState, ErrorState, FilterChips, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { opsStyles, Pager, StatCard, StatGrid } from '../../components/operations/OpsParts';
import { StockOperationSheet } from '../../components/inventory/StockOperationSheet';
import { AlertCircleIcon, BoxIcon, CartIcon, CheckCircleIcon, ClipboardListIcon, ClockIcon, FileTextIcon, LayersIcon, LockIcon, PlusIcon, RefreshIcon, WalletIcon, WarehouseIcon, type IconProps } from '../../components/icons';
import type { InventoryTab, RootStackParamList, ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;

const TABS: { key: InventoryTab; label: string; icon: ComponentType<IconProps>; title: string; description: string }[] = [
  {
    key: 'stock',
    get label() { return i18n.t('common.stock'); },
    icon: BoxIcon,
    get title() { return i18n.t('common.stock'); },
    get description() { return i18n.t('inventory.stockPerSkuAndWarehouseAvailable'); },
  },
  { key: 'ledger', get label() { return i18n.t('common.ledger'); }, icon: ClipboardListIcon, get title() { return i18n.t('inventory.stockLedger'); }, get description() { return i18n.t('inventory.everyStockMovementReceiptsSalesCounts'); } },
  { key: 'reservations', get label() { return i18n.t('common.reservations'); }, icon: LockIcon, get title() { return i18n.t('common.reservations'); }, get description() { return i18n.t('inventory.stockHeldForOpenOrdersNot'); } },
  { key: 'low', get label() { return i18n.t('common.lowStock'); }, icon: AlertCircleIcon, get title() { return i18n.t('common.lowStock'); }, get description() { return i18n.t('inventory.productsThatHaveReachedOrFallen'); } },
];

const note = () => i18n.t('inventory.reservationsNote');

type Op = { op: StockOperation; row: StockBalance | null } | null;
const useStackNav = () => useNavigation<NavigationProp<RootStackParamList>>();

/** Inventory › Stock / Ledger / Reservations / Low Stock (the panel's four pages). */
export function InventoryScreen({ navigation, route }: ScreenProps<'Inventory'>) {
  const { t: tr } = useTranslation();
  const { hasPermission } = useAuth();
  const allowed = hasPermission('product-inventory:manage');
  const [tab, setTab] = useState<InventoryTab>(route.params?.tab ?? 'stock');
  const [operation, setOperation] = useState<Op>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);
  const warehouses = useFetch(() => (allowed ? warehouseService.list() : Promise.resolve([])), [allowed]);

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={tr('common.inventory')} onBack={navigation.goBack} />
        <ComingSoon label={tr('common.inventory')} icon={WarehouseIcon} allowed={false} />
      </View>
    );
  }

  const meta = TABS.find(t => t.key === tab)!;
  const warehouseOptions = (warehouses.data ?? []).map(w => ({ value: String(w.id), label: String(w.facilityTitle ?? tr('common.warehouse')) }));
  const onOperation = (op: StockOperation, row: StockBalance | null) => setOperation({ op, row });

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={meta.title} subtitle={tr('common.inventory')} onBack={navigation.goBack} />
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map(t => {
            const on = t.key === tab;
            const Icon = t.icon;
            return (
              <Pressable
                key={t.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  setTab(t.key);
                  // Keeps the menu's highlight on this tab's item.
                  navigation.setParams({ tab: t.key });
                }}
                style={[styles.tab, on && styles.tabOn]}
              >
                <Icon size={15} color={on ? colors.white : colors.textSecondary} />
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {tab === 'stock' ? <StockTab key={refreshKey} warehouses={warehouseOptions} description={meta.description} onOperation={onOperation} /> : null}
      {tab === 'ledger' ? <LedgerTab key={refreshKey} warehouses={warehouseOptions} description={meta.description} onReceive={() => onOperation('receive', null)} /> : null}
      {tab === 'reservations' ? <ReservationsTab key={refreshKey} warehouses={warehouseOptions} description={meta.description} onReceive={() => onOperation('receive', null)} /> : null}
      {tab === 'low' ? <LowStockTab key={refreshKey} warehouses={warehouseOptions} description={meta.description} onOperation={onOperation} /> : null}

      <StockOperationSheet
        operation={operation?.op ?? null}
        balance={operation?.row ?? null}
        onClose={() => setOperation(null)}
        onDone={() => {
          setOperation(null);
          setRefreshKey(k => k + 1);
        }}
      />
    </View>
  );
}

/** Title, description and Receive Stock, above each tab's content. */
function Intro({ description, onReceive }: { description: string; onReceive: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.intro}>
      <Text style={opsStyles.meta}>{description}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('inventory.receiveStock2')} onPress={onReceive} style={[opsStyles.primaryBtn, styles.selfStart]}>
        <PlusIcon size={15} color={colors.white} strokeWidth={2.4} />
        <Text style={opsStyles.primaryBtnText}>{t('inventory.receiveStock2')}</Text>
      </Pressable>
    </View>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={opsStyles.rowBetween}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.secondary, false: colors.border }} thumbColor={colors.white} />
    </View>
  );
}

function Thumb({ src }: { src: string | null | undefined }) {
  return <View style={styles.thumb}>{src ? <Image source={{ uri: src }} style={styles.thumbImg} /> : <BoxIcon size={18} color={colors.textMuted} />}</View>;
}

function ResetLink({ shown, onPress }: { shown: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  if (!shown) return null;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6} style={styles.selfStart}>
      <Text style={styles.reset}>{t('common.resetFilters')}</Text>
    </Pressable>
  );
}

/** Client-side paging, as the panel's tables. */
function usePaged<T>(rows: T[], deps: unknown[]) {
  const [page, setPage] = useState(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPage(1), deps);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  return { page: current, setPage, shown: rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE) };
}

function ListShell<T>({
  rows,
  shown,
  keyOf,
  render,
  header,
  loading,
  error,
  onRetry,
  empty,
  page,
  setPage,
  noun,
  refreshing,
  onRefresh,
}: {
  rows: T[];
  shown: T[];
  keyOf: (t: T) => string;
  render: (t: T) => ReactNode;
  header: ReactNode;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  empty: ReactNode;
  page: number;
  setPage: (p: number) => void;
  noun: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const ref = useRef<FlatList<T>>(null);
  return (
    <FlatList
      ref={ref}
      data={loading || error ? [] : shown}
      keyExtractor={keyOf}
      renderItem={({ item }) => <>{render(item)}</>}
      ListHeaderComponent={<View style={styles.header}>{header}</View>}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={loading ? <ListSkeleton height={120} /> : error ? <ErrorState message={error} onRetry={onRetry} /> : <>{empty}</>}
      ListFooterComponent={
        <View style={styles.footer}>
          {!loading && rows.length ? (
            <Pager
              page={page}
              total={rows.length}
              limit={PAGE_SIZE}
              noun={noun}
              onPage={p => {
                setPage(p);
                ref.current?.scrollToOffset({ offset: 0, animated: true });
              }}
            />
          ) : null}
          <Info />
        </View>
      }
      contentContainerStyle={opsStyles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.secondary} colors={[colors.secondary]} />}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function Info() {
  return (
    <View style={styles.info}>
      <View style={styles.infoDot}>
        <Text style={styles.infoDotText}>i</Text>
      </View>
      <Text style={styles.infoText}>{note()}</Text>
    </View>
  );
}

function AllClear({ title, text }: { title: string; text: string }) {
  return <EmptyState icon={CheckCircleIcon} title={title} text={text} />;
}

// ─── Stock ────────────────────────────────────────────────────────────────

const ACTIONS: { op: StockOperation; label: string }[] = [
  { op: 'adjust', get label() { return i18n.t('inventory.countAdjust'); } },
  { op: 'transfer', get label() { return i18n.t('inventory.transfer'); } },
  { op: 'block', get label() { return i18n.t('inventory.damageBlock'); } },
  { op: 'return', get label() { return i18n.t('common.return'); } },
  { op: 'levels', get label() { return i18n.t('inventory.setStockLevels'); } },
];

function StockTab({
  warehouses,
  description,
  onOperation,
}: {
  warehouses: { value: string; label: string }[];
  description: string;
  onOperation: (op: StockOperation, row: StockBalance | null) => void;
}) {
  const { t } = useTranslation();
  const navigation = useStackNav();
  const [warehouseId, setWarehouseId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [onlyReserved, setOnlyReserved] = useState(false);
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [more, setMore] = useState<StockBalance | null>(null);
  const { data, error, loading, refreshing, reload } = useFetch(
    () => stockService.list({ ...(warehouseId ? { warehouseId } : {}), ...(status ? { status } : {}) }),
    [warehouseId, status],
  );
  useReloadOnFocus(reload);
  const all = useMemo(() => data ?? [], [data]);
  const counts = useMemo(
    () => ({
      total: all.length,
      low: all.filter(r => r.stockStatus === 'LOW_STOCK').length,
      out: all.filter(r => r.stockStatus === 'OUT_OF_STOCK').length,
      blocked: all.filter(r => r.blocked > 0).length,
    }),
    [all],
  );
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      r => (!q || `${r.productName} ${r.sku} ${r.variantLabel}`.toLowerCase().includes(q)) && (!onlyReserved || r.reserved > 0) && (!onlyBlocked || r.blocked > 0),
    );
  }, [all, search, onlyReserved, onlyBlocked]);
  const { page, setPage, shown } = usePaged(rows, [search, onlyReserved, onlyBlocked, warehouseId, status]);
  const filtered = !!(search || warehouseId || status || onlyReserved || onlyBlocked);

  return (
    <>
      <ListShell
        rows={rows}
        shown={shown}
        keyOf={r => r.id}
        page={page}
        setPage={setPage}
        noun={rows.length === 1 ? 'product' : 'products'}
        loading={loading}
        error={error && !data ? error : null}
        onRetry={() => reload()}
        refreshing={refreshing}
        onRefresh={() => reload(true)}
        header={
          <>
            <Intro description={description} onReceive={() => onOperation('receive', null)} />
            <StatGrid>
              <StatCard icon={BoxIcon} tone="blue" label={t('inventory.totalStockRecords')} value={String(counts.total)} sub={t('inventory.productsAcrossWarehouses')} loading={loading} />
              <StatCard icon={AlertCircleIcon} tone="amber" label={t('common.lowStock')} value={String(counts.low)} sub={t('inventory.productsBelowMinimum')} loading={loading} />
              <StatCard icon={BoxIcon} tone="red" label={t('common.outOfStock')} value={String(counts.out)} sub={t('inventory.productsWithZeroStock')} loading={loading} />
              <StatCard icon={LockIcon} tone="violet" label={t('inventory.withBlockedStock')} value={String(counts.blocked)} sub={t('inventory.productsWithBlockedQuantity')} loading={loading} />
            </StatGrid>
            <SearchBar value={search} onChange={setSearch} placeholder={t('inventory.searchProductOrSku')} />
            <SelectField label={t('common.warehouse')} value={warehouseId} options={warehouses} onChange={setWarehouseId} placeholder={t('inventory.allWarehouses')} allowClear={t('inventory.allWarehouses')} />
            <FilterChips
              options={[{ value: '', label: t('common.allStatuses') }, ...(Object.keys(STOCK_STATUS) as StockStatus[]).map(s => ({ value: s, label: STOCK_STATUS[s].label }))]}
              value={status}
              onChange={setStatus}
            />
            <ToggleRow label={t('inventory.onlyWithReservedStock')} value={onlyReserved} onChange={setOnlyReserved} />
            <ToggleRow label={t('inventory.onlyWithBlockedStock')} value={onlyBlocked} onChange={setOnlyBlocked} />
            <ResetLink
              shown={filtered}
              onPress={() => {
                setSearch('');
                setWarehouseId('');
                setStatus('');
                setOnlyReserved(false);
                setOnlyBlocked(false);
              }}
            />
          </>
        }
        empty={
          <EmptyState
            icon={BoxIcon}
            title={filtered ? t('inventory.noStockMatchesYourFilters') : t('inventory.noStockRecordsYet')}
            text={filtered ? t('inventory.tryAnotherSearchOrResetThe') : t('inventory.useReceiveStockToAddStock')}
          />
        }
        render={r => (
          <StockCard
            row={r}
            onOpen={() => navigation.navigate('StockDetail', { id: r.id })}
            onReceive={() => onOperation('receive', r)}
            onMore={() => setMore(r)}
          />
        )}
      />
      <Sheet visible={!!more} title={more?.productName ?? t('common.stock')} subtitle={more ? `${more.sku} · ${more.warehouseTitle}` : undefined} onClose={() => setMore(null)}>
        <View style={styles.menu}>
          {ACTIONS.map(a => (
            <Pressable
              key={a.op}
              accessibilityRole="menuitem"
              onPress={() => {
                const row = more;
                setMore(null);
                onOperation(a.op, row);
              }}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            >
              <Text style={styles.menuText}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </>
  );
}

function StockCard({ row: r, onOpen, onReceive, onMore }: { row: StockBalance; onOpen: () => void; onReceive: () => void; onMore: () => void }) {
  const { t } = useTranslation();
  const s = stockStatus(r.stockStatus);
  const availableTone = r.available <= 0 ? colors.error : r.stockStatus === 'LOW_STOCK' ? colors.warningDark : colors.successDark;
  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${r.productName}, ${r.sku}`} onPress={onOpen} style={styles.cardTop}>
        <Thumb src={r.imageUrl} />
        <View style={styles.flex}>
          <Text style={opsStyles.title} numberOfLines={1}>
            {r.productName}
          </Text>
          <Text style={opsStyles.meta} numberOfLines={1}>{t('inventory.skuSku', { sku: r.sku })}</Text>
          {r.variantLabel ? (
            <Text style={opsStyles.muted} numberOfLines={1}>
              {r.variantLabel}
            </Text>
          ) : null}
          <View style={styles.warehouse}>
            <WarehouseIcon size={13} color={colors.textMuted} />
            <Text style={opsStyles.meta} numberOfLines={1}>
              {r.warehouseTitle}
            </Text>
          </View>
        </View>
        <Badge label={s.label} tone={s.tone} />
      </Pressable>
      <View style={styles.qtys}>
        <Qty label={t('inventory.onHand')} base={r.onHand} row={r} />
        <Qty label={t('common.reserved')} base={r.reserved} row={r} color={colors.textSecondary} />
        <Qty label={t('common.blocked')} base={r.blocked} row={r} color={r.blocked > 0 ? '#7c3aed' : colors.textSecondary} />
        <Qty label={t('common.available')} base={r.available} row={r} color={availableTone} />
      </View>
      <View style={opsStyles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('inventory.receiveProductname', { productName: r.productName })} onPress={onReceive} style={[styles.action, styles.actionPrimary]}>
          <Text style={[styles.actionText, styles.actionTextPrimary]}>{t('inventory.receive')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('inventory.moreForProductname', { productName: r.productName })} onPress={onMore} style={styles.action}>
          <Text style={styles.actionText}>{t('common.more')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Qty({ label, base, row, color = colors.text }: { label: string; base: number; row: StockBalance; color?: string }) {
  const factor = row.salesUom !== row.baseUom && row.salesFactor ? row.salesFactor : 1;
  return (
    <View style={styles.qty}>
      <Text style={styles.qtyLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.qtyValue, { color: base < 0 ? colors.error : color }]} numberOfLines={1} adjustsFontSizeToFit>
        {formatQuantity(base / factor)}
      </Text>
      <Text style={styles.qtyUnit} numberOfLines={1}>
        {baseHint(base, row) ?? (factor === 1 ? row.baseUom : row.salesUom)}
      </Text>
    </View>
  );
}

// ─── Ledger ───────────────────────────────────────────────────────────────

function trend(value: number, previous: number, label: string, invert = false) {
  if (previous === 0) return value === 0 ? i18n.t('inventory.noChangeLabel', { label }) : i18n.t('inventory.newLabel', { label });
  const pct = ((value - previous) / Math.abs(previous)) * 100;
  const good = invert ? pct <= 0 : pct >= 0;
  return { text: `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(0)}% ${label}`, good };
}
const trendSub = (t: ReturnType<typeof trend>) => (typeof t === 'string' ? t : t.text);

function LedgerTab({ warehouses, description, onReceive }: { warehouses: { value: string; label: string }[]; description: string; onReceive: () => void }) {
  const { t: tr } = useTranslation();
  const navigation = useStackNav();
  const { hasPermission } = useAuth();
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const range = useMemo(() => preset.range(new Date()), [preset]);
  const [warehouseId, setWarehouseId] = useState('');
  const [group, setGroup] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const listRef = useRef<FlatList>(null);
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => setPage(1), [range.from, range.to, warehouseId, group, search]);

  const { data, error, loading, refreshing, reload } = useFetch(
    () =>
      stockService.ledgerPage({
        from: range.from,
        to: range.to,
        page,
        limit: PAGE_SIZE,
        ...(warehouseId ? { warehouseId } : {}),
        ...(group ? { group: group as LedgerGroup } : {}),
        ...(search ? { search } : {}),
      }),
    [range.from, range.to, warehouseId, group, search, page],
  );
  useReloadOnFocus(reload);
  const s = data?.summary;
  const compare = preset.key === 'this-month' ? tr('inventory.thisMonth2') : preset.compareLabel;
  const filtered = !!(warehouseId || group || search) || preset.key !== DEFAULT_PRESET.key;
  const units = (v: number | undefined) => (v === undefined ? '—' : formatQuantity(v));
  const stat = (k: 'movements' | 'received' | 'sold' | 'adjusted', invert = false) => (s ? trendSub(trend(s[k].value, s[k].previous, compare, invert)) : undefined);

  return (
    <FlatList
      ref={listRef}
      data={loading || (error && !data) ? [] : data?.items ?? []}
      keyExtractor={e => e.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Intro description={description} onReceive={onReceive} />
          <StatGrid>
            <StatCard icon={BoxIcon} tone="orange" label={tr('inventory.totalMovements')} value={units(s?.movements.value)} sub={stat('movements')} loading={loading} />
            <StatCard icon={LayersIcon} tone="emerald" label={tr('common.stockReceived')} value={tr('common.unitsValue', { units: units(s?.received.value) })} sub={stat('received')} loading={loading} />
            <StatCard icon={CartIcon} tone="red" label={tr('inventory.stockSold')} value={tr('common.unitsValue', { units: units(s?.sold.value) })} sub={stat('sold')} loading={loading} />
            <StatCard icon={RefreshIcon} tone="violet" label={tr('inventory.adjustments')} value={tr('common.unitsValue', { units: units(s?.adjusted.value) })} sub={stat('adjusted', true)} loading={loading} />
          </StatGrid>
          <FilterChips options={RANGE_PRESETS.map(p => ({ value: p.key, label: p.label }))} value={preset.key} onChange={k => setPreset(RANGE_PRESETS.find(p => p.key === k) ?? DEFAULT_PRESET)} />
          <SelectField label={tr('common.warehouse')} value={warehouseId} options={warehouses} onChange={setWarehouseId} placeholder={tr('inventory.allWarehouses')} allowClear={tr('inventory.allWarehouses')} />
          <FilterChips options={LEDGER_GROUPS} value={group} onChange={setGroup} />
          <SearchBar value={query} onChange={setQuery} placeholder={tr('inventory.searchProductNameSkuOrReference')} />
          <ResetLink
            shown={filtered}
            onPress={() => {
              setWarehouseId('');
              setGroup('');
              setQuery('');
              setPreset(DEFAULT_PRESET);
            }}
          />
        </View>
      }
      renderItem={({ item: e }) => {
        const [bg, fg] = movementTone(e.type);
        const qty = moved(e);
        const reference = e.orderNumber ?? e.referenceId;
        const open = e.inventoryId
          ? () => navigation.navigate('StockDetail', { id: e.inventoryId! })
          : e.orderId && hasPermission('orders:manage')
            ? () => navigation.navigate('OrderDetail', { id: e.orderId! })
            : undefined;
        return (
          <Pressable accessibilityRole="button" disabled={!open} onPress={open} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <View style={styles.cardTop}>
              <Thumb src={e.imageUrl} />
              <View style={styles.flex}>
                <Text style={opsStyles.title} numberOfLines={1}>
                  {e.productName ?? '—'}
                </Text>
                <Text style={opsStyles.meta} numberOfLines={1}>
                  {[e.sku, e.warehouseTitle].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
              <View style={styles.right}>
                <Text style={[styles.delta, qty && qty < 0 ? styles.neg : styles.pos]}>{signed(qty)}</Text>
                {e.enteredUom ? <Text style={opsStyles.muted}>{e.enteredUom}</Text> : null}
              </View>
            </View>
            <View style={opsStyles.rowBetween}>
              <View style={[styles.moveTag, { backgroundColor: bg }]}>
                <Text style={[styles.moveText, { color: fg }]}>{movementLabel(e.type)}</Text>
              </View>
              <Text style={opsStyles.meta} numberOfLines={1}>
                {`${dateTime(e.createdAt)}${e.onHandAfter === null ? '' : ` · ${tr('common.onHandQuantity', { quantity: formatQuantity(e.onHandAfter) })}`}`}
              </Text>
            </View>
            {reference || e.notes || e.reason || e.performedBy ? (
              <Text style={opsStyles.muted} numberOfLines={2}>
                {[reference, e.notes ?? e.reason, e.performedBy ? tr('inventory.byPerformedby', { performedBy: e.performedBy }) : null].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </Pressable>
        );
      }}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={
        loading ? (
          <ListSkeleton height={100} />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={() => reload()} />
        ) : (
          <EmptyState
            icon={ClipboardListIcon}
            title={tr('inventory.noStockMovements')}
            text={filtered ? tr('inventory.nothingMatchesTheseFiltersTryAnother') : tr('inventory.receiptsSalesCountsAndTransfersAppear')}
          />
        )
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {data && data.total > 0 ? (
            <Pager
              page={page}
              total={data.total}
              limit={PAGE_SIZE}
              noun={data.total === 1 ? 'movement' : 'movements'}
              onPage={p => {
                setPage(p);
                listRef.current?.scrollToOffset({ offset: 0, animated: true });
              }}
            />
          ) : null}
          <Text style={opsStyles.muted}>{tr('inventory.quantitiesAreInEachSkusBase')}</Text>
        </View>
      }
      contentContainerStyle={opsStyles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
    />
  );
}

// ─── Reservations ─────────────────────────────────────────────────────────

const DATE_RANGES = [
  { value: '', get label() { return i18n.t('inventory.anyDate'); } },
  { value: '1', get label() { return i18n.t('common.today'); } },
  { value: '7', get label() { return i18n.t('common.last7Days'); } },
  { value: '30', get label() { return i18n.t('common.last30Days'); } },
  { value: 'older', get label() { return i18n.t('inventory.olderThan7Days'); } },
];

function ReservationsTab({ warehouses, description, onReceive }: { warehouses: { value: string; label: string }[]; description: string; onReceive: () => void }) {
  const { t } = useTranslation();
  const navigation = useStackNav();
  const { hasPermission } = useAuth();
  const { data, error, loading, refreshing, reload } = useFetch(() => stockService.reservations({ status: 'RESERVED' }), []);
  useReloadOnFocus(reload);
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState('');
  const [oldOnly, setOldOnly] = useState(false);
  // Ages are measured from when the list loaded.
  const [now] = useState(() => Date.now());
  const all = useMemo(() => data ?? [], [data]);
  const statuses = useMemo(() => [...new Set(all.map(r => r.orderStatus).filter((s): s is string => !!s))], [all]);
  const kpis = useMemo(
    () => ({
      items: all.length,
      units: all.reduce((s, r) => s + (r.baseReservedQty ?? 0), 0),
      unit: [...new Set(all.map(r => r.baseUom).filter(Boolean))],
      orders: new Set(all.map(r => r.orderId).filter(Boolean)).size,
      value: all.reduce((s, r) => s + (r.value ?? 0), 0),
    }),
    [all],
  );
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(r => {
      const age = (now - new Date(r.orderedAt ?? r.reservedAt).getTime()) / 86400000;
      return (
        (!q || `${r.productName ?? ''} ${r.sku ?? ''} ${r.orderNumber ?? ''} ${r.customerName ?? ''}`.toLowerCase().includes(q)) &&
        (!warehouseId || r.warehouseId === warehouseId) &&
        (!status || r.orderStatus === status) &&
        (!range || (range === 'older' ? age > 7 : age <= Number(range))) &&
        (!oldOnly || age > 3)
      );
    });
  }, [all, search, warehouseId, status, range, oldOnly, now]);
  const { page, setPage, shown } = usePaged(rows, [search, warehouseId, status, range, oldOnly]);
  const filtered = !!(search || warehouseId || status || range || oldOnly);

  return (
    <ListShell<Reservation>
      rows={rows}
      shown={shown}
      keyOf={r => r.id}
      page={page}
      setPage={setPage}
      noun={rows.length === 1 ? 'reservation' : 'reservations'}
      loading={loading}
      error={error && !data ? error : null}
      onRetry={() => reload()}
      refreshing={refreshing}
      onRefresh={() => reload(true)}
      header={
        <>
          <Intro description={description} onReceive={onReceive} />
          <StatGrid>
            <StatCard icon={FileTextIcon} tone="blue" label={t('inventory.totalReservedItems')} value={String(kpis.items)} sub={t('inventory.itemsInOpenOrders')} loading={loading} />
            <StatCard icon={CartIcon} tone="orange" label={t('inventory.reservedQuantity')} value={`${formatQuantity(kpis.units)} ${kpis.unit.length === 1 ? kpis.unit[0] : 'units'}`} sub={t('inventory.totalUnitsReserved')} loading={loading} />
            <StatCard icon={BoxIcon} tone="violet" label={t('inventory.ordersOnHold')} value={String(kpis.orders)} sub={t('inventory.pendingShipmentDelivery')} loading={loading} />
            <StatCard icon={WalletIcon} tone="emerald" label={t('inventory.estimatedValue')} value={shortRupees(kpis.value)} sub={t('inventory.valueOfReservedStock')} loading={loading} />
          </StatGrid>
          <SearchBar value={search} onChange={setSearch} placeholder={t('inventory.searchProductSkuOrOrderNo')} />
          <SelectField label={t('common.warehouse')} value={warehouseId} options={warehouses} onChange={setWarehouseId} placeholder={t('inventory.allWarehouses')} allowClear={t('inventory.allWarehouses')} />
          {statuses.length ? (
            <FilterChips options={[{ value: '', label: t('common.allStatuses') }, ...statuses.map(s => ({ value: s, label: reservationOrderStatus(s).label }))]} value={status} onChange={setStatus} />
          ) : null}
          <FilterChips options={DATE_RANGES} value={range} onChange={setRange} />
          <ToggleRow label={t('inventory.onlyHeldForMoreThan3')} value={oldOnly} onChange={setOldOnly} />
          <ResetLink
            shown={filtered}
            onPress={() => {
              setSearch('');
              setWarehouseId('');
              setStatus('');
              setRange('');
              setOldOnly(false);
            }}
          />
        </>
      }
      empty={
        all.length === 0 ? (
          <AllClear title={t('inventory.noStockIsReservedForOpen')} text={t('inventory.allYourProductsAreCurrentlyAvailable')} />
        ) : (
          <AllClear title={t('inventory.nothingMatchesTheseFilters')} text={t('inventory.tryAnotherSearchOrResetThe')} />
        )
      }
      render={r => {
        const meta = reservationOrderStatus(r.orderStatus);
        const long = now - new Date(r.reservedAt).getTime() > 3 * 86400000;
        return (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Thumb src={r.imageUrl} />
              <View style={styles.flex}>
                <Text style={opsStyles.title} numberOfLines={1}>
                  {r.productName ?? '—'}
                </Text>
                <Text style={opsStyles.meta} numberOfLines={1}>
                  {[r.sku, r.categoryName].filter(Boolean).join(' · ') || '—'}
                </Text>
                <View style={styles.warehouse}>
                  <WarehouseIcon size={13} color={colors.textMuted} />
                  <Text style={opsStyles.meta} numberOfLines={1}>
                    {r.warehouseTitle ?? '—'}
                  </Text>
                </View>
              </View>
              <Badge label={meta.label} tone={meta.tone} />
            </View>
            <View style={opsStyles.rowBetween}>
              <View style={styles.flex}>
                <Text style={opsStyles.title}>{`${r.orderNumber ?? '—'}${r.customerName ? ` · ${r.customerName}` : ''}`}</Text>
                <Text style={opsStyles.meta}>{dateTime(r.orderedAt ?? r.reservedAt)}</Text>
              </View>
              <View style={styles.right}>
                <Text style={opsStyles.amount}>{`${formatQuantity(r.reservedQty)} ${r.uom ?? r.baseUom ?? ''}`}</Text>
                {r.uom && r.baseUom && r.uom !== r.baseUom ? <Text style={opsStyles.muted}>{`${formatQuantity(r.baseReservedQty)} ${r.baseUom}`}</Text> : null}
              </View>
            </View>
            <View style={opsStyles.rowBetween}>
              <View style={styles.held}>
                <ClockIcon size={13} color={long ? colors.warningDark : colors.textMuted} />
                <Text style={[opsStyles.meta, long && styles.heldLong]}>{t('inventory.heldForHeldfor', { heldFor: heldFor(r.reservedAt, now) })}</Text>
              </View>
              <View style={opsStyles.row}>
                {r.inventoryId ? (
                  <Pressable accessibilityRole="button" onPress={() => navigation.navigate('StockDetail', { id: r.inventoryId! })} style={styles.action}>
                    <Text style={styles.actionText}>{t('inventory.viewStock')}</Text>
                  </Pressable>
                ) : null}
                {r.orderId && hasPermission('orders:manage') ? (
                  <Pressable accessibilityRole="button" onPress={() => navigation.navigate('OrderDetail', { id: r.orderId! })} style={[styles.action, styles.actionPrimary]}>
                    <Text style={[styles.actionText, styles.actionTextPrimary]}>{t('inventory.viewOrder')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        );
      }}
    />
  );
}

// ─── Low Stock ────────────────────────────────────────────────────────────

function LowStockTab({
  warehouses,
  description,
  onOperation,
}: {
  warehouses: { value: string; label: string }[];
  description: string;
  onOperation: (op: StockOperation, row: StockBalance | null) => void;
}) {
  const { t } = useTranslation();
  const navigation = useStackNav();
  const { data, error, loading, refreshing, reload } = useFetch(() => stockService.lowStock(), []);
  useReloadOnFocus(reload);
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [withLevels, setWithLevels] = useState(false);
  const all = useMemo(() => data ?? [], [data]);
  const value = (r: StockBalance) => (r.costPrice != null ? reorderQty(r) * r.costPrice : null);
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    all.forEach(r => r.categoryId && map.set(r.categoryId, r.categoryName ?? 'Uncategorised'));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([v, l]) => ({ value: v, label: l }));
  }, [all]);
  const kpis = useMemo(() => {
    const priced = all.filter(r => r.costPrice != null);
    return {
      out: all.filter(r => r.stockStatus === 'OUT_OF_STOCK').length,
      low: all.filter(r => r.stockStatus === 'LOW_STOCK').length,
      required: all.reduce((s, r) => s + reorderQty(r), 0),
      value: priced.reduce((s, r) => s + reorderQty(r) * (r.costPrice ?? 0), 0),
      unpriced: all.length - priced.length,
    };
  }, [all]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      r =>
        (!q || `${r.productName} ${r.sku} ${r.variantLabel}`.toLowerCase().includes(q)) &&
        (!warehouseId || r.warehouseId === warehouseId) &&
        (!status || r.stockStatus === status) &&
        (!categoryId || r.categoryId === categoryId) &&
        (!withLevels || r.minimum > 0),
    );
  }, [all, search, warehouseId, status, categoryId, withLevels]);
  const { page, setPage, shown } = usePaged(rows, [search, warehouseId, status, categoryId, withLevels]);
  const filtered = !!(search || warehouseId || status || categoryId || withLevels);

  return (
    <ListShell
      rows={rows}
      shown={shown}
      keyOf={r => r.id}
      page={page}
      setPage={setPage}
      noun={rows.length === 1 ? 'product' : 'products'}
      loading={loading}
      error={error && !data ? error : null}
      onRetry={() => reload()}
      refreshing={refreshing}
      onRefresh={() => reload(true)}
      header={
        <>
          <Intro description={description} onReceive={() => onOperation('receive', null)} />
          <StatGrid>
            <StatCard icon={BoxIcon} tone="red" label={t('common.outOfStock')} value={String(kpis.out)} sub={t('inventory.productsWithZeroStock')} loading={loading} />
            <StatCard icon={AlertCircleIcon} tone="amber" label={t('common.lowStock')} value={String(kpis.low)} sub={t('inventory.productsBelowMinimum')} loading={loading} />
            <StatCard icon={LayersIcon} tone="blue" label={t('inventory.totalUnitsRequired')} value={formatQuantity(kpis.required)} sub={t('inventory.unitsToReachMinimum')} loading={loading} />
            <StatCard
              icon={WalletIcon}
              tone="emerald"
              label={t('inventory.estimatedReorderValue')}
              value={shortRupees(kpis.value)}
              sub={kpis.unpriced ? t('inventory.skusWithoutCostPrice', { count: kpis.unpriced }) : t('inventory.basedOnProductCostPrice')}
              loading={loading}
            />
          </StatGrid>
          <SearchBar value={search} onChange={setSearch} placeholder={t('inventory.searchProductNameOrSku')} />
          <SelectField label={t('common.warehouse')} value={warehouseId} options={warehouses} onChange={setWarehouseId} placeholder={t('inventory.allWarehouses')} allowClear={t('inventory.allWarehouses')} />
          <FilterChips
            options={[
              { value: '', label: t('common.allStatuses') },
              { value: 'LOW_STOCK', label: t('common.lowStock') },
              { value: 'OUT_OF_STOCK', label: t('common.outOfStock') },
            ]}
            value={status}
            onChange={setStatus}
          />
          {categories.length ? <SelectField label={t('common.category')} value={categoryId} options={categories} onChange={setCategoryId} placeholder={t('common.allCategories')} allowClear={t('common.allCategories')} /> : null}
          <ToggleRow label={t('inventory.onlySkusWithAMinimumLevel')} value={withLevels} onChange={setWithLevels} />
          <ResetLink
            shown={filtered}
            onPress={() => {
              setSearch('');
              setWarehouseId('');
              setStatus('');
              setCategoryId('');
              setWithLevels(false);
            }}
          />
        </>
      }
      empty={
        all.length === 0 ? (
          <AllClear title={t('inventory.nothingIsLowOrOutOf')} text={t('inventory.allYourProductsAreCurrentlyAbove')} />
        ) : (
          <AllClear title={t('inventory.nothingMatchesTheseFilters')} text={t('inventory.tryAnotherSearchOrResetThe')} />
        )
      }
      render={r => {
        const out = r.stockStatus === 'OUT_OF_STOCK' || r.available <= 0;
        const v = value(r);
        const need = reorderQty(r);
        return (
          <View style={styles.card}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${r.productName}, ${r.sku}`} onPress={() => navigation.navigate('StockDetail', { id: r.id })} style={styles.cardTop}>
              <Thumb src={r.imageUrl} />
              <View style={styles.flex}>
                <Text style={opsStyles.title} numberOfLines={1}>
                  {r.productName}
                </Text>
                <Text style={opsStyles.meta} numberOfLines={1}>{`${r.sku} · ${r.categoryName ?? r.variantLabel}`}</Text>
                <View style={styles.warehouse}>
                  <WarehouseIcon size={13} color={colors.textMuted} />
                  <Text style={opsStyles.meta} numberOfLines={1}>
                    {r.warehouseTitle}
                  </Text>
                </View>
              </View>
              <Badge label={out ? t('common.outOfStock') : t('common.lowStock')} tone={out ? 'red' : 'amber'} />
            </Pressable>
            <View style={styles.qtys}>
              <Figure label={t('common.current')} value={formatQty(r.available, r)} color={colors.error} />
              <Figure label={t('inventory.minimum')} value={formatQty(r.minimum, r)} />
              <Figure label={t('inventory.reorder')} value={need > 0 ? formatQty(need, r) : 'Set levels'} muted={need <= 0} />
              <Figure label={t('inventory.estValue')} value={v !== null ? shortRupees(v) : 'No cost'} muted={v === null} />
            </View>
            <View style={opsStyles.row}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('inventory.receiveProductname', { productName: r.productName })} onPress={() => onOperation('receive', r)} style={[styles.action, styles.actionPrimary]}>
                <Text style={[styles.actionText, styles.actionTextPrimary]}>{t('inventory.receive')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t('inventory.setStockLevelsForProductname', { productName: r.productName })} onPress={() => onOperation('levels', r)} style={styles.action}>
                <Text style={styles.actionText}>{t('inventory.setStockLevels')}</Text>
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}

function Figure({ label, value, color = colors.text, muted }: { label: string; value: string; color?: string; muted?: boolean }) {
  return (
    <View style={styles.qty}>
      <Text style={styles.qtyLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.figureValue, { color: muted ? colors.textMuted : color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

/** Lists come back fresh after a stock record's own page changed it. */
function useReloadOnFocus(reload: () => void) {
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
    }, [reload]),
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  selfStart: { alignSelf: 'flex-start' },
  tabsWrap: { backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tabs: { gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tabOn: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  tabText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  tabTextOn: { color: colors.white },
  header: { gap: 12, marginBottom: 4 },
  footer: { gap: 12 },
  intro: { gap: 10 },
  toggleLabel: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.text },
  reset: { fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary },
  separator: { height: 10 },
  card: { gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  pressed: { backgroundColor: '#fffaf5' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  thumbImg: { width: '100%', height: '100%' },
  warehouse: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  qtys: { flexDirection: 'row', gap: 6, padding: 10, borderRadius: radius.md, backgroundColor: colors.background },
  qty: { flex: 1, alignItems: 'center', minWidth: 0 },
  qtyLabel: { fontFamily: fonts.semibold, fontSize: 9.5, letterSpacing: 0.4, color: colors.textSecondary },
  qtyValue: { marginTop: 2, fontFamily: fonts.bold, fontSize: 15 },
  qtyUnit: { fontFamily: fonts.regular, fontSize: 10.5, color: colors.textMuted },
  figureValue: { marginTop: 3, fontFamily: fonts.bold, fontSize: 13 },
  action: { flex: 1, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actionPrimary: { borderColor: colors.secondarySoft, backgroundColor: colors.secondaryLight },
  actionText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  actionTextPrimary: { color: colors.secondaryDark },
  menu: { gap: 6 },
  menuItem: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  menuText: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  right: { alignItems: 'flex-end' },
  delta: { fontFamily: fonts.bold, fontSize: 15 },
  pos: { color: colors.successDark },
  neg: { color: colors.error },
  moveTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  moveText: { fontFamily: fonts.semibold, fontSize: 12 },
  held: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heldLong: { fontFamily: fonts.semibold, color: colors.warningDark },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: '#dbeafe', backgroundColor: '#eff6ff' },
  infoDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b82f6' },
  infoDotText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  infoText: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary },
});
