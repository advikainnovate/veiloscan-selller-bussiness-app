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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
        <AppHeader title={t('common.productVariants')} onBack={navigation.goBack} />
        <ComingSoon label={t('common.productVariants')} icon={LayersIcon} allowed={false} />
      </View>
    );
  }

  async function setStatus(row: Row, status: 0 | 1) {
    try {
      await productVariantService.update(row.id, { status });
      toast(status === 1 ? t('catalog.variantMappingActivated') : t('catalog.variantMappingDeactivated'));
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function remove(row: Row) {
    if (!(await confirmAction(t('catalog.removeThisVariantMapping'), t('catalog.theProductWillNoLongerOffer'), t('common.remove'), true))) return;
    try {
      await productVariantService.remove(row.id);
      toast(t('catalog.variantMappingRemoved'));
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={t('common.productVariants')} subtitle={t('common.catalog')} onBack={navigation.goBack} />
      <ListTop>
        <SearchBar value={filters.search} onChange={v => set('search', v)} placeholder={t('catalog.searchByProductSkuVariantType')} />
        <CountTiles
          tiles={[
            { key: '1', label: t('common.active'), count: stats.active, ...TILE_COLORS.green },
            { key: '0', label: t('common.inactive'), count: stats.inactive, ...TILE_COLORS.slate },
            { key: 'products', label: t('common.products'), count: stats.products, info: true, ...TILE_COLORS.blue },
            { key: 'types', label: t('catalog.types'), count: stats.types, info: true, ...TILE_COLORS.violet },
          ]}
          value={filters.status}
          onSelect={k => set('status', k)}
          loading={loading && !data}
        />
        <SummaryLine
          hint={t('catalog.whichVariantValuesSizeColourEach')}
          filtered={isFiltered}
          shown={rows.length}
          total={items.length}
          noun="mapping"
          onClear={() => setFilters(VARIANT_FILTERS)}
          extra={
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.moreFilters')} hitSlop={8} onPress={() => setMoreFilters(true)} style={styles.filterBtn}>
              <SlidersIcon size={14} color={extra ? colors.secondary : colors.textSecondary} />
              <Text style={[styles.filterText, extra ? styles.accent : null]}>{extra ? t('common.filtersExtra', { extra }) : t('common.filters')}</Text>
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
                  title={isFiltered ? t('catalog.noVariantMappingsMatch') : t('catalog.noProductVariantsYet')}
                  text={isFiltered ? t('common.tryAnotherFilterOrSearchTerm') : t('catalog.theyReAddedFromAProducts')}
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
              <RowCard label={t('catalog.editMappingNamed', { name: `${String(p.productName ?? t('catalog.mapping'))} ${String(v.variantData ?? '')}`.trim() })} onPress={() => navigation.navigate('ProductVariantForm', { id: item.id })}>
                <View style={compactStyles.head}>
                  <View style={compactStyles.thumb}>{cover ? <Image source={{ uri: cover }} style={compactStyles.thumbImage} /> : <BoxIcon size={17} color={colors.textMuted} />}</View>
                  <View style={styles.flex}>
                    <Text style={compactStyles.name} numberOfLines={1}>
                      {String(p.productName ?? '—')}
                    </Text>
                    <Text style={compactStyles.meta} numberOfLines={1}>
                      {t('catalog.skuValueValue2Createdat', { value: String(p.skuItemNumber ?? '—'), value2: String(item.sequence ?? '—'), createdAt: formatDay(item.createdAt) })}
                    </Text>
                  </View>
                  <Badge label={active ? t('common.active') : t('common.inactive')} tone={active ? 'green' : 'slate'} />
                  <Pressable accessibilityRole="button" accessibilityLabel={t('catalog.moreForValueValue2', { value: String(p.productName ?? ''), value2: String(v.variantData ?? '') })} hitSlop={10} onPress={() => setActionsFor(item)} style={compactStyles.more}>
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

      <Fab label={t('catalog.addMapping')} accessibilityLabel={t('catalog.addVariantMapping')} onPress={() => navigation.navigate('ProductVariantForm')} />

      <Sheet visible={moreFilters} title={t('common.filters')} onClose={() => setMoreFilters(false)}>
        <SelectField label={t('common.product')} value={filters.productId} options={options.products} onChange={v => set('productId', v)} allowClear={t('catalog.allProducts')} placeholder={t('catalog.allProducts')} />
        <SelectField label={t('catalog.variantType2')} value={filters.variantId} options={options.variants} onChange={v => set('variantId', v)} allowClear={t('common.allTypes')} placeholder={t('common.allTypes')} />
      </Sheet>

      <ActionSheet
        visible={!!actionsFor}
        title={String(variantProduct(actionsFor ?? ({} as Row)).productName ?? '')}
        subtitle={actionsFor ? `${String(variantType(actionsFor).variantTitle ?? '')}: ${String(variantValue(actionsFor).variantData ?? '')}` : undefined}
        onClose={() => setActionsFor(null)}
        actions={
          actionsFor
            ? [
                { label: t('common.viewProduct'), icon: EyeIcon, onPress: () => navigation.navigate('ProductDetail', { id: String(actionsFor.productId) }) },
                { label: t('catalog.editMapping'), icon: EditIcon, onPress: () => navigation.navigate('ProductVariantForm', { id: actionsFor.id }) },
                { label: t('common.activate'), icon: CheckCircleIcon, hidden: isActiveRow(actionsFor), onPress: () => setStatus(actionsFor, 1) },
                { label: t('common.deactivate'), icon: BanIcon, hidden: !isActiveRow(actionsFor), onPress: () => setStatus(actionsFor, 0) },
                { label: t('common.remove'), icon: TrashIcon, danger: true, onPress: () => remove(actionsFor) },
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
