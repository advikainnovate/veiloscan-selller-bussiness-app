import React, { useState, type ComponentType } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import {
  canChangePlan,
  day,
  money,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  pendingLabel,
  planState,
  spentShare,
  STAGE,
  titleCase,
  usageLevel,
  type CurrentPlan,
} from '../lib/subscription';
import { subscriptionService, type FeatureUsage, type MyPayment, type PlanDetails, type RenewalQuote } from '../services/subscription-service';
import { AppHeader } from '../components/layout/AppHeader';
import { Badge } from '../components/ui/Badge';
import { Gradient } from '../components/ui/Gradient';
import { Group, groupStyles, Row } from '../components/ui/GroupList';
import { EmptyState, ErrorState, ListSkeleton } from '../components/list/ListParts';
import { opsStyles } from '../components/operations/OpsParts';
import { ChangePlanSheet } from '../components/subscription/ChangePlanSheet';
import { AlertCircleIcon, ArrowUpIcon, AwardIcon, BanIcon, CalendarIcon, CheckCircleIcon, ChevronDownIcon, ClockIcon, CreditCardIcon, LayersIcon, RefreshIcon, ShieldCheckIcon, WalletIcon, type IconProps } from '../components/icons';
import type { ScreenProps } from '../navigation/types';

/**
 * Subscription, as the Seller Panel's page: the plan and where it stands,
 * renewal, price and billing, usage against the plan's allowances,
 * payments, and every feature the plan includes. Account owners can change
 * plan here.
 */
export function SubscriptionScreen({ navigation }: ScreenProps<'Subscription'>) {
  const { user } = useAuth();
  const { data, error, loading, reload } = useFetch(() => subscriptionService.planDetails(), []);
  const renewal = useFetch(() => subscriptionService.renewal().catch(() => null), []);
  const payments = useFetch(() => subscriptionService.payments().catch(() => []), []);
  const [changing, setChanging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const header = <AppHeader title="Subscription" subtitle="Your plan and everything it includes" onBack={navigation.canGoBack() ? navigation.goBack : undefined} />;

  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([reload(), renewal.reload(), payments.reload()]);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading && !data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ListSkeleton rows={4} height={140} />
      </View>
    );
  }
  if (error && !data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ErrorState message={error} onRetry={reload} />
      </View>
    );
  }
  if (data?.isPlatformAdmin || !data?.details) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <EmptyState
          icon={AwardIcon}
          title={data?.isPlatformAdmin ? 'Platform admins hold no plan' : 'No plan found'}
          text={data?.isPlatformAdmin ? "Subscriptions belong to seller accounts." : "We couldn't find a plan for this account. Contact support and we'll sort it out."}
        />
      </View>
    );
  }

  const details = data.details;
  const sub = details.subscription;
  const allFeatures = details.modules.flatMap(g => g.features);
  const included = allFeatures.filter(f => f.isEnabled).length;
  const current: CurrentPlan = {
    planCode: details.plan.planCode,
    planName: details.plan.planName,
    tier: details.plan.tier,
    isDefault: details.source !== 'SUBSCRIPTION',
    billingCycle: sub?.billingCycle ?? null,
    status: sub?.status ?? null,
  };
  const canChange = canChangePlan(user?.userType);
  const price = !sub ? 'Free' : sub.amount === null ? 'Custom pricing' : `${money(sub.amount, sub.currency)} / ${sub.billingCycle === 'YEARLY' ? 'year' : 'month'}`;
  const onTrial = sub?.status === 'TRIALING';
  const usage = data.usage ?? [];

  return (
    <View style={opsStyles.screen}>
      {header}
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <PlanCard details={details} renewal={renewal.data ?? null} canChange={canChange} onChange={() => setChanging(true)} isDefault={current.isDefault} />

        {renewal.data ? <RenewalCard quote={renewal.data} urgent={planState(details, renewal.data).urgent} /> : null}

        <View style={styles.tiles}>
          <Tile icon={CreditCardIcon} label="Price" value={price} hint={sub?.taxRatePercent ? `+ ${sub.taxRatePercent}% tax` : sub ? undefined : 'No charge'} />
          <Tile icon={RefreshIcon} label="Billing cycle" value={sub ? titleCase(sub.billingCycle) : '—'} hint={sub ? (sub.autoRenew ? 'Auto-renew on' : 'Auto-renew off') : undefined} />
          <Tile icon={CalendarIcon} label={onTrial ? 'First charge due' : 'Next charge due'} value={sub ? day(sub.nextBillingAt) : 'Nothing due'} />
          <Tile icon={LayersIcon} label="Features included" value={`${included} of ${allFeatures.length}`} hint={`Across ${details.modules.length} module${details.modules.length === 1 ? '' : 's'}`} />
        </View>

        {usage.length ? (
          <View style={groupStyles.group}>
            <Text style={[groupStyles.title, styles.sectionTitle]}>USAGE</Text>
            <Text style={[opsStyles.muted, styles.sectionHint]}>What you have used and what is still left on your plan.</Text>
            {usage.map(u => (
              <UsageMeter key={u.featureCode} usage={u} />
            ))}
          </View>
        ) : null}

        <BillingGroup details={details} />

        <PaymentsGroup payments={payments.data ?? []} loading={payments.loading} />

        <FeaturesGroup details={details} />
      </ScrollView>

      {canChange ? (
        <ChangePlanSheet
          visible={changing}
          current={current}
          onClose={() => setChanging(false)}
          onChanged={() => {
            setChanging(false);
            refresh();
          }}
        />
      ) : null}
    </View>
  );
}

// ── The plan, on navy ────────────────────────────────────────────────────

function PlanCard({ details, renewal, canChange, isDefault, onChange }: { details: PlanDetails; renewal: RenewalQuote | null; canChange: boolean; isDefault: boolean; onChange: () => void }) {
  const st = planState(details, renewal);
  const stage = st.stage ? STAGE[st.stage] : null;
  const StageIcon = st.urgent ? AlertCircleIcon : st.stage === 'TRIAL' || st.stage === 'COMPLIMENTARY' ? ClockIcon : st.stage ? CheckCircleIcon : ShieldCheckIcon;
  const blurb = details.plan.targetSeller ?? details.plan.description;
  return (
    <View style={styles.hero}>
      <Gradient colors={[colors.primaryDeep, '#0B2A55', '#163E73']} direction="diagonal" />
      <View style={styles.glow} />
      <View style={styles.heroHead}>
        <View style={styles.award}>
          <AwardIcon size={22} color={colors.primaryDeep} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.kicker}>YOUR PLAN</Text>
          <Text style={styles.planName} numberOfLines={1}>
            {details.plan.planName}
          </Text>
        </View>
      </View>
      <View style={[styles.stage, { backgroundColor: stage?.tint ?? 'rgba(255,255,255,0.1)' }]}>
        <StageIcon size={13} color={stage?.color ?? '#e2e8f0'} />
        <Text style={[styles.stageText, { color: stage?.color ?? '#e2e8f0' }]}>{stage?.label ?? 'Free plan'}</Text>
      </View>
      {blurb ? <Text style={styles.blurb}>{blurb}</Text> : null}
      <Text style={[styles.message, st.urgent && styles.urgent]}>{st.message}</Text>

      {st.phase && st.progress !== null ? (
        <View style={styles.progressWrap}>
          <View style={styles.progressHead}>
            <Text style={styles.progressLabel}>{st.phase.label}</Text>
            {st.left !== null ? <Text style={[styles.progressLeft, st.urgent && styles.urgent]}>{`${st.left} day${st.left === 1 ? '' : 's'} ${st.stage === 'RENEWAL_DUE' ? 'left to renew' : 'remaining'}`}</Text> : null}
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, st.urgent && styles.fillUrgent, { width: `${Math.max(st.progress * 100, 2)}%` }]} />
          </View>
          <View style={styles.progressHead}>
            <Text style={styles.edge}>{day(st.phase.from)}</Text>
            <Text style={styles.edge}>{day(st.phase.to)}</Text>
          </View>
        </View>
      ) : null}

      {st.dates.length ? (
        <View style={styles.dates}>
          {st.dates.map(d => (
            <View key={d.label} style={styles.dateBox}>
              <Text style={styles.dateLabel}>{d.label.toUpperCase()}</Text>
              <Text style={[styles.dateValue, st.urgent && d.label !== 'Free trial' && styles.urgent]}>{d.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {details.plan.highlights.length ? (
        <View style={styles.highlights}>
          {details.plan.highlights.map(h => (
            <View key={h} style={styles.highlight}>
              <CheckCircleIcon size={12} color="#6ee7b7" />
              <Text style={styles.highlightText}>{h}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {canChange ? (
        <Pressable accessibilityRole="button" accessibilityLabel={isDefault ? 'Choose a Plan' : 'Upgrade Plan'} onPress={onChange} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <ArrowUpIcon size={15} color={colors.white} />
          <Text style={styles.ctaText}>{isDefault ? 'Choose a Plan' : 'Upgrade Plan'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function RenewalCard({ quote, urgent }: { quote: RenewalQuote; urgent: boolean }) {
  return (
    <View style={[styles.card, urgent && styles.cardUrgent]}>
      <Text style={styles.cardKicker}>RENEWAL</Text>
      <Text style={opsStyles.title}>{`${quote.planName} · ${quote.billingCycle === 'YEARLY' ? 'Yearly' : 'Monthly'}`}</Text>
      <Text style={styles.total}>{money(quote.totalAmount, quote.currency)}</Text>
      <Text style={opsStyles.muted}>{`incl. GST · covers ${day(quote.periodStart)} – ${day(quote.periodEnd)}`}</Text>
      <View style={styles.breakdown}>
        <View style={opsStyles.rowBetween}>
          <Text style={opsStyles.meta}>Plan price</Text>
          <Text style={styles.breakValue}>{money(quote.subtotal, quote.currency)}</Text>
        </View>
        <View style={opsStyles.rowBetween}>
          <Text style={opsStyles.meta}>{`GST (${quote.taxRatePercent}%)`}</Text>
          <Text style={styles.breakValue}>{money(quote.taxAmount, quote.currency)}</Text>
        </View>
        <View style={[opsStyles.rowBetween, styles.breakTotal]}>
          <Text style={opsStyles.title}>Total</Text>
          <Text style={opsStyles.amount}>{money(quote.totalAmount, quote.currency)}</Text>
        </View>
      </View>
      <View style={styles.payNote}>
        <WalletIcon size={15} color={urgent ? colors.warningDark : colors.textSecondary} />
        <Text style={[opsStyles.meta, styles.flex, urgent && styles.urgentDark]}>
          {quote.canRenew
            ? `${quote.stage === 'EXPIRED' ? 'Renew & reactivate' : 'Renew'} on the Seller Panel (Subscription) — payment opens there. Nothing is charged automatically.`
            : `Renewal opens on ${day(quote.opensAt)}.`}
        </Text>
      </View>
    </View>
  );
}

function Tile({ icon: Icon, label, value, hint }: { icon: ComponentType<IconProps>; label: string; value: string; hint?: string }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileIcon}>
        <Icon size={15} color={colors.secondary} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? (
        <Text style={styles.tileHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const LEVEL_COLOR = { off: '#cbd5e1', unlimited: '#10b981', full: '#f43f5e', near: '#f59e0b', ok: '#10b981' } as const;

function UsageMeter({ usage }: { usage: FeatureUsage }) {
  const level = usageLevel(usage);
  const share = spentShare(usage);
  return (
    <View style={[styles.meter, level === 'full' && styles.meterFull, level === 'near' && styles.meterNear]}>
      <View style={opsStyles.rowBetween}>
        <Text style={[opsStyles.title, styles.flex]}>{usage.featureName}</Text>
        <Text style={[styles.left, level === 'full' ? styles.leftFull : level === 'near' ? styles.leftNear : null]}>{pendingLabel(usage)}</Text>
      </View>
      {usage.isEnabled ? (
        <Text style={styles.used}>
          {usage.used.toLocaleString('en-IN')}
          <Text style={styles.of}>{` / ${usage.allowed === null ? 'Unlimited' : usage.allowed.toLocaleString('en-IN')}`}</Text>
        </Text>
      ) : (
        <Text style={opsStyles.muted}>Not included</Text>
      )}
      {usage.scope === 'STORE' && usage.limitValue !== null && usage.isEnabled ? <Text style={opsStyles.muted}>{`${usage.limitValue.toLocaleString('en-IN')} per store`}</Text> : null}
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { backgroundColor: LEVEL_COLOR[level], width: `${Math.max(share * 100, usage.used > 0 ? 4 : 0)}%` }]} />
      </View>
      {usage.perStore && usage.stores.length ? (
        <View style={styles.stores}>
          {usage.stores.map(s => (
            <View key={s.storeId} style={opsStyles.rowBetween}>
              <Text style={[opsStyles.muted, styles.flex]} numberOfLines={1}>
                {s.storeName}
              </Text>
              <Text style={[styles.storeUse, s.remaining === 0 && opsStyles.danger]}>
                {`${s.used.toLocaleString('en-IN')}${usage.limitValue !== null ? ` / ${usage.limitValue.toLocaleString('en-IN')}` : ''}${s.remaining !== null ? ` · ${s.remaining.toLocaleString('en-IN')} left` : ''}`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {level === 'full' ? <Text style={[opsStyles.muted, opsStyles.danger]}>You have used your whole allowance. Upgrade your plan to add more.</Text> : null}
    </View>
  );
}

function BillingGroup({ details }: { details: PlanDetails }) {
  const { plan, subscription: sub } = details;
  const planRows = (last: boolean) => (
    <>
      <Row label="Plan code" value={plan.planCode} />
      <Row label="Plan tier" value={`Tier ${plan.tier}`} />
      <Row label="Entitlements from" value={details.source === 'SUBSCRIPTION' ? 'Your subscription' : 'Default free plan'} last={last} />
    </>
  );
  if (!sub) {
    return (
      <Group title="Billing details">
        <Row label="Amount" value="No charge" />
        <Row label="Free trial on paid plans" value={plan.trialDays > 0 ? `${plan.trialDays} days` : '—'} />
        {planRows(true)}
      </Group>
    );
  }
  return (
    <Group title={`Billing details · ${sub.idd}`}>
      <Row label="Started on" value={day(sub.startedAt)} />
      {sub.status === 'TRIALING' ? <Row label="Free trial ends" value={day(sub.trialEndAt)} /> : null}
      <Row label="Current period" value={`${day(sub.currentPeriodStart)} – ${day(sub.currentPeriodEnd)}`} />
      {sub.taxRatePercent ? <Row label="Tax" value={`${sub.taxRatePercent}% on top`} /> : null}
      <Row label="Auto-renew" value={<Text style={[groupStyles.value, sub.autoRenew ? groupStyles.ok : groupStyles.muted]}>{sub.autoRenew ? 'On' : 'Off — nothing is charged automatically'}</Text>} />
      {planRows(true)}
    </Group>
  );
}

function PaymentsGroup({ payments, loading }: { payments: MyPayment[]; loading: boolean }) {
  const awaiting = payments.find(p => p.status === 'AWAITING_VERIFICATION');
  return (
    <View style={groupStyles.group}>
      <Text style={[groupStyles.title, styles.sectionTitle]}>PAYMENTS</Text>
      {awaiting ? (
        <View style={styles.awaiting}>
          <ClockIcon size={15} color={colors.warningDark} />
          <Text style={[styles.awaitingText, styles.flex]}>
            {`Your cash payment of ${money(Number(awaiting.amount), awaiting.currency)} for ${awaiting.planName} is being verified. Your plan activates as soon as it is confirmed.`}
          </Text>
        </View>
      ) : null}
      {loading && !payments.length ? (
        <Text style={[opsStyles.muted, styles.sectionHint]}>Loading…</Text>
      ) : payments.length ? (
        <View style={groupStyles.body}>
          {payments.map((p, i) => {
            const st = PAYMENT_STATUS[p.status];
            return (
              <View key={p.idd} style={[styles.payment, i < payments.length - 1 && groupStyles.line]}>
                <View style={styles.flex}>
                  <Text style={opsStyles.title}>{`${p.planName} · ${p.billingCycle === 'YEARLY' ? 'Yearly' : 'Monthly'}`}</Text>
                  <Text style={opsStyles.muted}>{`${day(p.paidAt ?? p.createdAt)} · ${PAYMENT_METHOD[p.method]}${p.invoiceNumber ? ` · Invoice ${p.invoiceNumber}` : ''}`}</Text>
                  {Number(p.discountAmount) ? <Text style={[opsStyles.muted, opsStyles.success]}>{`${money(Number(p.discountAmount), p.currency)} off`}</Text> : null}
                </View>
                <View style={styles.payRight}>
                  <Text style={opsStyles.amount}>{money(Number(p.amount), p.currency)}</Text>
                  <Badge label={st.label} tone={st.tone} />
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={[groupStyles.body, styles.noPayments]}>
          <WalletIcon size={22} color={colors.border} />
          <Text style={opsStyles.title}>No payments yet</Text>
          <Text style={opsStyles.muted}>Payments for your plan will show here.</Text>
        </View>
      )}
    </View>
  );
}

function FeaturesGroup({ details }: { details: PlanDetails }) {
  const [includedOnly, setIncludedOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(details.modules[0]?.module ?? null);
  return (
    <View style={groupStyles.group}>
      <View style={groupStyles.head}>
        <Text style={groupStyles.title}>WHAT YOUR PLAN INCLUDES</Text>
      </View>
      {details.modules.length ? (
        <>
          <View accessibilityRole="tablist" style={styles.toggle}>
            {[
              [false, 'All features'],
              [true, 'Included'],
            ].map(([value, label]) => {
              const on = includedOnly === value;
              return (
                <Pressable key={String(label)} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setIncludedOnly(value as boolean)} style={[styles.toggleBtn, on && styles.toggleOn]}>
                  <Text style={[styles.toggleText, on && styles.toggleTextOn]}>{label as string}</Text>
                </Pressable>
              );
            })}
          </View>
          {details.modules.map(group => {
            const inc = group.features.filter(f => f.isEnabled);
            // Included first, so what the seller has reads before what they don't.
            const shown = includedOnly ? inc : [...inc, ...group.features.filter(f => !f.isEnabled)];
            if (!shown.length) return null;
            const expanded = open === group.module;
            const full = inc.length === group.features.length;
            return (
              <View key={group.module} style={styles.module}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${group.module}, ${inc.length} of ${group.features.length} included`} onPress={() => setOpen(expanded ? null : group.module)} style={styles.moduleHead}>
                  <View style={styles.moduleIcon}>
                    <CreditCardIcon size={14} color={colors.textSecondary} />
                  </View>
                  <Text style={[opsStyles.title, styles.flex]} numberOfLines={1}>
                    {group.module}
                  </Text>
                  <Text style={[styles.count, full && styles.countFull]}>{`${inc.length} of ${group.features.length}`}</Text>
                  <View style={expanded ? styles.flip : null}>
                    <ChevronDownIcon size={16} color={colors.textMuted} />
                  </View>
                </Pressable>
                {expanded
                  ? shown.map(f => {
                      const Icon = f.isEnabled ? CheckCircleIcon : BanIcon;
                      return (
                        <View key={f.featureCode} style={styles.feature}>
                          <Icon size={15} color={f.isEnabled ? colors.success : colors.border} />
                          <View style={styles.flex}>
                            <Text style={[styles.featureName, !f.isEnabled && styles.off]}>{f.featureName}</Text>
                            {f.description ? <Text style={opsStyles.muted}>{f.description}</Text> : null}
                          </View>
                          <View style={styles.featureRight}>
                            {f.isEnabled && f.tier && f.tier !== 'NONE' ? <Text style={styles.tier}>{titleCase(f.tier)}</Text> : null}
                            <Text style={[styles.featureValue, !f.isEnabled && styles.off]}>{f.displayValue}</Text>
                          </View>
                        </View>
                      );
                    })
                  : null}
              </View>
            );
          })}
        </>
      ) : (
        <View style={[groupStyles.body, styles.noPayments]}>
          <AwardIcon size={22} color={colors.border} />
          <Text style={opsStyles.title}>No features listed</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },
  flip: { transform: [{ rotate: '180deg' }] },
  content: { gap: 16, padding: 16, paddingBottom: 40 },
  sectionTitle: { paddingHorizontal: 4 },
  sectionHint: { paddingHorizontal: 4, marginTop: -2 },
  // The panel's navy plan card.
  hero: { overflow: 'hidden', gap: 12, padding: 18, borderRadius: radius.xl, ...shadow.raised },
  glow: { position: 'absolute', top: -90, right: -90, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,107,0,0.25)' },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  award: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  kicker: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1.6, color: '#fdba74' },
  planName: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.white, letterSpacing: -0.3 },
  stage: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  stageText: { fontFamily: fonts.bold, fontSize: 12 },
  blurb: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: '#cbd5e1' },
  message: { fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 21, color: colors.white },
  urgent: { color: '#fde68a' },
  urgentDark: { color: colors.warningDark },
  progressWrap: { gap: 6 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  progressLabel: { fontFamily: fonts.semibold, fontSize: 12, color: '#cbd5e1' },
  progressLeft: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  track: { height: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.secondary },
  fillUrgent: { backgroundColor: '#fbbf24' },
  edge: { fontFamily: fonts.regular, fontSize: 11, color: '#94a3b8' },
  dates: { gap: 8 },
  dateBox: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)' },
  dateLabel: { fontFamily: fonts.semibold, fontSize: 10.5, letterSpacing: 0.6, color: '#94a3b8' },
  dateValue: { marginTop: 2, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.white },
  highlights: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  highlight: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)' },
  highlightText: { fontFamily: fonts.medium, fontSize: 12, color: '#e2e8f0' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, marginTop: 4, borderRadius: radius.md, backgroundColor: colors.secondary, ...shadow.button },
  ctaText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  card: { gap: 4, padding: 16, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, ...shadow.card },
  cardUrgent: { borderWidth: 1.5, borderColor: '#fcd34d' },
  cardKicker: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1, color: colors.textMuted },
  total: { marginTop: 6, fontFamily: fonts.extrabold, fontSize: 28, color: colors.text, letterSpacing: -0.5 },
  breakdown: { gap: 6, marginTop: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.background },
  breakValue: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  breakTotal: { paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  payNote: { flexDirection: 'row', gap: 8, marginTop: 10 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, gap: 2, padding: 12, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  tileIcon: { width: 30, height: 30, marginBottom: 6, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff7ed' },
  tileLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textMuted },
  tileValue: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  tileHint: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  meter: { gap: 4, padding: 14, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, ...shadow.card },
  meterFull: { borderWidth: 1, borderColor: '#fecdd3', backgroundColor: '#fff7f8' },
  meterNear: { borderWidth: 1, borderColor: '#fde68a', backgroundColor: '#fffdf5' },
  left: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary, backgroundColor: colors.background },
  leftFull: { color: '#be123c', backgroundColor: '#ffe4e6' },
  leftNear: { color: '#b45309', backgroundColor: '#fef3c7' },
  used: { marginTop: 2, fontFamily: fonts.extrabold, fontSize: 22, color: colors.text },
  of: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  meterTrack: { height: 6, marginTop: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.background },
  meterFill: { height: '100%', borderRadius: 3 },
  stores: { gap: 4, marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  storeUse: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  awaiting: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: '#fffbeb' },
  awaitingText: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.warningDark },
  payment: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  payRight: { alignItems: 'flex-end', gap: 4 },
  noPayments: { alignItems: 'center', gap: 4, paddingVertical: 22 },
  toggle: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  toggleBtn: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  toggleOn: { backgroundColor: colors.white, ...shadow.card },
  toggleText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  toggleTextOn: { color: colors.text },
  module: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  moduleHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 54 },
  moduleIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  count: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary, backgroundColor: colors.background },
  countFull: { color: '#047857', backgroundColor: '#ecfdf5' },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  featureName: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.text },
  off: { color: colors.textMuted },
  featureRight: { alignItems: 'flex-end', gap: 3, maxWidth: '40%' },
  tier: { overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 1, borderRadius: 8, fontFamily: fonts.semibold, fontSize: 10.5, color: '#c2410c', backgroundColor: '#fff7ed' },
  featureValue: { textAlign: 'right', fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
});
