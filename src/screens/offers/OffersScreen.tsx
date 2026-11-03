import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatDay } from '../../lib/date';
import { isActiveRow } from '../../lib/catalog';
import { filterOffers, isExpired, OFFERS, offerSummary, offerTitle } from '../../lib/offers';
import { offerService } from '../../services/offers-service';
import type { Row } from '../../services/products-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, ErrorState, FilterChips, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { ActionSheet, compactStyles, CountTiles, Fab, ListTop, RowCard, Separator, SummaryLine, TILE_COLORS, useListPadding } from '../../components/list/CompactList';
import { confirmAction, opsStyles } from '../../components/operations/OpsParts';
import { BanIcon, CheckCircleIcon, EditIcon, EyeIcon, TrashIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

/** Sales › Freebies / Gift Cards / Promotions, as the panel's lists: totals, search, status (and type / category), cards. */
export function OffersScreen({ navigation, route }: ScreenProps<'Offers'>) {
  const c = OFFERS[route.params.kind];
  const service = offerService(c.kind);
  const { hasPermission } = useAuth();
  const toast = useToast();
  const listPadding = useListPadding();
  const allowed = hasPermission(c.permission);
  const { data, error, loading, reload } = useFetch(() => (allowed ? service.list() : Promise.resolve([])), [allowed, c.kind]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [extra, setExtra] = useState('');
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
  const rows = useMemo(() => filterOffers(c, items, search, status, extra), [c, items, search, status, extra]);
  const active = items.filter(isActiveRow).length;
  const fourth =
    c.kind === 'gift-cards'
      ? { key: 'value', label: 'Face value', count: `₹${items.reduce((s, r) => s + (Number(r.gcValue) || 0), 0).toLocaleString('en-IN')}`, info: true, ...TILE_COLORS.amber }
      : { key: 'expired', label: 'Expired', count: items.filter(r => isExpired(r)).length, ...TILE_COLORS.amber };
  // Gift card categories come from the cards themselves.
  const extraOptions = c.filter ? c.filter.options ?? [...new Set(items.map(r => String(r[c.filter!.key] ?? '')).filter(Boolean))].sort().map(v => ({ value: v, label: v })) : [];
  const isFiltered = !!(search.trim() || status || extra);

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={c.title} onBack={navigation.goBack} />
        <ComingSoon label={c.title} icon={c.icon} allowed={false} />
      </View>
    );
  }

  async function toggle(r: Row) {
    const on = isActiveRow(r);
    if (!(await confirmAction(`${on ? 'Deactivate' : 'Activate'} "${offerTitle(c, r)}"?`, undefined, on ? 'Deactivate' : 'Activate', on))) return;
    try {
      await service.update(r.id, { status: on ? 0 : 1 });
      toast(`${c.singular} ${on ? 'deactivated' : 'activated'}`);
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function remove(r: Row) {
    if (!(await confirmAction(`Delete ${c.singular.toLowerCase()}?`, `"${offerTitle(c, r)}" will be removed from this list. Deactivate it instead if you only want to take it out of use.`, 'Delete', true))) return;
    try {
      await service.remove(r.id);
      toast(`${c.singular} deleted`);
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  const Icon = c.icon;
  return (
    <View style={opsStyles.screen}>
      <AppHeader title={c.title} subtitle="Sales" onBack={navigation.goBack} />
      <ListTop>
        <SearchBar value={search} onChange={setSearch} placeholder={c.searchPlaceholder} />
        <CountTiles
          tiles={[
            { key: 'total', label: 'Total', count: items.length, info: true, ...TILE_COLORS.orange },
            { key: '1', label: 'Active', count: active, ...TILE_COLORS.green },
            { key: '0', label: 'Inactive', count: items.length - active, ...TILE_COLORS.red },
            fourth,
          ]}
          value={status}
          onSelect={setStatus}
          loading={loading && !data}
        />
        {c.filter && extraOptions.length ? <FilterChips options={[{ value: '', label: `All ${c.filter.label === 'Type' ? 'Types' : 'Categories'}` }, ...extraOptions]} value={extra} onChange={setExtra} /> : null}
        <SummaryLine
          hint={c.subtitle}
          filtered={isFiltered}
          shown={rows.length}
          total={items.length}
          noun={c.singular.toLowerCase()}
          onClear={() => {
            setSearch('');
            setStatus('');
            setExtra('');
          }}
        />
      </ListTop>

      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={loading && !data ? [] : rows}
          keyExtractor={r => r.id}
          contentContainerStyle={listPadding}
          ItemSeparatorComponent={Separator}
          refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
          ListEmptyComponent={
            loading && !data ? (
              <ListSkeleton rows={4} height={84} />
            ) : (
              <View style={compactStyles.empty}>
                <EmptyState icon={c.icon} title={isFiltered ? `No ${c.title.toLowerCase()} match` : `No ${c.title.toLowerCase()} found`} text={isFiltered ? 'Try another filter or search term.' : c.subtitle} />
              </View>
            )
          }
          renderItem={({ item }) => {
            const on = isActiveRow(item);
            const expired = isExpired(item);
            const { sub, chips } = offerSummary(c, item);
            const image = c.kind === 'gift-cards' ? ((item.imageFile as Row | undefined)?.url as string | undefined) : undefined;
            return (
              <RowCard label={`Open ${offerTitle(c, item)}`} onPress={() => navigation.navigate('OfferDetail', { kind: c.kind, id: item.id })}>
                <View style={compactStyles.head}>
                  <View style={[compactStyles.thumb, styles.icon]}>{image ? <Image source={{ uri: image }} style={compactStyles.thumbImage} /> : <Icon size={16} color={colors.secondary} />}</View>
                  <View style={styles.flex}>
                    <Text style={compactStyles.name} numberOfLines={1}>
                      {offerTitle(c, item)}
                    </Text>
                    <Text style={compactStyles.meta} numberOfLines={1}>
                      {sub}
                    </Text>
                  </View>
                  <Badge label={expired && on ? 'Expired' : on ? 'Active' : 'Inactive'} tone={expired && on ? 'amber' : on ? 'green' : 'slate'} />
                  <Pressable accessibilityRole="button" accessibilityLabel={`More for ${offerTitle(c, item)}`} hitSlop={10} onPress={() => setActionsFor(item)} style={compactStyles.more}>
                    <Text style={compactStyles.dots}>⋮</Text>
                  </Pressable>
                </View>
                <View style={compactStyles.chips}>
                  {chips.map((x, i) => (
                    <Text key={i} style={[compactStyles.chip, i === 0 && styles.lead]}>
                      {x}
                    </Text>
                  ))}
                  {c.kind !== 'gift-cards' && (item.startDate || item.endDate) ? (
                    <Text style={compactStyles.meta}>{`${item.startDate ? formatDay(item.startDate) : '—'} → ${item.endDate ? formatDay(item.endDate) : 'No end date'}`}</Text>
                  ) : null}
                </View>
              </RowCard>
            );
          }}
        />
      )}

      <Fab label={`Create ${c.singular}`} onPress={() => navigation.navigate('OfferForm', { kind: c.kind })} />

      <ActionSheet
        visible={!!actionsFor}
        title={actionsFor ? offerTitle(c, actionsFor) : ''}
        onClose={() => setActionsFor(null)}
        actions={
          actionsFor
            ? [
                { label: 'View', icon: EyeIcon, onPress: () => navigation.navigate('OfferDetail', { kind: c.kind, id: actionsFor.id }) },
                { label: 'Edit', icon: EditIcon, onPress: () => navigation.navigate('OfferForm', { kind: c.kind, id: actionsFor.id }) },
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
  lead: { color: '#c2410c', backgroundColor: '#fff7ed' },
});
