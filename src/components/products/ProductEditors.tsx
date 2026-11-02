import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../lib/api';
import { pickImages } from '../../lib/pick-image';
import { ITEM_CONDITION_OPTIONS, LENGTH_UNIT_OPTIONS, slugify, splitTags, WEIGHT_UNIT_OPTIONS } from '../../lib/product-wizard-helpers';
import { fileService, productMeasuresService, productSeoService, productTagService, type Row } from '../../services/products-service';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { CloseIcon, PlusIcon } from '../icons';

// ── Tags ──

/** The product's tags: add several at once ("one, two") or remove one. */
export function TagEditor({ productId, tags, onChange }: { productId: string; tags: Row[]; onChange: () => void }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    const existing = new Set(tags.map(t => String(t.tagTitle).toLowerCase()));
    const titles = splitTags(text).filter(t => !existing.has(t.toLowerCase()));
    if (!titles.length) {
      setAdding(false);
      setText('');
      return;
    }
    setBusy(true);
    try {
      for (const title of titles) await productTagService.create({ productId, tagTitle: title, tagSlug: slugify(title) });
      toast(titles.length === 1 ? 'Tag added' : `${titles.length} tags added`);
      setText('');
      setAdding(false);
      onChange();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(tag: Row) {
    try {
      await productTagService.remove(tag.id);
      onChange();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  return (
    <View style={styles.tags}>
      {tags.map(tag => (
        <View key={tag.id} style={styles.tag}>
          <Text style={styles.tagText}>{String(tag.tagTitle)}</Text>
          <Pressable accessibilityLabel={`Remove tag ${tag.tagTitle}`} hitSlop={8} onPress={() => remove(tag)}>
            <CloseIcon size={12} color="#4f46e5" />
          </Pressable>
        </View>
      ))}
      {adding ? (
        <View style={styles.tagInputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            autoFocus
            placeholder="Tag, or one, two…"
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={add}
            returnKeyType="done"
            style={styles.tagInput}
          />
          {busy ? <ActivityIndicator color={colors.secondary} /> : null}
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={styles.addTag}>
          <PlusIcon size={12} color={colors.secondary} strokeWidth={2.4} />
          <Text style={styles.addTagText}>Add tag</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Measurements ──

type MeasureField = `${'product' | 'package'}${'Length' | 'Width' | 'Height' | 'Weight'}`;

type MeasuresForm = Record<MeasureField, string> & {
  productLengthMeasuringUnit: string;
  productWeightMeasuringUnit: string;
  packageLengthMeasuringUnit: string;
  packageWeightMeasuringUnit: string;
  packageQuantity: string;
  itemCondition: string;
  itemConditionNote: string;
};

function measuresForm(m: Row | undefined): MeasuresForm {
  const s = (k: string, d = '') => (m?.[k] == null ? d : String(m[k]));
  return {
    productLength: s('productLength'),
    productWidth: s('productWidth'),
    productHeight: s('productHeight'),
    productWeight: s('productWeight'),
    packageLength: s('packageLength'),
    packageWidth: s('packageWidth'),
    packageHeight: s('packageHeight'),
    packageWeight: s('packageWeight'),
    productLengthMeasuringUnit: s('productLengthMeasuringUnit', 'CM'),
    productWeightMeasuringUnit: s('productWeightMeasuringUnit', 'KG'),
    packageLengthMeasuringUnit: s('packageLengthMeasuringUnit', 'CM'),
    packageWeightMeasuringUnit: s('packageWeightMeasuringUnit', 'KG'),
    packageQuantity: s('packageQuantity', '1'),
    itemCondition: s('itemCondition', 'NEW'),
    itemConditionNote: s('itemConditionNote'),
  };
}

/** Product and package dimensions, weight and condition (the Seller Panel's Measurements). */
export function MeasuresSheet({
  visible,
  productId,
  measures,
  onClose,
  onSaved,
}: {
  visible: boolean;
  productId: string;
  measures: Row | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<MeasuresForm>(measuresForm(measures));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (visible) setForm(measuresForm(measures));
  }, [visible, measures]);
  const set = (patch: Partial<MeasuresForm>) => setForm(f => ({ ...f, ...patch }));

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        productId,
        ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? undefined : v])),
        packageQuantity: form.packageQuantity ? Number(form.packageQuantity) : undefined,
      };
      if (measures) await productMeasuresService.update(measures.id, payload);
      else await productMeasuresService.create(payload);
      toast('Measurements saved');
      onSaved();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  const dims = (prefix: 'product' | 'package') => (
    <>
      <View style={styles.row3}>
        {(['Length', 'Width', 'Height'] as const).map(d => {
          const key = `${prefix}${d}` as keyof MeasuresForm;
          return <NumberField key={key} label={d} value={form[key]} onChange={v => set({ [key]: v })} />;
        })}
      </View>
      <Units options={LENGTH_UNIT_OPTIONS} value={form[`${prefix}LengthMeasuringUnit`]} onChange={v => set({ [`${prefix}LengthMeasuringUnit`]: v })} />
      <View style={styles.row3}>
        <NumberField label="Weight" value={form[`${prefix}Weight`]} onChange={v => set({ [`${prefix}Weight`]: v })} />
      </View>
      <Units options={WEIGHT_UNIT_OPTIONS} value={form[`${prefix}WeightMeasuringUnit`]} onChange={v => set({ [`${prefix}WeightMeasuringUnit`]: v })} />
    </>
  );

  return (
    <Sheet visible={visible} title="Measurements" onClose={onClose} footer={<Button title="Save measurements" loading={saving} onPress={save} />}>
      <Text style={styles.section}>Product</Text>
      {dims('product')}
      <Text style={styles.section}>Package</Text>
      {dims('package')}
      <View style={styles.row3}>
        <NumberField label="Items in a package" value={form.packageQuantity} onChange={v => set({ packageQuantity: v.replace(/\D/g, '') })} />
      </View>
      <Text style={styles.section}>Condition</Text>
      <Units options={ITEM_CONDITION_OPTIONS.map(o => o.value)} labels={ITEM_CONDITION_OPTIONS.map(o => o.label)} value={form.itemCondition} onChange={v => set({ itemCondition: v })} />
      <TextInput
        value={form.itemConditionNote}
        onChangeText={v => set({ itemConditionNote: v })}
        placeholder="Condition note (optional)"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
    </Sheet>
  );
}

// ── SEO ──

interface SeoForm {
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImageFileId: string;
  ogImageUrl: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  structuredData: string;
}

function seoForm(seo: Row | undefined): SeoForm {
  const s = (k: string) => (seo?.[k] == null ? '' : String(seo[k]));
  return {
    canonicalUrl: s('canonicalUrl'),
    ogTitle: s('ogTitle'),
    ogDescription: s('ogDescription'),
    ogImageFileId: s('ogImageFileId'),
    ogImageUrl: (seo?.ogImage as { url?: string } | undefined)?.url ?? s('ogImageUrl'),
    robotsIndex: seo?.robotsIndex !== undefined ? Boolean(seo.robotsIndex) : true,
    robotsFollow: seo?.robotsFollow !== undefined ? Boolean(seo.robotsFollow) : true,
    structuredData: s('structuredData'),
  };
}

/** How the product appears in search engines and when shared (the Seller Panel's SEO tab). */
export function SeoSheet({
  visible,
  productId,
  seo,
  onClose,
  onSaved,
}: {
  visible: boolean;
  productId: string;
  seo: Row | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<SeoForm>(seoForm(seo));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (visible) setForm(seoForm(seo));
  }, [visible, seo]);
  const set = (patch: Partial<SeoForm>) => setForm(f => ({ ...f, ...patch }));

  async function pickImage() {
    try {
      const [file] = await pickImages({ multiple: false });
      if (!file) return;
      setUploading(true);
      const uploaded = await fileService.upload(file, 'product-seo');
      set({ ogImageFileId: String(uploaded.id), ogImageUrl: uploaded.url ?? file.uri });
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        canonicalUrl: form.canonicalUrl || undefined,
        ogTitle: form.ogTitle || undefined,
        ogDescription: form.ogDescription || undefined,
        ogImageFileId: form.ogImageFileId || undefined,
        robotsIndex: form.robotsIndex,
        robotsFollow: form.robotsFollow,
        structuredData: form.structuredData || undefined,
      };
      if (seo) await productSeoService.update(seo.id, payload);
      else await productSeoService.create({ productId, ...payload });
      toast('SEO details saved');
      onSaved();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} title="SEO" subtitle="How the product appears in search results and when its link is shared." onClose={onClose} footer={<Button title="Save SEO" loading={saving} onPress={save} />}>
      <LabeledInput label="Share title" value={form.ogTitle} onChange={v => set({ ogTitle: v })} />
      <LabeledInput label="Share description" value={form.ogDescription} onChange={v => set({ ogDescription: v })} multiline />
      <View>
        <Text style={styles.label}>Share image</Text>
        <View style={styles.ogRow}>
          {form.ogImageUrl ? <Image source={{ uri: form.ogImageUrl }} style={styles.ogImage} /> : <View style={[styles.ogImage, styles.ogEmpty]} />}
          <Pressable onPress={pickImage} disabled={uploading} style={styles.ogBtn}>
            <Text style={styles.ogBtnText}>{uploading ? 'Uploading…' : form.ogImageUrl ? 'Change' : 'Upload'}</Text>
          </Pressable>
          {form.ogImageUrl ? (
            <Pressable onPress={() => set({ ogImageFileId: '', ogImageUrl: '' })} style={styles.ogBtn}>
              <Text style={[styles.ogBtnText, styles.danger]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <LabeledInput label="Canonical URL" value={form.canonicalUrl} onChange={v => set({ canonicalUrl: v })} keyboardType="url" />
      <SwitchRow label="Let search engines index it" value={form.robotsIndex} onChange={v => set({ robotsIndex: v })} />
      <SwitchRow label="Let search engines follow its links" value={form.robotsFollow} onChange={v => set({ robotsFollow: v })} />
      <LabeledInput label="Structured data (JSON-LD)" value={form.structuredData} onChange={v => set({ structuredData: v })} multiline />
    </Sheet>
  );
}

// ── Small form parts ──

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.numberField}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={v => onChange(v.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        style={styles.input}
      />
    </View>
  );
}

function Units({ options, labels, value, onChange }: { options: string[]; labels?: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.units}>
      {options.map((o, i) => (
        <Pressable key={o} accessibilityRole="radio" accessibilityState={{ selected: value === o }} onPress={() => onChange(o)} style={[styles.unit, value === o && styles.unitOn]}>
          <Text style={[styles.unitText, value === o && styles.unitTextOn]}>{labels?.[i] ?? o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function LabeledInput({
  label,
  value,
  onChange,
  multiline,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'url' | 'decimal-pad' | 'number-pad' | 'email-address';
  placeholder?: string;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'url' ? 'none' : 'sentences'}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.secondary}
        accessibilityLabel={label}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

export function SwitchRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex}>
        <Text style={styles.switchLabel}>{label}</Text>
        {hint ? <Text style={styles.switchHint}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.secondary, false: colors.border }} thumbColor={colors.white} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full, backgroundColor: '#eef2ff' },
  tagText: { fontFamily: fonts.semibold, fontSize: 12, color: '#4338ca' },
  tagInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagInput: {
    minWidth: 140,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.secondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
  },
  addTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.secondarySoft },
  addTagText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.secondary },
  section: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  row3: { flexDirection: 'row', gap: 8 },
  numberField: { flex: 1 },
  label: { marginBottom: 5, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  unit: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  unitOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  unitText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  unitTextOn: { color: colors.white },
  ogRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ogImage: { width: 64, height: 64, borderRadius: radius.md },
  ogEmpty: { backgroundColor: colors.background, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  ogBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  ogBtnText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  danger: { color: colors.error },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  switchHint: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
});
