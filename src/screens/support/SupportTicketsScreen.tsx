import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useFetch } from '../../hooks/useFetch';
import { usePagedList } from '../../hooks/usePagedList';
import { dateTime } from '../../lib/operations';
import { categoryOptions, customerReplied, PRIORITIES, PRIORITY_TONE, priorityLabel, QUEUES, requesterName, slaState, SOURCE_LABEL, STATUS, statusOf, TICKET_STATUSES } from '../../lib/support';
import { supportService, type SupportTicketSummary } from '../../services/support-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Sheet } from '../../components/ui/Sheet';
import { SelectField } from '../../components/form/Fields';
import { EmptyState, ErrorState, FilterChips, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { compactStyles, CountTiles, Fab, ListTop, RowCard, Separator, SummaryLine, TILE_COLORS, useListPadding } from '../../components/list/CompactList';
import { opsStyles } from '../../components/operations/OpsParts';
import { HelpCircleIcon, SlidersIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 350;

/** CRM › Support Tickets: customer complaints and the store's own requests, as the panel's ticket queue. */
export function SupportTicketsScreen({ navigation }: ScreenProps<'SupportTickets'>) {
  const { hasPermission } = useAuth();
  const { stores, current } = useStore();
  const listPadding = useListPadding();
  const allowed = hasPermission('support-tickets:view');
  const canCreate = hasPermission('support-tickets:manage') || hasPermission('support-tickets:create');
  const canSeeStats = hasPermission('support-reports:view');

  const [everyStore, setEveryStore] = useState(false);
  const [queue, setQueue] = useState('active');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [ticketType, setTicketType] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [query]);

  const list = usePagedList(
    page =>
      supportService.list(
        {
          page,
          limit: PAGE_SIZE,
          ...(queue ? { queue } : {}),
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
          ...(ticketType ? { ticketType } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(search ? { search } : {}),
        },
        everyStore,
      ),
    [queue, status, priority, ticketType, categoryId, search, everyStore, current?.id],
    { enabled: allowed },
  );
  const stats = useFetch(() => (allowed && canSeeStats ? supportService.dashboard({}, everyStore) : Promise.resolve(null)), [allowed, canSeeStats, everyStore, current?.id]);
  const types = useFetch(() => (allowed ? supportService.ticketTypes() : Promise.resolve([])), [allowed]);
  const categories = useFetch(() => (allowed ? supportService.categories() : Promise.resolve([])), [allowed]);

  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) {
        list.refresh();
        stats.reload();
      }
      focused.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const categoryChoices = useMemo(() => categoryOptions(categories.data ?? []), [categories.data]);
  const moreFilters = [status, priority, ticketType, categoryId].filter(Boolean).length;
  const isFiltered = !!(search || moreFilters || queue !== 'active');

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="Support Tickets" onBack={navigation.goBack} />
        <ComingSoon label="Support Tickets" icon={HelpCircleIcon} allowed={false} />
      </View>
    );
  }

  const s = stats.data?.totals;
  return (
    <View style={opsStyles.screen}>
      <AppHeader title="Support Tickets" subtitle="CRM" onBack={navigation.goBack} />
      <ListTop>
        {stores.length > 1 ? (
          <FilterChips
            options={[
              { value: 'one', label: current?.name ?? 'This store' },
              { value: 'all', label: 'All my stores' },
            ]}
            value={everyStore ? 'all' : 'one'}
            onChange={v => setEveryStore(v === 'all')}
          />
        ) : null}
        <SearchBar value={query} onChange={setQuery} placeholder="Ticket number, subject, customer…" />
        {s ? (
          <CountTiles
            tiles={[
              { key: 'active', label: 'Open', count: s.open, ...TILE_COLORS.orange },
              { key: 'unassigned', label: 'Unassigned', count: s.unassigned, ...TILE_COLORS.blue },
              { key: 'overdue', label: 'SLA breached', count: s.breached, ...TILE_COLORS.red },
              { key: 'approaching', label: 'Due in 2h', count: s.approaching, info: true, ...TILE_COLORS.amber },
            ]}
            value={queue}
            onSelect={k => setQueue(k === queue ? 'active' : k)}
          />
        ) : null}
        <View style={styles.queueRow}>
          <View style={styles.flex}>
            <FilterChips options={QUEUES} value={queue} onChange={setQueue} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Filters" onPress={() => setFiltersOpen(true)} style={[styles.filterBtn, moreFilters ? styles.filterOn : null]}>
            <SlidersIcon size={15} color={moreFilters ? colors.white : colors.text} />
            {moreFilters ? <Text style={styles.filterCount}>{moreFilters}</Text> : null}
          </Pressable>
        </View>
        <SummaryLine
          hint={`Complaints and requests about ${everyStore ? 'all your stores' : current?.name ?? 'your store'}. Reply, work them to a fix, or escalate to VeiloScan.`}
          filtered={isFiltered}
          shown={list.items.length}
          total={list.total}
          noun="ticket"
          onClear={() => {
            setQueue('active');
            setStatus('');
            setPriority('');
            setTicketType('');
            setCategoryId('');
            setQuery('');
          }}
        />
      </ListTop>

      {list.error && !list.items.length ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : (
        <FlatList
          data={list.loading ? [] : list.items}
          keyExtractor={t => t.id}
          contentContainerStyle={listPadding}
          ItemSeparatorComponent={Separator}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.secondary} colors={[colors.secondary]} />}
          ListEmptyComponent={
            list.loading ? (
              <ListSkeleton rows={5} height={104} />
            ) : (
              <View style={compactStyles.empty}>
                <EmptyState
                  icon={HelpCircleIcon}
                  title={isFiltered ? 'No tickets match' : 'No support tickets'}
                  text={isFiltered ? 'Try another queue, filter or search.' : 'Tickets from customers, and requests your store raises to VeiloScan, appear here.'}
                />
              </View>
            )
          }
          ListFooterComponent={list.loadingMore ? <Text style={[opsStyles.muted, styles.more]}>Loading more…</Text> : undefined}
          renderItem={({ item }) => <TicketCard ticket={item} showStore={everyStore} onPress={() => navigation.navigate('SupportTicket', { id: item.id })} />}
        />
      )}

      {canCreate ? <Fab label="New Ticket" onPress={() => navigation.navigate('SupportTicketForm', {})} /> : null}

      <Sheet visible={filtersOpen} title="Filters" onClose={() => setFiltersOpen(false)}>
        <View style={styles.sheet}>
          <SelectField label="Status" value={status} options={TICKET_STATUSES.map(v => ({ value: v, label: STATUS[v].label }))} onChange={setStatus} placeholder="All statuses" allowClear="All statuses" />
          <SelectField label="Priority" value={priority} options={PRIORITIES.map(v => ({ value: v, label: priorityLabel(v) }))} onChange={setPriority} placeholder="All priorities" allowClear="All priorities" />
          <SelectField label="Ticket type" value={ticketType} options={(types.data ?? []).map(t => ({ value: t.code, label: t.name }))} onChange={setTicketType} placeholder="All types" allowClear="All types" />
          <SelectField label="Category" value={categoryId} options={categoryChoices} onChange={setCategoryId} placeholder="All categories" allowClear="All categories" />
          <Pressable accessibilityRole="button" onPress={() => setFiltersOpen(false)} style={opsStyles.primaryBtn}>
            <Text style={opsStyles.primaryBtnText}>Show tickets</Text>
          </Pressable>
        </View>
      </Sheet>
    </View>
  );
}

const SLA_COLOR = { ok: '#047857', soon: '#b45309', late: colors.error, none: colors.textSecondary };

function TicketCard({ ticket: t, showStore, onPress }: { ticket: SupportTicketSummary; showStore: boolean; onPress: () => void }) {
  const st = statusOf(t.status);
  const response = slaState(t.firstResponseDueAt, t.firstResponseAt, t.firstResponseOverdue);
  const resolve = slaState(t.resolutionDueAt, t.resolvedAt, t.resolutionOverdue);
  // The deadline that matters now: the reply until there is one, then the fix.
  const sla = t.firstResponseAt || !t.firstResponseDueAt ? { label: 'Resolve', ...resolve } : { label: 'Response', ...response };
  return (
    <RowCard label={`Open ${t.ticketNumber}`} onPress={onPress}>
      <View style={compactStyles.head}>
        <View style={styles.flex}>
          <Text style={styles.number}>{t.ticketNumber}</Text>
          <Text style={compactStyles.name} numberOfLines={1}>
            {t.subject}
          </Text>
        </View>
        <Badge label={st.label} tone={st.tone} />
      </View>
      <Text style={compactStyles.meta} numberOfLines={1}>
        {[
          t.customer.isStore ? 'Store request' : requesterName(t),
          t.customer.isGuest ? 'Guest' : null,
          showStore ? t.store?.name : null,
          t.category?.name,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <View style={compactStyles.chips}>
        <Badge label={`${t.priority === 'URGENT' ? '● ' : ''}${priorityLabel(t.priority)}`} tone={PRIORITY_TONE[t.priority]} />
        <Text style={compactStyles.chip}>{t.ticketType.name}</Text>
        {customerReplied(t) ? <Text style={[compactStyles.chip, styles.replied]}>Customer replied</Text> : null}
        {t.escalationLevel ? <Text style={[compactStyles.chip, styles.escalated]}>{`Level ${t.escalationLevel}`}</Text> : null}
      </View>
      <View style={opsStyles.rowBetween}>
        <Text style={[styles.sla, { color: SLA_COLOR[sla.tone] }]}>{sla.tone === 'none' && sla.text === 'No SLA' ? 'No SLA' : `${sla.label} ${sla.text}`}</Text>
        <Text style={compactStyles.meta} numberOfLines={1}>
          {`${t.assignee?.name ?? 'Unassigned'} · ${dateTime(t.createdAt)} · ${SOURCE_LABEL[t.source] ?? t.source}`}
        </Text>
      </View>
    </RowCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 10, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  filterOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterCount: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  number: { fontFamily: fonts.semibold, fontSize: 11.5, letterSpacing: 0.2, color: colors.secondary },
  replied: { color: '#c2410c', backgroundColor: '#fff7ed' },
  escalated: { color: colors.errorDark, backgroundColor: colors.errorLight },
  sla: { fontFamily: fonts.semibold, fontSize: 12 },
  more: { textAlign: 'center', paddingVertical: 14 },
  sheet: { gap: 14, paddingBottom: 6, borderRadius: radius.md },
});
