import React, { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { dateTime } from '../../lib/operations';
import {
  BUSINESS_TYPES,
  DISPLAY_STATUS,
  displayStatus,
  filterStores,
  labelFor,
  ownerName,
  STATUS_FILTERS,
  STORE_FILTERS_INITIAL,
  storeCity,
  storeLocation,
  storeStats,
  submittedOn,
  type StoreFilters,
} from '../../lib/store-manage';
import { openMenuKey } from '../../navigation/navigationRef';
import { storeManageService, type FeatureUsage, type StoreRecord } from '../../services/store-manage-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Sheet } from '../../components/ui/Sheet';
import { SelectField } from '../../components/form/Fields';
import { EmptyState, ErrorState, FilterChips, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { confirmAction, opsStyles, PageTitle, StatCard, StatGrid } from '../../components/operations/OpsParts';
import { BanIcon, CheckCircleIcon, ClockIcon, CloseIcon, EditIcon, MapPinIcon, PlusIcon, RefreshIcon, SettingsIcon, SlidersIcon, StoreIcon, type IconProps } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

/**
 * All Stores (the panel's /dashboard/stores, opened from the store
 * switcher): every store the seller holds with its approval status,
 * filters, the plan's store allowance and Add New Store. stores:view to
 * open, stores:create to add, stores:edit / stores:delete per store.
 */
export function StoresScreen({ navigation }: ScreenProps<'Stores'>) {
  const { hasPermission } = useAuth();
  const { current, select, refresh } = useStore();
  const toast = useToast();
  const canView = hasPermission('stores:view');
  const canCreate = hasPermission('stores:create');
  const canEdit = hasPermission('stores:edit');
  const canDelete = hasPermission('stores:delete');
  const { data, error, loading, reload } = useFetch(() => (canView ? storeManageService.list() : Promise.resolve([])), [canView]);
  const usage = useFetch(() => (canView ? storeManageService.storeUsage().catch(() => null) : Promise.resolve(null)), [canView]);
  const [filters, setFilters] = useState<StoreFilters>(STORE_FILTERS_INITIAL);
  const [moreFilters, setMoreFilters] = useState(false);
  const [actionsFor, setActionsFor] = useState<StoreRecord | null>(null);

  const stores = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => filterStores(stores, filters), [stores, filters]);
  const stats = storeStats(stores);
  const choices = useMemo(() => {
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort().map(v => ({ value: v, label: v }));
    return { categories: unique(stores.map(s => s.businessCategory ?? '')), cities: unique(stores.map(storeCity)) };
  }, [stores]);

  if (!canView) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="All Stores" onBack={navigation.goBack} />
        <ComingSoon label="All Stores" icon={StoreIcon} allowed={false} />
      </View>
    );
  }

  const set = <K extends keyof StoreFilters>(k: K) => (v: StoreFilters[K]) => setFilters(f => ({ ...f, [k]: v }));
  const extraFilters = [filters.businessType, filters.category, filters.city].filter(Boolean).length;
  const hasFilters = Object.values(filters).some(Boolean);
  const changed = () => {
    reload();
    usage.reload();
    refresh();
  };

  async function closeStore(store: StoreRecord) {
    setActionsFor(null);
    if (!(await confirmAction(`Close "${store.name}"?`, 'It will be removed from the store list.', 'Close Store', true))) return;
    try {
      await storeManageService.remove(store.id);
      toast('Store closed');
      changed();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  const header = (
    <View style={styles.headerGap}>
      <View style={opsStyles.rowBetween}>
        <View style={styles.flex}>
          <PageTitle title="All Stores" subtitle="Your registered stores. View, edit or take action on each one." />
        </View>
      </View>
      {canCreate ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Add New Store" onPress={() => navigation.navigate('CreateStore')} style={[opsStyles.primaryBtn, styles.selfStart]}>
          <PlusIcon size={15} color={colors.white} strokeWidth={2.4} />
          <Text style={opsStyles.primaryBtnText}>Add New Store</Text>
        </Pressable>
      ) : null}
      <StatGrid>
        <StatCard icon={StoreIcon} tone="orange" label="Total Stores" value={String(stats.total)} sub="All registered stores" loading={loading && !data} />
        <StatCard icon={ClockIcon} tone="amber" label="Pending Approval" value={String(stats.pending)} sub="Awaiting review" loading={loading && !data} />
        <StatCard icon={CheckCircleIcon} tone="emerald" label="Approved" value={String(stats.approved)} sub="Active stores" loading={loading && !data} />
        <StatCard icon={CloseIcon} tone="red" label="Rejected" value={String(stats.rejected)} sub="Not approved" loading={loading && !data} />
        <StatCard icon={ClockIcon} tone="blue" label="In Review" value={String(stats.inReview)} sub="Under verification" loading={loading && !data} />
      </StatGrid>
      {usage.data ? <UsageStrip usage={usage.data} /> : null}
      <SearchBar value={filters.search} onChange={set('search')} placeholder="Search by store name, owner, email, GST, or location..." />
      <FilterChips options={[{ value: '', label: 'All Status' }, ...STATUS_FILTERS]} value={filters.status} onChange={set('status')} />
      <View style={opsStyles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="More filters" onPress={() => setMoreFilters(true)} style={opsStyles.smallBtn}>
          <SlidersIcon size={15} color={colors.text} />
          <Text style={opsStyles.smallBtnText}>{extraFilters ? `Filters (${extraFilters})` : 'Filters'}</Text>
        </Pressable>
        {hasFilters ? (
          <Pressable accessibilityRole="button" onPress={() => setFilters(STORE_FILTERS_INITIAL)} style={opsStyles.smallBtn}>
            <RefreshIcon size={15} color={colors.text} />
            <Text style={opsStyles.smallBtnText}>Reset</Text>
          </Pressable>
        ) : null}
        <Text style={[opsStyles.muted, styles.flex, styles.right]}>{`${rows.length} store${rows.length === 1 ? '' : 's'}`}</Text>
      </View>
    </View>
  );

  return (
    <View style={opsStyles.screen}>
      <AppHeader title="All Stores" subtitle="Stores" onBack={navigation.goBack} />
      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={loading && !data ? [] : rows}
          keyExtractor={s => s.id}
          contentContainerStyle={opsStyles.content}
          refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={changed} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            loading && !data ? (
              <ListSkeleton rows={3} height={150} />
            ) : (
              <EmptyState icon={StoreIcon} title={hasFilters ? 'No stores match these filters.' : 'No stores yet'} text={hasFilters ? undefined : canCreate ? 'Add one to get started.' : undefined} />
            )
          }
          renderItem={({ item }) => (
            <StoreCard
              store={item}
              current={item.id === current?.id}
              onOpen={() => navigation.navigate('StoreSettings', { storeId: item.id })}
              onMore={() => setActionsFor(item)}
            />
          )}
        />
      )}

      <Sheet visible={moreFilters} title="Filters" onClose={() => setMoreFilters(false)}>
        <SelectField label="Business Type" value={filters.businessType} options={BUSINESS_TYPES} onChange={set('businessType')} allowClear="All Types" placeholder="All Types" />
        <SelectField label="Category" value={filters.category} options={choices.categories} onChange={set('category')} allowClear="All Categories" placeholder="All Categories" />
        <SelectField label="Location" value={filters.city} options={choices.cities} onChange={set('city')} allowClear="All Cities" placeholder="All Cities" />
      </Sheet>

      <StoreActionsSheet
        store={actionsFor}
        isCurrent={actionsFor?.id === current?.id}
        canEdit={canEdit}
        canDelete={canDelete}
        onClose={() => setActionsFor(null)}
        onView={s => {
          setActionsFor(null);
          navigation.navigate('StoreSettings', { storeId: s.id });
        }}
        onEdit={s => {
          setActionsFor(null);
          navigation.navigate('StoreSettings', { storeId: s.id, tab: 'setup' });
        }}
        onOnboarding={s => {
          setActionsFor(null);
          navigation.navigate('CreateStore', { storeId: s.id });
        }}
        onSwitch={s => {
          setActionsFor(null);
          select(s.id);
          toast(`Switched to ${s.name}`);
        }}
        onCloseStore={closeStore}
      />
    </View>
  );
}

function UsageStrip({ usage }: { usage: FeatureUsage }) {
  // Unlimited allowances aren't worth a row of their own.
  if (usage.isEnabled && usage.allowed === null) return null;
  const exhausted = usage.remaining === 0;
  const used = !usage.isEnabled ? 'Not included' : `${usage.used} of ${usage.allowed} used`;
  const left = !usage.isEnabled ? '—' : usage.remaining === null ? 'No limit' : exhausted ? 'None left' : `${usage.remaining} left`;
  const share = usage.allowed ? Math.min(1, usage.used / usage.allowed) : 1;
  return (
    <View style={[styles.usage, exhausted && styles.usageFull]}>
      <View style={opsStyles.rowBetween}>
        <Text style={styles.usageLabel}>Stores on your plan</Text>
        <Pressable accessibilityRole="link" onPress={() => openMenuKey('subscription')}>
          <Text style={styles.link}>Plan</Text>
        </Pressable>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, exhausted && styles.barFull, { width: `${Math.max(share * 100, usage.used ? 4 : 0)}%` }]} />
      </View>
      <View style={opsStyles.rowBetween}>
        <Text style={[opsStyles.meta, exhausted && opsStyles.danger]}>{used}</Text>
        <Text style={[styles.left, exhausted && opsStyles.danger]}>{left}</Text>
      </View>
    </View>
  );
}

function StoreCard({ store, current, onOpen, onMore }: { store: StoreRecord; current: boolean; onOpen: () => void; onMore: () => void }) {
  const status = DISPLAY_STATUS[displayStatus(store)];
  const logo = (store.branding?.logo as { url?: string } | undefined)?.url;
  const location = storeLocation(store);
  const gst = !!store.taxDetails?.gstRegistered;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${store.name}`} onPress={onOpen} style={({ pressed }) => [styles.card, pressed && opsStyles.pressed]}>
      <View style={styles.cardHead}>
        <View style={styles.logo}>{logo ? <Image source={{ uri: logo }} style={styles.fill} /> : <StoreIcon size={20} color={colors.white} />}</View>
        <View style={styles.flex}>
          <Text style={opsStyles.title} numberOfLines={1}>
            {store.name}
          </Text>
          <Text style={opsStyles.meta} numberOfLines={1}>
            {`#${store.code}${current ? ' · Current store' : ''}`}
          </Text>
        </View>
        <Badge label={status.label === 'Pending Approval' ? 'Pending' : status.label} tone={status.tone} />
        <Pressable accessibilityRole="button" accessibilityLabel={`More for ${store.name}`} hitSlop={8} onPress={onMore} style={styles.more}>
          <Text style={styles.dots}>⋮</Text>
        </Pressable>
      </View>
      <View style={styles.pills}>
        <Badge label={labelFor(BUSINESS_TYPES, store.businessType)} tone="blue" />
        {store.businessCategory ? <Badge label={store.businessCategory} tone="slate" /> : null}
        <Badge label={gst ? 'GST Provided' : 'GST Not Provided'} tone={gst ? 'green' : 'slate'} />
      </View>
      <View style={styles.facts}>
        <Text style={opsStyles.meta} numberOfLines={1}>
          {`Owner: ${ownerName(store) || '—'}${store.owner?.email ? ` · ${String(store.owner.email)}` : ''}`}
        </Text>
        {location ? (
          <View style={opsStyles.row}>
            <MapPinIcon size={13} color={colors.textMuted} />
            <Text style={opsStyles.meta}>{location}</Text>
          </View>
        ) : null}
        <Text style={opsStyles.meta}>{`${store.submittedAt ? 'Submitted' : 'Draft created'} ${dateTime(submittedOn(store))}`}</Text>
        {store.approvalStatus === 'REJECTED' && store.rejectionReason ? (
          <Text style={[opsStyles.meta, opsStyles.danger]} numberOfLines={2}>
            {store.rejectionReason}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function StoreActionsSheet({
  store,
  isCurrent,
  canEdit,
  canDelete,
  onClose,
  onView,
  onEdit,
  onOnboarding,
  onSwitch,
  onCloseStore,
}: {
  store: StoreRecord | null;
  isCurrent: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onView: (s: StoreRecord) => void;
  onEdit: (s: StoreRecord) => void;
  onOnboarding: (s: StoreRecord) => void;
  onSwitch: (s: StoreRecord) => void;
  onCloseStore: (s: StoreRecord) => void;
}) {
  const actions: { label: string; icon: React.ComponentType<IconProps>; danger?: boolean; hidden: boolean; onPress: (s: StoreRecord) => void }[] = [
    { label: 'View Details', icon: SettingsIcon, hidden: false, onPress: onView },
    { label: 'Switch to this store', icon: CheckCircleIcon, hidden: isCurrent, onPress: onSwitch },
    { label: 'Edit Store', icon: EditIcon, hidden: !canEdit, onPress: onEdit },
    { label: 'Continue Onboarding', icon: ClockIcon, hidden: !canEdit || store?.onboardingStatus === 'COMPLETED', onPress: onOnboarding },
    { label: 'Close Store', icon: BanIcon, danger: true, hidden: !canDelete, onPress: onCloseStore },
  ];
  return (
    <Sheet visible={!!store} title={store?.name ?? ''} subtitle={store ? `#${store.code}` : undefined} onClose={onClose}>
      {store
        ? actions
            .filter(a => !a.hidden)
            .map(a => {
              const Icon = a.icon;
              return (
                <Pressable key={a.label} accessibilityRole="button" onPress={() => a.onPress(store)} style={styles.action}>
                  <Icon size={18} color={a.danger ? colors.error : colors.text} />
                  <Text style={[styles.actionText, a.danger && opsStyles.danger]}>{a.label}</Text>
                </Pressable>
              );
            })
        : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  right: { textAlign: 'right' },
  fill: { width: '100%', height: '100%' },
  selfStart: { alignSelf: 'flex-start' },
  headerGap: { gap: 12, marginBottom: 2 },
  link: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.secondary },
  usage: { gap: 6, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  usageFull: { borderColor: '#fecdd3', backgroundColor: '#fff1f2' },
  usageLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  left: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  bar: { height: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.background },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: colors.secondary },
  barFull: { backgroundColor: colors.error },
  card: { gap: 10, padding: 14, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, ...shadow.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 42, height: 42, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#047857' },
  more: { width: 28, height: 32, alignItems: 'center', justifyContent: 'center' },
  dots: { fontFamily: fonts.bold, fontSize: 20, color: colors.textSecondary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  facts: { gap: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  actionText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
});
