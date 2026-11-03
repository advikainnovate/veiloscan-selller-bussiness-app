import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { filterSkus, isActiveRow } from '../../lib/catalog';
import { productSkuService, productsService, type Row } from '../../services/products-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Sheet } from '../../components/ui/Sheet';
import { SelectField } from '../../components/form/Fields';
import { EmptyState, ErrorState, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { ActionSheet, compactStyles, CountTiles, Fab, ListTop, RowCard, Separator, SummaryLine, TILE_COLORS, useListPadding } from '../../components/list/CompactList';
import { confirmAction, opsStyles } from '../../components/operations/OpsParts';
import { BanIcon, CheckCircleIcon, EditIcon, LayersIcon, SlidersIcon, TrashIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

const PAGE_SIZE = 10;
const rupees = (v: unknown) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

/** Catalog › Business Variants: sellable SKUs with pricing for each variant combination. */
export function BusinessVariantsScreen({ navigation }: ScreenProps<'BusinessVariants'>) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const listPadding = useListPadding();
  const allowed = hasPermission('product-business-variants:manage');
  const { data, error, loading, reload } = useFetch(() => (allowed ? productSkuService.list() : Promise.resolve([])), [allowed]);
  const products = useFetch(() => (allowed ? productsService.list().catch(() => []) : Promise.resolve([])), [allowed]);
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [status, setStatus] = useState('');
  const [moreFilters, setMoreFilters] = useState(false);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [actionsFor, setActionsFor] = useState<Row | null>(null);

  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const items = useMemo(() => data ?? [], [data]);
  const nameById = useMemo(() => new Map((products.data ?? []).map(p => [p.id as unknown, String(p.productName ?? '')])), [products.data]);
  const productName = useCallback((pid: unknown) => nameById.get(pid) ?? '', [nameById]);
  const rows = useMemo(() => filterSkus(items, productName, search, productId, status), [items, productName, search, productId, status]);
  const prices = items.map(r => Number(r.businessPrice)).filter(n => !Number.isNaN(n));
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const isFiltered = !!(search.trim() || productId || status);

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="Business Variants" onBack={navigation.goBack} />
        <ComingSoon label="Business Variants" icon={LayersIcon} allowed={false} />
      </View>
    );
  }

  async function toggle(row: Row) {
    const active = isActiveRow(row);
    if (!(await confirmAction(`${active ? 'Deactivate' : 'Activate'} "${String(row.skuItemNumber)}"?`, undefined, active ? 'Deactivate' : 'Activate', active))) return;
    try {
      await productSkuService.update(row.id, { status: active ? 0 : 1 });
      toast(`Business variant ${active ? 'deactivated' : 'activated'}`);
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function remove(row: Row) {
    if (!(await confirmAction('Delete business variant?', `"${String(row.skuItemNumber)}" will be removed from this list. Deactivate it instead if you only want to take it out of use.`, 'Delete', true))) return;
    try {
      await productSkuService.remove(row.id);
      toast('Business variant deleted');
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title="Business Variants" subtitle="Catalog" onBack={navigation.goBack} />
      <ListTop>
        <SearchBar
          value={search}
          onChange={v => {
            setSearch(v);
            setShown(PAGE_SIZE);
          }}
          placeholder="Search by SKU, barcode or product…"
        />
        <CountTiles
          tiles={[
            { key: '1', label: 'Active', count: items.filter(isActiveRow).length, ...TILE_COLORS.green },
            { key: '0', label: 'Inactive', count: items.filter(r => !isActiveRow(r)).length, ...TILE_COLORS.slate },
            { key: 'products', label: 'Products', count: new Set(items.map(r => r.productId)).size, info: true, ...TILE_COLORS.amber },
            { key: 'avg', label: 'Avg price', count: `₹${avg.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, info: true, ...TILE_COLORS.violet },
          ]}
          value={status}
          onSelect={k => {
            setStatus(k);
            setShown(PAGE_SIZE);
          }}
          loading={loading && !data}
        />
        <SummaryLine
          hint="Sellable SKUs with pricing for each variant combination."
          filtered={isFiltered}
          shown={rows.length}
          total={items.length}
          noun="SKU"
          onClear={() => {
            setSearch('');
            setProductId('');
            setStatus('');
          }}
          extra={
            <Pressable accessibilityRole="button" accessibilityLabel="More filters" hitSlop={8} onPress={() => setMoreFilters(true)} style={styles.filterBtn}>
              <SlidersIcon size={14} color={productId ? colors.secondary : colors.textSecondary} />
              <Text style={[styles.filterText, productId ? styles.accent : null]}>{productId ? 'Filters (1)' : 'Filters'}</Text>
            </Pressable>
          }
        />
      </ListTop>

      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={loading && !data ? [] : rows.slice(0, shown)}
          keyExtractor={r => r.id}
          contentContainerStyle={listPadding}
          ItemSeparatorComponent={Separator}
          refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
          onEndReached={() => setShown(n => (n < rows.length ? n + PAGE_SIZE : n))}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            loading && !data ? (
              <ListSkeleton rows={4} height={84} />
            ) : (
              <View style={compactStyles.empty}>
                <EmptyState icon={LayersIcon} title={isFiltered ? 'No SKUs match' : 'No business variants found'} text={isFiltered ? 'Try another filter or search term.' : 'Add a SKU to sell a product variant.'} />
              </View>
            )
          }
          renderItem={({ item }) => {
            const active = isActiveRow(item);
            const image = (item.productImageFile as Row | undefined)?.url as string | undefined;
            const combo = Object.values((item.variantCombination as Record<string, unknown>) ?? {});
            const discounted = item.mrp && Number(item.mrp) > Number(item.businessPrice);
            return (
              <RowCard label={`Edit ${String(item.skuItemNumber)}`} onPress={() => navigation.navigate('BusinessVariantForm', { id: item.id })}>
                <View style={compactStyles.head}>
                  <View style={compactStyles.thumb}>{image ? <Image source={{ uri: image }} style={compactStyles.thumbImage} /> : <LayersIcon size={16} color={colors.textMuted} />}</View>
                  <View style={styles.flex}>
                    <Text style={compactStyles.name} numberOfLines={1}>
                      {String(item.skuItemNumber)}
                    </Text>
                    <Text style={compactStyles.meta} numberOfLines={1}>
                      {`${productName(item.productId) || '—'}${item.barcode ? ` · ${String(item.barcode)}` : ''}`}
                    </Text>
                  </View>
                  <Badge label={active ? 'Active' : 'Inactive'} tone={active ? 'green' : 'slate'} />
                  <Pressable accessibilityRole="button" accessibilityLabel={`More for ${String(item.skuItemNumber)}`} hitSlop={10} onPress={() => setActionsFor(item)} style={compactStyles.more}>
                    <Text style={compactStyles.dots}>⋮</Text>
                  </Pressable>
                </View>
                <View style={compactStyles.chips}>
                  <Text style={styles.price}>{rupees(item.businessPrice)}</Text>
                  {discounted ? <Text style={styles.mrp}>{rupees(item.mrp)}</Text> : null}
                  <Text style={compactStyles.chip}>{item.quantityPriceType === 'SLAB' ? 'Slab' : 'Fixed'}</Text>
                  {combo.map((v, i) => (
                    <Text key={i} style={compactStyles.chip}>
                      {String(v)}
                    </Text>
                  ))}
                </View>
              </RowCard>
            );
          }}
        />
      )}

      <Fab label="Add SKU" onPress={() => navigation.navigate('BusinessVariantForm')} />

      <Sheet visible={moreFilters} title="Filters" onClose={() => setMoreFilters(false)}>
        <SelectField
          label="Product"
          value={productId}
          options={(products.data ?? []).map(p => ({ value: p.id, label: String(p.productName ?? p.id) }))}
          onChange={v => {
            setProductId(v);
            setShown(PAGE_SIZE);
          }}
          allowClear="All Products"
          placeholder="All Products"
        />
      </Sheet>

      <ActionSheet
        visible={!!actionsFor}
        title={String(actionsFor?.skuItemNumber ?? '')}
        subtitle={actionsFor ? productName(actionsFor.productId) : undefined}
        onClose={() => setActionsFor(null)}
        actions={
          actionsFor
            ? [
                { label: 'Edit', icon: EditIcon, onPress: () => navigation.navigate('BusinessVariantForm', { id: actionsFor.id }) },
                { label: isActiveRow(actionsFor) ? 'Deactivate' : 'Activate', icon: isActiveRow(actionsFor) ? BanIcon : CheckCircleIcon, onPress: () => toggle(actionsFor) },
                { label: 'Delete', icon: TrashIcon, danger: true, onPress: () => remove(actionsFor) },
              ]
            : []
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  accent: { color: colors.secondary },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  price: { marginRight: 2, fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  mrp: { marginRight: 4, fontFamily: fonts.regular, fontSize: 11.5, color: colors.textMuted, textDecorationLine: 'line-through' },
});
