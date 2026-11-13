import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../lib/api';
import {
  couponPayload,
  couponToForm,
  DISCOUNT_TYPES,
  EMPTY_COUPON,
  SELECTION_OPTIONS,
  slugify,
  validateCoupon,
  type CouponFormValues,
} from '../../lib/coupons';
import { couponService } from '../../services/coupon-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Button } from '../../components/ui/Button';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { Choices, DateField, Field, Input, Section } from '../../components/form/Fields';
import { AlertCircleIcon, TicketIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

const fromISO = (s: string) => (s ? new Date(`${s}T00:00:00`) : undefined);

/** Create or edit a coupon (the Seller Panel's coupon form). */
export function CouponFormScreen({ navigation, route }: ScreenProps<'CouponForm'>) {
  const { t } = useTranslation();
  const id = route.params?.id;
  const isEdit = !!id;
  const { hasPermission } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const allowed = hasPermission('coupons-master:manage');

  const [values, setValues] = useState<CouponFormValues>(EMPTY_COUPON);
  const [loading, setLoading] = useState(isEdit && allowed);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Errors show once a save was tried, then update as fields are fixed.
  const [tried, setTried] = useState(false);
  // The slug follows the title until it's typed by hand.
  const slugTouched = useRef(isEdit);
  const scrollRef = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    if (!isEdit || !allowed || !id) return;
    couponService
      .get(id)
      .then(c => setValues(couponToForm(c)))
      .catch(err => setLoadError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [isEdit, id, allowed]);

  const errors = tried ? validateCoupon(values) : {};
  const update = <K extends keyof CouponFormValues>(field: K, value: CouponFormValues[K]) =>
    setValues(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'title' && !slugTouched.current ? { codeSlug: slugify(String(value)) } : {}),
    }));

  async function submit() {
    setTried(true);
    setError('');
    const problems = validateCoupon(values);
    if (Object.keys(problems).length) {
      setError(t('coupons.fixTheHighlightedFields'));
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setSaving(true);
    try {
      if (isEdit && id) {
        await couponService.update(id, couponPayload(values, true));
        toast(t('coupons.couponUpdated'));
      } else {
        await couponService.create(couponPayload(values, false));
        toast(t('coupons.couponCreated'));
      }
      navigation.goBack();
    } catch (err) {
      setError(extractErrorMessage(err));
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSaving(false);
    }
  }

  const heading = isEdit ? t('coupons.editCoupon') : t('coupons.createCoupon');

  if (!allowed) {
    return (
      <View style={styles.screen}>
        <AppHeader title={heading} onBack={navigation.goBack} />
        <ComingSoon label={t('coupons.coupons')} icon={TicketIcon} allowed={false} />
      </View>
    );
  }
  if (loading || loadError) {
    return (
      <View style={styles.screen}>
        <AppHeader title={heading} onBack={navigation.goBack} />
        {loading ? (
          <View style={styles.content}>
            <ListSkeleton rows={3} height={160} />
          </View>
        ) : (
          <ErrorState message={loadError} onRetry={() => navigation.replace('CouponForm', { id })} />
        )}
      </View>
    );
  }

  const percent = values.discountType === 'PERCENTAGE';

  return (
    <View style={styles.screen}>
      <AppHeader title={heading} subtitle={t('coupons.configureADiscountCouponCodeAnd')} onBack={navigation.goBack} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? (
            <View style={styles.error}>
              <AlertCircleIcon size={16} color={colors.errorDark} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Section title={t('common.basicInformation')} subtitle={t('coupons.titleCodeAndHowTheDiscount')}>
            <Field label={t('common.title')} required error={errors.title}>
              <Input value={values.title} onChangeText={v => update('title', v)} maxLength={255} placeholder="e.g. Diwali Sale" />
            </Field>
            <Field label={t('common.slug')} required hint={t('coupons.urlFriendlyIdentifier')} error={errors.codeSlug}>
              <Input
                value={values.codeSlug}
                onChangeText={v => {
                  slugTouched.current = true;
                  update('codeSlug', v);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={255}
              />
            </Field>
            <Field label={t('coupons.couponCode')} required hint="e.g. SUMMER20" error={errors.couponCode}>
              <Input value={values.couponCode} onChangeText={v => update('couponCode', v)} autoCapitalize="characters" autoCorrect={false} maxLength={100} />
            </Field>
            <Field label={t('common.discountType')}>
              <Choices options={DISCOUNT_TYPES} value={values.discountType} onChange={v => update('discountType', v)} />
            </Field>
            <Field label={t('common.discountValue')} required hint={percent ? t('coupons.percentOffUpTo100') : t('coupons.rupeesOffTheOrder')} error={errors.discountValue}>
              <Input value={values.discountValue} onChangeText={v => update('discountValue', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" />
            </Field>
            {isEdit ? (
              <Field label={t('common.status')}>
                <Choices
                  options={[
                    { value: '1', label: t('common.active') },
                    { value: '0', label: t('common.inactive') },
                  ]}
                  value={values.status}
                  onChange={v => update('status', v)}
                />
              </Field>
            ) : null}
          </Section>

          <View style={styles.tip}>
            <Text style={styles.tipTitle}>{t('coupons.tip')}</Text>
            <Text style={styles.tipText}>
              {t('coupons.useAPercentageDiscountWithA')}</Text>
          </View>

          <Section title={t('coupons.orderRulesAndUsageLimits')} subtitle={t('coupons.restrictWhenAndHowOftenThis')}>
            <MoneyField label={t('coupons.minOrderValue2')} value={values.minOrderValue} error={errors.minOrderValue} onChange={v => update('minOrderValue', v)} />
            <MoneyField label={t('coupons.maxOrderValue2')} value={values.maxOrderValue} error={errors.maxOrderValue} onChange={v => update('maxOrderValue', v)} />
            <MoneyField
              label={t('coupons.maxDiscountAmount2')}
              value={values.maxDiscountAmount}
              error={errors.maxDiscountAmount}
              onChange={v => update('maxDiscountAmount', v)}
            />
            <Field label={t('coupons.totalUsageLimit2')} hint={t('coupons.leaveEmptyForUnlimited')} error={errors.usageLimitTotal}>
              <Input value={values.usageLimitTotal} onChangeText={v => update('usageLimitTotal', v.replace(/\D/g, ''))} keyboardType="number-pad" />
            </Field>
            <Field label={t('coupons.usageLimitPerUser2')} error={errors.usageLimitPerUser}>
              <Input value={values.usageLimitPerUser} onChangeText={v => update('usageLimitPerUser', v.replace(/\D/g, ''))} keyboardType="number-pad" />
            </Field>
          </Section>

          <Section title={t('coupons.eligibilityAndValidity')} subtitle={t('coupons.whichCatalogItemsQualifyAndWhen')}>
            <Field label={t('common.categories')}>
              <Choices options={SELECTION_OPTIONS} value={values.categoriesSelection} onChange={v => update('categoriesSelection', v)} />
            </Field>
            <Field label={t('common.brands')}>
              <Choices options={SELECTION_OPTIONS} value={values.brandsSelection} onChange={v => update('brandsSelection', v)} />
            </Field>
            <Field label={t('common.products')}>
              <Choices options={SELECTION_OPTIONS} value={values.productSelection} onChange={v => update('productSelection', v)} />
            </Field>
            <DateField label={t('common.startDate')} value={values.startDate} onChange={v => update('startDate', v)} />
            <DateField label={t('common.endDate')} value={values.endDate} onChange={v => update('endDate', v)} minimumDate={fromISO(values.startDate)} />
            {errors.endDate ? <Text style={styles.fieldError}>{errors.endDate}</Text> : null}
          </Section>

          <Section title={t('common.descriptionAndTerms')}>
            <Field label={t('common.description')}>
              <Input value={values.description} onChangeText={v => update('description', v)} multiline />
            </Field>
            <Field label={t('common.termsAndConditions')}>
              <Input value={values.termsAndConditions} onChangeText={v => update('termsAndConditions', v)} multiline />
            </Field>
          </Section>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Button title={t('common.cancel')} variant="ghost" onPress={navigation.goBack} style={styles.flex} />
          <Button title={isEdit ? t('common.saveChanges') : t('coupons.createCoupon')} onPress={submit} loading={saving} style={styles.flex2} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function MoneyField({ label, value, error, onChange }: { label: string; value: string; error?: string; onChange: (v: string) => void }) {
  return (
    <Field label={label} error={error}>
      <Input value={value} onChangeText={v => onChange(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="₹" />
    </Field>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 2 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 24, gap: 14 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, backgroundColor: colors.errorLight },
  errorText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.errorDark },
  fieldError: { marginTop: -6, fontFamily: fonts.medium, fontSize: 12, color: colors.error },
  tip: { padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: '#e0e7ff', backgroundColor: '#eef2ff' },
  tipTitle: { fontFamily: fonts.bold, fontSize: 13, color: '#4338ca' },
  tipText: { marginTop: 4, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: '#4f46e5' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
