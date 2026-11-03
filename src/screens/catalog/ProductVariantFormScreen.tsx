import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { productVariantService, variantDataService, variantMasterService } from '../../services/catalog-service';
import { productsService } from '../../services/products-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Choices, Field, Input, SelectField } from '../../components/form/Fields';
import { FormFooter } from '../../components/form/FormFooter';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { opsStyles } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { AlertCircleIcon, LayersIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

interface Form {
  productId: string;
  variantId: string;
  variantDataId: string;
  sequence: string;
  status: string;
}
const EMPTY: Form = { productId: '', variantId: '', variantDataId: '', sequence: '', status: '1' };

/** Map a product to one variant value (Product × Variant type × Value), as the panel's form. */
export function ProductVariantFormScreen({ navigation, route }: ScreenProps<'ProductVariantForm'>) {
  const id = route.params?.id;
  const { hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission('product-variants:manage');
  const products = useFetch(() => (allowed ? productsService.list() : Promise.resolve([])), [allowed]);
  const types = useFetch(() => (allowed ? variantMasterService.list() : Promise.resolve([])), [allowed]);
  const values = useFetch(() => (allowed ? variantDataService.list() : Promise.resolve([])), [allowed]);
  const record = useFetch(() => (allowed && id ? productVariantService.get(id) : Promise.resolve(null)), [allowed, id]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const r = record.data;
    if (!r) return;
    setForm({
      productId: String(r.productId ?? ''),
      variantId: String(r.variantId ?? ''),
      variantDataId: String(r.variantDataId ?? ''),
      sequence: r.sequence == null ? '' : String(r.sequence),
      status: r.status == null ? '1' : String(Number(r.status)),
    });
  }, [record.data]);

  const productOptions = useMemo(() => (products.data ?? []).map(p => ({ value: p.id, label: String(p.productName ?? p.id) })), [products.data]);
  const typeOptions = useMemo(() => (types.data ?? []).map(t => ({ value: t.id, label: String(t.variantTitle ?? t.id) })), [types.data]);
  // The values of the chosen variant type.
  const valueOptions = useMemo(
    () => (values.data ?? []).filter(v => !form.variantId || String(v.variantId) === form.variantId).map(v => ({ value: v.id, label: `${String(v.variantData ?? v.id)}${v.colorCode ? ` (${String(v.colorCode)})` : ''}` })),
    [values.data, form.variantId],
  );

  async function save() {
    setError('');
    const missing = [!form.productId && 'Product', !form.variantId && 'Variant type', !form.variantDataId && 'Variant value'].filter(Boolean);
    if (missing.length) return setError(`Please fill in: ${missing.join(', ')}`);
    if (form.sequence.trim() && !(Number.isInteger(Number(form.sequence)) && Number(form.sequence) >= 0)) return setError('The sequence is a whole number');
    setSaving(true);
    try {
      const payload = {
        productId: form.productId,
        variantId: form.variantId,
        variantDataId: form.variantDataId,
        ...(form.sequence.trim() ? { sequence: Number(form.sequence) } : {}),
        status: Number(form.status),
      };
      if (id) await productVariantService.update(id, payload);
      else await productVariantService.create(payload);
      toast(id ? 'Variant mapping updated' : 'Variant mapping added');
      navigation.goBack();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const title = id ? 'Edit Variant Mapping' : 'Add Variant Mapping';
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ComingSoon label="Product Variants" icon={LayersIcon} allowed={false} />
      </View>
    );
  }
  if (id && (record.loading || !record.data)) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        {record.error ? <ErrorState message={record.error} onRetry={record.reload} /> : <ListSkeleton rows={2} height={120} />}
      </View>
    );
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={title} subtitle="Product Variants" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={[opsStyles.content, styles.content]} keyboardShouldPersistTaps="handled">
        <Text style={opsStyles.meta}>Map products to their variant combinations.</Text>
        <SectionCard icon={LayersIcon} title="Variant mapping">
          <SelectField label="Product" required value={form.productId} options={productOptions} onChange={v => set('productId', v)} placeholder={products.loading ? 'Loading…' : 'Select product'} />
          <SelectField
            label="Variant type"
            required
            value={form.variantId}
            options={typeOptions}
            onChange={v => setForm(f => ({ ...f, variantId: v, variantDataId: v === f.variantId ? f.variantDataId : '' }))}
            placeholder={types.loading ? 'Loading…' : 'Select variant type'}
          />
          <SelectField
            label="Variant value"
            required
            value={form.variantDataId}
            options={valueOptions}
            onChange={v => set('variantDataId', v)}
            disabled={!form.variantId}
            placeholder={form.variantId ? 'Select value' : 'Choose the variant type first'}
            emptyText="This variant type has no values yet."
          />
          <Field label="Sequence">
            <Input value={form.sequence} onChangeText={v => set('sequence', v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} accessibilityLabel="Sequence" />
          </Field>
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
        </SectionCard>
        {error ? (
          <View style={opsStyles.error}>
            <AlertCircleIcon size={16} color={colors.errorDark} />
            <Text style={opsStyles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
      <FormFooter title={id ? 'Save Changes' : 'Add Mapping'} loading={saving} onSave={save} onCancel={navigation.goBack} />
    </View>
  );
}

const styles = StyleSheet.create({ content: { gap: 12, paddingBottom: 24 } });
