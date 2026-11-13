import React, { useState } from 'react';
import { Alert as NativeAlert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatDay } from '../../lib/date';
import { formatRupees } from '../../lib/format';
import { formatDiscount, isActiveCoupon, isExpiredCoupon } from '../../lib/coupons';
import { couponService } from '../../services/coupon-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, Row } from '../../components/ui/Card';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { BanIcon, CheckCircleIcon, EditIcon, FileTextIcon, TicketIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const money = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : formatRupees(Number(v)));
const count = (v: unknown, none = '—') => (v === null || v === undefined || v === '' ? none : String(v));
const selection = (v: unknown) => (v === 'SELECTED' ? i18n.t('common.selected') : v === 'ALL' ? i18n.t('common.all') : '—');

/** One coupon: its rules, eligibility and validity; activate, edit or delete. */
export function CouponDetailScreen({ navigation, route }: ScreenProps<'CouponDetail'>) {
  const { t } = useTranslation();
  const { id } = route.params;
  const { hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission('coupons-master:manage');
  const { data: coupon, error, loading, refreshing, reload } = useFetch(() => (allowed ? couponService.get(id) : Promise.resolve(null)), [id, allowed]);
  const [busy, setBusy] = useState<'toggle' | 'delete' | null>(null);

  if (!allowed) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('common.coupon')} onBack={navigation.goBack} />
        <ComingSoon label={t('coupons.coupons')} icon={TicketIcon} allowed={false} />
      </View>
    );
  }
  if (loading || !coupon) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('common.coupon')} onBack={navigation.goBack} />
        {loading ? (
          <View style={styles.content}>
            <ListSkeleton rows={3} height={140} />
          </View>
        ) : (
          <ErrorState message={error ?? t('common.notFound')} onRetry={() => reload()} />
        )}
      </View>
    );
  }

  const active = isActiveCoupon(coupon);

  function toggle() {
    NativeAlert.alert(`${active ? 'Deactivate' : 'Activate'} "${coupon!.title}"?`, undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: active ? t('common.deactivate') : t('common.activate'),
        onPress: async () => {
          setBusy('toggle');
          try {
            await couponService.update(id, { status: active ? 0 : 1 });
            toast(active ? t('coupons.couponDeactivated') : t('coupons.couponActivated'));
            reload();
          } catch (err) {
            toast(extractErrorMessage(err), 'error');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  function remove() {
    NativeAlert.alert(t('coupons.deleteCoupon'), t('coupons.itWillBeRemovedFromThis'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          try {
            await couponService.remove(id);
            toast(t('coupons.couponDeleted'));
            navigation.goBack();
          } catch (err) {
            toast(extractErrorMessage(err), 'error');
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <AppHeader title={coupon.title} subtitle={t('coupons.codeCouponcode', { couponCode: coupon.couponCode })} onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      >
        <View style={styles.hero}>
          <Text style={styles.heroDiscount}>{formatDiscount(coupon)}</Text>
          <View style={styles.code}>
            <Text style={styles.codeText}>{coupon.couponCode}</Text>
          </View>
          <View style={styles.badges}>
            <Badge label={active ? t('common.active') : t('common.inactive')} tone={active ? 'green' : 'slate'} />
            {isExpiredCoupon(coupon) ? <Badge label={t('common.expired')} tone="amber" /> : null}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={busy !== null}
            onPress={toggle}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            {active ? <BanIcon size={16} color={colors.text} /> : <CheckCircleIcon size={16} color={colors.text} />}
            <Text style={styles.actionText}>{busy === 'toggle' ? t('common.saving') : active ? t('common.deactivate') : t('common.activate')}</Text>
          </Pressable>
          <Button
            title={t('common.edit')}
            onPress={() => navigation.navigate('CouponForm', { id })}
            icon={<EditIcon size={16} color={colors.white} />}
            style={styles.flex}
          />
        </View>

        <Card title={t('common.details')} icon={TicketIcon}>
          <Row label={t('common.slug')} value={coupon.codeSlug} />
          <Row label={t('common.discountType')} value={coupon.discountType === 'PERCENTAGE' ? 'Percentage' : coupon.discountType === 'FLAT' ? 'Flat' : '—'} />
          <Row label={t('common.discountValue')} value={count(coupon.discountValue)} />
          <Row label={t('common.created')} value={formatDay(coupon.createdAt)} />
          <Row label={t('common.updated')} value={formatDay(coupon.updatedAt)} />
        </Card>

        <Card title={t('coupons.orderRulesAndUsageLimits')} icon={TicketIcon}>
          <Row label={t('coupons.minOrderValue2')} value={money(coupon.minOrderValue)} />
          <Row label={t('coupons.maxOrderValue2')} value={money(coupon.maxOrderValue)} />
          <Row label={t('coupons.maxDiscountAmount2')} value={money(coupon.maxDiscountAmount)} />
          <Row label={t('coupons.totalUsageLimit2')} value={coupon.usageLimitTotal ? String(coupon.usageLimitTotal) : 'Unlimited'} />
          <Row label={t('coupons.usageLimitPerUser2')} value={count(coupon.usageLimitPerUser)} />
          <Row label={t('coupons.initialCouponCount')} value={count(coupon.initialCoupon)} />
        </Card>

        <Card title={t('coupons.eligibilityAndValidity')} icon={TicketIcon}>
          <Row label={t('common.categories')} value={selection(coupon.categoriesSelection)} />
          <Row label={t('common.brands')} value={selection(coupon.brandsSelection)} />
          <Row label={t('common.products')} value={selection(coupon.productSelection)} />
          <Row label={t('common.startDate')} value={coupon.startDate ? formatDay(coupon.startDate) : '—'} />
          <Row label={t('common.endDate')} value={coupon.endDate ? formatDay(coupon.endDate) : 'No end date'} />
        </Card>

        {coupon.description || coupon.termsAndConditions ? (
          <Card title={t('common.descriptionAndTerms')} icon={FileTextIcon}>
            {coupon.description ? <Text style={styles.body}>{coupon.description}</Text> : null}
            {coupon.termsAndConditions ? <Text style={[styles.body, styles.terms]}>{coupon.termsAndConditions}</Text> : null}
          </Card>
        ) : null}

        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={remove} hitSlop={8} style={styles.delete}>
          <Text style={styles.deleteText}>{busy === 'delete' ? t('common.deleting') : t('coupons.deleteCoupon2')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 18, borderRadius: radius.lg, backgroundColor: colors.secondaryLight },
  heroDiscount: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.secondaryDark },
  code: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.secondary, backgroundColor: colors.white },
  codeText: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: 1, color: colors.text },
  badges: { flexDirection: 'row', gap: 6 },
  actions: { flexDirection: 'row', gap: 10 },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionPressed: { backgroundColor: colors.background },
  actionText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary },
  terms: { marginTop: 10, color: colors.textMuted },
  delete: { alignSelf: 'flex-start', paddingVertical: 4 },
  deleteText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.error },
});
