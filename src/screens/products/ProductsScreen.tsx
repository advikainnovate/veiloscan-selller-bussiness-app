import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useProducts, type ProductRow, type StockStatus } from '../../hooks/useProducts';
import { useProductActions } from '../../hooks/useProductActions';
import { extractErrorMessage } from '../../lib/api';
import { formatRupees } from '../../lib/format';
import { readableQty } from '../../lib/inventory';
import { canPublish, canSubmitForApproval, isLive, productStage } from '../../lib/product-approval';
import { productsService, type Uom } from '../../services/products-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Gradient } from '../../components/ui/Gradient';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { EmptyState, ErrorState, FilterChips, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { BanIcon, BoxIcon, CheckCircleIcon, CheckIcon, FilterIcon, PlusIcon } from '../../components/icons';
import type { TabScreenProps } from '../../navigation/types';

// Approval stages (see lib/product-approval) plus stock views, as the Seller Panel's tabs.
const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In Review' },
  { value: 'changes_required', label: 'Changes Required' },
  { value: 'unpublished', label: 'Unpublished' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'low_stock', label: 'Low Stock' },
];
const STAGE_TABS = ['published', 'draft', 'in_review', 'changes_required', 'unpublished'];

const STOCK: Record<StockStatus, { label: string; color: string }> = {
  IN_STOCK: { label: 'In stock', color: colors.successDark },
  LOW_STOCK: { label: 'Low stock', color: colors.warningDark },
  OUT_OF_STOCK: { label: 'Out of stock', color: colors.error },
};

type SortKey = 'newest' | 'name' | 'price' | 'stock';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'name', label: 'Name' },
  { key: 'price', label: 'Price' },
  { key: 'stock', label: 'Stock' },
];

// Brand filter value for products without a brand.
const NO_BRAND = '__none__';
// Bulk updates run a few requests at a time so a large selection doesn't flood the API.
const BULK_CONCURRENCY = 5;

async function runInBatches<T>(items: T[], task: (item: T) => Promise<unknown>) {
  const failed: T[] = [];
  let firstError: unknown = null;
  for (let i = 0; i < items.length; i += BULK_CONCURRENCY) {
    const batch = items.slice(i, i + BULK_CONCURRENCY);
    const results = await Promise.allSettled(batch.map(task));
    results.forEach((result, j) => {
      if (result.status === 'rejected') {
        failed.push(batch[j]);
        firstError ??= result.reason;
      }
    });
  }
  return { failed, firstError };
}

interface Filters {
  categoryId: string;
  brandId: string;
  stock: StockStatus | '';
  priceMin: string;
  priceMax: string;
}
const NO_FILTERS: Filters = { categoryId: '', brandId: '', stock: '', priceMin: '', priceMax: '' };

/** Products tab: the catalog with approval stages, stock, filters and the row actions of the Seller Panel. */
export function ProductsScreen({ navigation }: TabScreenProps<'Products'>) {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('products-master:manage');
  const toast = useToast();
  const { rows, categories, brands, uoms, loading, error, loaded, refreshing, reload } = useProducts(allowed);
  const actions = useProductActions(() => reload());

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>('newest');
  const [menuFor, setMenuFor] = useState<ProductRow | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (allowed && loaded) reload();
      // Only when coming back to the tab.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allowed]),
  );

  const categoryTitle = useMemo(() => new Map(categories.map(c => [c.id, String(c.categoryTitle ?? '')])), [categories]);
  const brandTitle = useMemo(() => new Map(brands.map(b => [b.id, String(b.title ?? '')])), [brands]);

  const stats = useMemo(() => {
    const byStage = (key: string) => rows.filter(r => productStage(r).key === key).length;
    return {
      total: rows.length,
      published: byStage('published'),
      inReview: byStage('in_review'),
      changes: byStage('changes_required'),
      draft: byStage('draft'),
      outOfStock: rows.filter(r => r.stockStatus === 'OUT_OF_STOCK').length,
    };
  }, [rows]);

  const tabCount = (value: string) =>
    value === 'all'
      ? rows.length
      : STAGE_TABS.includes(value)
        ? rows.filter(r => productStage(r).key === value).length
        : rows.filter(r => r.stockStatus === (value === 'out_of_stock' ? 'OUT_OF_STOCK' : 'LOW_STOCK')).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(row => {
        if (STAGE_TABS.includes(tab) && productStage(row).key !== tab) return false;
        if (tab === 'out_of_stock' && row.stockStatus !== 'OUT_OF_STOCK') return false;
        if (tab === 'low_stock' && row.stockStatus !== 'LOW_STOCK') return false;
        if (filters.categoryId && row.categoryId !== filters.categoryId) return false;
        if (filters.brandId === NO_BRAND ? !!row.brandId : filters.brandId && row.brandId !== filters.brandId) return false;
        if (filters.stock && row.stockStatus !== filters.stock) return false;
        if (filters.priceMin && (row.price === null || row.price < Number(filters.priceMin))) return false;
        if (filters.priceMax && (row.price === null || row.price > Number(filters.priceMax))) return false;
        if (q && !`${row.productName} ${row.skuItemNumber ?? ''}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) =>
        sort === 'name'
          ? a.productName.localeCompare(b.productName)
          : sort === 'price'
            ? (a.price ?? Infinity) - (b.price ?? Infinity)
            : sort === 'stock'
              ? b.totalAvailable - a.totalAvailable
              : new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
      );
  }, [rows, tab, filters, search, sort]);

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const selectedRows = rows.filter(r => selected.has(r.id));
  // Only approved products can go live; drafts are submitted for approval.
  const toActivate = selectedRows.filter(r => canPublish(r) && !isLive(r));
  const toSubmit = selectedRows.filter(r => canSubmitForApproval(r));

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulk(kind: 'submit' | 'activate') {
    const items = kind === 'submit' ? toSubmit : toActivate;
    if (!items.length || bulkBusy) return;
    setBulkBusy(true);
    const { failed, firstError } = await runInBatches(items, row =>
      kind === 'submit' ? productsService.submitForApproval(row.id) : productsService.update(row.id, { status: 1, isActive: true }),
    );
    setBulkBusy(false);
    const done = items.length - failed.length;
    const verb = kind === 'submit' ? 'submitted for approval' : 'activated';
    if (failed.length) {
      toast(`${done} of ${items.length} ${verb}. ${failed.length} failed: ${extractErrorMessage(firstError)}`, 'error');
      // Keep the failed ones selected so they can be retried.
      setSelected(new Set(failed.map(r => r.id)));
    } else {
      toast(`${done} product${done === 1 ? '' : 's'} ${verb}`);
      setSelected(new Set());
      setSelecting(false);
    }
    reload();
  }

  if (!allowed) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Products" />
        <ComingSoon label="Products" icon={BoxIcon} allowed={false} />
      </View>
    );
  }

  const header = (
    <View style={styles.headerBlock}>
      {/* The catalog at a glance; tapping a figure opens its tab */}
      <View style={styles.summary}>
        <Gradient colors={[colors.primary, '#0b2a52']} direction="diagonal" borderRadius={20} />
        <View style={styles.summaryGlow} />
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryLabel}>Products</Text>
            <Text style={styles.summaryValue}>{stats.total}</Text>
          </View>
          {stats.outOfStock ? (
            <Pressable accessibilityRole="button" onPress={() => setTab(tab === 'out_of_stock' ? 'all' : 'out_of_stock')} style={styles.alertPill}>
              <BanIcon size={13} color="#fca5a5" />
              <Text style={styles.alertPillText}>{`${stats.outOfStock} out of stock`}</Text>
            </Pressable>
          ) : (
            <View style={[styles.alertPill, styles.okPill]}>
              <CheckCircleIcon size={13} color="#4ade80" />
              <Text style={[styles.alertPillText, styles.okPillText]}>All in stock</Text>
            </View>
          )}
        </View>
        <View style={styles.summaryStats}>
          <SummaryStat label="Live" value={stats.published} dot="#4ade80" active={tab === 'published'} onPress={() => setTab(tab === 'published' ? 'all' : 'published')} />
          <SummaryStat label="In review" value={stats.inReview} dot="#fbbf24" active={tab === 'in_review'} onPress={() => setTab(tab === 'in_review' ? 'all' : 'in_review')} />
          <SummaryStat label="Changes" value={stats.changes} dot="#fb923c" active={tab === 'changes_required'} onPress={() => setTab(tab === 'changes_required' ? 'all' : 'changes_required')} />
          <SummaryStat label="Draft" value={stats.draft} dot="#94a3b8" active={tab === 'draft'} onPress={() => setTab(tab === 'draft' ? 'all' : 'draft')} />
        </View>
      </View>
      <View style={styles.searchRow}>
        <View style={styles.flex}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search name or SKU" />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Filters${activeFilters ? `, ${activeFilters} on` : ''}`}
          onPress={() => setFilterOpen(true)}
          style={[styles.filterBtn, activeFilters > 0 && styles.filterBtnOn]}
        >
          <FilterIcon size={18} color={activeFilters ? colors.white : colors.text} />
          {activeFilters ? <Text style={styles.filterCount}>{activeFilters}</Text> : null}
        </Pressable>
      </View>
      <FilterChips options={STATUS_TABS.map(t => ({ ...t, count: tabCount(t.value) }))} value={tab} onChange={setTab} />
      <View style={styles.sortRow}>
        <View style={styles.sortGroup}>
        {SORTS.map(s => (
          <Pressable
            key={s.key}
            accessibilityRole="button"
            accessibilityState={{ selected: sort === s.key }}
            onPress={() => setSort(s.key)}
            style={[styles.sort, sort === s.key && styles.sortOn]}
          >
            <Text style={[styles.sortText, sort === s.key && styles.sortTextOn]}>{s.label}</Text>
          </Pressable>
        ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setSelecting(s => !s);
            setSelected(new Set());
          }}
          style={styles.selectBtn}
        >
          <Text style={styles.selectText}>{selecting ? 'Done' : 'Select'}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <AppHeader title="Products" subtitle={loaded ? `${rows.length} product${rows.length === 1 ? '' : 's'}` : undefined} />
      <FlatList
        data={loading || (error && !loaded) ? [] : visible}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            uoms={uoms}
            category={categoryTitle.get(item.categoryId ?? '')}
            brand={item.brandId ? brandTitle.get(item.brandId) : undefined}
            selecting={selecting}
            selected={selected.has(item.id)}
            busy={actions.busyId === item.id}
            onPress={() => (selecting ? toggleSelect(item.id) : navigation.navigate('ProductDetail', { id: item.id }))}
            onMenu={() => setMenuFor(item)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <ListSkeleton rows={5} height={104} />
          ) : error && !loaded ? (
            <ErrorState message={error} onRetry={() => reload()} />
          ) : (
            <EmptyState
              icon={BoxIcon}
              title={rows.length ? 'No products match' : 'No products yet'}
              text={rows.length ? 'Try another tab, filter or search.' : 'Add your first product to start selling.'}
            />
          )
        }
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      />

      {selecting ? (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkText}>{selected.size} selected</Text>
          <Button
            title={`Submit (${toSubmit.length})`}
            variant="ghost"
            disabled={!toSubmit.length || bulkBusy}
            onPress={() => bulk('submit')}
            style={styles.bulkBtn}
          />
          <Button
            title={`Activate (${toActivate.length})`}
            loading={bulkBusy}
            disabled={!toActivate.length}
            onPress={() => bulk('activate')}
            style={styles.bulkBtn}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add product"
          onPress={() => navigation.navigate('ProductEditor', {})}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <PlusIcon size={20} color={colors.white} strokeWidth={2.4} />
          <Text style={styles.fabText}>Add product</Text>
        </Pressable>
      )}

      <FilterSheet
        visible={filterOpen}
        value={filters}
        categories={categories.filter(c => rows.some(r => r.categoryId === c.id))}
        brands={brands.filter(b => rows.some(r => r.brandId === b.id))}
        onApply={next => {
          setFilters(next);
          setFilterOpen(false);
        }}
        onClose={() => setFilterOpen(false)}
      />

      <Sheet visible={!!menuFor} title={menuFor?.productName ?? ''} subtitle={menuFor ? productStage(menuFor).label : undefined} onClose={() => setMenuFor(null)}>
        {menuFor ? (
          <View style={styles.menu}>
            <MenuItem label="View details" onPress={() => navigation.navigate('ProductDetail', { id: menuFor.id })} close={() => setMenuFor(null)} />
            <MenuItem label="Edit" onPress={() => navigation.navigate('ProductEditor', { id: menuFor.id })} close={() => setMenuFor(null)} />
            <MenuItem label="Duplicate" onPress={() => actions.duplicate(menuFor)} close={() => setMenuFor(null)} />
            {canSubmitForApproval(menuFor) ? (
              <MenuItem label={productStage(menuFor).key === 'changes_required' ? 'Resubmit for approval' : 'Submit for approval'} onPress={() => actions.submit(menuFor)} close={() => setMenuFor(null)} />
            ) : null}
            {canPublish(menuFor) ? (
              <MenuItem label={Number(menuFor.status) === 1 ? 'Deactivate' : 'Activate'} onPress={() => actions.toggleStatus(menuFor)} close={() => setMenuFor(null)} />
            ) : null}
            <MenuItem label="Delete" danger onPress={() => actions.remove(menuFor)} close={() => setMenuFor(null)} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function MenuItem({ label, onPress, close, danger }: { label: string; onPress: () => void; close: () => void; danger?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        close();
        onPress();
      }}
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
    >
      <Text style={[styles.menuText, danger && styles.menuDanger]}>{label}</Text>
    </Pressable>
  );
}

function SummaryStat({ label, value, dot, active, onPress }: { label: string; value: number; dot: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} accessibilityState={{ selected: active }} onPress={onPress} style={[styles.stat, active && styles.statActive]}>
      <View style={styles.statHead}>
        <View style={[styles.statDot, { backgroundColor: dot }]} />
        <Text style={styles.statLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </Pressable>
  );
}

const STAGE_COLOR: Record<string, string> = {
  published: '#22c55e',
  in_review: '#f59e0b',
  changes_required: '#f97316',
  draft: '#38bdf8',
  unpublished: '#94a3b8',
};

function ProductCard({
  product,
  uoms,
  category,
  brand,
  selecting,
  selected,
  busy,
  onPress,
  onMenu,
}: {
  product: ProductRow;
  uoms: Uom[];
  category?: string;
  brand?: string;
  selecting: boolean;
  selected: boolean;
  busy: boolean;
  onPress: () => void;
  onMenu: () => void;
}) {
  const stage = productStage(product);
  const stock = STOCK[product.stockStatus];
  const stockText = product.stockTotals.length
    ? product.stockTotals.map(t => readableQty(t.available, t.uom, uoms)).join(' + ')
    : 'No stock yet';
  const off = product.mrp && product.price !== null && product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.productName}, ${stage.label}`}
      accessibilityState={selecting ? { selected } : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.cardPressed, busy && styles.cardBusy]}
    >
      <View style={[styles.stripe, { backgroundColor: STAGE_COLOR[stage.key] ?? STAGE_COLOR.unpublished }]} />
      {selecting ? (
        <View style={[styles.check, selected && styles.checkOn]}>{selected ? <CheckIcon size={13} color={colors.white} strokeWidth={3} /> : null}</View>
      ) : null}
      {product.coverUrl ? (
        <Image source={{ uri: product.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverEmpty]}>
          <BoxIcon size={22} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {product.productName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[category, brand ?? 'No brand', `${product.skuCount} SKU${product.skuCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.bottomRow}>
          <Text style={styles.price}>{product.price === null ? '—' : formatRupees(product.price)}</Text>
          {off ? (
            <>
              <Text style={styles.mrp}>{formatRupees(product.mrp!)}</Text>
              <Text style={styles.off}>{`${off}% off`}</Text>
            </>
          ) : null}
        </View>
        <View style={styles.pills}>
          <Badge label={stage.label} tone={stage.tone} />
          <View style={[styles.stockPill, { backgroundColor: `${stock.color}14` }]}>
            <View style={[styles.stockDot, { backgroundColor: stock.color }]} />
            <Text style={[styles.stock, { color: stock.color }]} numberOfLines={1}>
              {product.stockTotals.length ? stockText : stock.label}
            </Text>
          </View>
        </View>
      </View>
      {!selecting ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${product.productName}`} hitSlop={10} onPress={onMenu} style={styles.more}>
          <Text style={styles.moreText}>⋯</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function FilterSheet({
  visible,
  value,
  categories,
  brands,
  onApply,
  onClose,
}: {
  visible: boolean;
  value: Filters;
  categories: { id: string; [key: string]: unknown }[];
  brands: { id: string; [key: string]: unknown }[];
  onApply: (next: Filters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Filters>(value);
  React.useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);
  const set = (patch: Partial<Filters>) => setDraft(d => ({ ...d, ...patch }));

  return (
    <Sheet
      visible={visible}
      title="Filters"
      onClose={onClose}
      footer={
        <View style={styles.filterActions}>
          <Pressable onPress={() => onApply(NO_FILTERS)} style={styles.resetBtn}>
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
          <Button title="Apply" onPress={() => onApply(draft)} style={styles.flex} />
        </View>
      }
    >
      <FilterGroup label="Category">
        <Choice label="All" on={!draft.categoryId} onPress={() => set({ categoryId: '' })} />
        {categories.map(c => (
          <Choice key={c.id} label={String(c.categoryTitle ?? '')} on={draft.categoryId === c.id} onPress={() => set({ categoryId: c.id })} />
        ))}
      </FilterGroup>
      <FilterGroup label="Brand">
        <Choice label="All" on={!draft.brandId} onPress={() => set({ brandId: '' })} />
        <Choice label="No brand" on={draft.brandId === NO_BRAND} onPress={() => set({ brandId: NO_BRAND })} />
        {brands.map(b => (
          <Choice key={b.id} label={String(b.title ?? '')} on={draft.brandId === b.id} onPress={() => set({ brandId: b.id })} />
        ))}
      </FilterGroup>
      <FilterGroup label="Stock">
        <Choice label="All" on={!draft.stock} onPress={() => set({ stock: '' })} />
        {(Object.keys(STOCK) as StockStatus[]).map(s => (
          <Choice key={s} label={STOCK[s].label} on={draft.stock === s} onPress={() => set({ stock: s })} />
        ))}
      </FilterGroup>
      <FilterGroup label="Price (₹)">
        <TextInput
          value={draft.priceMin}
          onChangeText={t => set({ priceMin: t.replace(/[^0-9.]/g, '') })}
          placeholder="Min"
          keyboardType="decimal-pad"
          placeholderTextColor={colors.textMuted}
          style={styles.priceInput}
        />
        <TextInput
          value={draft.priceMax}
          onChangeText={t => set({ priceMax: t.replace(/[^0-9.]/g, '') })}
          placeholder="Max"
          keyboardType="decimal-pad"
          placeholderTextColor={colors.textMuted}
          style={styles.priceInput}
        />
      </FilterGroup>
    </Sheet>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.choices}>{children}</View>
    </View>
  );
}

function Choice({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={onPress} style={[styles.choice, on && styles.choiceOn]}>
      <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 96 },
  headerBlock: { gap: 12, marginBottom: 12 },
  summary: { overflow: 'hidden', padding: 16, borderRadius: 20, backgroundColor: colors.primary, ...shadow.raised },
  summaryGlow: { position: 'absolute', top: -60, right: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,138,51,0.06)' },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  summaryLabel: { fontFamily: fonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.65)' },
  summaryValue: { marginTop: 2, fontFamily: fonts.extrabold, fontSize: 26, letterSpacing: -0.6, color: colors.white },
  alertPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(248,113,113,0.15)' },
  alertPillText: { fontFamily: fonts.semibold, fontSize: 11.5, color: '#fecaca' },
  okPill: { backgroundColor: 'rgba(74,222,128,0.12)' },
  okPillText: { color: '#bbf7d0' },
  summaryStats: { flexDirection: 'row', gap: 6, marginTop: 14 },
  stat: { flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.07)' },
  statActive: { borderColor: 'rgba(255,138,51,0.7)', backgroundColor: 'rgba(255,107,0,0.18)' },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  statLabel: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 10.5, color: 'rgba(255,255,255,0.7)' },
  statValue: { marginTop: 3, fontFamily: fonts.extrabold, fontSize: 17, color: colors.white },
  searchRow: { flexDirection: 'row', gap: 8 },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnOn: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  filterCount: { position: 'absolute', top: 4, right: 6, fontFamily: fonts.bold, fontSize: 10, color: colors.white },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortGroup: { flexDirection: 'row', padding: 3, gap: 2, borderRadius: 12, backgroundColor: colors.surface, ...shadow.card },
  sort: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  sortOn: { backgroundColor: colors.primary },
  sortText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  sortTextOn: { color: colors.white },
  selectBtn: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 5 },
  selectText: { fontFamily: fonts.bold, fontSize: 13, color: colors.secondary },
  separator: { height: 10 },
  card: { overflow: 'hidden', flexDirection: 'row', gap: 12, paddingVertical: 12, paddingLeft: 16, paddingRight: 12, borderRadius: 16, backgroundColor: colors.surface, ...shadow.card },
  cardSelected: { borderWidth: 1.5, borderColor: colors.secondary },
  cardPressed: { backgroundColor: '#fffaf5' },
  cardBusy: { opacity: 0.6 },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  check: { alignSelf: 'center', width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  cover: { width: 80, height: 80, borderRadius: 14, backgroundColor: colors.background },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 19, color: colors.text, paddingRight: 20 },
  meta: { marginTop: 3, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  bottomRow: { marginTop: 6, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  price: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text },
  mrp: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, textDecorationLine: 'line-through' },
  off: { fontFamily: fonts.bold, fontSize: 12, color: colors.successDark },
  pills: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  stockPill: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '60%', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  stockDot: { width: 6, height: 6, borderRadius: 3 },
  stock: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 11.5 },
  more: { position: 'absolute', top: 6, right: 8, padding: 4 },
  moreText: { fontFamily: fonts.bold, fontSize: 18, color: colors.textMuted, lineHeight: 20 },
  bulkBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...shadow.raised,
  },
  bulkText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  bulkBtn: { height: 44, paddingHorizontal: 12 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 50,
    paddingHorizontal: 18,
    borderRadius: 25,
    backgroundColor: colors.secondary,
    ...shadow.button,
  },
  fabPressed: { backgroundColor: colors.secondaryDark },
  fabText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  menu: { gap: 2 },
  menuItem: { paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  menuItemPressed: { backgroundColor: colors.background },
  menuText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  menuDanger: { color: colors.error },
  group: { gap: 8 },
  groupLabel: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { paddingHorizontal: 12, height: 34, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  choiceOn: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  choiceText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  choiceTextOn: { color: colors.secondaryDark },
  priceInput: {
    flex: 1,
    minWidth: 120,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
  },
  filterActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resetBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  resetText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
});
