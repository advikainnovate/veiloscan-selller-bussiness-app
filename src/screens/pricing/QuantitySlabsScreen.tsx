import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatDay } from '../../lib/date';
import { slabDiscountLabel, slabRangeLabel } from '../../lib/quantity-discount';
import { asSlab, filterSchemes, STATE_BADGE, TARGET_LABEL } from '../../lib/quantity-slabs';
import { quantityDiscountService, type SchemeListRow, type SchemeState } from '../../services/quantity-discount-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, ErrorState, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { confirmAction, opsStyles } from '../../components/operations/OpsParts';
import { ChevronRightIcon, PercentIcon, PlusIcon, TicketIcon, TrashIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

// Shown 10 at a time; more load as the list scrolls.
const PAGE_SIZE = 10;

// Each state's count doubles as its filter.
const STATE_TILES: { state: SchemeState; hint: string; color: string; tint: string }[] = [
  { state: 'RUNNING', get hint() { return i18n.t('pricing.discountingOrdersNow'); }, color: '#059669', tint: '#ecfdf5' },
  { state: 'SCHEDULED', get hint() { return i18n.t('pricing.startAtALaterDate'); }, color: '#0284c7', tint: '#f0f9ff' },
  { state: 'ENDED', get hint() { return i18n.t('pricing.pastTheirEndDate'); }, color: '#64748b', tint: '#f1f5f9' },
  { state: 'INACTIVE', get hint() { return i18n.t('pricing.switchedOffByYou'); }, color: '#d97706', tint: '#fffbeb' },
];

/** Pricing & Discounts › Quantity Discount Slabs: every scheme, with its slabs at a glance. */
export function QuantitySlabsScreen({ navigation }: ScreenProps<'QuantitySlabs'>) {
  const { t: tr } = useTranslation();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const allowed = hasPermission('quantity-discounts:manage');
  const { data, error, loading, reload } = useFetch(() => (allowed ? quantityDiscountService.list() : Promise.resolve([])), [allowed]);
  const [search, setSearch] = useState('');
  const [state, setState] = useState<SchemeState | ''>('');
  const [shown, setShown] = useState(PAGE_SIZE);

  // Schemes may have been created or changed on the form.
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const all = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => filterSchemes(all, search, state), [all, search, state]);
  const count = (s: SchemeState) => all.filter(r => r.state === s).length;
  const filtered = !!(state || search.trim());

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={tr('common.quantityDiscountSlabs')} onBack={navigation.goBack} />
        <ComingSoon label={tr('common.quantityDiscountSlabs')} icon={PercentIcon} allowed={false} />
      </View>
    );
  }

  async function remove(row: SchemeListRow) {
    if (!(await confirmAction(tr('pricing.deleteSchemename', { schemeName: row.schemeName }), tr('pricing.ordersAlreadyPlacedKeepTheirDiscount'), tr('common.delete'), true))) return;
    try {
      await quantityDiscountService.remove(row.id);
      toast(tr('pricing.quantityDiscountDeleted'));
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  const pickState = (s: SchemeState | '') => {
    setState(cur => (cur === s ? '' : s));
    setShown(PAGE_SIZE);
  };
  const hint = state ? STATE_TILES.find(t => t.state === state)!.hint : tr('pricing.buyMorePayLessAppliesBy');

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={tr('common.quantityDiscountSlabs')} subtitle={tr('common.pricingAndDiscounts')} onBack={navigation.goBack} />

      {/* Search and the state tiles stay put while the list scrolls. */}
      <View style={styles.top}>
        <SearchBar
          value={search}
          onChange={v => {
            setSearch(v);
            setShown(PAGE_SIZE);
          }}
          placeholder={tr('pricing.searchBySchemeProductOrId')}
        />
        <View style={styles.tiles}>
          {STATE_TILES.map(t => {
            const on = state === t.state;
            return (
              <Pressable
                key={t.state}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${STATE_BADGE[t.state].label}: ${count(t.state)}`}
                onPress={() => pickState(t.state)}
                style={[styles.tile, { backgroundColor: t.tint }, on && { borderColor: t.color }]}
              >
                <Text style={[styles.tileCount, { color: t.color }]}>{loading && !data ? '–' : String(count(t.state))}</Text>
                <Text style={styles.tileLabel} numberOfLines={1}>
                  {STATE_BADGE[t.state].label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.summary}>
          <Text style={[opsStyles.muted, styles.flex]} numberOfLines={2}>
            {hint}
          </Text>
          {filtered ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setState('');
                setSearch('');
              }}
            >
              <Text style={styles.clear}>{tr('pricing.clearRowscountOfAllcount', { rowsCount: rows.length, allCount: all.length })}</Text>
            </Pressable>
          ) : (
            <Text style={opsStyles.muted}>{tr('pricing.schemeCount', { count: all.length })}</Text>
          )}
        </View>
      </View>

      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={loading && !data ? [] : rows.slice(0, shown)}
          keyExtractor={r => r.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
          ItemSeparatorComponent={Separator}
          refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
          onEndReached={() => setShown(n => (n < rows.length ? n + PAGE_SIZE : n))}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            loading && !data ? (
              <ListSkeleton rows={4} height={104} />
            ) : (
              <View style={styles.empty}>
                <EmptyState
                  icon={PercentIcon}
                  title={filtered ? tr('pricing.noSchemesMatch') : tr('pricing.noQuantityDiscountsYet')}
                  text={filtered ? tr('common.tryAnotherFilterOrSearchTerm') : tr('pricing.giveCustomersALowerPriceWhen')}
                />
              </View>
            )
          }
          renderItem={({ item }) => <SchemeRow row={item} onOpen={() => navigation.navigate('QuantitySlabForm', { id: item.id })} onDelete={() => remove(item)} />}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr('pricing.createDiscountScheme')}
        onPress={() => navigation.navigate('QuantitySlabForm')}
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 20 }, pressed && opsStyles.pressed]}
      >
        <PlusIcon size={18} color={colors.white} strokeWidth={2.6} />
        <Text style={styles.fabText}>{tr('pricing.newScheme')}</Text>
      </Pressable>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

/** One scheme: name and state, what it covers, when and where, then its slab ladder. */
function SchemeRow({ row, onOpen, onDelete }: { row: SchemeListRow; onOpen: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  const badge = STATE_BADGE[row.state];
  const covers = `${TARGET_LABEL[row.targetType]}${row.targetType === 'SPECIFIC_VARIANTS' ? ` (${row.variantCount} of ${row.skuCount})` : ''}${row.aggregationMode === 'COMBINED_PRODUCT' ? ' · quantities combined' : ''}`;
  const when = `${formatDay(row.startsAt)} → ${row.endsAt ? formatDay(row.endsAt) : 'no end'}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('pricing.openSchemename', { schemeName: row.schemeName })}
      accessibilityHint={t('pricing.opensTheSchemeToEditIt')}
      onPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowHead}>
        <View style={[styles.dot, { backgroundColor: row.state === 'RUNNING' ? colors.success : row.state === 'SCHEDULED' ? '#0284c7' : colors.border }]} />
        <Text style={styles.name} numberOfLines={1}>
          {row.schemeName}
        </Text>
        <Badge label={badge.label} tone={badge.tone} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('pricing.deleteSchemename2', { schemeName: row.schemeName })} hitSlop={10} onPress={onDelete} style={styles.trash}>
          <TrashIcon size={16} color={colors.textMuted} />
        </Pressable>
      </View>
      <Text style={styles.product} numberOfLines={1}>
        {row.productName}
        <Text style={opsStyles.muted}>{` · ${covers}`}</Text>
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {`${row.storeName ?? 'All stores'} · ${when} · ${row.idd}`}
      </Text>
      <View style={styles.ladder}>
        {row.slabs.map((s, i) => (
          <View key={i} style={styles.step}>
            {i > 0 ? <ChevronRightIcon size={11} color={colors.textMuted} /> : null}
            <Text style={styles.slab}>
              <Text style={styles.slabRange}>{`${slabRangeLabel(asSlab(s), s.quantityUnit)}  `}</Text>
              <Text style={styles.slabOff}>{slabDiscountLabel(asSlab(s), s.quantityUnit)}</Text>
            </Text>
          </View>
        ))}
        {row.stackWithCoupons ? (
          <View style={styles.coupons}>
            <TicketIcon size={11} color="#4338ca" />
            <Text style={styles.couponsText}>{t('pricing.couponsAllowed')}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  top: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: radius.md, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center' },
  tileCount: { fontFamily: fonts.extrabold, fontSize: 18, lineHeight: 22 },
  tileLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clear: { fontFamily: fonts.semibold, fontSize: 12, color: colors.secondary },
  list: { padding: 12 },
  separator: { height: 8 },
  empty: { minHeight: 300 },
  row: { gap: 4, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surface, ...shadow.card },
  rowPressed: { backgroundColor: colors.background },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  trash: { padding: 2 },
  product: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textMuted },
  ladder: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  slab: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#f0fdf4' },
  slabRange: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  slabOff: { fontFamily: fonts.bold, fontSize: 11.5, color: '#047857' },
  coupons: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: '#eef2ff' },
  couponsText: { fontFamily: fonts.semibold, fontSize: 10.5, color: '#4338ca' },
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 50,
    paddingHorizontal: 18,
    borderRadius: 25,
    backgroundColor: colors.secondary,
    ...shadow.button,
  },
  fabText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.white },
});
