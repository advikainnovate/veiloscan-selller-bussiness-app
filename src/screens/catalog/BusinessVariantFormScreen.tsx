import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { pickImages } from '../../lib/pick-image';
import { emptySku, skuFromRecord, skuPayload, skuProblem, type SkuForm } from '../../lib/catalog';
import { fileService, productSkuService, productsService } from '../../services/products-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Choices, Field, Input, SelectField } from '../../components/form/Fields';
import { FormFooter } from '../../components/form/FormFooter';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { opsStyles } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { AlertCircleIcon, ImageIcon, LayersIcon, PercentIcon, PlusIcon, SettingsIcon, TrashIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

const amount = (v: string) => v.replace(/[^\d.]/g, '');

/** Add or edit a business variant: a sellable SKU with its own price, as the panel's form. */
export function BusinessVariantFormScreen({ navigation, route }: ScreenProps<'BusinessVariantForm'>) {
  const { t: tr } = useTranslation();
  const id = route.params?.id;
  const { hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission('product-business-variants:manage');
  const products = useFetch(() => (allowed ? productsService.list() : Promise.resolve([])), [allowed]);
  const record = useFetch(() => (allowed && id ? productSkuService.get(id) : Promise.resolve(null)), [allowed, id]);
  const [form, setForm] = useState<SkuForm>(() => emptySku(route.params?.productId ?? ''));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const set = <K extends keyof SkuForm>(k: K, v: SkuForm[K]) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (record.data) setForm(skuFromRecord(record.data));
  }, [record.data]);

  const productOptions = useMemo(() => (products.data ?? []).map(p => ({ value: p.id, label: String(p.productName ?? p.id) })), [products.data]);
  const setAttr = (i: number, patch: Partial<SkuForm['attributes'][number]>) => set('attributes', form.attributes.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const setTier = (i: number, patch: Partial<SkuForm['tiers'][number]>) => set('tiers', form.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  async function pickImage() {
    try {
      const [file] = await pickImages({ multiple: false });
      if (!file) return;
      setUploading(true);
      const up = await fileService.upload(file, 'product-business-variants');
      setForm(f => ({ ...f, productImageFileId: String(up.id), productImageUrl: (up.url as string | undefined) ?? file.uri }));
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError('');
    const problem = skuProblem(form);
    if (problem) {
      setError(problem);
      return scroll.current?.scrollToEnd({ animated: true });
    }
    setSaving(true);
    try {
      if (id) await productSkuService.update(id, { ...skuPayload(form), status: Number(form.status) });
      else await productSkuService.create(skuPayload(form));
      toast(id ? tr('catalog.businessVariantUpdated') : tr('catalog.businessVariantCreated'));
      navigation.goBack();
    } catch (err) {
      setError(extractErrorMessage(err));
      scroll.current?.scrollToEnd({ animated: true });
    } finally {
      setSaving(false);
    }
  }

  const title = id ? tr('catalog.editBusinessVariant') : tr('catalog.addBusinessVariant');
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ComingSoon label={tr('common.businessVariants')} icon={LayersIcon} allowed={false} />
      </View>
    );
  }
  if (id && (record.loading || !record.data)) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        {record.error ? <ErrorState message={record.error} onRetry={record.reload} /> : <ListSkeleton rows={3} height={140} />}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={opsStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title={title} subtitle={tr('common.businessVariants')} onBack={navigation.goBack} />
      <ScrollView ref={scroll} contentContainerStyle={[opsStyles.content, styles.content]} keyboardShouldPersistTaps="handled">
        <Text style={opsStyles.meta}>{tr('catalog.defineASellableSkuWithIts')}</Text>

        <SectionCard icon={SettingsIcon} title={tr('common.basicInformation')}>
          <SelectField label={tr('common.product')} required value={form.productId} options={productOptions} onChange={v => set('productId', v)} placeholder={products.loading ? tr('common.loading') : tr('common.selectProduct')} />
          {id ? (
            <Field label={tr('common.status')}>
              <Choices
                options={[
                  { value: '1', label: tr('common.active') },
                  { value: '0', label: tr('common.inactive') },
                ]}
                value={form.status}
                onChange={v => set('status', v)}
              />
            </Field>
          ) : null}
          <Field label={tr('catalog.skuItemNumber')} required>
            <Input value={form.skuItemNumber} onChangeText={v => set('skuItemNumber', v)} placeholder="e.g. SKU-IP15-128-BLK" autoCapitalize="characters" maxLength={100} accessibilityLabel={tr('catalog.skuItemNumber')} />
          </Field>
          <Field label={tr('common.barcode')}>
            <Input value={form.barcode} onChangeText={v => set('barcode', v)} placeholder="e.g. 8901234567890" keyboardType="number-pad" maxLength={64} accessibilityLabel={tr('common.barcode')} />
          </Field>
        </SectionCard>

        <SectionCard icon={LayersIcon} title={tr('catalog.variantAttributes')} subtitle={tr('catalog.theVariantValuesThatMakeUp')}>
          {form.attributes.map((a, i) => (
            <View key={i} style={styles.row}>
              <View style={styles.flex}>
                <Input value={a.key} onChangeText={v => setAttr(i, { key: v })} placeholder={tr('catalog.attributeEGColor')} accessibilityLabel={tr('catalog.attributeI', { i: i + 1 })} />
              </View>
              <View style={styles.flex}>
                <Input value={a.value} onChangeText={v => setAttr(i, { value: v })} placeholder={tr('catalog.valueEGBlack')} accessibilityLabel={tr('catalog.attributeIValue', { i: i + 1 })} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tr('catalog.removeAttributeI', { i: i + 1 })}
                disabled={form.attributes.length === 1}
                hitSlop={6}
                onPress={() => set('attributes', form.attributes.filter((_, j) => j !== i))}
                style={form.attributes.length === 1 ? styles.disabled : null}
              >
                <TrashIcon size={17} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
          <Pressable accessibilityRole="button" onPress={() => set('attributes', [...form.attributes, { key: '', value: '' }])} style={styles.add}>
            <PlusIcon size={15} color={colors.secondary} />
            <Text style={styles.addText}>{tr('catalog.addAttribute')}</Text>
          </Pressable>
        </SectionCard>

        <SectionCard icon={PercentIcon} title={tr('catalog.pricing')}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field label={tr('catalog.sellingPrice')} required>
                <Input value={form.businessPrice} onChangeText={v => set('businessPrice', amount(v))} keyboardType="decimal-pad" placeholder="0.00" accessibilityLabel={tr('catalog.sellingPrice')} />
              </Field>
            </View>
            <View style={styles.flex}>
              <Field label="MRP">
                <Input value={form.mrp} onChangeText={v => set('mrp', amount(v))} keyboardType="decimal-pad" placeholder="0.00" accessibilityLabel="MRP" />
              </Field>
            </View>
          </View>
          <Field label={tr('catalog.costPrice')}>
            <Input value={form.costPrice} onChangeText={v => set('costPrice', amount(v))} keyboardType="decimal-pad" placeholder="0.00" accessibilityLabel={tr('catalog.costPrice')} />
          </Field>
          <Field label={tr('catalog.quantityPricing')}>
            <Choices
              options={[
                { value: 'FIXED', label: tr('catalog.fixedOnePrice') },
                { value: 'SLAB', label: tr('catalog.slabByQuantity') },
              ]}
              value={form.quantityPriceType}
              onChange={v => set('quantityPriceType', v as SkuForm['quantityPriceType'])}
            />
          </Field>
          {form.quantityPriceType === 'SLAB' ? (
            <View style={styles.tiers}>
              <Text style={opsStyles.muted}>{tr('catalog.aLowerPricePerUnitAs')}</Text>
              {form.tiers.map((t, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.tier}>{tr('catalog.tierI', { i: i + 1 })}</Text>
                  <View style={styles.flex}>
                    <Input value={t.lowerBound} onChangeText={v => setTier(i, { lowerBound: v.replace(/\D/g, '') })} keyboardType="number-pad" placeholder={tr('catalog.minQty')} accessibilityLabel={tr('catalog.tierIMinimumQuantity', { i: i + 1 })} />
                  </View>
                  <View style={styles.flex}>
                    <Input value={t.price} onChangeText={v => setTier(i, { price: amount(v) })} keyboardType="decimal-pad" placeholder={tr('common.price')} accessibilityLabel={tr('catalog.tierIPrice', { i: i + 1 })} />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </SectionCard>

        <SectionCard icon={ImageIcon} title={tr('catalog.skuImage')}>
          <View style={styles.row}>
            <View style={styles.image}>{form.productImageUrl ? <Image source={{ uri: form.productImageUrl }} style={styles.fill} /> : <ImageIcon size={22} color={colors.textMuted} />}</View>
            <View style={styles.imageActions}>
              <Pressable accessibilityRole="button" accessibilityLabel={tr('catalog.uploadSkuImage')} disabled={uploading} onPress={pickImage} style={opsStyles.smallBtn}>
                <Text style={opsStyles.smallBtnText}>{uploading ? tr('common.uploading') : form.productImageUrl ? tr('common.change') : tr('common.upload')}</Text>
              </Pressable>
              {form.productImageUrl ? (
                <Pressable accessibilityRole="button" accessibilityLabel={tr('catalog.removeImage')} onPress={() => setForm(f => ({ ...f, productImageFileId: '', productImageUrl: '' }))}>
                  <Text style={[opsStyles.smallBtnText, opsStyles.danger]}>{tr('common.remove')}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Text style={opsStyles.muted}>{tr('catalog.aBusinessVariantIsTheUnit')}</Text>
        </SectionCard>

        {error ? (
          <View style={opsStyles.error}>
            <AlertCircleIcon size={16} color={colors.errorDark} />
            <Text style={opsStyles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
      <FormFooter title={id ? tr('common.saveChanges') : tr('catalog.addBusinessVariant')} loading={saving} onSave={save} onCancel={navigation.goBack} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  fill: { width: '100%', height: '100%' },
  content: { gap: 12, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disabled: { opacity: 0.3 },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  addText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.secondary },
  tiers: { gap: 8 },
  tier: { width: 50, fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  image: { width: 88, height: 88, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  imageActions: { gap: 8 },
});
