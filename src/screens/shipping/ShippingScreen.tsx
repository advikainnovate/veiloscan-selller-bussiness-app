import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { isActiveRow } from '../../lib/catalog';
import { coveredLabel } from '../../lib/shipping';
import { shippingMethodService, shippingZoneService } from '../../services/shipping-service';
import type { Row } from '../../services/products-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, ErrorState, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { ActionSheet, compactStyles, CountTiles, Fab, ListTop, RowCard, Separator, SummaryLine, TILE_COLORS, useListPadding } from '../../components/list/CompactList';
import { confirmAction, opsStyles } from '../../components/operations/OpsParts';
import { BanIcon, CheckCircleIcon, EditIcon, EyeIcon, MapPinIcon, TrashIcon, TruckIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

/** Sales › Shipping: delivery zones and their shipping methods & rates, as the panel's list. */
export function ShippingScreen({ navigation }: ScreenProps<'Shipping'>) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const listPadding = useListPadding();
  const allowed = hasPermission('shipping:manage');
  const { data, error, loading, reload } = useFetch(() => (allowed ? shippingZoneService.list() : Promise.resolve([])), [allowed]);
  const methods = useFetch(() => (allowed ? shippingMethodService.list().catch(() => []) : Promise.resolve([])), [allowed]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [actionsFor, setActionsFor] = useState<Row | null>(null);

  const refresh = useCallback(() => {
    reload();
    methods.reload();
  }, [reload, methods]);
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) refresh();
      focused.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const zones = useMemo(() => data ?? [], [data]);
  const countByZone = useMemo(() => {
    const map = new Map<unknown, number>();
    (methods.data ?? []).forEach(m => map.set(m.zoneId, (map.get(m.zoneId) ?? 0) + 1));
    return map;
  }, [methods.data]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return zones.filter(z => (!status || String(Number(z.status)) === status) && (!q || String(z.zoneTitle ?? '').toLowerCase().includes(q)));
  }, [zones, search, status]);
  const active = zones.filter(isActiveRow).length;
  const isFiltered = !!(search.trim() || status);

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={t('shipping.shipping')} onBack={navigation.goBack} />
        <ComingSoon label={t('shipping.shipping')} icon={TruckIcon} allowed={false} />
      </View>
    );
  }

  async function toggle(z: Row) {
    const on = isActiveRow(z);
    if (!(await confirmAction(`${on ? 'Deactivate' : 'Activate'} "${String(z.zoneTitle)}"?`, undefined, on ? t('common.deactivate') : t('common.activate'), on))) return;
    try {
      await shippingZoneService.update(z.id, { status: on ? 0 : 1 });
      toast(on ? t('shipping.zoneDeactivated') : t('shipping.zoneActivated'));
      refresh();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function remove(z: Row) {
    if (!(await confirmAction(t('shipping.deleteZone'), t('shipping.zonetitleWillBeRemovedFromThis', { zoneTitle: String(z.zoneTitle) }), t('common.delete'), true))) return;
    try {
      await shippingZoneService.remove(z.id);
      toast(t('shipping.zoneDeleted'));
      refresh();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={t('shipping.shipping')} subtitle={t('common.sales')} onBack={navigation.goBack} />
      <ListTop>
        <SearchBar value={search} onChange={setSearch} placeholder={t('shipping.searchByZoneTitle')} />
        <CountTiles
          tiles={[
            { key: 'zones', label: t('shipping.zones'), count: zones.length, info: true, ...TILE_COLORS.orange },
            { key: '1', label: t('common.active'), count: active, ...TILE_COLORS.green },
            { key: '0', label: t('common.inactive'), count: zones.length - active, ...TILE_COLORS.red },
            { key: 'methods', label: t('shipping.methods'), count: (methods.data ?? []).length, info: true, ...TILE_COLORS.amber },
          ]}
          value={status}
          onSelect={setStatus}
          loading={loading && !data}
        />
        <SummaryLine
          hint={t('shipping.deliveryZonesAndTheirShippingMethods')}
          filtered={isFiltered}
          shown={rows.length}
          total={zones.length}
          noun="zone"
          onClear={() => {
            setSearch('');
            setStatus('');
          }}
        />
      </ListTop>

      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={loading && !data ? [] : rows}
          keyExtractor={z => z.id}
          contentContainerStyle={listPadding}
          ItemSeparatorComponent={Separator}
          refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} />}
          ListEmptyComponent={
            loading && !data ? (
              <ListSkeleton rows={3} height={86} />
            ) : (
              <View style={compactStyles.empty}>
                <EmptyState
                  icon={TruckIcon}
                  title={isFiltered ? t('shipping.noZonesMatch') : t('shipping.noShippingZonesFound')}
                  text={isFiltered ? t('common.tryAnotherFilterOrSearchTerm') : t('shipping.createAZoneForTheStates')}
                />
              </View>
            )
          }
          renderItem={({ item: z }) => {
            const on = isActiveRow(z);
            const n = countByZone.get(z.id) ?? 0;
            return (
              <RowCard label={t('shipping.openZonetitle', { zoneTitle: String(z.zoneTitle) })} onPress={() => navigation.navigate('ShippingZone', { id: z.id })}>
                <View style={compactStyles.head}>
                  <View style={[compactStyles.thumb, styles.icon]}>
                    <TruckIcon size={16} color={colors.secondary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={compactStyles.name} numberOfLines={1}>
                      {String(z.zoneTitle)}
                    </Text>
                    <Text style={compactStyles.meta} numberOfLines={1}>{`${String(z.zoneSlug ?? '')} · ${t('shipping.methodCount', { count: n })}`}</Text>
                  </View>
                  <Badge label={on ? t('common.active') : t('common.inactive')} tone={on ? 'green' : 'slate'} />
                  <Pressable accessibilityRole="button" accessibilityLabel={t('shipping.moreForZonetitle', { zoneTitle: String(z.zoneTitle) })} hitSlop={10} onPress={() => setActionsFor(z)} style={compactStyles.more}>
                    <Text style={compactStyles.dots}>⋮</Text>
                  </Pressable>
                </View>
                <View style={styles.states}>
                  <MapPinIcon size={12} color={colors.textMuted} />
                  <Text style={[compactStyles.meta, styles.flex]} numberOfLines={2}>
                    {coveredLabel(z.coveredStates)}
                  </Text>
                </View>
              </RowCard>
            );
          }}
        />
      )}

      <Fab label={t('shipping.createZone')} onPress={() => navigation.navigate('ShippingZoneForm')} />

      <ActionSheet
        visible={!!actionsFor}
        title={String(actionsFor?.zoneTitle ?? '')}
        onClose={() => setActionsFor(null)}
        actions={
          actionsFor
            ? [
                { label: t('common.view'), icon: EyeIcon, onPress: () => navigation.navigate('ShippingZone', { id: actionsFor.id }) },
                { label: t('common.edit'), icon: EditIcon, onPress: () => navigation.navigate('ShippingZoneForm', { id: actionsFor.id }) },
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
  icon: { backgroundColor: '#fff7ed' },
  states: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
});
