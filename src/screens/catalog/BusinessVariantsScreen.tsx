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
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;
const rupees = (v: unknown) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

/** Catalog › Business Variants: sellable SKUs with pricing for each variant combination. */
export function BusinessVariantsScreen({ navigation }: ScreenProps<'BusinessVariants'>) {
  const { t } = useTranslation();
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
        <AppHeader title={t('common.businessVariants')} onBack={navigation.goBack} />
        <ComingSoon label={t('common.businessVariants')} icon={LayersIcon} allowed={false} />
      </View>
    );
  }

  async function toggle(row: Row) {
    const active = isActiveRow(row);
    if (!(await confirmAction(`${active ? 'Deactivate' : 'Activate'} "${String(row.skuItemNumber)}"?`, undefined, active ? t('common.deactivate') : t('common.activate'), active))) return;
    try {
      await productSkuService.update(row.id, { status: active ? 0 : 1 });
      toast(active ? t('catalog.businessVariantDeactivated') : t('catalog.businessVariantActivated'));
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function remove(row: Row) {
    if (!(await confirmAction(t('catalog.deleteBusinessVariant'), t('catalog.skuitemnumberWillBeRemovedFromThis', { skuItemNumber: String(row.skuItemNumber) }), t('common.delete'), true))) return;
    try {
      await productSkuService.remove(row.id);
      toast(t('catalog.businessVariantDeleted'));
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={t('common.businessVariants')} subtitle={t('common.catalog')} onBack={navigation.goBack} />
      <ListTop>
        <SearchBar
          value={search}
          onChange={v => {
            setSearch(v);
            setShown(PAGE_SIZE);
          }}
          placeholder={t('catalog.searchBySkuBarcodeOrProduct')}
        />
        <CountTiles
          tiles={[
            { key: '1', label: t('common.active'), count: items.filter(isActiveRow).length, ...TILE_COLORS.green },
            { key: '0', label: t('common.inactive'), count: items.filter(r => !isActiveRow(r)).length, ...TILE_COLORS.slate },
            { key: 'products', label: t('common.products'), count: new Set(items.map(r => r.productId)).size, info: true, ...TILE_COLORS.amber },
            { key: 'avg', label: t('catalog.avgPrice'), count: `₹${avg.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, info: true, ...TILE_COLORS.violet },
          ]}
          value={status}
          onSelect={k => {
            setStatus(k);
            setShown(PAGE_SIZE);
          }}
          loading={loading && !data}
        />
        <SummaryLine
          hint={t('catalog.sellableSkusWithPricingForEach')}
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
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.moreFilters')} hitSlop={8} onPress={() => setMoreFilters(true)} style={styles.filterBtn}>
              <SlidersIcon size={14} color={productId ? colors.secondary : colors.textSecondary} />
              <Text style={[styles.filterText, productId ? styles.accent : null]}>{productId ? t('catalog.filters1') : t('common.filters')}</Text>
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
                <EmptyState icon={LayersIcon} title={isFiltered ? t('catalog.noSkusMatch') : t('catalog.noBusinessVariantsFound')} text={isFiltered ? t('common.tryAnotherFilterOrSearchTerm') : t('catalog.addASkuToSellA')} />
              </View>
            )
          }
          renderItem={({ item }) => {
            const active = isActiveRow(item);
            const image = (item.productImageFile as Row | undefined)?.url as string | undefined;
            const combo = Object.values((item.variantCombination as Record<string, unknown>) ?? {});
            const discounted = item.mrp && Number(item.mrp) > Number(item.businessPrice);
            return (
              <RowCard label={t('catalog.editSkuitemnumber', { skuItemNumber: String(item.skuItemNumber) })} onPress={() => navigation.navigate('BusinessVariantForm', { id: item.id })}>
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
                  <Badge label={active ? t('common.active') : t('common.inactive')} tone={active ? 'green' : 'slate'} />
                  <Pressable accessibilityRole="button" accessibilityLabel={t('catalog.moreForSkuitemnumber', { skuItemNumber: String(item.skuItemNumber) })} hitSlop={10} onPress={() => setActionsFor(item)} style={compactStyles.more}>
                    <Text style={compactStyles.dots}>⋮</Text>
                  </Pressable>
                </View>
                <View style={compactStyles.chips}>
                  <Text style={styles.price}>{rupees(item.businessPrice)}</Text>
                  {discounted ? <Text style={styles.mrp}>{rupees(item.mrp)}</Text> : null}
                  <Text style={compactStyles.chip}>{item.quantityPriceType === 'SLAB' ? t('catalog.slab') : t('common.fixed')}</Text>
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

      <Fab label={t('catalog.addSku')} onPress={() => navigation.navigate('BusinessVariantForm')} />

      <Sheet visible={moreFilters} title={t('common.filters')} onClose={() => setMoreFilters(false)}>
        <SelectField
          label={t('common.product')}
          value={productId}
          options={(products.data ?? []).map(p => ({ value: p.id, label: String(p.productName ?? p.id) }))}
          onChange={v => {
            setProductId(v);
            setShown(PAGE_SIZE);
          }}
          allowClear={t('catalog.allProducts')}
          placeholder={t('catalog.allProducts')}
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
                { label: t('common.edit'), icon: EditIcon, onPress: () => navigation.navigate('BusinessVariantForm', { id: actionsFor.id }) },
                { label: isActiveRow(actionsFor) ? t('common.deactivate') : t('common.activate'), icon: isActiveRow(actionsFor) ? BanIcon : CheckCircleIcon, onPress: () => toggle(actionsFor) },
                { label: t('common.delete'), icon: TrashIcon, danger: true, onPress: () => remove(actionsFor) },
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
