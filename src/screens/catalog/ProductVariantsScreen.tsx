import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatDay } from '../../lib/date';
import { filterVariants, isActiveRow, VARIANT_FILTERS, variantProduct, variantType, variantValue, type VariantFilters } from '../../lib/catalog';
import { productVariantService } from '../../services/catalog-service';
import { productImageService, type Row } from '../../services/products-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Sheet } from '../../components/ui/Sheet';
import { SelectField } from '../../components/form/Fields';
import { EmptyState, ErrorState, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { ActionSheet, compactStyles, CountTiles, Fab, ListTop, RowCard, Separator, SummaryLine, TILE_COLORS, useListPadding } from '../../components/list/CompactList';
import { confirmAction, opsStyles } from '../../components/operations/OpsParts';
import { BanIcon, BoxIcon, CheckCircleIcon, EditIcon, EyeIcon, LayersIcon, SlidersIcon, TrashIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

const PAGE_SIZE = 10;

/** A variant value's swatch: its image, its colour code, or its initial. */
function ValueSwatch({ value }: { value: Row }) {
  const image = (value.imageFile as Row | undefined)?.url as string | undefined;
  const color = value.colorCode as string | undefined;
  if (image) return <Image source={{ uri: image }} style={styles.swatch} />;
  if (color) return <View style={[styles.swatch, { backgroundColor: color }]} />;
  return (
    <View style={[styles.swatch, styles.swatchText]}>
      <Text style={styles.initial}>{String(value.variantData ?? '?').slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

/** Catalog › Product Variants: which variant values (size, colour…) each product is offered in. */
export function ProductVariantsScreen({ navigation }: ScreenProps<'ProductVariants'>) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const listPadding = useListPadding();
  const allowed = hasPermission('product-variants:manage');
  const { data, error, loading, reload } = useFetch(() => (allowed ? productVariantService.list() : Promise.resolve([])), [allowed]);
  const images = useFetch(() => (allowed ? productImageService.list().catch(() => []) : Promise.resolve([])), [allowed]);
  const [filters, setFilters] = useState<VariantFilters>(VARIANT_FILTERS);
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
  const rows = useMemo(() => filterVariants(items, filters), [items, filters]);
  // Primary (or first) image per product for the thumbnail.
  const coverByProduct = useMemo(() => {
    const map = new Map<string, string>();
    for (const img of [...(images.data ?? [])].sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)))) {
      const url = (img.file as Row | undefined)?.url as string | undefined;
      if (url && !map.has(String(img.productId))) map.set(String(img.productId), url);
    }
    return map;
  }, [images.data]);
  const options = useMemo(() => {
    const byId = (key: 'product' | 'variant', label: string) =>
      [...new Map(items.map(r => [String(r[`${key}Id`]), String(((r[key] as Row | undefined)?.[label] as string) ?? '—')])).entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, l]) => ({ value, label: l }));
    return { products: byId('product', 'productName'), variants: byId('variant', 'variantTitle') };
  }, [items]);
  const stats = {
    active: items.filter(isActiveRow).length,
    inactive: items.filter(r => !isActiveRow(r)).length,
    products: new Set(items.map(r => r.productId)).size,
    types: new Set(items.map(r => r.variantId)).size,
  };
  const isFiltered = Object.values(filters).some(Boolean);
  const extra = [filters.productId, filters.variantId].filter(Boolean).length;
  const set = <K extends keyof VariantFilters>(k: K, v: VariantFilters[K]) => {
    setFilters(f => ({ ...f, [k]: v }));
    setShown(PAGE_SIZE);
  };

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="Product Variants" onBack={navigation.goBack} />
        <ComingSoon label="Product Variants" icon={LayersIcon} allowed={false} />
      </View>
    );
  }

  async function setStatus(row: Row, status: 0 | 1) {
    try {
      await productVariantService.update(row.id, { status });
      toast(status === 1 ? 'Variant mapping activated' : 'Variant mapping deactivated');
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function remove(row: Row) {
    if (!(await confirmAction('Remove this variant mapping?', 'The product will no longer offer this variant value.', 'Remove', true))) return;
    try {
      await productVariantService.remove(row.id);
      toast('Variant mapping removed');
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title="Product Variants" subtitle="Catalog" onBack={navigation.goBack} />
      <ListTop>
        <SearchBar value={filters.search} onChange={v => set('search', v)} placeholder="Search by product, SKU, variant type or value..." />
        <CountTiles
          tiles={[
            { key: '1', label: 'Active', count: stats.active, ...TILE_COLORS.green },
            { key: '0', label: 'Inactive', count: stats.inactive, ...TILE_COLORS.slate },
            { key: 'products', label: 'Products', count: stats.products, info: true, ...TILE_COLORS.blue },
            { key: 'types', label: 'Types', count: stats.types, info: true, ...TILE_COLORS.violet },
          ]}
          value={filters.status}
          onSelect={k => set('status', k)}
          loading={loading && !data}
        />
        <SummaryLine
          hint="Which variant values (size, colour…) each product is offered in."
          filtered={isFiltered}
          shown={rows.length}
          total={items.length}
          noun="mapping"
          onClear={() => setFilters(VARIANT_FILTERS)}
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
                <EmptyState
                  icon={LayersIcon}
                  title={isFiltered ? 'No variant mappings match' : 'No product variants yet'}
                  text={isFiltered ? 'Try another filter or search term.' : "They're added from a product's Variants step, or with Add Mapping."}
                />
              </View>
            )
          }
          renderItem={({ item }) => {
            const p = variantProduct(item);
            const v = variantValue(item);
            const cover = coverByProduct.get(String(item.productId));
            const active = isActiveRow(item);
            return (
              <RowCard label={`Edit ${String(p.productName ?? 'mapping')} ${String(v.variantData ?? '')}`} onPress={() => navigation.navigate('ProductVariantForm', { id: item.id })}>
                <View style={compactStyles.head}>
                  <View style={compactStyles.thumb}>{cover ? <Image source={{ uri: cover }} style={compactStyles.thumbImage} /> : <BoxIcon size={17} color={colors.textMuted} />}</View>
                  <View style={styles.flex}>
                    <Text style={compactStyles.name} numberOfLines={1}>
                      {String(p.productName ?? '—')}
                    </Text>
                    <Text style={compactStyles.meta} numberOfLines={1}>
                      {`SKU ${String(p.skuItemNumber ?? '—')} · #${String(item.sequence ?? '—')} · ${formatDay(item.createdAt)}`}
                    </Text>
                  </View>
                  <Badge label={active ? 'Active' : 'Inactive'} tone={active ? 'green' : 'slate'} />
                  <Pressable accessibilityRole="button" accessibilityLabel={`More for ${String(p.productName ?? '')} ${String(v.variantData ?? '')}`} hitSlop={10} onPress={() => setActionsFor(item)} style={compactStyles.more}>
                    <Text style={compactStyles.dots}>⋮</Text>
                  </Pressable>
                </View>
                <View style={compactStyles.chips}>
                  <Text style={[compactStyles.chip, styles.type]}>{String(variantType(item).variantTitle ?? '—')}</Text>
                  <ValueSwatch value={v} />
                  <Text style={compactStyles.line}>{String(v.variantData ?? '—')}</Text>
                  {v.colorCode ? <Text style={compactStyles.meta}>{String(v.colorCode)}</Text> : null}
                </View>
              </RowCard>
            );
          }}
        />
      )}

      <Fab label="Add Mapping" accessibilityLabel="Add Variant Mapping" onPress={() => navigation.navigate('ProductVariantForm')} />

      <Sheet visible={moreFilters} title="Filters" onClose={() => setMoreFilters(false)}>
        <SelectField label="Product" value={filters.productId} options={options.products} onChange={v => set('productId', v)} allowClear="All Products" placeholder="All Products" />
        <SelectField label="Variant Type" value={filters.variantId} options={options.variants} onChange={v => set('variantId', v)} allowClear="All Types" placeholder="All Types" />
      </Sheet>

      <ActionSheet
        visible={!!actionsFor}
        title={String(variantProduct(actionsFor ?? ({} as Row)).productName ?? '')}
        subtitle={actionsFor ? `${String(variantType(actionsFor).variantTitle ?? '')}: ${String(variantValue(actionsFor).variantData ?? '')}` : undefined}
        onClose={() => setActionsFor(null)}
        actions={
          actionsFor
            ? [
                { label: 'View Product', icon: EyeIcon, onPress: () => navigation.navigate('ProductDetail', { id: String(actionsFor.productId) }) },
                { label: 'Edit Mapping', icon: EditIcon, onPress: () => navigation.navigate('ProductVariantForm', { id: actionsFor.id }) },
                { label: 'Activate', icon: CheckCircleIcon, hidden: isActiveRow(actionsFor), onPress: () => setStatus(actionsFor, 1) },
                { label: 'Deactivate', icon: BanIcon, hidden: !isActiveRow(actionsFor), onPress: () => setStatus(actionsFor, 0) },
                { label: 'Remove', icon: TrashIcon, danger: true, onPress: () => remove(actionsFor) },
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
  type: { color: '#6d28d9', backgroundColor: '#f5f3ff' },
  swatch: { width: 20, height: 20, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  swatchText: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  initial: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.textSecondary },
});
