import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../lib/api';
import { dateTime } from '../../lib/operations';
import {
  addSlab,
  AUDIT_LABEL,
  auditSummary,
  dateOf,
  joinDateTime,
  newSlab,
  preferredUnit,
  schemeInput,
  schemeProblem,
  slabPreview,
  slabRowsFrom,
  STATE_BADGE,
  TARGET_LABEL,
  timeOf,
  type SchemeForm,
  type SlabRow,
} from '../../lib/quantity-slabs';
import {
  quantityDiscountService,
  type DiscountAggregationMode,
  type SchemeDetail,
  type SchemeProduct,
  type SchemeProductOptions,
  type SchemeSku,
} from '../../services/quantity-discount-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { Choices, DateField, Field, Input, SelectField, TimeField } from '../../components/form/Fields';
import { ErrorState, FilterChips, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { opsStyles } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { AlertCircleIcon, BoxIcon, CheckIcon, ClockIcon, LayersIcon, PercentIcon, PlusIcon, SearchIcon, SettingsIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

const SEARCH_DELAY_MS = 250;
const MAX_SLABS = 20;

const now = new Date();
const INITIAL: SchemeForm = {
  schemeName: '',
  productId: '',
  storeId: '',
  targetType: 'ALL_VARIANTS',
  aggregationMode: 'PER_VARIANT',
  variantIds: [],
  stackWithCoupons: false,
  startDate: dateOf(now),
  startTime: timeOf(now),
  endDate: '',
  endTime: '',
  status: 'ACTIVE',
  unit: '',
  slabs: [],
};

/**
 * Create or edit a quantity discount scheme, as the panel's form: the
 * product, which of its SKUs it covers, how quantity is counted, the slabs
 * and when it runs. The server checks again (ownership, overlaps with other
 * schemes, units) and explains what to change.
 */
export function QuantitySlabFormScreen({ navigation, route }: ScreenProps<'QuantitySlabForm'>) {
  const { t } = useTranslation();
  const id = route.params?.id;
  const { hasPermission } = useAuth();
  const { stores } = useStore();
  const toast = useToast();
  const allowed = hasPermission('quantity-discounts:manage');
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);

  const [form, setForm] = useState<SchemeForm>(() => ({ ...INITIAL, slabs: [newSlab()] }));
  const [detail, setDetail] = useState<SchemeDetail | null>(null);
  const [product, setProduct] = useState<SchemeProduct | null>(null);
  const [options, setOptions] = useState<SchemeProductOptions | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const set = <K extends keyof SchemeForm>(k: K, v: SchemeForm[K]) => setForm(f => ({ ...f, [k]: v }));

  // Edit: the scheme, then its product's SKUs and units.
  useEffect(() => {
    if (!id || !allowed) return;
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    quantityDiscountService
      .get(id)
      .then(async d => {
        const opts = await quantityDiscountService.productOptions(d.productId);
        if (cancelled) return;
        const starts = new Date(d.startsAt);
        const ends = d.endsAt ? new Date(d.endsAt) : null;
        setDetail(d);
        setOptions(opts);
        setProduct({ id: d.productId, name: d.productName ?? opts.name, skuCount: opts.skus.length, sku: opts.skus[0]?.sku ?? null });
        setForm({
          schemeName: d.schemeName,
          productId: d.productId,
          storeId: d.storeId ?? '',
          targetType: d.targetType,
          aggregationMode: d.aggregationMode,
          variantIds: d.variantIds,
          stackWithCoupons: d.stackWithCoupons,
          startDate: dateOf(starts),
          startTime: timeOf(starts),
          endDate: ends ? dateOf(ends) : '',
          endTime: ends ? timeOf(ends) : '',
          status: d.status,
          unit: d.slabs[0]?.quantityUnit ?? opts.units[0]?.code ?? '',
          slabs: d.slabs.length ? slabRowsFrom(d.slabs) : [newSlab()],
        });
      })
      .catch(err => !cancelled && setLoadError(extractErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, allowed, reloadKey]);

  async function pickProduct(p: SchemeProduct) {
    setPicking(false);
    setProduct(p);
    setOptions(null);
    setError('');
    try {
      const opts = await quantityDiscountService.productOptions(p.id);
      setOptions(opts);
      setForm(f => ({
        ...f,
        productId: p.id,
        targetType: opts.simple ? 'SIMPLE_PRODUCT' : 'ALL_VARIANTS',
        aggregationMode: 'PER_VARIANT',
        variantIds: [],
        unit: preferredUnit(opts.units),
        schemeName: f.schemeName.trim() ? f.schemeName : t('pricing.bulkDiscountName', { name: p.name }).slice(0, 150),
      }));
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  const unitInfo = options?.units.find(u => u.code === form.unit);
  const whole = unitInfo?.whole ?? true;
  const hasVariants = options ? !options.simple : true;
  // Picked SKUs deleted since are still listed, so they can be unticked.
  const allSkus = useMemo(() => {
    const extra = (detail?.variants ?? []).filter(v => v.deleted && !(options?.skus ?? []).some(s => s.id === v.id));
    return [...(options?.skus ?? []), ...extra];
  }, [options, detail]);
  const preview = slabPreview(form.slabs, form.unit);
  const updateSlab = (key: number, patch: Partial<SlabRow>) => set('slabs', form.slabs.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const storeName = form.storeId ? stores.find(s => s.id === form.storeId)?.name ?? t('pricing.oneStore') : t('pricing.allStores');

  async function submit() {
    setError('');
    const problem = schemeProblem(form, whole);
    if (problem) {
      setError(problem);
      return scroll.current?.scrollToEnd({ animated: true });
    }
    const body = schemeInput(form);
    setSaving(true);
    try {
      if (id) {
        const { productId: _productId, ...changes } = body;
        await quantityDiscountService.update(id, changes);
      } else {
        await quantityDiscountService.create(body);
      }
      toast(id ? t('pricing.quantityDiscountSaved') : t('pricing.quantityDiscountCreated'));
      navigation.goBack();
    } catch (err) {
      setError(extractErrorMessage(err));
      scroll.current?.scrollToEnd({ animated: true });
    } finally {
      setSaving(false);
    }
  }

  const title = id ? t('pricing.editDiscountScheme') : t('pricing.createDiscountScheme');
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ComingSoon label={t('common.quantityDiscountSlabs')} icon={PercentIcon} allowed={false} />
      </View>
    );
  }
  if (loading) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ListSkeleton rows={3} height={160} />
      </View>
    );
  }
  if (loadError) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ErrorState message={loadError} onRetry={() => setReloadKey(k => k + 1)} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={opsStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title={id && form.schemeName ? form.schemeName : title} subtitle={t('common.quantityDiscountSlabs')} onBack={navigation.goBack} />
      <ScrollView ref={scroll} contentContainerStyle={[opsStyles.content, styles.content]} keyboardShouldPersistTaps="handled">
        <Text style={opsStyles.meta}>{t('pricing.setTheQuantitiesThatEarnA')}</Text>
        {detail ? (
          <View style={opsStyles.row}>
            <Text style={styles.idd}>{detail.idd}</Text>
            <Badge label={STATE_BADGE[detail.state].label} tone={STATE_BADGE[detail.state].tone} />
          </View>
        ) : null}

        {/* 1 · Basic information */}
        <SectionCard icon={SettingsIcon} title={t('pricing.n1BasicInformation')} subtitle={t('pricing.whatTheSchemeIsCalledIts')}>
          <Field label={t('pricing.schemeName')} required>
            <Input value={form.schemeName} onChangeText={v => set('schemeName', v)} maxLength={150} accessibilityLabel={t('pricing.schemeName')} />
          </Field>
          <Field label={t('common.product')} required>
            {id ? (
              <View style={styles.fixed}>
                <Text style={[opsStyles.title, styles.flex]} numberOfLines={1}>
                  {product?.name}
                </Text>
                <Text style={opsStyles.muted}>{t('pricing.skuSkuCanTBeChanged', { sku: product?.sku ?? '—' })}</Text>
              </View>
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel={t('pricing.productNamed', { name: product?.name ?? t('pricing.notChosen') })} onPress={() => setPicking(true)} style={styles.picker}>
                <SearchIcon size={16} color={colors.textMuted} />
                <Text style={[styles.flex, product ? opsStyles.title : opsStyles.muted]} numberOfLines={1}>
                  {product?.name ?? t('pricing.searchByProductNameSkuOr')}
                </Text>
              </Pressable>
            )}
          </Field>
          {product ? <Text style={[opsStyles.muted, styles.tight]}>{`${t('inventory.skuCode', { sku: product.sku ?? '—' })}${product.skuCount > 1 ? ` + ${t('pricing.countMore', { count: product.skuCount - 1 })}` : ''}`}</Text> : null}
          <SelectField
            label={t('common.store')}
            hint={t('pricing.whereTheDiscountApplies')}
            value={form.storeId}
            options={stores.map(s => ({ value: s.id, label: s.name }))}
            onChange={v => set('storeId', v)}
            allowClear={t('pricing.allStoresThatSellIt')}
            placeholder={t('pricing.allStoresThatSellIt')}
          />
          <Field label={t('common.status')}>
            <Choices
              options={[
                { value: 'ACTIVE', label: t('common.active') },
                { value: 'INACTIVE', label: t('common.inactive') },
              ]}
              value={form.status}
              onChange={v => set('status', v as SchemeForm['status'])}
            />
          </Field>
          <View style={styles.row}>
            <View style={styles.flex}>
              <DateField label={t('pricing.starts')} required value={form.startDate} onChange={v => set('startDate', v)} />
            </View>
            <TimeField label={t('pricing.startTime')} value={form.startTime} onChange={v => set('startTime', v)} />
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>
              <DateField label={t('pricing.endsOptional')} hint={t('pricing.leaveEmptyToRunUntilYou')} value={form.endDate} onChange={v => set('endDate', v)} minimumDate={joinDateTime(form.startDate, '') ?? undefined} />
            </View>
            {form.endDate ? <TimeField label={t('pricing.endTime')} value={form.endTime || '23:59'} onChange={v => set('endTime', v)} /> : null}
          </View>
        </SectionCard>

        {/* 2 · Applies to */}
        <SectionCard icon={LayersIcon} title={t('pricing.n2DiscountAppliesTo')} subtitle={t('pricing.whichSkusOfTheProductGet')}>
          {!options ? (
            <Text style={[opsStyles.muted, styles.center]}>{product ? t('pricing.loadingTheProductsVariants') : t('pricing.chooseAProductFirst')}</Text>
          ) : (
            <>
              <ChoiceCard active={form.targetType === 'ALL_VARIANTS'} disabled={!hasVariants} title={TARGET_LABEL.ALL_VARIANTS} hint={t('pricing.everyActiveVariantIncludingOnesYou')} onPress={() => set('targetType', 'ALL_VARIANTS')} />
              <ChoiceCard active={form.targetType === 'SPECIFIC_VARIANTS'} disabled={!hasVariants} title={TARGET_LABEL.SPECIFIC_VARIANTS} hint={t('pricing.onlyTheVariantsYouTickNew')} onPress={() => set('targetType', 'SPECIFIC_VARIANTS')} />
              <ChoiceCard active={form.targetType === 'SIMPLE_PRODUCT'} disabled={hasVariants} title={TARGET_LABEL.SIMPLE_PRODUCT} hint={t('pricing.forAProductSoldAsOne')} onPress={() => set('targetType', 'SIMPLE_PRODUCT')} />
              {form.targetType === 'SPECIFIC_VARIANTS' ? <VariantPanel skus={allSkus} selected={form.variantIds} onChange={v => set('variantIds', v)} /> : null}
              {form.targetType !== 'SIMPLE_PRODUCT' ? (
                <>
                  <Text style={styles.label}>{t('pricing.howQuantityIsCounted')}</Text>
                  <ChoiceCard
                    active={form.aggregationMode === 'PER_VARIANT'}
                    title={t('pricing.eachVariantOnItsOwn')}
                    hint={t('pricing.n6OfSizeMAnd4')}
                    onPress={() => set('aggregationMode', 'PER_VARIANT' as DiscountAggregationMode)}
                  />
                  <ChoiceCard
                    active={form.aggregationMode === 'COMBINED_PRODUCT'}
                    title={t('pricing.allCoveredVariantsTogether')}
                    hint={t('pricing.n6OfSizeM4Of')}
                    onPress={() => set('aggregationMode', 'COMBINED_PRODUCT' as DiscountAggregationMode)}
                  />
                </>
              ) : null}
            </>
          )}
        </SectionCard>

        {/* 3 · Slabs */}
        <SectionCard icon={PercentIcon} title={t('pricing.n3QuantityDiscountSlabs')} subtitle={t('pricing.eachSlabIsAQuantityBand')}>
          <SelectField label={t('pricing.quantityUnit')} value={form.unit} options={(options?.units ?? []).map(u => ({ value: u.code, label: `${u.code} · ${u.name}` }))} onChange={v => set('unit', v)} disabled={!options} />
          <Text style={[opsStyles.muted, styles.tight]}>{whole ? t('pricing.countedInWhole', { unit: form.unit || t('pricing.unitsLower') }) : t('pricing.decimalsAllowedEG15', { unit: form.unit })}</Text>
          {form.slabs.map((s, i) => (
            <View key={s.key} style={styles.slab}>
              <View style={opsStyles.rowBetween}>
                <View style={opsStyles.row}>
                  <View style={styles.slabNum}>
                    <Text style={styles.slabNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.label}>{t('pricing.slabI2', { i: i + 1 })}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('pricing.removeSlabI', { i: i + 1 })}
                  disabled={form.slabs.length === 1}
                  onPress={() => set('slabs', form.slabs.filter(r => r.key !== s.key))}
                  hitSlop={6}
                >
                  <Text style={[opsStyles.smallBtnText, form.slabs.length === 1 ? opsStyles.muted : opsStyles.danger]}>{t('common.remove')}</Text>
                </Pressable>
              </View>
              <Text style={styles.sub}>{t('pricing.quantityInUnit', { unit: form.unit || t('pricing.unitsLower') })}</Text>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Input value={s.min} onChangeText={v => updateSlab(s.key, { min: v.replace(/[^\d.]/g, '') })} placeholder={t('common.from')} keyboardType={whole ? 'number-pad' : 'decimal-pad'} accessibilityLabel={t('pricing.slabIMinimum', { i: i + 1 })} />
                </View>
                <Text style={opsStyles.muted}>{t('common.to2')}</Text>
                <View style={styles.flex}>
                  <Input
                    value={s.max}
                    onChangeText={v => updateSlab(s.key, { max: v.replace(/[^\d.]/g, '') })}
                    placeholder={i === form.slabs.length - 1 ? t('common.noLimit') : t('common.required')}
                    keyboardType={whole ? 'number-pad' : 'decimal-pad'}
                    accessibilityLabel={t('pricing.slabIMaximum', { i: i + 1 })}
                  />
                </View>
              </View>
              <Text style={styles.sub}>{t('common.discount')}</Text>
              <View style={styles.row}>
                <View style={styles.toggle}>
                  {(
                    [
                      ['PERCENTAGE', '%'],
                      ['FLAT', '₹'],
                    ] as const
                  ).map(([value, label]) => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: s.type === value }}
                      accessibilityLabel={t(value === 'PERCENTAGE' ? 'pricing.slabPercentage' : 'pricing.slabFlatAmount', { number: i + 1 })}
                      onPress={() => updateSlab(s.key, { type: value })}
                      style={[styles.toggleBtn, s.type === value && styles.toggleOn]}
                    >
                      <Text style={[styles.toggleText, s.type === value && styles.toggleTextOn]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.flex}>
                  <Input
                    value={s.value}
                    onChangeText={v => updateSlab(s.key, { value: v.replace(/[^\d.]/g, '') })}
                    placeholder={s.type === 'PERCENTAGE' ? 'e.g. 5' : 'e.g. 20'}
                    keyboardType="decimal-pad"
                    accessibilityLabel={t('pricing.slabIValue', { i: i + 1 })}
                  />
                </View>
              </View>
              {s.type === 'FLAT' ? (
                <Choices
                  options={[
                    { value: 'PER_UNIT', label: t('pricing.perUnit', { unit: form.unit || t('pricing.unitLower') }) },
                    { value: 'PER_ORDER', label: t('pricing.perOrder') },
                  ]}
                  value={s.method}
                  onChange={v => updateSlab(s.key, { method: v as SlabRow['method'] })}
                />
              ) : null}
            </View>
          ))}
          <Pressable accessibilityRole="button" disabled={form.slabs.length >= MAX_SLABS} onPress={() => set('slabs', addSlab(form.slabs, whole))} style={styles.addSlab}>
            <PlusIcon size={15} color={colors.textSecondary} />
            <Text style={styles.addSlabText}>{t('pricing.addSlab')}</Text>
          </Pressable>
        </SectionCard>

        {/* What customers will see */}
        <View style={styles.preview}>
          <View style={opsStyles.row}>
            <View style={styles.previewIcon}>
              <PercentIcon size={15} color={colors.white} />
            </View>
            <View style={styles.flex}>
              <Text style={opsStyles.title}>{t('pricing.customersWillSee')}</Text>
              <Text style={opsStyles.meta}>{product?.name ?? t('pricing.chooseAProduct')}</Text>
            </View>
          </View>
          {preview.length ? (
            preview.map((p, i) => (
              <View key={p.key} style={styles.previewRow}>
                <View style={styles.flex}>
                  <Text style={styles.buy}>{t('pricing.buy')}</Text>
                  <Text style={opsStyles.title}>{p.range}</Text>
                </View>
                <Text style={[styles.off, i === preview.length - 1 && styles.offTop]}>{p.discount}</Text>
              </View>
            ))
          ) : (
            <Text style={[opsStyles.muted, styles.center]}>{t('pricing.fillInASlabToSee')}</Text>
          )}
          <Text style={opsStyles.meta}>
            {`${form.targetType === 'SIMPLE_PRODUCT' || form.aggregationMode === 'PER_VARIANT' ? t('pricing.eachVariantOwnQuantity') : t('pricing.coveredVariantsAddedUp')} ${t('pricing.flatAmountSharedHint')}`}
          </Text>
        </View>

        <View style={styles.coupons}>
          <View style={styles.flex}>
            <Text style={opsStyles.title}>{t('pricing.allowCouponsOnTheseItems')}</Text>
            <Text style={opsStyles.meta}>{t('pricing.offACouponAppliesOnlyTo')}</Text>
          </View>
          <Switch
            accessibilityLabel={t('pricing.allowCouponsOnTheseItems')}
            value={form.stackWithCoupons}
            onValueChange={v => set('stackWithCoupons', v)}
            trackColor={{ true: colors.secondary, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>

        {detail?.audit.length ? (
          <SectionCard icon={ClockIcon} title={t('common.history')}>
            {detail.audit.map((a, i) => (
              <View key={a.id} style={styles.event}>
                <View style={[styles.dot, i === 0 && styles.dotOn]} />
                <View style={styles.flex}>
                  <Text style={opsStyles.title}>{AUDIT_LABEL[a.action] ?? a.action}</Text>
                  {auditSummary(a, allSkus) ? <Text style={opsStyles.meta}>{auditSummary(a, allSkus)}</Text> : null}
                  <Text style={opsStyles.muted}>{`${dateTime(a.createdAt)}${a.actorName ? ` · ${a.actorName}` : ''}`}</Text>
                </View>
              </View>
            ))}
            <Text style={opsStyles.muted}>{t('pricing.ordersAlreadyPlacedKeepTheDiscount')}</Text>
          </SectionCard>
        ) : null}

        {error ? (
          <View style={opsStyles.error} accessibilityLiveRegion="polite">
            <AlertCircleIcon size={16} color={colors.errorDark} />
            <Text style={opsStyles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Always in reach: what's being saved, Cancel and Save. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <Text style={styles.footerSummary} numberOfLines={1}>
          {preview.length ? [t('pricing.slabCount', { count: preview.length }), form.status === 'ACTIVE' ? t('pricing.activeLower') : t('pricing.inactiveLower'), storeName].join(' · ') : t('pricing.addAtLeastOneSlab')}
        </Text>
        <View style={styles.footerRow}>
          <Pressable accessibilityRole="button" onPress={navigation.goBack} disabled={saving} style={styles.cancel}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
          <View style={styles.flex}>
            <Button title={id ? t('common.saveChanges') : t('pricing.createScheme')} loading={saving} disabled={!options} onPress={submit} />
          </View>
        </View>
      </View>

      <ProductPickerSheet visible={picking} onClose={() => setPicking(false)} onPick={pickProduct} />
    </KeyboardAvoidingView>
  );
}

function ChoiceCard({ active, disabled, title, hint, onPress }: { active: boolean; disabled?: boolean; title: string; hint: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, active && styles.choiceOn, disabled && styles.disabled]}
    >
      <View style={[styles.radio, active && styles.radioOn]}>{active ? <View style={styles.radioDot} /> : null}</View>
      <View style={styles.flex}>
        <Text style={[opsStyles.title, active && styles.accent]}>{title}</Text>
        <Text style={opsStyles.meta}>{hint}</Text>
      </View>
    </Pressable>
  );
}

/** A product search for the seller's products (create only). */
function ProductPickerSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (p: SchemeProduct) => void }) {
  const { t } = useTranslation();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SchemeProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      quantityDiscountService
        .products(term)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, SEARCH_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [term, visible]);

  return (
    <Sheet visible={visible} title={t('pricing.chooseAProduct')} onClose={onClose}>
      <SearchBar value={term} onChange={setTerm} placeholder={t('pricing.searchByProductNameSkuOr')} />
      {loading && !results.length ? <ActivityIndicator color={colors.secondary} style={styles.spinner} /> : null}
      {!loading && !results.length ? <Text style={[opsStyles.muted, styles.center]}>{t('common.noProductsFound')}</Text> : null}
      {results.map(p => (
        <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={t('pricing.pickName', { name: p.name })} onPress={() => onPick(p)} style={styles.result}>
          <BoxIcon size={18} color={colors.textMuted} />
          <View style={styles.flex}>
            <Text style={opsStyles.title} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={opsStyles.muted}>{p.skuCount > 1 ? t('pricing.skucountVariants', { skuCount: p.skuCount }) : t('pricing.singleSkuSku', { sku: p.sku ?? '' })}</Text>
          </View>
        </Pressable>
      ))}
    </Sheet>
  );
}

/** The product's SKUs, to tick some for a Specific Variants scheme. */
function VariantPanel({ skus, selected, onChange }: { skus: SchemeSku[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'' | 'active' | 'inactive' | 'selected'>('');
  const picked = new Set(selected);
  const q = search.trim().toLowerCase();
  const listed = skus.filter(s => {
    if (filter === 'active' && !s.active) return false;
    if (filter === 'inactive' && s.active) return false;
    if (filter === 'selected' && !picked.has(s.id)) return false;
    return !q || `${s.label} ${s.sku}`.toLowerCase().includes(q);
  });
  const toggle = (id: string) => onChange(picked.has(id) ? selected.filter(x => x !== id) : [...selected, id]);
  return (
    <View style={styles.variants}>
      <SearchBar value={search} onChange={setSearch} placeholder={t('pricing.searchVariantsOrSku')} />
      <FilterChips
        options={[
          { value: '', label: t('pricing.allVariants') },
          { value: 'selected', label: t('common.selected') },
          { value: 'active', label: t('common.active') },
          { value: 'inactive', label: t('common.inactive') },
        ]}
        value={filter}
        onChange={v => setFilter(v as typeof filter)}
      />
      <View style={opsStyles.rowBetween}>
        <View style={opsStyles.row}>
          <Pressable accessibilityRole="button" onPress={() => onChange([...new Set([...selected, ...listed.filter(s => !s.deleted).map(s => s.id)])])}>
            <Text style={styles.link}>{t('pricing.selectAllListed')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onChange(selected.filter(id => !listed.some(s => s.id === id)))}>
            <Text style={styles.linkMuted}>{t('pricing.clearListed')}</Text>
          </Pressable>
        </View>
        <Text style={opsStyles.meta}>{t('pricing.selectedcountOfCountcountSelected', { selectedCount: selected.length, countCount: skus.filter(s => !s.deleted).length })}</Text>
      </View>
      {listed.length ? (
        listed.map(s => {
          const on = picked.has(s.id);
          return (
            <Pressable
              key={s.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: s.deleted && !on }}
              accessibilityLabel={t('pricing.selectLabel', { label: s.label })}
              disabled={s.deleted && !on}
              onPress={() => toggle(s.id)}
              style={[styles.sku, on && styles.skuOn]}
            >
              <View style={[styles.box, on && styles.boxOn]}>{on ? <CheckIcon size={12} color={colors.white} strokeWidth={3} /> : null}</View>
              <View style={styles.flex}>
                <Text style={opsStyles.title} numberOfLines={1}>
                  {s.label}
                </Text>
                <Text style={opsStyles.muted} numberOfLines={1}>
                  {[s.sku, ...Object.entries(s.attributes).map(([k, v]) => `${k}: ${v}`)].join(' · ')}
                </Text>
                <Text style={[styles.skuStatus, s.deleted ? opsStyles.danger : s.active ? opsStyles.success : styles.amber]}>
                  {s.deleted ? t('common.deleted') : s.active ? t('common.active') : t('pricing.inactiveNoDiscountUntilActive')}
                </Text>
              </View>
              <Text style={opsStyles.amount}>{`₹${s.price.toLocaleString('en-IN')}`}</Text>
            </Pressable>
          );
        })
      ) : (
        <Text style={[opsStyles.muted, styles.center]}>{t('pricing.noVariantsMatch')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  center: { textAlign: 'center' },
  tight: { marginTop: -8 },
  accent: { color: colors.secondaryDark },
  amber: { color: colors.warningDark },
  idd: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: colors.border, fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  label: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 0.5, color: colors.textSecondary },
  sub: { marginBottom: -4, fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textSecondary },
  fixed: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  picker: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  choice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  choiceOn: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  disabled: { opacity: 0.4 },
  radio: { width: 18, height: 18, marginTop: 2, borderRadius: 9, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.secondary },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondary },
  slab: { gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  slabNum: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryLight },
  slabNumText: { fontFamily: fonts.bold, fontSize: 11, color: colors.secondaryDark },
  toggle: { flexDirection: 'row', padding: 3, borderRadius: radius.md, backgroundColor: colors.background },
  toggleBtn: { width: 40, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.surface },
  toggleText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textMuted },
  toggleTextOn: { color: colors.secondary },
  addSlab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  addSlabText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  preview: { gap: 10, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: '#fed7aa', backgroundColor: '#fff7ed' },
  previewIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: '#ffedd5', backgroundColor: colors.surface },
  buy: { fontFamily: fonts.semibold, fontSize: 10.5, letterSpacing: 0.5, color: colors.textMuted },
  off: { overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, fontFamily: fonts.bold, fontSize: 13, color: '#047857', backgroundColor: '#ecfdf5' },
  offTop: { color: colors.white, backgroundColor: colors.secondary },
  coupons: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  event: { flexDirection: 'row', gap: 10 },
  dot: { width: 10, height: 10, marginTop: 5, borderRadius: 5, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.secondary },
  content: { gap: 12, paddingBottom: 24 },
  footer: { gap: 8, paddingHorizontal: 16, paddingTop: 10, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, ...shadow.raised },
  footerSummary: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancel: { height: 52, paddingHorizontal: 18, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  cancelText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  spinner: { marginVertical: 16 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  variants: { gap: 10, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  link: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.secondary },
  linkMuted: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  sku: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  skuOn: { borderColor: colors.secondarySoft, backgroundColor: colors.secondaryLight },
  skuStatus: { fontFamily: fonts.medium, fontSize: 11.5 },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  boxOn: { borderColor: colors.secondary, backgroundColor: colors.secondary },
});
