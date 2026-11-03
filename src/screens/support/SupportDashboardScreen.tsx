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

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '', label: 'All time' },
];
const dayString = (d: Date) => d.toISOString().slice(0, 10);

/** CRM › Support Dashboard: backlog, SLA performance and customer satisfaction. */
export function SupportDashboardScreen({ navigation }: ScreenProps<'SupportDashboard'>) {
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
        <AppHeader title="Support Dashboard" onBack={navigation.goBack} />
        <ComingSoon label="Support Dashboard" icon={BarChartIcon} allowed={false} />
      </View>
    );
  }

  const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);
  const openTickets = hasPermission('support-tickets:view') ? () => navigation.navigate('SupportTickets') : undefined;
  const t = data?.totals;
  const p = data?.performance;
  return (
    <View style={opsStyles.screen}>
      <AppHeader title="Support Dashboard" subtitle="CRM" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} tintColor={colors.secondary} colors={[colors.secondary]} />}>
        <Text style={opsStyles.muted}>{`Backlog, SLA performance and customer satisfaction for ${everyStore ? 'all your stores' : current?.name ?? 'your store'}.`}</Text>
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
        <FilterChips options={RANGES} value={range} onChange={setRange} />

        {error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <ListSkeleton rows={4} height={90} />
        ) : data ? (
          <>
            <StatGrid>
              <StatCard icon={HelpCircleIcon} tone="slate" label="Tickets created" value={String(t!.total)} />
              <StatCard icon={ClockIcon} tone="orange" label="Open" value={String(t!.open)} onPress={openTickets} />
              <StatCard icon={UserIcon} tone="blue" label="Unassigned" value={String(t!.unassigned)} />
              <StatCard icon={AlertCircleIcon} tone="red" label="Urgent open" value={String(t!.urgent)} />
              <StatCard icon={AlertCircleIcon} tone="red" label="Escalated" value={String(t!.escalated)} />
              <StatCard icon={AlertCircleIcon} tone="red" label="SLA breached" value={String(t!.breached)} />
              <StatCard icon={ClockIcon} tone="amber" label="Due within 2h" value={String(t!.approaching)} />
              <StatCard icon={StarIcon} tone="amber" label={`CSAT (${p!.csatResponses} ratings)`} value={p!.csatAverage === null ? '—' : `${p!.csatAverage} / 5`} />
            </StatGrid>

            <Group title="PERFORMANCE">
              <Metric icon={ClockIcon} label="Avg first response" value={formatMinutes(p!.avgFirstResponseMinutes)} />
              <Metric icon={CheckCircleIcon} label="Avg resolution" value={formatMinutes(p!.avgResolutionMinutes)} />
              <Metric icon={CheckCircleIcon} label="First response on time" value={pct(p!.firstResponseSlaMetPercent)} />
              <Metric icon={RefreshIcon} label="Reopened rate" value={pct(p!.reopenedRatePercent)} last />
            </Group>

            <BarGroup title="BY STATUS" rows={data.byStatus} label={r => statusOf(r.key ?? '').label || r.label} />
            <BarGroup title="BY PRIORITY" rows={data.byPriority} label={r => r.label} />
            <BarGroup title="BY TICKET TYPE" rows={data.byType} label={r => r.label} />
            <BarGroup title="BY CATEGORY" rows={data.byCategory} label={r => r.label} />
            {everyStore ? <BarGroup title="BY STORE" rows={data.byStore.slice(0, 10)} label={r => r.label} /> : null}

            <Group title="AGENT WORKLOAD">
              <View style={styles.block}>
                {data.agents.length ? (
                  data.agents.map(a => (
                    <View key={a.userId} style={styles.agent}>
                      <Text style={[opsStyles.title, styles.flex]} numberOfLines={1}>
                        {a.name || '—'}
                      </Text>
                      <Text style={styles.agentFig}>{`${a.open} open`}</Text>
                      <Text style={[styles.agentFig, a.breached ? styles.bad : null]}>{`${a.breached} breached`}</Text>
                      <Text style={styles.agentFig}>{`${a.resolved} resolved · ${formatMinutes(a.avgResolutionMinutes)}`}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={opsStyles.muted}>No assigned tickets in this period.</Text>
                )}
              </View>
            </Group>

            <Group title="HOW THESE FIGURES ARE COUNTED" action={{ label: showHow ? 'Hide' : 'Show', onPress: () => setShowHow(v => !v) }}>
              <View style={styles.block}>
                {showHow
                  ? Object.entries(data.definitions).map(([key, text]) => (
                      <View key={key} style={styles.def}>
                        <Text style={opsStyles.title}>{key}</Text>
                        <Text style={opsStyles.meta}>{text}</Text>
                      </View>
                    ))
                  : null}
                <Text style={opsStyles.muted}>{`Generated ${dateTime(data.generatedAt)}`}</Text>
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
                  {` · ${r.open} open`}
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(2, (r.count / max) * 100)}%` }]} />
              </View>
            </View>
          ))
        ) : (
          <Text style={opsStyles.muted}>No tickets in this period.</Text>
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
