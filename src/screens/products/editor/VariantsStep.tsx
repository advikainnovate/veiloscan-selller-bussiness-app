import React, { useEffect, useImperativeHandle, useMemo, useState, type Ref } from 'react';
import { Alert as NativeAlert, Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../../theme';
import { extractErrorMessage } from '../../../lib/api';
import {
  productBuilderService,
  type ConfiguredVariantAttribute,
  type ProductConfiguration,
  type ProductVariant,
  type TypedVariantValue,
  type VariantUpdate,
} from '../../../services/product-builder-service';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Choices, Field, Input, Section } from '../../../components/form/Fields';
import { CheckIcon, CloseIcon, ImageIcon } from '../../../components/icons';
import { VariantPhotosSheet } from './VariantPhotosSheet';
import type { BusinessVariantRow, MediaItem } from './types';

export interface StepHandle {
  save: () => Promise<void>;
}

interface Draft {
  sku: string;
  barcode: string;
  mrp: string;
  sellingPrice: string;
  costPrice: string;
  imageFileId: string;
  status: 0 | 1;
}

// A value typed in that doesn't exist yet; created when SKUs are generated.
type TypedValue = TypedVariantValue & { key: string; label: string };

const num = (n: number | null) => (n === null ? '' : String(n));
function draftOf(v: ProductVariant): Draft {
  return {
    sku: v.sku,
    barcode: v.barcode ?? '',
    mrp: num(v.mrp),
    sellingPrice: v.sellingPrice ? String(v.sellingPrice) : '',
    costPrice: num(v.costPrice),
    imageFileId: v.imageFileId ?? '',
    status: v.status === 1 ? 1 : 0,
  };
}

// Only the fields that differ from what's saved.
function changesOf(v: ProductVariant, d: Draft): VariantUpdate {
  const saved = draftOf(v);
  const changes: VariantUpdate = {};
  if (d.sku.trim() !== saved.sku) changes.sku = d.sku.trim();
  if (d.barcode.trim() !== saved.barcode) changes.barcode = d.barcode.trim() || null;
  if (d.mrp !== saved.mrp) changes.mrp = d.mrp === '' ? null : d.mrp;
  if (d.sellingPrice !== saved.sellingPrice) changes.sellingPrice = d.sellingPrice === '' ? '0' : d.sellingPrice;
  if (d.costPrice !== saved.costPrice) changes.costPrice = d.costPrice === '' ? null : d.costPrice;
  if (d.imageFileId !== saved.imageFileId) changes.imageFileId = d.imageFileId || null;
  if (d.status !== saved.status) changes.status = d.status;
  return changes;
}

export function toSkuRow(v: ProductVariant): BusinessVariantRow {
  return {
    id: v.id,
    skuItemNumber: v.sku,
    barcode: v.barcode ?? '',
    businessPrice: v.sellingPrice,
    mrp: v.mrp ?? '',
    costPrice: v.costPrice ?? '',
    combo: Object.fromEntries(v.options.map(o => [o.attributeId, { variantDataId: o.optionId, variantTitle: o.attributeTitle, variantDataValue: o.value }])),
  };
}

const money = (t: string) => t.replace(/[^0-9.]/g, '');

/**
 * The product's sellable SKUs, as the Seller Panel's Variants step: tick the
 * options of the category's variant attributes, the server builds every new
 * combination (never duplicates), and each SKU's code, barcode, prices,
 * photo and on-sale status are edited below.
 */
export function VariantsStep({
  ref,
  productId,
  categoryId,
  media,
  onSkusChange,
}: {
  ref?: Ref<StepHandle>;
  productId: string | null;
  categoryId: string;
  media: MediaItem[];
  onSkusChange: (rows: BusinessVariantRow[]) => void;
}) {
  const [config, setConfig] = useState<ProductConfiguration | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [typed, setTyped] = useState<Record<string, TypedValue[]>>({});
  const [newValue, setNewValue] = useState<Record<string, string>>({});
  const [newUnit, setNewUnit] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState({ sellingPrice: '', mrp: '', costPrice: '' });
  const [bulk, setBulk] = useState({ sellingPrice: '', mrp: '', costPrice: '', target: 'all' });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [photosFor, setPhotosFor] = useState<ProductVariant | null>(null);

  function adopt(list: ProductVariant[]) {
    setVariants(list);
    setDrafts(prev => {
      const next: Record<string, Draft> = {};
      // Keep unsaved edits of rows that still exist.
      list.forEach(v => (next[v.id] = prev[v.id] && Object.keys(changesOf(v, prev[v.id])).length ? prev[v.id] : draftOf(v)));
      return next;
    });
    onSkusChange(list.map(toSkuRow));
  }

  // Ticks what the existing SKUs already use.
  function tickFrom(list: ProductVariant[]) {
    const ticked: Record<string, string[]> = {};
    list.forEach(v => v.options.forEach(o => (ticked[o.attributeId] = [...new Set([...(ticked[o.attributeId] ?? []), o.optionId])])));
    setSelected(ticked);
  }

  useEffect(() => {
    if (!categoryId || !productId) return;
    let cancelled = false;
    Promise.all([productBuilderService.configuration(categoryId), productBuilderService.variants(productId)])
      .then(([cfg, list]) => {
        if (cancelled) return;
        setConfig(cfg);
        adopt(list);
        tickFrom(list);
        setLoadError(null);
      })
      .catch(err => !cancelled && setLoadError(extractErrorMessage(err)));
    return () => {
      cancelled = true;
    };
    // `adopt` only sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, productId]);

  const attributes: ConfiguredVariantAttribute[] = useMemo(() => config?.variantAttributes ?? [], [config]);
  const countOf = (a: ConfiguredVariantAttribute) => (selected[a.id] ?? []).length + (typed[a.id] ?? []).length;
  const chosen = attributes.filter(a => countOf(a) > 0);
  const comboCount = chosen.length ? chosen.reduce((n, a) => n * countOf(a), 1) : 0;
  const missingRequired = attributes.filter(a => a.required && !countOf(a));
  const dirty = variants.filter(v => drafts[v.id] && Object.keys(changesOf(v, drafts[v.id])).length);

  // SKUs are grouped by the value of the first attribute (e.g. by Size).
  const groupAttribute = attributes[0]?.id ?? variants.find(v => v.options.length)?.options[0]?.attributeId ?? '';
  const groupOf = (v: ProductVariant) => v.options.find(o => o.attributeId === groupAttribute)?.value ?? '';
  const groupTitle = attributes.find(a => a.id === groupAttribute)?.title ?? '';
  const groupNames = [...new Set(variants.map(groupOf).filter(Boolean))];

  async function saveDrafts() {
    if (!productId) return;
    setError(null);
    const errors: Record<string, string> = {};
    const updated: ProductVariant[] = [];
    for (const v of variants) {
      const changes = drafts[v.id] ? changesOf(v, drafts[v.id]) : {};
      if (!Object.keys(changes).length) continue;
      try {
        updated.push(await productBuilderService.updateVariant(productId, v.id, changes));
      } catch (err) {
        errors[v.id] = extractErrorMessage(err);
      }
    }
    setRowErrors(errors);
    if (updated.length) {
      const byId = new Map(updated.map(v => [v.id, v]));
      const next = variants.map(v => byId.get(v.id) ?? v);
      setVariants(next);
      setDrafts(prev => ({ ...prev, ...Object.fromEntries(updated.map(v => [v.id, draftOf(v)])) }));
      onSkusChange(next.map(toSkuRow));
    }
    const failed = Object.keys(errors).length;
    if (failed) throw new Error(`${failed} SKU${failed === 1 ? '' : 's'} couldn't be saved — see the highlighted SKUs.`);
  }

  useImperativeHandle(ref, () => ({ save: saveDrafts }));

  async function generate(withoutVariants = false) {
    if (!productId) return;
    setError(null);
    setNotice(null);
    setBusy('generate');
    try {
      const result = await productBuilderService.generate(
        productId,
        withoutVariants
          ? []
          : chosen.map(a => ({
              variantAttributeId: a.id,
              optionIds: selected[a.id] ?? [],
              ...(typed[a.id]?.length ? { values: typed[a.id].map(({ value, numericValue, unit }) => ({ value, numericValue, unit })) } : {}),
            })),
        { sellingPrice: defaults.sellingPrice || undefined, mrp: defaults.mrp || undefined, costPrice: defaults.costPrice || undefined },
      );
      adopt(result.variants);
      if (Object.values(typed).some(list => list.length)) {
        // Typed-in values now exist: show them as options, ticked.
        setConfig(await productBuilderService.configuration(categoryId));
        setTyped({});
        tickFrom(result.variants);
      }
      setNotice(
        result.created
          ? `${result.created} SKU${result.created === 1 ? '' : 's'} added${result.skipped ? ` · ${result.skipped} already existed` : ''}.${
              defaults.sellingPrice ? '' : ' Set their prices below — SKUs without a price stay off sale.'
            }`
          : 'All these combinations already exist.',
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy('');
    }
  }

  function removeVariant(v: ProductVariant) {
    if (!productId) return;
    NativeAlert.alert(`Remove SKU ${v.sku}?`, v.label, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusy(v.id);
          try {
            await productBuilderService.removeVariant(productId, v.id);
            adopt(variants.filter(x => x.id !== v.id));
          } catch (err) {
            setError(extractErrorMessage(err));
          } finally {
            setBusy('');
          }
        },
      },
    ]);
  }

  // A measurement / number / text value typed in: ticks the matching option, else it's added on Generate.
  function addTyped(attribute: ConfiguredVariantAttribute) {
    const text = (newValue[attribute.id] ?? '').trim();
    if (!text) return;
    setError(null);
    let entry: TypedValue;
    let match: { id: string } | undefined;
    if (attribute.type === 'MEASUREMENT' || attribute.type === 'NUMERIC') {
      const number = Number(text);
      if (!Number.isFinite(number) || number <= 0) return setError(`${attribute.title} must be a number above 0`);
      if (attribute.type === 'MEASUREMENT') {
        const unit = newUnit[attribute.id] || attribute.openUnits[0];
        if (!unit) return;
        match = attribute.options.find(o => o.numericValue === number && o.unit === unit);
        entry = { key: `${number}${unit}`, label: `${number} ${unit}`, numericValue: number, unit };
      } else {
        match = attribute.options.find(o => o.numericValue === number);
        entry = { key: String(number), label: String(number), numericValue: number };
      }
    } else {
      match = attribute.options.find(o => o.value.toLowerCase() === text.toLowerCase());
      entry = { key: text.toLowerCase(), label: text, value: text };
    }
    if (match) {
      const id = match.id;
      setSelected(prev => ({ ...prev, [attribute.id]: [...new Set([...(prev[attribute.id] ?? []), id])] }));
    } else {
      setTyped(prev => ({
        ...prev,
        [attribute.id]: (prev[attribute.id] ?? []).some(t => t.key === entry.key) ? prev[attribute.id] ?? [] : [...(prev[attribute.id] ?? []), entry],
      }));
    }
    setNewValue(prev => ({ ...prev, [attribute.id]: '' }));
  }

  function toggle(attributeId: string, optionId: string) {
    setSelected(prev => {
      const current = prev[attributeId] ?? [];
      return { ...prev, [attributeId]: current.includes(optionId) ? current.filter(id => id !== optionId) : [...current, optionId] };
    });
  }

  const setDraft = (id: string, patch: Partial<Draft>) => setDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  function applyBulk() {
    const fields = (['sellingPrice', 'mrp', 'costPrice'] as const).filter(f => bulk[f] !== '');
    if (!fields.length) return;
    setDrafts(prev => {
      const next = { ...prev };
      variants.forEach(v => {
        if (bulk.target !== 'all' && groupOf(v) !== bulk.target) return;
        next[v.id] = { ...next[v.id], ...Object.fromEntries(fields.map(f => [f, bulk[f]])) };
      });
      return next;
    });
    setNotice(`Prices filled in for ${bulk.target === 'all' ? 'all SKUs' : `${groupTitle}: ${bulk.target}`} — they're saved when you continue.`);
  }

  if (!productId) return <Section title="Variants" subtitle="Save the basic information first." children={null} />;
  if (loadError) return <Alert message={loadError} />;
  if (!config) return <Section title="Variants" subtitle="Loading the category's variant attributes…" children={null} />;

  return (
    <View style={styles.wrap}>
      <Section
        title="Variant attributes"
        subtitle={`Tick the options this product comes in (from ${config.category.path.map(c => c.title).join(' › ')}). Generating again only adds new combinations.`}
      >
        {!attributes.length ? (
          <Text style={styles.muted}>This category has no variant attributes, so the product is sold as a single SKU.</Text>
        ) : (
          attributes.map(attribute => {
            const ids = selected[attribute.id] ?? [];
            const allOn = attribute.options.length > 0 && attribute.options.every(o => ids.includes(o.id));
            const typedHere = typed[attribute.id] ?? [];
            const canType = attribute.type === 'MEASUREMENT' ? attribute.openUnits.length > 0 : attribute.type !== 'SELECT' && attribute.acceptsNewValues;
            return (
              <View key={attribute.id} style={styles.attribute}>
                <View style={styles.attrHead}>
                  <Text style={styles.attrTitle}>
                    {attribute.title}
                    {attribute.required ? <Text style={styles.required}> *</Text> : null}
                    {attribute.type === 'MEASUREMENT' ? <Text style={styles.muted}> · in {attribute.units.join(' / ')}</Text> : null}
                  </Text>
                  {attribute.options.length ? (
                    <Pressable onPress={() => setSelected(prev => ({ ...prev, [attribute.id]: allOn ? [] : attribute.options.map(o => o.id) }))} hitSlop={6}>
                      <Text style={styles.link}>{allOn ? 'Clear' : 'Select all'}</Text>
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.options}>
                  {attribute.options.map(o => {
                    const on = ids.includes(o.id);
                    return (
                      <Pressable
                        key={o.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        onPress={() => toggle(attribute.id, o.id)}
                        style={[styles.option, on && styles.optionOn]}
                      >
                        {o.colorCode ? <View style={[styles.swatch, { backgroundColor: o.colorCode }]} /> : null}
                        <Text style={[styles.optionText, on && styles.optionTextOn]}>{o.value}</Text>
                        {on ? <CheckIcon size={12} color={colors.secondaryDark} strokeWidth={3} /> : null}
                      </Pressable>
                    );
                  })}
                  {typedHere.map(t => (
                    <Pressable
                      key={t.key}
                      accessibilityLabel={`Remove ${t.label}`}
                      onPress={() => setTyped(prev => ({ ...prev, [attribute.id]: (prev[attribute.id] ?? []).filter(x => x.key !== t.key) }))}
                      style={[styles.option, styles.optionNew]}
                    >
                      <Text style={styles.optionTextNew}>{t.label} · new</Text>
                      <CloseIcon size={11} color="#4f46e5" />
                    </Pressable>
                  ))}
                </View>
                {canType ? (
                  <View style={styles.addRow}>
                    <Input
                      value={newValue[attribute.id] ?? ''}
                      onChangeText={v => setNewValue(prev => ({ ...prev, [attribute.id]: v }))}
                      keyboardType={attribute.type === 'MEASUREMENT' || attribute.type === 'NUMERIC' ? 'decimal-pad' : 'default'}
                      placeholder={attribute.type === 'MEASUREMENT' ? 'e.g. 20' : attribute.type === 'NUMERIC' ? 'e.g. 6' : `Add a ${attribute.title.toLowerCase()}…`}
                      onSubmitEditing={() => addTyped(attribute)}
                      style={styles.flex}
                    />
                    <Pressable onPress={() => addTyped(attribute)} style={styles.addBtn}>
                      <Text style={styles.addBtnText}>Add</Text>
                    </Pressable>
                  </View>
                ) : null}
                {attribute.type === 'MEASUREMENT' && attribute.openUnits.length > 1 ? (
                  <Choices
                    options={attribute.openUnits.map(u => ({ value: u, label: u }))}
                    value={newUnit[attribute.id] || attribute.openUnits[0]}
                    onChange={u => setNewUnit(prev => ({ ...prev, [attribute.id]: u }))}
                  />
                ) : null}
              </View>
            );
          })
        )}

        {attributes.length ? (
          <>
            <Text style={styles.subhead}>Prices for new SKUs (optional)</Text>
            <View style={styles.priceRow}>
              {(['sellingPrice', 'mrp', 'costPrice'] as const).map(f => (
                <View key={f} style={styles.flex}>
                  <Text style={styles.priceLabel}>{f === 'sellingPrice' ? 'Price' : f === 'mrp' ? 'MRP' : 'Cost'}</Text>
                  <Input value={defaults[f]} onChangeText={v => setDefaults(d => ({ ...d, [f]: money(v) }))} keyboardType="decimal-pad" placeholder="₹" />
                </View>
              ))}
            </View>
            {missingRequired.length ? <Text style={styles.warn}>Choose at least one {missingRequired.map(a => a.title).join(', ')}.</Text> : null}
            <Button
              title={busy === 'generate' ? 'Generating…' : `Generate ${comboCount} combination${comboCount === 1 ? '' : 's'}`}
              disabled={busy === 'generate' || !comboCount || missingRequired.length > 0}
              onPress={() => generate()}
            />
            {chosen.length > 1 ? (
              <Text style={styles.muted}>
                {chosen.map(a => `${countOf(a)} ${a.title}`).join(' × ')} = {comboCount}
              </Text>
            ) : null}
          </>
        ) : null}
        {!chosen.length && !variants.length && !attributes.some(a => a.required) ? (
          <Button title="No variants — create a single SKU" variant="ghost" disabled={busy === 'generate'} onPress={() => generate(true)} />
        ) : null}
        {notice ? <Alert variant="success" message={notice} /> : null}
        {error ? <Alert message={error} /> : null}
      </Section>

      {variants.length > 1 ? (
        <Section title="Fill prices" subtitle="Set the same prices for many SKUs at once.">
          <View style={styles.priceRow}>
            {(['sellingPrice', 'mrp', 'costPrice'] as const).map(f => (
              <View key={f} style={styles.flex}>
                <Text style={styles.priceLabel}>{f === 'sellingPrice' ? 'Price' : f === 'mrp' ? 'MRP' : 'Cost'}</Text>
                <Input value={bulk[f]} onChangeText={v => setBulk(b => ({ ...b, [f]: money(v) }))} keyboardType="decimal-pad" placeholder="₹" />
              </View>
            ))}
          </View>
          {groupNames.length > 1 ? (
            <Field label="For">
              <Choices
                options={[{ value: 'all', label: 'All SKUs' }, ...groupNames.map(g => ({ value: g, label: `${groupTitle}: ${g}` }))]}
                value={bulk.target}
                onChange={target => setBulk(b => ({ ...b, target }))}
              />
            </Field>
          ) : null}
          <Button title="Fill in" variant="ghost" disabled={!bulk.sellingPrice && !bulk.mrp && !bulk.costPrice} onPress={applyBulk} />
        </Section>
      ) : null}

      <Text style={styles.listTitle}>
        SKUs ({variants.length}){dirty.length ? ` · ${dirty.length} unsaved` : ''}
      </Text>
      {variants.map(v => {
        const d = drafts[v.id] ?? draftOf(v);
        const picked = media.find(m => String(m.fileId) === d.imageFileId);
        return (
          <View key={v.id} style={[styles.sku, rowErrors[v.id] ? styles.skuError : null]}>
            <View style={styles.skuHead}>
              <View style={styles.flex}>
                <Text style={styles.skuLabel}>{v.label}</Text>
                <Text style={styles.muted}>
                  {v.imageCount ? `${v.imageCount} photo${v.imageCount === 1 ? '' : 's'}` : 'No own photos'} · stock {v.stock}
                </Text>
              </View>
              <Text style={styles.onSale}>{d.status === 1 ? 'On sale' : 'Hidden'}</Text>
              <Switch
                value={d.status === 1}
                onValueChange={on => setDraft(v.id, { status: on ? 1 : 0 })}
                trackColor={{ true: colors.secondary, false: colors.border }}
                thumbColor={colors.white}
                accessibilityLabel={`${v.label} on sale`}
              />
            </View>
            <View style={styles.priceRow}>
              <View style={styles.flex}>
                <Text style={styles.priceLabel}>SKU code</Text>
                <Input value={d.sku} onChangeText={sku => setDraft(v.id, { sku: sku.toUpperCase() })} autoCapitalize="characters" autoCorrect={false} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.priceLabel}>Barcode</Text>
                <Input value={d.barcode} onChangeText={barcode => setDraft(v.id, { barcode })} keyboardType="number-pad" placeholder="Optional" />
              </View>
            </View>
            <View style={styles.priceRow}>
              {(['sellingPrice', 'mrp', 'costPrice'] as const).map(f => (
                <View key={f} style={styles.flex}>
                  <Text style={styles.priceLabel}>{f === 'sellingPrice' ? 'Price *' : f === 'mrp' ? 'MRP' : 'Cost'}</Text>
                  <Input value={d[f]} onChangeText={val => setDraft(v.id, { [f]: money(val) })} keyboardType="decimal-pad" placeholder="₹" accessibilityLabel={`${v.label} ${f}`} />
                </View>
              ))}
            </View>
            {media.length ? (
              <View style={styles.imageRow}>
                <Text style={styles.priceLabel}>Product photo for this SKU</Text>
                <View style={styles.thumbs}>
                  <Pressable onPress={() => setDraft(v.id, { imageFileId: '' })} style={[styles.thumb, styles.thumbNone, !d.imageFileId && styles.thumbOn]}>
                    <Text style={styles.thumbNoneText}>None</Text>
                  </Pressable>
                  {media.map(m => (
                    <Pressable
                      key={String(m.fileId)}
                      accessibilityLabel="Use this photo"
                      onPress={() => setDraft(v.id, { imageFileId: String(m.fileId) })}
                      style={[styles.thumb, picked?.fileId === m.fileId && styles.thumbOn]}
                    >
                      {m.url ? <Image source={{ uri: m.url }} style={styles.thumbImg} /> : null}
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={styles.skuActions}>
              <Pressable onPress={() => setPhotosFor(v)} style={styles.skuAction}>
                <ImageIcon size={15} color={colors.secondary} />
                <Text style={styles.link}>Photos</Text>
              </Pressable>
              <Pressable onPress={() => removeVariant(v)} disabled={busy === v.id} style={styles.skuAction}>
                <Text style={styles.danger}>{busy === v.id ? 'Removing…' : 'Remove'}</Text>
              </Pressable>
            </View>
            {rowErrors[v.id] ? <Text style={styles.rowError}>{rowErrors[v.id]}</Text> : null}
          </View>
        );
      })}

      {photosFor && productId ? (
        <VariantPhotosSheet
          productId={productId}
          variant={photosFor}
          onClose={() => setPhotosFor(null)}
          onChange={(count, primary) =>
            setVariants(list => list.map(x => (x.id === photosFor.id ? { ...x, imageCount: count, primaryImageUrl: primary } : x)))
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 14 },
  muted: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary },
  required: { color: colors.error },
  link: { fontFamily: fonts.bold, fontSize: 13, color: colors.secondary },
  danger: { fontFamily: fonts.bold, fontSize: 13, color: colors.error },
  warn: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.warningDark },
  attribute: { gap: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  attrHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  attrTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  optionOn: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  optionNew: { borderColor: '#c7d2fe', backgroundColor: '#eef2ff' },
  optionText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  optionTextOn: { color: colors.secondaryDark },
  optionTextNew: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#4338ca' },
  swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  addRow: { flexDirection: 'row', gap: 8 },
  addBtn: { height: 46, paddingHorizontal: 14, borderRadius: radius.md, justifyContent: 'center', backgroundColor: colors.primary },
  addBtnText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.white },
  subhead: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  priceRow: { flexDirection: 'row', gap: 8 },
  priceLabel: { marginBottom: 4, fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  listTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  sku: { gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface },
  skuError: { borderWidth: 1.5, borderColor: colors.error },
  skuHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skuLabel: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  onSale: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  imageRow: { gap: 4 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thumb: { width: 46, height: 46, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.background },
  thumbOn: { borderColor: colors.secondary },
  thumbNone: { alignItems: 'center', justifyContent: 'center', borderColor: colors.border },
  thumbNoneText: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.textSecondary },
  thumbImg: { width: '100%', height: '100%' },
  skuActions: { flexDirection: 'row', gap: 18 },
  skuAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  rowError: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.error },
});
