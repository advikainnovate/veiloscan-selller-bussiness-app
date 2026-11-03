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

/** Sales › Shipping: delivery zones and their shipping methods & rates, as the panel's list. */
export function ShippingScreen({ navigation }: ScreenProps<'Shipping'>) {
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
        <AppHeader title="Shipping" onBack={navigation.goBack} />
        <ComingSoon label="Shipping" icon={TruckIcon} allowed={false} />
      </View>
    );
  }

  async function toggle(z: Row) {
    const on = isActiveRow(z);
    if (!(await confirmAction(`${on ? 'Deactivate' : 'Activate'} "${String(z.zoneTitle)}"?`, undefined, on ? 'Deactivate' : 'Activate', on))) return;
    try {
      await shippingZoneService.update(z.id, { status: on ? 0 : 1 });
      toast(`Zone ${on ? 'deactivated' : 'activated'}`);
      refresh();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function remove(z: Row) {
    if (!(await confirmAction('Delete zone?', `"${String(z.zoneTitle)}" will be removed from this list. Deactivate it instead if you only want to take it out of use.`, 'Delete', true))) return;
    try {
      await shippingZoneService.remove(z.id);
      toast('Zone deleted');
      refresh();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title="Shipping" subtitle="Sales" onBack={navigation.goBack} />
      <ListTop>
        <SearchBar value={search} onChange={setSearch} placeholder="Search by zone title…" />
        <CountTiles
          tiles={[
            { key: 'zones', label: 'Zones', count: zones.length, info: true, ...TILE_COLORS.orange },
            { key: '1', label: 'Active', count: active, ...TILE_COLORS.green },
            { key: '0', label: 'Inactive', count: zones.length - active, ...TILE_COLORS.red },
            { key: 'methods', label: 'Methods', count: (methods.data ?? []).length, info: true, ...TILE_COLORS.amber },
          ]}
          value={status}
          onSelect={setStatus}
          loading={loading && !data}
        />
        <SummaryLine
          hint="Delivery zones and their shipping methods & rates."
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
                  title={isFiltered ? 'No zones match' : 'No shipping zones found'}
                  text={isFiltered ? 'Try another filter or search term.' : 'Create a zone for the states you deliver to, then add its shipping methods.'}
                />
              </View>
            )
          }
          renderItem={({ item: z }) => {
            const on = isActiveRow(z);
            const n = countByZone.get(z.id) ?? 0;
            return (
              <RowCard label={`Open ${String(z.zoneTitle)}`} onPress={() => navigation.navigate('ShippingZone', { id: z.id })}>
                <View style={compactStyles.head}>
                  <View style={[compactStyles.thumb, styles.icon]}>
                    <TruckIcon size={16} color={colors.secondary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={compactStyles.name} numberOfLines={1}>
                      {String(z.zoneTitle)}
                    </Text>
                    <Text style={compactStyles.meta} numberOfLines={1}>{`${String(z.zoneSlug ?? '')} · ${n} method${n === 1 ? '' : 's'}`}</Text>
                  </View>
                  <Badge label={on ? 'Active' : 'Inactive'} tone={on ? 'green' : 'slate'} />
                  <Pressable accessibilityRole="button" accessibilityLabel={`More for ${String(z.zoneTitle)}`} hitSlop={10} onPress={() => setActionsFor(z)} style={compactStyles.more}>
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

      <Fab label="Create Zone" onPress={() => navigation.navigate('ShippingZoneForm')} />

      <ActionSheet
        visible={!!actionsFor}
        title={String(actionsFor?.zoneTitle ?? '')}
        onClose={() => setActionsFor(null)}
        actions={
          actionsFor
            ? [
                { label: 'View', icon: EyeIcon, onPress: () => navigation.navigate('ShippingZone', { id: actionsFor.id }) },
                { label: 'Edit', icon: EditIcon, onPress: () => navigation.navigate('ShippingZoneForm', { id: actionsFor.id }) },
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
  icon: { backgroundColor: '#fff7ed' },
  states: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
});
