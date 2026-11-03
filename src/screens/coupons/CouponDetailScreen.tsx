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

const money = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : formatRupees(Number(v)));
const count = (v: unknown, none = '—') => (v === null || v === undefined || v === '' ? none : String(v));
const selection = (v: unknown) => (v === 'SELECTED' ? 'Selected' : v === 'ALL' ? 'All' : '—');

/** One coupon: its rules, eligibility and validity; activate, edit or delete. */
export function CouponDetailScreen({ navigation, route }: ScreenProps<'CouponDetail'>) {
  const { id } = route.params;
  const { hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission('coupons-master:manage');
  const { data: coupon, error, loading, refreshing, reload } = useFetch(() => (allowed ? couponService.get(id) : Promise.resolve(null)), [id, allowed]);
  const [busy, setBusy] = useState<'toggle' | 'delete' | null>(null);

  if (!allowed) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Coupon" onBack={navigation.goBack} />
        <ComingSoon label="Coupons" icon={TicketIcon} allowed={false} />
      </View>
    );
  }
  if (loading || !coupon) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Coupon" onBack={navigation.goBack} />
        {loading ? (
          <View style={styles.content}>
            <ListSkeleton rows={3} height={140} />
          </View>
        ) : (
          <ErrorState message={error ?? 'Not found.'} onRetry={() => reload()} />
        )}
      </View>
    );
  }

  const active = isActiveCoupon(coupon);

  function toggle() {
    NativeAlert.alert(`${active ? 'Deactivate' : 'Activate'} "${coupon!.title}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: active ? 'Deactivate' : 'Activate',
        onPress: async () => {
          setBusy('toggle');
          try {
            await couponService.update(id, { status: active ? 0 : 1 });
            toast(active ? 'Coupon deactivated' : 'Coupon activated');
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
    NativeAlert.alert('Delete coupon?', 'It will be removed from this list. Deactivate it instead if you only want to take it out of use.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          try {
            await couponService.remove(id);
            toast('Coupon deleted');
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
      <AppHeader title={coupon.title} subtitle={`Code: ${coupon.couponCode}`} onBack={navigation.goBack} />
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
            <Badge label={active ? 'Active' : 'Inactive'} tone={active ? 'green' : 'slate'} />
            {isExpiredCoupon(coupon) ? <Badge label="Expired" tone="amber" /> : null}
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
            <Text style={styles.actionText}>{busy === 'toggle' ? 'Saving…' : active ? 'Deactivate' : 'Activate'}</Text>
          </Pressable>
          <Button
            title="Edit"
            onPress={() => navigation.navigate('CouponForm', { id })}
            icon={<EditIcon size={16} color={colors.white} />}
            style={styles.flex}
          />
        </View>

        <Card title="Details" icon={TicketIcon}>
          <Row label="Slug" value={coupon.codeSlug} />
          <Row label="Discount Type" value={coupon.discountType === 'PERCENTAGE' ? 'Percentage' : coupon.discountType === 'FLAT' ? 'Flat' : '—'} />
          <Row label="Discount Value" value={count(coupon.discountValue)} />
          <Row label="Created" value={formatDay(coupon.createdAt)} />
          <Row label="Updated" value={formatDay(coupon.updatedAt)} />
        </Card>

        <Card title="Order Rules & Usage Limits" icon={TicketIcon}>
          <Row label="Min Order Value" value={money(coupon.minOrderValue)} />
          <Row label="Max Order Value" value={money(coupon.maxOrderValue)} />
          <Row label="Max Discount Amount" value={money(coupon.maxDiscountAmount)} />
          <Row label="Total Usage Limit" value={coupon.usageLimitTotal ? String(coupon.usageLimitTotal) : 'Unlimited'} />
          <Row label="Usage Limit Per User" value={count(coupon.usageLimitPerUser)} />
          <Row label="Initial Coupon Count" value={count(coupon.initialCoupon)} />
        </Card>

        <Card title="Eligibility & Validity" icon={TicketIcon}>
          <Row label="Categories" value={selection(coupon.categoriesSelection)} />
          <Row label="Brands" value={selection(coupon.brandsSelection)} />
          <Row label="Products" value={selection(coupon.productSelection)} />
          <Row label="Start Date" value={coupon.startDate ? formatDay(coupon.startDate) : '—'} />
          <Row label="End Date" value={coupon.endDate ? formatDay(coupon.endDate) : 'No end date'} />
        </Card>

        {coupon.description || coupon.termsAndConditions ? (
          <Card title="Description & Terms" icon={FileTextIcon}>
            {coupon.description ? <Text style={styles.body}>{coupon.description}</Text> : null}
            {coupon.termsAndConditions ? <Text style={[styles.body, styles.terms]}>{coupon.termsAndConditions}</Text> : null}
          </Card>
        ) : null}

        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={remove} hitSlop={8} style={styles.delete}>
          <Text style={styles.deleteText}>{busy === 'delete' ? 'Deleting…' : 'Delete coupon'}</Text>
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
