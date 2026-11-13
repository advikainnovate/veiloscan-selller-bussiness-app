import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { filterSpecs, isActiveRow, specValueLabel, specValues } from '../../lib/catalog';
import { productSpecificationService, productSpecificationValueService, specificationDataService, specificationService } from '../../services/catalog-service';
import { productsService, type Row } from '../../services/products-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Sheet } from '../../components/ui/Sheet';
import { SelectField } from '../../components/form/Fields';
import { EmptyState, ErrorState, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { ActionSheet, compactStyles, CountTiles, Fab, ListTop, RowCard, Separator, SummaryLine, TILE_COLORS, useListPadding } from '../../components/list/CompactList';
import { confirmAction, opsStyles } from '../../components/operations/OpsParts';
import { EditIcon, EyeIcon, SlidersIcon, TrashIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;
const NO_FILTERS = { search: '', productId: '', specificationId: '', status: '' };

/** The lookups every product-spec page needs: products, specifications, their options and the saved values. */
export function useSpecLookups(allowed: boolean) {
  const products = useFetch(() => (allowed ? productsService.list().catch(() => []) : Promise.resolve([])), [allowed]);
  const specs = useFetch(() => (allowed ? specificationService.list().catch(() => []) : Promise.resolve([])), [allowed]);
  const options = useFetch(() => (allowed ? specificationDataService.list().catch(() => []) : Promise.resolve([])), [allowed]);
  const values = useFetch(() => (allowed ? productSpecificationValueService.list().catch(() => []) : Promise.resolve([])), [allowed]);
  return useMemo(() => {
    const productById = new Map((products.data ?? []).map(p => [p.id as unknown, p]));
    const specById = new Map((specs.data ?? []).map(s => [s.id as unknown, s]));
    const optionById = new Map((options.data ?? []).map(o => [o.id as unknown, String(o.optionTitle ?? '')]));
    return {
      products: products.data ?? [],
      specs: specs.data ?? [],
      options: options.data ?? [],
      values: values.data ?? [],
      productName: (id: unknown) => String(productById.get(id)?.productName ?? ''),
      specTitle: (id: unknown) => String(specById.get(id)?.specificationTitle ?? ''),
      spec: (id: unknown) => specById.get(id),
      optionTitle: (id: unknown) => optionById.get(id),
      reloadValues: values.reload,
      /** The saved values have arrived (or failed). */
      valuesLoaded: values.data != null || !!values.error,
    };
  }, [products.data, specs.data, options.data, values.data, values.error, values.reload]);
}

/** Catalog › Product Specs: the specification values assigned to each product. */
export function ProductSpecsScreen({ navigation }: ScreenProps<'ProductSpecs'>) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const listPadding = useListPadding();
  const allowed = hasPermission('product-specifications:manage');
  const { data, error, loading, reload } = useFetch(() => (allowed ? productSpecificationService.list() : Promise.resolve([])), [allowed]);
  const look = useSpecLookups(allowed);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [moreFilters, setMoreFilters] = useState(false);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [actionsFor, setActionsFor] = useState<Row | null>(null);

  const refresh = useCallback(() => {
    reload();
    look.reloadValues();
  }, [reload, look]);
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) refresh();
      focused.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const items = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => filterSpecs(items, look.productName, look.specTitle, filters), [items, look, filters]);
  const isFiltered = Object.values(filters).some(Boolean);
  const extra = [filters.productId, filters.specificationId].filter(Boolean).length;
  const set = (k: keyof typeof NO_FILTERS, v: string) => {
    setFilters(f => ({ ...f, [k]: v }));
    setShown(PAGE_SIZE);
  };

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={t('common.productSpecs')} onBack={navigation.goBack} />
        <ComingSoon label={t('common.productSpecs')} icon={SlidersIcon} allowed={false} />
      </View>
    );
  }

  async function remove(row: Row) {
    if (!(await confirmAction(t('catalog.removeThisSpecificationFromTheProduct'), undefined, t('common.remove'), true))) return;
    try {
      await productSpecificationService.remove(row.id);
      toast(t('catalog.productSpecificationRemoved'));
      refresh();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={t('common.productSpecs')} subtitle={t('common.catalog')} onBack={navigation.goBack} />
      <ListTop>
        <SearchBar value={filters.search} onChange={v => set('search', v)} placeholder={t('catalog.searchByProductOrSpecification')} />
        <CountTiles
          tiles={[
            { key: '1', label: t('common.active'), count: items.filter(isActiveRow).length, ...TILE_COLORS.green },
            { key: '0', label: t('common.inactive'), count: items.filter(r => !isActiveRow(r)).length, ...TILE_COLORS.red },
            { key: 'products', label: t('common.products'), count: new Set(items.map(r => r.productId)).size, info: true, ...TILE_COLORS.amber },
          ]}
          value={filters.status}
          onSelect={k => set('status', k)}
          loading={loading && !data}
        />
        <SummaryLine
          hint={t('catalog.specificationValuesAssignedToEachProduct')}
          filtered={isFiltered}
          shown={rows.length}
          total={items.length}
          noun="assignment"
          onClear={() => setFilters(NO_FILTERS)}
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
          refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} />}
          onEndReached={() => setShown(n => (n < rows.length ? n + PAGE_SIZE : n))}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            loading && !data ? (
              <ListSkeleton rows={4} height={80} />
            ) : (
              <View style={compactStyles.empty}>
                <EmptyState icon={SlidersIcon} title={isFiltered ? t('catalog.noAssignmentsMatch') : t('catalog.noProductSpecificationsFound')} text={isFiltered ? t('common.tryAnotherFilterOrSearchTerm') : t('catalog.addASpecificationValueToA')} />
              </View>
            )
          }
          renderItem={({ item }) => {
            const active = isActiveRow(item);
            const labels = specValues(item, look.values)
              .map(v => specValueLabel(v, look.optionTitle))
              .filter(Boolean);
            return (
              <RowCard label={t('catalog.openProductidSpecificationid', { productId: look.productName(item.productId), specificationId: look.specTitle(item.specificationId) })} onPress={() => navigation.navigate('ProductSpecDetail', { id: item.id })}>
                <View style={compactStyles.head}>
                  <Text style={compactStyles.name} numberOfLines={1}>
                    {look.specTitle(item.specificationId) || '—'}
                  </Text>
                  <Badge label={active ? t('common.active') : t('common.inactive')} tone={active ? 'green' : 'slate'} />
                  <Pressable accessibilityRole="button" accessibilityLabel={t('catalog.moreForSpecificationid', { specificationId: look.specTitle(item.specificationId) })} hitSlop={10} onPress={() => setActionsFor(item)} style={compactStyles.more}>
                    <Text style={compactStyles.dots}>⋮</Text>
                  </Pressable>
                </View>
                <Text style={compactStyles.line} numberOfLines={1}>
                  {look.productName(item.productId) || '—'}
                </Text>
                <View style={compactStyles.chips}>
                  {labels.length ? (
                    labels.map((l, i) => (
                      <Text key={i} style={[compactStyles.chip, styles.value]}>
                        {l}
                      </Text>
                    ))
                  ) : (
                    <Text style={compactStyles.meta}>{t('catalog.noValues')}</Text>
                  )}
                </View>
              </RowCard>
            );
          }}
        />
      )}

      <Fab label={t('catalog.addSpecification')} onPress={() => navigation.navigate('ProductSpecForm')} />

      <Sheet visible={moreFilters} title={t('common.filters')} onClose={() => setMoreFilters(false)}>
        <SelectField label={t('common.product')} value={filters.productId} options={look.products.map(p => ({ value: p.id, label: String(p.productName ?? p.id) }))} onChange={v => set('productId', v)} allowClear={t('catalog.allProducts')} placeholder={t('catalog.allProducts')} />
        <SelectField
          label={t('catalog.specification')}
          value={filters.specificationId}
          options={look.specs.map(s => ({ value: s.id, label: String(s.specificationTitle ?? s.id) }))}
          onChange={v => set('specificationId', v)}
          allowClear={t('catalog.allSpecifications')}
          placeholder={t('catalog.allSpecifications')}
        />
      </Sheet>

      <ActionSheet
        visible={!!actionsFor}
        title={actionsFor ? look.specTitle(actionsFor.specificationId) : ''}
        subtitle={actionsFor ? look.productName(actionsFor.productId) : undefined}
        onClose={() => setActionsFor(null)}
        actions={
          actionsFor
            ? [
                { label: t('common.view'), icon: EyeIcon, onPress: () => navigation.navigate('ProductSpecDetail', { id: actionsFor.id }) },
                { label: t('common.edit'), icon: EditIcon, onPress: () => navigation.navigate('ProductSpecForm', { id: actionsFor.id }) },
                { label: t('common.remove'), icon: TrashIcon, danger: true, onPress: () => remove(actionsFor) },
              ]
            : []
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  accent: { color: colors.secondary },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  value: { color: '#4338ca', backgroundColor: '#eef2ff' },
});
