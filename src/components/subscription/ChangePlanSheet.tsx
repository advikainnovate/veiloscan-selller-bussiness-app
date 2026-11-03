import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { cycleNoun, money, MOVE_LABEL, moveFor, priceOn, type CurrentPlan, type Move } from '../../lib/subscription';
import { subscriptionService, type BillingCycle, type CataloguePlan } from '../../services/subscription-service';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { opsStyles } from '../operations/OpsParts';
import { AlertCircleIcon, ArrowDownIcon, ArrowUpIcon, AwardIcon, CheckCircleIcon, StarIcon } from '../icons';

/**
 * Change plan, as the panel's dialog: pick monthly or yearly, then a plan,
 * then confirm. A seller on the free fallback plan starts a trial instead.
 * The backend refuses a downgrade the account can't fit into and names
 * what's over; that message is shown as sent.
 */
export function ChangePlanSheet({ visible, current, onClose, onChanged }: { visible: boolean; current: CurrentPlan; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [cycle, setCycle] = useState<BillingCycle>(current.billingCycle ?? 'MONTHLY');
  const [picked, setPicked] = useState<CataloguePlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Only fetched once opened.
  const { data, loading, error: loadError } = useFetch(() => (visible ? subscriptionService.catalogue() : Promise.resolve(null)), [visible]);

  useEffect(() => {
    if (!visible) return;
    setCycle(current.billingCycle ?? 'MONTHLY');
    setPicked(null);
    setError('');
  }, [visible, current.billingCycle]);

  const plans = data?.plans ?? [];
  const move = picked ? moveFor(picked, current, cycle) : null;
  const price = picked ? priceOn(picked, cycle) : null;

  async function confirm() {
    if (!picked) return;
    setSaving(true);
    setError('');
    try {
      const result = current.isDefault ? await subscriptionService.start(picked.planCode, cycle) : await subscriptionService.change(picked.planCode, cycle);
      toast(`You're now on ${result.planName}`);
      onChanged();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const close = () => {
    if (!saving) onClose();
  };

  return (
    <Sheet
      visible={visible}
      title={picked ? 'Confirm your new plan' : current.isDefault ? 'Choose a plan' : 'Change your plan'}
      subtitle={
        picked ? undefined : current.isDefault ? 'Pick the plan that fits your business. Every paid plan starts on a free trial.' : `You are on ${current.planName}. Pick another plan to move to.`
      }
      onClose={close}
      footer={
        picked ? (
          <View style={styles.footer}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => setPicked(null)} style={styles.back}>
              <Text style={opsStyles.smallBtnText}>Back</Text>
            </Pressable>
            <View style={styles.flex}>
              <Button title={move === 'downgrade' ? `Downgrade to ${picked.planName}` : `Confirm ${picked.planName}`} loading={saving} onPress={confirm} />
            </View>
          </View>
        ) : undefined
      }
    >
      {picked ? (
        <>
          <View style={styles.summary}>
            {[
              ['FROM', current.planName],
              ['TO', picked.planName],
              ['NEW PRICE', price ? `${money(price.amount as number, price.currency)} / ${cycleNoun(cycle)}` : '—'],
            ].map(([k, v]) => (
              <View key={k} style={styles.flex}>
                <Text style={styles.kicker}>{k}</Text>
                <Text style={styles.summaryValue}>{v}</Text>
              </View>
            ))}
          </View>
          <Text style={opsStyles.meta}>
            {move === 'downgrade'
              ? 'You will keep fewer features and lower limits. If this account already holds more than the new plan allows, the change is refused and we will tell you what to remove first.'
              : 'The change takes effect immediately — your new features are available as soon as you confirm.'}
          </Text>
          <Text style={opsStyles.muted}>
            {current.isDefault
              ? price && price.trialDays > 0
                ? `Your ${price.trialDays}-day free trial starts now. No card is taken and nothing is charged automatically.`
                : 'No card is taken and nothing is charged automatically.'
              : current.status === 'TRIALING'
                ? 'Your free trial carries over and keeps its original end date — switching does not start a new one.'
                : 'Nothing is charged right now.'}
          </Text>
          {error ? (
            <View style={opsStyles.error}>
              <AlertCircleIcon size={16} color={colors.errorDark} />
              <Text style={opsStyles.errorText}>{error}</Text>
            </View>
          ) : null}
        </>
      ) : (
        <>
          <View accessibilityRole="tablist" style={styles.cycle}>
            {(['MONTHLY', 'YEARLY'] as const).map(c => {
              const on = cycle === c;
              return (
                <Pressable key={c} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setCycle(c)} style={[styles.cycleBtn, on && styles.cycleOn]}>
                  <Text style={[styles.cycleText, on && styles.cycleTextOn]}>{c === 'MONTHLY' ? 'Monthly' : 'Yearly'}</Text>
                </Pressable>
              );
            })}
          </View>
          {loading ? (
            <Text style={[opsStyles.muted, styles.center]}>Loading plans…</Text>
          ) : loadError || !plans.length ? (
            <View style={styles.warn}>
              <AwardIcon size={16} color={colors.warningDark} />
              <Text style={[styles.warnText, styles.flex]}>Plans are unavailable right now. Please try again shortly.</Text>
            </View>
          ) : (
            plans.map(plan => (
              <PlanCard
                key={plan.planCode}
                plan={plan}
                cycle={cycle}
                move={moveFor(plan, current, cycle)}
                onPick={() => {
                  setError('');
                  setPicked(plan);
                }}
              />
            ))
          )}
        </>
      )}
    </Sheet>
  );
}

function PlanCard({ plan, cycle, move, onPick }: { plan: CataloguePlan; cycle: BillingCycle; move: Move; onPick: () => void }) {
  const price = priceOn(plan, cycle);
  const trialDays = price?.trialDays ?? plan.trialDays;
  const actionable = move === 'upgrade' || move === 'downgrade' || move === 'cycle';
  return (
    <View style={[styles.plan, move === 'current' && styles.planCurrent, plan.isRecommended && move !== 'current' && styles.planPopular]}>
      <View style={styles.planHead}>
        <Text style={styles.planName}>{plan.planName}</Text>
        {move === 'current' ? (
          <View style={[styles.pill, styles.pillCurrent]}>
            <CheckCircleIcon size={11} color="#047857" />
            <Text style={[styles.pillText, styles.green]}>Current</Text>
          </View>
        ) : plan.isRecommended ? (
          <View style={[styles.pill, styles.pillPopular]}>
            <StarIcon size={11} color="#b45309" />
            <Text style={[styles.pillText, styles.amber]}>Most popular</Text>
          </View>
        ) : null}
      </View>
      {plan.targetSeller || plan.description ? <Text style={opsStyles.muted}>{plan.targetSeller ?? plan.description}</Text> : null}
      <Text style={styles.price}>
        {price
          ? `${money(price.amount as number, price.currency)}`
          : plan.pricingModel === 'CUSTOM'
            ? 'Priced to your requirements'
            : `Not sold ${cycle === 'YEARLY' ? 'yearly' : 'monthly'}`}
        {price ? <Text style={styles.per}>{` / ${cycleNoun(cycle)}`}</Text> : null}
      </Text>
      {price && trialDays > 0 ? <Text style={styles.trial}>{`${trialDays}-day free trial`}</Text> : null}
      {plan.highlights.length ? (
        <View style={styles.highlights}>
          {plan.highlights.slice(0, 4).map(h => (
            <View key={h} style={styles.highlight}>
              <CheckCircleIcon size={13} color={colors.success} />
              <Text style={[opsStyles.meta, styles.flex]}>{h}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {actionable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${MOVE_LABEL[move]} to ${plan.planName}`}
          onPress={onPick}
          style={[move === 'downgrade' ? opsStyles.smallBtn : opsStyles.primaryBtn, styles.action]}
        >
          {move === 'upgrade' ? <ArrowUpIcon size={14} color={colors.white} /> : move === 'downgrade' ? <ArrowDownIcon size={14} color={colors.text} /> : null}
          <Text style={move === 'downgrade' ? opsStyles.smallBtnText : opsStyles.primaryBtnText}>{MOVE_LABEL[move]}</Text>
        </Pressable>
      ) : (
        <Text style={styles.moveText}>{MOVE_LABEL[move]}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  green: { color: '#047857' },
  amber: { color: '#b45309' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { height: 52, paddingHorizontal: 18, justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  summary: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.background },
  kicker: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.8, color: colors.textMuted },
  summaryValue: { marginTop: 3, fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  cycle: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  cycleBtn: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  cycleOn: { backgroundColor: colors.white, ...shadow.card },
  cycleText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.textSecondary },
  cycleTextOn: { color: colors.text },
  warn: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: '#fffbeb' },
  warnText: { fontFamily: fonts.medium, fontSize: 13, color: colors.warningDark },
  plan: { gap: 6, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  planCurrent: { borderColor: '#a7f3d0', backgroundColor: '#f0fdf4' },
  planPopular: { borderColor: colors.secondary, borderWidth: 1.5 },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: { flex: 1, fontFamily: fonts.extrabold, fontSize: 16, color: colors.text },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillCurrent: { backgroundColor: '#d1fae5' },
  pillPopular: { backgroundColor: '#fef3c7' },
  pillText: { fontFamily: fonts.bold, fontSize: 10.5 },
  price: { marginTop: 2, fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, letterSpacing: -0.3 },
  per: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  trial: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.successDark },
  highlights: { gap: 5, marginTop: 4 },
  highlight: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  action: { alignSelf: 'stretch', justifyContent: 'center', marginTop: 6 },
  moveText: { marginTop: 4, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textMuted },
});
