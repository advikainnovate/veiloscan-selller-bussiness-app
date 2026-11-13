import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { EMPTY_SPEC_VALUE, specValues, type SpecValueRow } from '../../lib/catalog';
import { productSpecificationService, productSpecificationValueService } from '../../services/catalog-service';
import { productBuilderService } from '../../services/product-builder-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Choices, Field, Input, SelectField } from '../../components/form/Fields';
import { FormFooter } from '../../components/form/FormFooter';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { Detail, opsStyles } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { AlertCircleIcon, PlusIcon, SettingsIcon, SlidersIcon, TrashIcon } from '../../components/icons';
import { useSpecLookups } from './ProductSpecsScreen';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

/**
 * Assign a specification and its values to a product, as the panel's form.
 * Only specifications mapped to the product's category (or a parent) are
 * offered — the API rejects any other.
 */
export function ProductSpecFormScreen({ navigation, route }: ScreenProps<'ProductSpecForm'>) {
  const { t } = useTranslation();
  const id = route.params?.id;
  const { hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission('product-specifications:manage');
  const look = useSpecLookups(allowed);
  const assignments = useFetch(() => (allowed ? productSpecificationService.list().catch(() => []) : Promise.resolve([])), [allowed]);
  const record = useFetch(() => (allowed && id ? productSpecificationService.get(id) : Promise.resolve(null)), [allowed, id]);
  const [productId, setProductId] = useState(route.params?.productId ?? '');
  const [specificationId, setSpecificationId] = useState('');
  const [status, setStatus] = useState('1');
  const [rows, setRows] = useState<SpecValueRow[]>([{ ...EMPTY_SPEC_VALUE }]);
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  // Edit: the assignment, then its values once they've loaded.
  useEffect(() => {
    const r = record.data;
    if (!r || seeded || !look.valuesLoaded) return;
    setProductId(String(r.productId ?? ''));
    setSpecificationId(String(r.specificationId ?? ''));
    setStatus(r.status == null ? '1' : String(Number(r.status)));
    const existing = specValues(r, look.values).map(v => ({
      id: v.id === 'legacy' ? undefined : String(v.id),
      specsDataId: String(v.specsDataId ?? ''),
      specificationValue: String(v.specificationValue ?? ''),
      sequence: v.sequence == null ? '' : String(v.sequence),
    }));
    setRows(existing.length ? existing : [{ ...EMPTY_SPEC_VALUE }]);
    setOriginalIds(existing.map(e => e.id).filter((x): x is string => !!x));
    setSeeded(true);
  }, [record.data, look.values, look.valuesLoaded, seeded]);

  const categoryId = String(look.products.find(p => p.id === productId)?.categoryId ?? '');
  const config = useFetch(() => (categoryId ? productBuilderService.configuration(categoryId).catch(() => null) : Promise.resolve(null)), [categoryId]);
  const mapped = useMemo(() => new Set((config.data?.specifications ?? []).map(s => s.id)), [config.data]);
  const taken = useMemo(() => new Set((assignments.data ?? []).filter(a => a.productId === productId && a.id !== id).map(a => String(a.specificationId))), [assignments.data, productId, id]);
  const specOptions = useMemo(
    () => look.specs.filter(s => s.id === specificationId || (mapped.has(s.id) && !taken.has(s.id))).map(s => ({ value: s.id, label: String(s.specificationTitle ?? s.id) })),
    [look.specs, specificationId, mapped, taken],
  );
  const spec = look.spec(specificationId);
  const isSelect = spec?.type === 'SELECT';
  const valueOptions = useMemo(() => look.options.filter(o => o.specificationId === specificationId).map(o => ({ value: o.id, label: String(o.optionTitle ?? o.id) })), [look.options, specificationId]);
  const hint = !productId
    ? t('catalog.selectAProductFirst')
    : config.loading
      ? t('catalog.loadingTheSpecificationsOfThisProducts')
      : !mapped.size
        ? t('catalog.noSpecificationsMappedTo', { category: config.data?.category.title ?? t('catalog.thisProductsCategory') })
        : t('catalog.specificationsOfThisProductsCategoryNot');
  const setRow = (i: number, patch: Partial<SpecValueRow>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    setError('');
    const fail = (m: string) => {
      setError(m);
      scroll.current?.scrollToEnd({ animated: true });
    };
    const missing = [!productId && t('common.product'), !specificationId && t('catalog.specification')].filter(Boolean);
    if (missing.length) return fail(t('common.pleaseFillInJoin', { join: missing.join(', ') }));
    const filled = rows.filter(r => (isSelect ? r.specsDataId : r.specificationValue.trim()));
    if (!filled.length) return fail(t('catalog.addAtLeastOneValueFor'));
    setSaving(true);
    try {
      let parentId = id ?? '';
      if (id) await productSpecificationService.update(id, { productId, specificationId, status: Number(status) });
      else parentId = (await productSpecificationService.create({ productId, specificationId })).id;
      const kept = new Set<string>();
      for (const [i, r] of rows.entries()) {
        if (!(isSelect ? r.specsDataId : r.specificationValue.trim())) continue;
        const payload: Record<string, unknown> = { productSpecificationId: parentId, sequence: r.sequence !== '' ? Number(r.sequence) : i + 1 };
        if (isSelect) payload.specsDataId = r.specsDataId || undefined;
        else payload.specificationValue = r.specificationValue.trim() || undefined;
        if (r.id) {
          await productSpecificationValueService.update(r.id, payload);
          kept.add(r.id);
        } else {
          kept.add((await productSpecificationValueService.create(payload)).id);
        }
      }
      await Promise.all(originalIds.filter(o => !kept.has(o)).map(o => productSpecificationValueService.remove(o)));
      toast(id ? t('catalog.productSpecificationUpdated') : t('catalog.productSpecificationAdded'));
      navigation.goBack();
    } catch (err) {
      fail(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const title = id ? t('catalog.editProductSpecification') : t('catalog.addProductSpecification');
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ComingSoon label={t('common.productSpecs')} icon={SlidersIcon} allowed={false} />
      </View>
    );
  }
  if (id && !seeded) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        {record.error ? <ErrorState message={record.error} onRetry={record.reload} /> : <ListSkeleton rows={2} height={140} />}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={opsStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title={title} subtitle={t('common.productSpecs')} onBack={navigation.goBack} />
      <ScrollView ref={scroll} contentContainerStyle={[opsStyles.content, styles.content]} keyboardShouldPersistTaps="handled">
        <Text style={opsStyles.meta}>{t('catalog.assignASpecificationAndItsValues')}</Text>
        <SectionCard icon={SettingsIcon} title={t('common.basicInformation')}>
          <SelectField
            label={t('common.product')}
            required
            hint={t('catalog.selectTheProductThisSpecificationApplies')}
            value={productId}
            options={look.products.map(p => ({ value: p.id, label: String(p.productName ?? p.id) }))}
            onChange={v => {
              // Another product can have another category, so the pick starts over.
              if (v !== productId) setSpecificationId('');
              setProductId(v);
            }}
          />
          <SelectField label={t('catalog.specification')} required hint={hint} value={specificationId} options={specOptions} onChange={setSpecificationId} disabled={!productId} emptyText={hint} />
          {id ? (
            <Field label={t('common.status')}>
              <Choices
                options={[
                  { value: '1', label: t('common.active') },
                  { value: '0', label: t('common.inactive') },
                ]}
                value={status}
                onChange={setStatus}
              />
            </Field>
          ) : null}
          {spec ? (
            <View style={styles.preview}>
              <Detail label={t('common.type')} value={String(spec.type ?? '')} />
              <Detail label={t('common.required')} value={spec.isRequired ? 'Yes' : 'No'} />
            </View>
          ) : null}
        </SectionCard>

        <SectionCard icon={SlidersIcon} title={t('catalog.values')} subtitle={t('catalog.mostSpecificationsNeedJustOneAdd')}>
          {rows.map((r, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.num}>{i + 1}</Text>
              <View style={styles.flex}>
                {isSelect ? (
                  <SelectField label={t('catalog.valueI', { i: i + 1 })} value={r.specsDataId} options={valueOptions} onChange={v => setRow(i, { specsDataId: v })} placeholder={t('catalog.selectValue')} />
                ) : (
                  <Input value={r.specificationValue} onChangeText={v => setRow(i, { specificationValue: v })} placeholder="e.g. 128GB" editable={!!specificationId} maxLength={500} accessibilityLabel={t('catalog.valueI', { i: i + 1 })} />
                )}
              </View>
              <View style={styles.seq}>
                <Input value={r.sequence} onChangeText={v => setRow(i, { sequence: v.replace(/\D/g, '') })} placeholder={String(i + 1)} keyboardType="number-pad" maxLength={4} accessibilityLabel={t('catalog.valueISequence', { i: i + 1 })} />
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t('catalog.removeValueI', { i: i + 1 })} disabled={rows.length === 1} hitSlop={6} onPress={() => setRows(rs => rs.filter((_, j) => j !== i))} style={rows.length === 1 ? styles.disabled : null}>
                <TrashIcon size={17} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
          <Pressable accessibilityRole="button" onPress={() => setRows(rs => [...rs, { ...EMPTY_SPEC_VALUE }])} style={styles.add}>
            <PlusIcon size={15} color={colors.secondary} />
            <Text style={styles.addText}>{t('catalog.addValue')}</Text>
          </Pressable>
        </SectionCard>

        {error ? (
          <View style={opsStyles.error}>
            <AlertCircleIcon size={16} color={colors.errorDark} />
            <Text style={opsStyles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
      <FormFooter title={id ? t('common.saveChanges') : t('catalog.addSpecification')} loading={saving} onSave={save} onCancel={navigation.goBack} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  content: { gap: 12, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  num: { width: 22, height: 22, borderRadius: 6, overflow: 'hidden', textAlign: 'center', lineHeight: 22, fontFamily: fonts.bold, fontSize: 11.5, color: '#4338ca', backgroundColor: '#eef2ff' },
  seq: { width: 64 },
  disabled: { opacity: 0.3 },
  preview: { gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.background },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  addText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.secondary },
});
