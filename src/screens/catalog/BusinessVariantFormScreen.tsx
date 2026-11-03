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

const amount = (v: string) => v.replace(/[^\d.]/g, '');

/** Add or edit a business variant: a sellable SKU with its own price, as the panel's form. */
export function BusinessVariantFormScreen({ navigation, route }: ScreenProps<'BusinessVariantForm'>) {
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
      toast(id ? 'Business variant updated' : 'Business variant created');
      navigation.goBack();
    } catch (err) {
      setError(extractErrorMessage(err));
      scroll.current?.scrollToEnd({ animated: true });
    } finally {
      setSaving(false);
    }
  }

  const title = id ? 'Edit Business Variant' : 'Add Business Variant';
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ComingSoon label="Business Variants" icon={LayersIcon} allowed={false} />
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
      <AppHeader title={title} subtitle="Business Variants" onBack={navigation.goBack} />
      <ScrollView ref={scroll} contentContainerStyle={[opsStyles.content, styles.content]} keyboardShouldPersistTaps="handled">
        <Text style={opsStyles.meta}>Define a sellable SKU with its own price for a product.</Text>

        <SectionCard icon={SettingsIcon} title="Basic Information">
          <SelectField label="Product" required value={form.productId} options={productOptions} onChange={v => set('productId', v)} placeholder={products.loading ? 'Loading…' : 'Select product'} />
          {id ? (
            <Field label="Status">
              <Choices
                options={[
                  { value: '1', label: 'Active' },
                  { value: '0', label: 'Inactive' },
                ]}
                value={form.status}
                onChange={v => set('status', v)}
              />
            </Field>
          ) : null}
          <Field label="SKU Item Number" required>
            <Input value={form.skuItemNumber} onChangeText={v => set('skuItemNumber', v)} placeholder="e.g. SKU-IP15-128-BLK" autoCapitalize="characters" maxLength={100} accessibilityLabel="SKU Item Number" />
          </Field>
          <Field label="Barcode">
            <Input value={form.barcode} onChangeText={v => set('barcode', v)} placeholder="e.g. 8901234567890" keyboardType="number-pad" maxLength={64} accessibilityLabel="Barcode" />
          </Field>
        </SectionCard>

        <SectionCard icon={LayersIcon} title="Variant Attributes" subtitle="The variant values that make up this SKU, e.g. Color: Black, Storage: 128GB.">
          {form.attributes.map((a, i) => (
            <View key={i} style={styles.row}>
              <View style={styles.flex}>
                <Input value={a.key} onChangeText={v => setAttr(i, { key: v })} placeholder="Attribute (e.g. Color)" accessibilityLabel={`Attribute ${i + 1}`} />
              </View>
              <View style={styles.flex}>
                <Input value={a.value} onChangeText={v => setAttr(i, { value: v })} placeholder="Value (e.g. Black)" accessibilityLabel={`Attribute ${i + 1} value`} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove attribute ${i + 1}`}
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
            <Text style={styles.addText}>Add Attribute</Text>
          </Pressable>
        </SectionCard>

        <SectionCard icon={PercentIcon} title="Pricing">
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field label="Selling Price" required>
                <Input value={form.businessPrice} onChangeText={v => set('businessPrice', amount(v))} keyboardType="decimal-pad" placeholder="0.00" accessibilityLabel="Selling Price" />
              </Field>
            </View>
            <View style={styles.flex}>
              <Field label="MRP">
                <Input value={form.mrp} onChangeText={v => set('mrp', amount(v))} keyboardType="decimal-pad" placeholder="0.00" accessibilityLabel="MRP" />
              </Field>
            </View>
          </View>
          <Field label="Cost Price">
            <Input value={form.costPrice} onChangeText={v => set('costPrice', amount(v))} keyboardType="decimal-pad" placeholder="0.00" accessibilityLabel="Cost Price" />
          </Field>
          <Field label="Quantity Pricing">
            <Choices
              options={[
                { value: 'FIXED', label: 'Fixed (one price)' },
                { value: 'SLAB', label: 'Slab (by quantity)' },
              ]}
              value={form.quantityPriceType}
              onChange={v => set('quantityPriceType', v as SkuForm['quantityPriceType'])}
            />
          </Field>
          {form.quantityPriceType === 'SLAB' ? (
            <View style={styles.tiers}>
              <Text style={opsStyles.muted}>A lower price per unit as the order quantity increases — up to 5 tiers.</Text>
              {form.tiers.map((t, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.tier}>{`Tier ${i + 1}`}</Text>
                  <View style={styles.flex}>
                    <Input value={t.lowerBound} onChangeText={v => setTier(i, { lowerBound: v.replace(/\D/g, '') })} keyboardType="number-pad" placeholder="Min qty" accessibilityLabel={`Tier ${i + 1} minimum quantity`} />
                  </View>
                  <View style={styles.flex}>
                    <Input value={t.price} onChangeText={v => setTier(i, { price: amount(v) })} keyboardType="decimal-pad" placeholder="Price" accessibilityLabel={`Tier ${i + 1} price`} />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </SectionCard>

        <SectionCard icon={ImageIcon} title="SKU Image">
          <View style={styles.row}>
            <View style={styles.image}>{form.productImageUrl ? <Image source={{ uri: form.productImageUrl }} style={styles.fill} /> : <ImageIcon size={22} color={colors.textMuted} />}</View>
            <View style={styles.imageActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Upload SKU image" disabled={uploading} onPress={pickImage} style={opsStyles.smallBtn}>
                <Text style={opsStyles.smallBtnText}>{uploading ? 'Uploading…' : form.productImageUrl ? 'Change' : 'Upload'}</Text>
              </Pressable>
              {form.productImageUrl ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Remove image" onPress={() => setForm(f => ({ ...f, productImageFileId: '', productImageUrl: '' }))}>
                  <Text style={[opsStyles.smallBtnText, opsStyles.danger]}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Text style={opsStyles.muted}>A business variant is the unit customers actually buy; its attributes say which variant combination it is (e.g. Color: Red, Size: L).</Text>
        </SectionCard>

        {error ? (
          <View style={opsStyles.error}>
            <AlertCircleIcon size={16} color={colors.errorDark} />
            <Text style={opsStyles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
      <FormFooter title={id ? 'Save Changes' : 'Add Business Variant'} loading={saving} onSave={save} onCancel={navigation.goBack} />
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
