import React, { useEffect, useImperativeHandle, useMemo, useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../../theme';
import { extractErrorMessage } from '../../../lib/api';
import { isOptionSpecificationType, isStructuredSpecificationType } from '../../../lib/specification-types';
import {
  productBuilderService,
  type ConfiguredSpecification,
  type ProductConfiguration,
  type ProductVariant,
  type SpecificationInput,
  type SpecificationValue,
} from '../../../services/product-builder-service';
import { Alert } from '../../../components/ui/Alert';
import { Choices, DateField, Field, Input, Section, SelectField } from '../../../components/form/Fields';
import { SwitchRow } from '../../../components/products/ProductEditors';
import type { StepHandle } from './VariantsStep';
import type { SpecificationRow } from './types';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';

interface Draft {
  optionIds: string[];
  value: string;
  // MEASUREMENT / RANGE.
  numericValue: string;
  maxValue: string;
  unit: string;
}

const EMPTY_DRAFT: Draft = { optionIds: [], value: '', numericValue: '', maxValue: '', unit: '' };
const text = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
const draftOf = (v: SpecificationValue): Draft => ({
  optionIds: v.options.map(o => o.id),
  value: v.value ?? '',
  numericValue: text(v.numericValue),
  maxValue: text(v.maxValue),
  unit: v.unit ?? '',
});

const isFilled = (d: Draft | undefined, type?: string) =>
  !!d &&
  (type === 'MEASUREMENT'
    ? d.numericValue !== ''
    : type === 'RANGE'
      ? d.numericValue !== '' || d.maxValue !== ''
      : d.optionIds.length > 0 || d.value.trim() !== '');

// The value as the server takes it.
function inputOf(spec: ConfiguredSpecification, d: Draft, where = ''): SpecificationInput {
  if (isOptionSpecificationType(spec.dataType)) return { specificationId: spec.id, optionIds: d.optionIds };
  if (isStructuredSpecificationType(spec.dataType)) {
    if (spec.dataType === 'RANGE' && (d.numericValue === '' || d.maxValue === '')) throw new Error(i18n.t('products.enterBothTheLowestAndHighest', { title: spec.title, where }));
    return {
      specificationId: spec.id,
      numericValue: Number(d.numericValue),
      ...(spec.dataType === 'RANGE' ? { maxValue: Number(d.maxValue) } : {}),
      ...(spec.units.length ? { unit: d.unit || spec.units[0] } : {}),
    };
  }
  return { specificationId: spec.id, value: d.value.trim() };
}

/**
 * The product's specifications, exactly as the category configures them
 * (parents' settings included), as the Seller Panel's step: shared ones once
 * for the product, per-variant ones for each SKU, and ones a variant
 * attribute already gives (Storage) not at all.
 */
export function SpecificationsStep({
  ref,
  productId,
  categoryId,
  onSummaryChange,
}: {
  ref?: Ref<StepHandle>;
  productId: string | null;
  categoryId: string;
  onSummaryChange: (rows: SpecificationRow[]) => void;
}) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ProductConfiguration | null>(null);
  const [saved, setSaved] = useState<SpecificationValue[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [skuDrafts, setSkuDrafts] = useState<Record<string, Record<string, Draft>>>({});
  // BOTH specifications the seller gives per variant.
  const [perVariant, setPerVariant] = useState<Record<string, boolean>>({});
  // Options already in use that the category no longer offers stay selectable.
  const [usedOptions, setUsedOptions] = useState<Map<string, { id: string; title: string }[]>>(new Map());
  const [showMissing, setShowMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId || !productId) return;
    let cancelled = false;
    Promise.all([
      productBuilderService.configuration(categoryId),
      productBuilderService.specifications(productId),
      productBuilderService.variants(productId),
      productBuilderService.variantSpecifications(productId),
    ])
      .then(([cfg, values, skus, skuValues]) => {
        if (cancelled) return;
        const specById = new Map(cfg.specifications.map(s => [s.id, s]));
        const next: Record<string, Draft> = {};
        values.forEach(v => specById.has(v.specificationId) && (next[v.specificationId] = draftOf(v)));
        const nextSku: Record<string, Record<string, Draft>> = {};
        const both: Record<string, boolean> = {};
        skuValues.forEach(row => {
          nextSku[row.variantId] = {};
          row.values.forEach(v => {
            const spec = specById.get(v.specificationId);
            if (!spec) return;
            nextSku[row.variantId][v.specificationId] = draftOf(v);
            if (spec.scope === 'BOTH') both[spec.id] = true;
          });
        });
        // A value saved for the whole product before the category made it per-variant starts every SKU without its own.
        cfg.specifications
          .filter(s => s.scope === 'VARIANT' && next[s.id])
          .forEach(s =>
            skus.forEach(sku => {
              nextSku[sku.id] ??= {};
              nextSku[sku.id][s.id] ??= next[s.id];
            }),
          );
        const used = new Map<string, { id: string; title: string }[]>();
        [...values, ...skuValues.flatMap(r => r.values)].forEach(v => {
          const list = used.get(v.specificationId) ?? [];
          v.options.forEach(o => !list.some(x => x.id === o.id) && list.push(o));
          used.set(v.specificationId, list);
        });
        setConfig(cfg);
        setSaved(values);
        setVariants(skus);
        setDrafts(next);
        setSkuDrafts(nextSku);
        setPerVariant(both);
        setUsedOptions(used);
        setLoadError(null);
        setLoadedFor(categoryId);
      })
      .catch(err => !cancelled && setLoadError(extractErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [categoryId, productId]);

  const withUsedOptions = (spec: ConfiguredSpecification): ConfiguredSpecification => ({
    ...spec,
    options: [
      ...spec.options,
      ...(usedOptions.get(spec.id) ?? []).filter(o => !spec.options.some(x => x.id === o.id)).map(o => ({ id: o.id, title: o.title, slug: '', sequence: 9999 })),
    ],
  });
  const usedAttributes = useMemo(() => new Set(variants.flatMap(v => v.options.map(o => o.attributeId))), [variants]);
  // Given by the SKUs' variant attribute (Storage), so never typed in.
  const sourced = (s: ConfiguredSpecification) => !!s.variantAttributeId && usedAttributes.has(s.variantAttributeId);
  // A product without variants: its single SKU's values are entered with the product's.
  const singleSku = variants.length === 1 && !variants[0].options.length ? variants[0] : null;
  const all = config?.specifications ?? [];
  const shared = all.filter(s => !sourced(s) && (s.scope !== 'VARIANT' || singleSku));
  const fromAttributes = all.filter(sourced);
  const columns = singleSku ? [] : all.filter(s => !sourced(s) && (s.scope === 'VARIANT' || (s.scope === 'BOTH' && perVariant[s.id])));
  const waitingForSkus = !variants.length && all.some(s => s.scope === 'VARIANT' && !sourced(s));
  const byGroup = new Map<string, ConfiguredSpecification[]>();
  shared.forEach(s => byGroup.set(s.group, [...(byGroup.get(s.group) ?? []), s]));
  const groups = [...byGroup.entries()].map(([group, list]) => ({ group, specs: [...list].sort((a, b) => Number(b.required) - Number(a.required)) }));
  const sharedDraft = (spec: ConfiguredSpecification) => (spec.scope === 'VARIANT' && singleSku ? skuDrafts[singleSku.id]?.[spec.id] : drafts[spec.id]);
  const cell = (variantId: string, specId: string) => skuDrafts[variantId]?.[specId];
  const foreign = saved.filter(v => !all.some(s => s.id === v.specificationId));

  // Required values still missing: the SKUs without one, or null for the shared field.
  const missing = new Map<string, string[] | null>();
  for (const spec of all.filter(s => s.required && !sourced(s))) {
    const skusWithout = () => variants.filter(v => !isFilled(cell(v.id, spec.id), spec.dataType)).map(v => v.id);
    if (spec.scope === 'VARIANT' && !singleSku) {
      if (variants.length && skusWithout().length) missing.set(spec.id, skusWithout());
    } else if (spec.scope === 'BOTH' && perVariant[spec.id] && !singleSku && !isFilled(drafts[spec.id], spec.dataType)) {
      if (skusWithout().length) missing.set(spec.id, skusWithout());
    } else if (!isFilled(sharedDraft(spec), spec.dataType)) {
      missing.set(spec.id, null);
    }
  }

  useEffect(() => {
    if (!config) return;
    const typeOf = (id: string) => config.specifications.find(s => s.id === id)?.dataType;
    const rows: SpecificationRow[] = Object.entries(drafts)
      .filter(([id, d]) => isFilled(d, typeOf(id)))
      .map(([specificationId, d]) => ({ specificationId, specsDataId: d.optionIds[0] ?? '', specificationValue: d.value }));
    const perSku = new Set(Object.values(skuDrafts).flatMap(row => Object.entries(row).filter(([id, d]) => isFilled(d, typeOf(id))).map(([id]) => id)));
    perSku.forEach(id => !rows.some(r => r.specificationId === id) && rows.push({ specificationId: id, specsDataId: '', specificationValue: '' }));
    onSummaryChange(rows);
  }, [config, drafts, skuDrafts, onSummaryChange]);

  useImperativeHandle(ref, () => ({
    async save() {
      if (!productId || !config || loadedFor !== categoryId) return;
      if (missing.size) {
        setShowMissing(true);
        const names = all
          .filter(s => missing.has(s.id))
          .map(s => {
            const skus = missing.get(s.id);
            return skus ? `${s.title} (${t('products.variantCount', { count: skus.length })})` : s.title;
          });
        throw new Error(t('products.fillInTheRequiredSpecificationsJoin', { join: names.join(', ') }));
      }
      const values = shared.filter(s => s.scope !== 'VARIANT' && isFilled(drafts[s.id], s.dataType)).map(s => inputOf(s, drafts[s.id]));
      const own = singleSku ? all.filter(s => s.scope === 'VARIANT' && !sourced(s)) : columns;
      const perSku = variants.length
        ? variants.map(v => ({
            variantId: v.id,
            values: own.filter(s => isFilled(cell(v.id, s.id), s.dataType)).map(s => inputOf(s, cell(v.id, s.id)!, ` (${v.label})`)),
          }))
        : undefined;
      setSaved(await productBuilderService.saveSpecifications(productId, values, perSku));
      setShowMissing(false);
    },
  }));

  function setShared(spec: ConfiguredSpecification, patch: Partial<Draft>) {
    if (spec.scope === 'VARIANT' && singleSku) return setCell(singleSku.id, spec.id, patch);
    setDrafts(prev => ({ ...prev, [spec.id]: { ...(prev[spec.id] ?? EMPTY_DRAFT), ...patch } }));
  }
  function setCell(variantId: string, specId: string, patch: Partial<Draft>) {
    setSkuDrafts(prev => ({ ...prev, [variantId]: { ...(prev[variantId] ?? {}), [specId]: { ...(prev[variantId]?.[specId] ?? EMPTY_DRAFT), ...patch } } }));
  }

  /** "all" copies the first filled SKU to every SKU; an attribute id copies within each of its values. */
  function fill(spec: ConfiguredSpecification, by: string) {
    const groupOf = (v: ProductVariant) => (by === 'all' ? '' : v.options.find(o => o.attributeId === by)?.optionId ?? v.id);
    setSkuDrafts(prev => {
      const source = new Map<string, Draft>();
      variants.forEach(v => {
        const d = prev[v.id]?.[spec.id];
        if (isFilled(d, spec.dataType) && !source.has(groupOf(v))) source.set(groupOf(v), d!);
      });
      const next = { ...prev };
      variants.forEach(v => {
        const d = source.get(groupOf(v));
        if (d) next[v.id] = { ...(next[v.id] ?? {}), [spec.id]: { ...d } };
      });
      return next;
    });
  }

  async function removeForeign(specificationId: string) {
    if (!productId) return;
    setRemoving(specificationId);
    try {
      setSaved(await productBuilderService.removeSpecification(productId, specificationId));
    } catch (err) {
      setLoadError(extractErrorMessage(err));
    } finally {
      setRemoving(null);
    }
  }

  if (!productId) return <Section title={t('products.specifications')} subtitle={t('products.saveTheBasicInformationFirst')} children={null} />;
  if (loadError && !config) return <Alert message={loadError} />;
  if (!config) return <Section title={t('products.specifications')} subtitle={t('products.loadingTheCategorysSpecifications')} children={null} />;
  if (!all.length) {
    return (
      <Section title={t('products.specifications')} subtitle={config.category.path.map(c => c.title).join(' › ')}>
        <Text style={styles.muted}>{t('products.thisCategoryHasNoSpecificationsSet')}</Text>
      </Section>
    );
  }

  const variantAttributes = [...new Map(variants.flatMap(v => v.options.map(o => [o.attributeId, o.attributeTitle] as const))).entries()];

  return (
    <View style={styles.wrap}>
      {loadError ? <Alert message={loadError} /> : null}
      {groups.map(({ group, specs }) => (
        <Section key={group} title={group} subtitle={group === groups[0].group ? t('products.fromJoin', { join: config.category.path.map(c => c.title).join(' › ') }) : undefined}>
          {specs.map(spec => (
            <View key={spec.id} style={styles.specBlock}>
              <SpecificationField
                spec={withUsedOptions(spec)}
                draft={sharedDraft(spec)}
                invalid={showMissing && missing.has(spec.id)}
                onChange={patch => setShared(spec, patch)}
              />
              {spec.scope === 'BOTH' && variants.length > 1 && !singleSku ? (
                <SwitchRow
                  label={t('products.differentPerVariant')}
                  hint={t('products.giveEachSkuItsOwnValue')}
                  value={!!perVariant[spec.id]}
                  onChange={v => setPerVariant(prev => ({ ...prev, [spec.id]: v }))}
                />
              ) : null}
            </View>
          ))}
        </Section>
      ))}

      {waitingForSkus ? <Alert message={t('products.someSpecificationsAreEnteredPerVariant')} /> : null}

      {columns.map(spec => (
        <Section key={spec.id} title={`${spec.title}${spec.required ? ' *' : ''}`} subtitle={t('products.perVariant')}>
          {variants.length > 1 ? (
            <View style={styles.fillRow}>
              <Pressable onPress={() => fill(spec, 'all')} style={styles.fillBtn}>
                <Text style={styles.fillText}>{t('products.sameForAll')}</Text>
              </Pressable>
              {variantAttributes.map(([id, title]) => (
                <Pressable key={id} onPress={() => fill(spec, id)} style={styles.fillBtn}>
                  <Text style={styles.fillText}>{t('products.samePerTitle', { title })}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {variants.map(v => (
            <View key={v.id} style={styles.skuField}>
              <Text style={styles.skuLabel}>{v.label}</Text>
              <SpecificationField
                compact
                spec={withUsedOptions(spec)}
                draft={cell(v.id, spec.id)}
                invalid={showMissing && (missing.get(spec.id) ?? []).includes(v.id)}
                placeholder={spec.scope === 'BOTH' && isFilled(drafts[spec.id], spec.dataType) ? t('products.usesTheProductValue') : undefined}
                onChange={patch => setCell(v.id, spec.id, patch)}
              />
            </View>
          ))}
        </Section>
      ))}

      {fromAttributes.length ? (
        <Section title={t('products.fromTheVariantOptions')} subtitle={t('products.eachSkusOptionGivesTheseNothing')}>
          {fromAttributes.map(s => (
            <Text key={s.id} style={styles.muted}>
              • {s.title}
            </Text>
          ))}
        </Section>
      ) : null}

      {foreign.length ? (
        <Section title={t('products.noLongerInThisCategory')} subtitle={t('products.valuesSavedBeforeTheCategoryChanged')}>
          {foreign.map(v => (
            <View key={v.specificationId} style={styles.foreign}>
              <Text style={styles.foreignText}>
                {v.title}: {v.value ?? v.options.map(o => o.title).join(', ')}
              </Text>
              <Pressable onPress={() => removeForeign(v.specificationId)} disabled={removing === v.specificationId}>
                <Text style={styles.remove}>{removing === v.specificationId ? t('products.removing') : t('common.remove')}</Text>
              </Pressable>
            </View>
          ))}
        </Section>
      ) : null}
    </View>
  );
}

/** One specification's input, by its data type. */
function SpecificationField({
  spec,
  draft,
  invalid,
  compact,
  placeholder,
  onChange,
}: {
  spec: ConfiguredSpecification;
  draft: Draft | undefined;
  invalid?: boolean;
  compact?: boolean;
  placeholder?: string;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const { t: tr } = useTranslation();
  const type = spec.dataType;
  const value = draft?.value ?? '';
  const label = compact ? '' : spec.title;
  const error = invalid ? tr('products.titleIsRequired', { title: spec.title }) : null;
  const hint = !compact ? spec.description ?? undefined : undefined;

  if (isOptionSpecificationType(type) && spec.multiselect) {
    const ids = draft?.optionIds ?? [];
    return (
      <Field label={label} required={!compact && spec.required} hint={hint} error={error}>
        <View style={styles.multi}>
          {spec.options.map(o => {
            const on = ids.includes(o.id);
            return (
              <Pressable
                key={o.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => onChange({ optionIds: on ? ids.filter(x => x !== o.id) : [...ids, o.id] })}
                style={[styles.multiChip, on && styles.multiChipOn]}
              >
                <Text style={[styles.multiText, on && styles.multiTextOn]}>{o.title}</Text>
              </Pressable>
            );
          })}
          {!spec.options.length ? <Text style={styles.muted}>{tr('products.noOptionsSetUp')}</Text> : null}
        </View>
      </Field>
    );
  }
  if (isOptionSpecificationType(type)) {
    return (
      <SelectField
        label={label || spec.title}
        required={!compact && spec.required}
        hint={error ?? hint}
        placeholder={placeholder ?? tr('products.selectLowercase', { lowerCase: spec.title.toLowerCase() })}
        value={draft?.optionIds[0] ?? ''}
        options={spec.options.map(o => ({ value: o.id, label: o.title }))}
        allowClear={tr('common.none')}
        onChange={v => onChange({ optionIds: v ? [v] : [] })}
      />
    );
  }
  if (type === 'BOOLEAN') {
    return (
      <Field label={label} required={!compact && spec.required} hint={hint} error={error}>
        <Choices
          options={[
            { value: 'true', label: tr('common.yes') },
            { value: 'false', label: tr('common.no') },
          ]}
          value={value}
          // Tapping the chosen answer again clears it.
          onChange={v => onChange({ value: value === v ? '' : v })}
        />
      </Field>
    );
  }
  if (type === 'DATE') {
    return <DateField label={label || spec.title} required={!compact && spec.required} hint={error ?? hint} value={value} onChange={v => onChange({ value: v })} />;
  }
  if (type === 'MEASUREMENT' || type === 'RANGE') {
    const unit = draft?.unit || spec.units[0] || '';
    return (
      <Field label={label} required={!compact && spec.required} hint={hint} error={error}>
        <View style={styles.numberRow}>
          <Input
            value={draft?.numericValue ?? ''}
            onChangeText={t => onChange({ numericValue: t.replace(/[^0-9.-]/g, '') })}
            keyboardType="numbers-and-punctuation"
            placeholder={type === 'RANGE' ? tr('common.from') : placeholder ?? 'e.g. 500'}
            style={styles.flex}
          />
          {type === 'RANGE' ? <Text style={styles.muted}>{tr('common.to2')}</Text> : null}
          {type === 'RANGE' ? (
            <Input
              value={draft?.maxValue ?? ''}
              onChangeText={t => onChange({ maxValue: t.replace(/[^0-9.-]/g, '') })}
              keyboardType="numbers-and-punctuation"
              placeholder={tr('common.to')}
              style={styles.flex}
            />
          ) : null}
          {!spec.units.length && spec.unitLabel ? <Text style={styles.muted}>{spec.unitLabel}</Text> : null}
        </View>
        {spec.units.length > 1 ? <Choices options={spec.units.map(u => ({ value: u, label: u }))} value={unit} onChange={u => onChange({ unit: u })} /> : null}
        {spec.units.length === 1 ? <Text style={styles.muted}>{tr('products.inUnits', { units: spec.units[0] })}</Text> : null}
      </Field>
    );
  }
  const numeric = type === 'NUMBER' || type === 'DECIMAL';
  return (
    <Field label={label} required={!compact && spec.required} hint={hint} error={error}>
      <View style={styles.numberRow}>
        <Input
          value={value}
          onChangeText={t => onChange({ value: numeric ? t.replace(type === 'NUMBER' ? /[^0-9-]/g : /[^0-9.-]/g, '') : t })}
          keyboardType={numeric ? 'numbers-and-punctuation' : 'default'}
          multiline={type === 'TEXTAREA'}
          maxLength={type === 'TEXTAREA' ? 5000 : 255}
          placeholder={placeholder}
          style={styles.flex}
        />
        {numeric && spec.unitLabel ? <Text style={styles.muted}>{spec.unitLabel}</Text> : null}
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 14 },
  muted: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary },
  specBlock: { gap: 8 },
  multi: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  multiChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  multiChipOn: { borderColor: '#4f46e5', backgroundColor: '#4f46e5' },
  multiText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  multiTextOn: { color: colors.white },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fillBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.primaryLight },
  fillText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primary },
  skuField: { gap: 4, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  skuLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  foreign: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  foreignText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  remove: { fontFamily: fonts.bold, fontSize: 13, color: colors.error },
});
