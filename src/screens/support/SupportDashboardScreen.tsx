import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useFetch } from '../../hooks/useFetch';
import { dateTime } from '../../lib/operations';
import { formatMinutes, statusOf } from '../../lib/support';
import { supportService, type Breakdown } from '../../services/support-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Group } from '../../components/ui/GroupList';
import { ErrorState, FilterChips, ListSkeleton } from '../../components/list/ListParts';
import { opsStyles, StatCard, StatGrid } from '../../components/operations/OpsParts';
import { AlertCircleIcon, BarChartIcon, CheckCircleIcon, ClockIcon, HelpCircleIcon, RefreshIcon, StarIcon, UserIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const RANGES = [
  { value: '7', get label() { return i18n.t('common.last7Days'); } },
  { value: '30', get label() { return i18n.t('common.last30Days'); } },
  { value: '90', get label() { return i18n.t('common.last90Days'); } },
  { value: '', get label() { return i18n.t('support.allTime'); } },
];
const dayString = (d: Date) => d.toISOString().slice(0, 10);

/** CRM › Support Dashboard: backlog, SLA performance and customer satisfaction. */
export function SupportDashboardScreen({ navigation }: ScreenProps<'SupportDashboard'>) {
  const { t: tr } = useTranslation();
  const { hasPermission } = useAuth();
  const { stores, current } = useStore();
  const allowed = hasPermission('support-reports:view');
  const [range, setRange] = useState('30');
  const [everyStore, setEveryStore] = useState(false);
  const [showHow, setShowHow] = useState(false);
  // The period is worked out when the request is made.
  const { data, error, loading, reload } = useFetch(
    () => (allowed ? supportService.dashboard(range ? { createdFrom: dayString(new Date(Date.now() - Number(range) * 86400000)) } : {}, everyStore) : Promise.resolve(null)),
    [allowed, range, everyStore, current?.id],
  );

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={tr('common.supportDashboard')} onBack={navigation.goBack} />
        <ComingSoon label={tr('common.supportDashboard')} icon={BarChartIcon} allowed={false} />
      </View>
    );
  }

  const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);
  const openTickets = hasPermission('support-tickets:view') ? () => navigation.navigate('SupportTickets') : undefined;
  const t = data?.totals;
  const p = data?.performance;
  return (
    <View style={opsStyles.screen}>
      <AppHeader title={tr('common.supportDashboard')} subtitle="CRM" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} tintColor={colors.secondary} colors={[colors.secondary]} />}>
        <Text style={opsStyles.muted}>{tr('support.dashboardSubtitle', { scope: everyStore ? tr('support.allYourStores') : current?.name ?? tr('support.yourStore') })}</Text>
        {stores.length > 1 ? (
          <FilterChips
            options={[
              { value: 'one', label: current?.name ?? tr('support.thisStore') },
              { value: 'all', label: tr('support.allMyStores') },
            ]}
            value={everyStore ? 'all' : 'one'}
            onChange={v => setEveryStore(v === 'all')}
          />
        ) : null}
        <FilterChips options={RANGES} value={range} onChange={setRange} />

        {error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <ListSkeleton rows={4} height={90} />
        ) : data ? (
          <>
            <StatGrid>
              <StatCard icon={HelpCircleIcon} tone="slate" label={tr('support.ticketsCreated')} value={String(t!.total)} />
              <StatCard icon={ClockIcon} tone="orange" label={tr('common.open')} value={String(t!.open)} onPress={openTickets} />
              <StatCard icon={UserIcon} tone="blue" label={tr('support.unassigned')} value={String(t!.unassigned)} />
              <StatCard icon={AlertCircleIcon} tone="red" label={tr('support.urgentOpen')} value={String(t!.urgent)} />
              <StatCard icon={AlertCircleIcon} tone="red" label={tr('support.escalated')} value={String(t!.escalated)} />
              <StatCard icon={AlertCircleIcon} tone="red" label={tr('support.slaBreached')} value={String(t!.breached)} />
              <StatCard icon={ClockIcon} tone="amber" label={tr('support.dueWithin2h')} value={String(t!.approaching)} />
              <StatCard icon={StarIcon} tone="amber" label={tr('support.csatCsatresponsesRatings', { csatResponses: p!.csatResponses })} value={p!.csatAverage === null ? '—' : `${p!.csatAverage} / 5`} />
            </StatGrid>

            <Group title="PERFORMANCE">
              <Metric icon={ClockIcon} label={tr('support.avgFirstResponse')} value={formatMinutes(p!.avgFirstResponseMinutes)} />
              <Metric icon={CheckCircleIcon} label={tr('support.avgResolution')} value={formatMinutes(p!.avgResolutionMinutes)} />
              <Metric icon={CheckCircleIcon} label={tr('support.firstResponseOnTime')} value={pct(p!.firstResponseSlaMetPercent)} />
              <Metric icon={RefreshIcon} label={tr('support.reopenedRate')} value={pct(p!.reopenedRatePercent)} last />
            </Group>

            <BarGroup title={tr('support.byStatus')} rows={data.byStatus} label={r => statusOf(r.key ?? '').label || r.label} />
            <BarGroup title={tr('support.byPriority')} rows={data.byPriority} label={r => r.label} />
            <BarGroup title={tr('support.byTicketType')} rows={data.byType} label={r => r.label} />
            <BarGroup title={tr('support.byCategory')} rows={data.byCategory} label={r => r.label} />
            {everyStore ? <BarGroup title={tr('support.byStore')} rows={data.byStore.slice(0, 10)} label={r => r.label} /> : null}

            <Group title={tr('support.agentWorkload')}>
              <View style={styles.block}>
                {data.agents.length ? (
                  data.agents.map(a => (
                    <View key={a.userId} style={styles.agent}>
                      <Text style={[opsStyles.title, styles.flex]} numberOfLines={1}>
                        {a.name || '—'}
                      </Text>
                      <Text style={styles.agentFig}>{tr('support.openOpen', { open: a.open })}</Text>
                      <Text style={[styles.agentFig, a.breached ? styles.bad : null]}>{tr('support.breachedBreached', { breached: a.breached })}</Text>
                      <Text style={styles.agentFig}>{tr('support.resolvedResolvedAvgresolutionminutes', { resolved: a.resolved, avgResolutionMinutes: formatMinutes(a.avgResolutionMinutes) })}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={opsStyles.muted}>{tr('support.noAssignedTicketsInThisPeriod')}</Text>
                )}
              </View>
            </Group>

            <Group title={tr('support.howTheseFiguresAreCounted')} action={{ label: showHow ? tr('support.hide') : tr('common.show'), onPress: () => setShowHow(v => !v) }}>
              <View style={styles.block}>
                {showHow
                  ? Object.entries(data.definitions).map(([key, text]) => (
                      <View key={key} style={styles.def}>
                        <Text style={opsStyles.title}>{key}</Text>
                        <Text style={opsStyles.meta}>{text}</Text>
                      </View>
                    ))
                  : null}
                <Text style={opsStyles.muted}>{tr('support.generatedGeneratedat', { generatedAt: dateTime(data.generatedAt) })}</Text>
              </View>
            </Group>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Metric({ icon: Icon, label, value, last }: { icon: typeof ClockIcon; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.metric, !last && styles.line]}>
      <Icon size={16} color={colors.textSecondary} />
      <Text style={[opsStyles.meta, styles.flex]}>{label}</Text>
      <Text style={opsStyles.title}>{value}</Text>
    </View>
  );
}

/** One magnitude per row: a single orange bar, the count beside it. */
function BarGroup({ title, rows, label }: { title: string; rows: Breakdown[]; label: (r: Breakdown) => string }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...rows.map(r => r.count));
  return (
    <Group title={title}>
      <View style={styles.block}>
        {rows.length ? (
          rows.map(r => (
            <View key={r.key ?? 'none'} style={styles.bar}>
              <View style={opsStyles.rowBetween}>
                <Text style={[opsStyles.meta, styles.flex]} numberOfLines={1}>
                  {label(r)}
                </Text>
                <Text style={opsStyles.meta}>
                  <Text style={opsStyles.title}>{r.count}</Text>
                  {t('support.openOpen2', { open: r.open })}
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(2, (r.count / max) * 100)}%` }]} />
              </View>
            </View>
          ))
        ) : (
          <Text style={opsStyles.muted}>{t('support.noTicketsInThisPeriod')}</Text>
        )}
      </View>
    </Group>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  content: { gap: 14, padding: 16, paddingBottom: 40 },
  block: { gap: 10, paddingVertical: 12 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  bar: { gap: 5 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.background },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.secondary },
  agent: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 2, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  agentFig: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  bad: { color: colors.error },
  def: { gap: 2, paddingBottom: 6, borderRadius: radius.sm },
});
