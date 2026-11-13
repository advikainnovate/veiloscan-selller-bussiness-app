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
import { useTranslation } from 'react-i18next';

/**
 * Change plan, as the panel's dialog: pick monthly or yearly, then a plan,
 * then confirm. A seller on the free fallback plan starts a trial instead.
 * The backend refuses a downgrade the account can't fit into and names
 * what's over; that message is shown as sent.
 */
export function ChangePlanSheet({ visible, current, onClose, onChanged }: { visible: boolean; current: CurrentPlan; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
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
      toast(t('subscription.youReNowOnPlanname', { planName: result.planName }));
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
      title={picked ? t('subscription.confirmYourNewPlan') : current.isDefault ? t('subscription.chooseAPlan') : t('subscription.changeYourPlan')}
      subtitle={
        picked ? undefined : current.isDefault ? t('subscription.pickThePlanThatFitsYour') : t('subscription.youAreOnPlannamePickAnother', { planName: current.planName })
      }
      onClose={close}
      footer={
        picked ? (
          <View style={styles.footer}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => setPicked(null)} style={styles.back}>
              <Text style={opsStyles.smallBtnText}>{t('common.back')}</Text>
            </Pressable>
            <View style={styles.flex}>
              <Button title={move === 'downgrade' ? t('subscription.downgradeToPlanname', { planName: picked.planName }) : t('subscription.confirmPlanname', { planName: picked.planName })} loading={saving} onPress={confirm} />
            </View>
          </View>
        ) : undefined
      }
    >
      {picked ? (
        <>
          <View style={styles.summary}>
            {[
              [t('subscription.fromLabel'), current.planName],
              [t('subscription.toLabel'), picked.planName],
              [t('subscription.newPrice'), price ? `${money(price.amount as number, price.currency)} / ${cycleNoun(cycle)}` : '—'],
            ].map(([k, v]) => (
              <View key={k} style={styles.flex}>
                <Text style={styles.kicker}>{k}</Text>
                <Text style={styles.summaryValue}>{v}</Text>
              </View>
            ))}
          </View>
          <Text style={opsStyles.meta}>
            {move === 'downgrade'
              ? t('subscription.youWillKeepFewerFeaturesAnd')
              : t('subscription.theChangeTakesEffectImmediatelyYour')}
          </Text>
          <Text style={opsStyles.muted}>
            {current.isDefault
              ? price && price.trialDays > 0
                ? t('subscription.yourTrialdaysDayFreeTrialStarts', { trialDays: price.trialDays })
                : t('subscription.noCardIsTakenAndNothing')
              : current.status === 'TRIALING'
                ? t('subscription.yourFreeTrialCarriesOverAnd')
                : t('subscription.nothingIsChargedRightNow')}
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
                  <Text style={[styles.cycleText, on && styles.cycleTextOn]}>{c === 'MONTHLY' ? t('common.monthly') : t('common.yearly')}</Text>
                </Pressable>
              );
            })}
          </View>
          {loading ? (
            <Text style={[opsStyles.muted, styles.center]}>{t('subscription.loadingPlans')}</Text>
          ) : loadError || !plans.length ? (
            <View style={styles.warn}>
              <AwardIcon size={16} color={colors.warningDark} />
              <Text style={[styles.warnText, styles.flex]}>{t('subscription.plansAreUnavailableRightNowPlease')}</Text>
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
  const { t } = useTranslation();
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
            <Text style={[styles.pillText, styles.green]}>{t('common.current')}</Text>
          </View>
        ) : plan.isRecommended ? (
          <View style={[styles.pill, styles.pillPopular]}>
            <StarIcon size={11} color="#b45309" />
            <Text style={[styles.pillText, styles.amber]}>{t('subscription.mostPopular')}</Text>
          </View>
        ) : null}
      </View>
      {plan.targetSeller || plan.description ? <Text style={opsStyles.muted}>{plan.targetSeller ?? plan.description}</Text> : null}
      <Text style={styles.price}>
        {price
          ? `${money(price.amount as number, price.currency)}`
          : plan.pricingModel === 'CUSTOM'
            ? t('subscription.pricedToYourRequirements')
            : cycle === 'YEARLY' ? t('subscription.notSoldYearly') : t('subscription.notSoldMonthly')}
        {price ? <Text style={styles.per}>{` / ${cycleNoun(cycle)}`}</Text> : null}
      </Text>
      {price && trialDays > 0 ? <Text style={styles.trial}>{t('subscription.trialdaysDayFreeTrial', { trialDays })}</Text> : null}
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
          accessibilityLabel={t('subscription.moveLabelToPlanname', { MOVE_LABEL: MOVE_LABEL[move], planName: plan.planName })}
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
