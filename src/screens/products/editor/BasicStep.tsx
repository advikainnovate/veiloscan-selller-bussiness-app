import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../../theme';
import { useToast } from '../../../context/ToastContext';
import { useFetch } from '../../../hooks/useFetch';
import { extractErrorMessage } from '../../../lib/api';
import { pickImages } from '../../../lib/pick-image';
import { slugify, splitTags } from '../../../lib/product-wizard-helpers';
import { cleanSku, generateSku, SKU_MAX, SKU_MIN, skuError } from '../../../lib/sku';
import { productBuilderService } from '../../../services/product-builder-service';
import { fileService, productsService, type ProductStoreScope } from '../../../services/products-service';
import { Choices, Field, Input, Section, SelectField } from '../../../components/form/Fields';
import { SwitchRow } from '../../../components/products/ProductEditors';
import { CloseIcon, PlusIcon, StarIcon } from '../../../components/icons';
import { KEY_FEATURE_COUNT, type MediaItem, type ProductFormValues, type TagItem } from './types';

const PRODUCT_ID_TYPES = ['SKU', 'UPC', 'EAN', 'ISBN', 'GTIN', 'MPN'];

export interface ProductScope {
  storeScope: ProductStoreScope;
  storeIds: string[];
}

/** Returns a message when the scope can't be saved yet. */
export function scopeError(scope: ProductScope): string | null {
  if (scope.storeScope === 'SPECIFIC_STORES' && !scope.storeIds.length) return 'Select at least one store, or choose All Stores.';
  return null;
}

type Update = <K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]) => void;

/**
 * Basic Information, as the Seller Panel's first step: where it's sold, the
 * name / SKU / category / brand, descriptions, photos, tags, labels and the
 * extra store details (highlights, search, policies).
 */
export function BasicStep({
  product,
  update,
  scope,
  setScope,
  media,
  setMedia,
  tags,
  setTags,
}: {
  product: ProductFormValues;
  update: Update;
  scope: ProductScope;
  setScope: (s: ProductScope) => void;
  media: MediaItem[];
  setMedia: React.Dispatch<React.SetStateAction<MediaItem[]>>;
  tags: TagItem[];
  setTags: React.Dispatch<React.SetStateAction<TagItem[]>>;
}) {
  const toast = useToast();
  const stores = useFetch(() => productsService.stores(), []);
  const storeIds = scope.storeScope === 'SPECIFIC_STORES' ? scope.storeIds : null;
  const storeKey = storeIds ? [...storeIds].sort().join(',') : 'all';
  const pickable = useFetch(() => productBuilderService.categoriesForProducts(storeIds, product.categoryId || undefined), [storeKey]);
  const brandOptions = useFetch(
    () =>
      product.categoryId
        ? productBuilderService.brandsForProducts({ categoryId: product.categoryId, storeIds, includeBrandId: product.brandId || undefined })
        : Promise.resolve({ selectableIds: [], brands: [] }),
    [product.categoryId, storeKey],
  );
  const config = useFetch(() => (product.categoryId ? productBuilderService.configuration(product.categoryId) : Promise.resolve(null)), [product.categoryId]);
  const [uploading, setUploading] = useState(0);
  const [tagDraft, setTagDraft] = useState('');

  // ── Category: Main → Sub → Child (only a child category completes the choice) ──
  const categories = useMemo(() => pickable.data?.categories ?? [], [pickable.data]);
  const selectable = pickable.data?.restricted ? new Set(pickable.data.selectableIds) : null;
  const byId = new Map(categories.map(c => [c.id, c]));
  const child = byId.get(product.categoryId);
  const [picked, setPicked] = useState({ main: '', sub: '' });
  const sub = product.categoryId ? child?.parentCategoryId ?? '' : picked.sub;
  const main = product.categoryId ? byId.get(sub)?.parentCategoryId ?? '' : picked.main;
  const optionsOf = (type: string, parent?: string) =>
    categories
      .filter(c => c.categoryType === type && (parent === undefined || c.parentCategoryId === parent))
      .filter(c => type !== 'CHILD_CATEGORY' || !selectable || selectable.has(c.id) || c.id === product.categoryId)
      .map(c => ({
        value: c.id,
        label: type === 'CHILD_CATEGORY' && selectable && !selectable.has(c.id) ? `${c.categoryTitle} (not mapped to your store)` : c.categoryTitle,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  const categoryNotMapped = !!selectable && !!product.categoryId && !selectable.has(product.categoryId);

  const brands = brandOptions.data?.brands ?? [];
  const approvedBrands = new Set(brandOptions.data?.selectableIds ?? []);
  const brandNotApproved = !!product.brandId && !!brandOptions.data && !approvedBrands.has(product.brandId);

  async function addPhotos() {
    try {
      const files = await pickImages();
      if (!files.length) return;
      setUploading(files.length);
      for (const file of files) {
        const uploaded = await fileService.upload(file, 'products');
        setMedia(prev => [...prev, { fileId: uploaded.id, url: uploaded.url ?? file.uri, altText: '', isPrimary: prev.length === 0 }]);
        setUploading(n => n - 1);
      }
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setUploading(0);
    }
  }

  function addTags() {
    const titles = splitTags(tagDraft);
    setTagDraft('');
    setTags(prev => {
      const taken = new Set(prev.map(t => t.tagTitle.toLowerCase()));
      return [...prev, ...titles.filter(t => !taken.has(t.toLowerCase())).map(t => ({ tagTitle: t, tagSlug: slugify(t) }))];
    });
  }

  const setAt = (key: 'keyFeatures' | 'searchTerms', index: number, value: string) =>
    update(key, product[key].map((v, i) => (i === index ? value : v)));

  return (
    <View style={styles.wrap}>
      <Section title="Where it's sold" subtitle="All your stores (including ones added later), or only the stores you pick.">
        <Choices
          options={[
            { value: 'ALL_STORES', label: 'All stores' },
            { value: 'SPECIFIC_STORES', label: 'Specific stores' },
          ]}
          value={scope.storeScope}
          onChange={v => setScope({ ...scope, storeScope: v as ProductStoreScope })}
        />
        {scope.storeScope === 'SPECIFIC_STORES' ? (
          <View style={styles.storeList}>
            {(stores.data ?? []).map(s => {
              const on = scope.storeIds.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => setScope({ ...scope, storeIds: on ? scope.storeIds.filter(x => x !== s.id) : [...scope.storeIds, s.id] })}
                  style={[styles.store, on && styles.storeOn]}
                >
                  <Text style={[styles.storeText, on && styles.storeTextOn]}>{s.name}</Text>
                  <Text style={styles.storeCode}>{s.code}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Section>

      <Section title="Basic information" subtitle="The basic details about your product.">
        <Field label="Product name" required hint="A clear, descriptive name.">
          <Input
            value={product.productName}
            placeholder="e.g. India Gate Basmati Rice 5kg"
            onChangeText={name => {
              update('productName', name);
              if (!product.slugTouched) update('productSlug', slugify(name));
            }}
          />
        </Field>
        <Field
          label="SKU"
          required
          error={product.skuItemNumber ? skuError(product.skuItemNumber) : null}
          hint={`Type one or generate it from the name · ${product.skuItemNumber.length}/${SKU_MAX} (min ${SKU_MIN})`}
        >
          <View style={styles.skuRow}>
            <Input
              value={product.skuItemNumber}
              placeholder="e.g. AERO-BD120-7K2Q"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={SKU_MAX}
              onChangeText={v => update('skuItemNumber', cleanSku(v))}
              style={styles.flex}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!product.productName.trim()}
              onPress={() => update('skuItemNumber', generateSku(product.productName))}
              style={[styles.generate, !product.productName.trim() && styles.disabled]}
            >
              <Text style={styles.generateText}>Generate</Text>
            </Pressable>
          </View>
        </Field>
        <Field label="Product ID type">
          <Choices options={PRODUCT_ID_TYPES.map(t => ({ value: t, label: t }))} value={product.productIdType} onChange={v => update('productIdType', v)} />
        </Field>
        <SelectField
          label="Main category"
          required
          value={main}
          options={optionsOf('MAIN_CATEGORY')}
          onChange={v => {
            setPicked({ main: v, sub: '' });
            if (product.categoryId) update('categoryId', '');
          }}
        />
        <SelectField
          label="Sub category"
          required
          disabled={!main}
          placeholder={main ? 'Select sub category' : 'Choose a main category first'}
          value={sub}
          options={main ? optionsOf('SUB_CATEGORY', main) : []}
          emptyText="No sub categories"
          onChange={v => {
            setPicked({ main, sub: v });
            if (product.categoryId) update('categoryId', '');
          }}
        />
        <SelectField
          label="Child category"
          required
          disabled={!sub}
          hint="Its specifications and variants drive the next steps."
          placeholder={sub ? 'Select child category' : 'Choose a sub category first'}
          value={product.categoryId}
          options={sub ? optionsOf('CHILD_CATEGORY', sub) : []}
          emptyText={pickable.data?.restricted ? 'No child categories mapped to your stores here' : 'No child categories'}
          onChange={v => {
            update('categoryId', v);
            update('brandId', '');
          }}
        />
        {categoryNotMapped ? <Text style={styles.warn}>This category isn't mapped to the product's stores any more. Pick another to submit it.</Text> : null}
        {config.data ? (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>This category loads</Text>
            <Text style={styles.previewText}>
              {config.data.specifications.length} specification{config.data.specifications.length === 1 ? '' : 's'}
              {config.data.specifications.some(s => s.required) ? ` (${config.data.specifications.filter(s => s.required).length} required)` : ''} ·{' '}
              {config.data.variantAttributes.length
                ? config.data.variantAttributes.map(a => `${a.title} (${a.options.length})`).join(', ')
                : 'no variant attributes — sold as a single SKU'}
            </Text>
          </View>
        ) : null}
        <SelectField
          label="Brand"
          disabled={!product.categoryId}
          placeholder={product.categoryId ? 'No brand' : 'Choose the category first'}
          hint="Brands approved for this category in your stores."
          allowClear="No brand"
          value={product.brandId}
          options={brands.map(b => ({ value: b.id, label: approvedBrands.has(b.id) ? b.title : `${b.title} (not approved here)` }))}
          emptyText="No brands approved for this category yet — request one from Brand Approvals."
          onChange={v => update('brandId', v)}
        />
        {brandNotApproved ? <Text style={styles.warn}>This brand isn't approved for the category in these stores.</Text> : null}
        <Field label="Slug" required hint="The product's web address on the store.">
          <Input
            value={product.productSlug}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={v => {
              update('slugTouched', true);
              update('productSlug', slugify(v));
            }}
          />
        </Field>
        <SwitchRow
          label="Has an expiry date"
          hint="Perishable: expiry batches must be recorded in the Inventory step."
          value={product.requiresExpiry}
          onChange={v => update('requiresExpiry', v)}
        />
        <Field label="Short description">
          <Input value={product.productShortDescription} onChangeText={v => update('productShortDescription', v)} multiline placeholder="One or two lines shown near the price." />
        </Field>
        <Field label="Description" hint="Shown on the product page.">
          <Input value={product.productLongDescription} onChangeText={v => update('productLongDescription', v)} multiline style={styles.long} />
        </Field>
      </Section>

      <Section title={`Photos (${media.length})`} subtitle="The first photo is the cover; tap ★ to change it.">
        <View style={styles.grid}>
          {media.map((m, i) => (
            <View key={`${m.fileId}`} style={styles.photo}>
              {m.url ? <Image source={{ uri: m.url }} style={styles.photoImg} /> : <View style={styles.photoImg} />}
              {m.isPrimary ? (
                <View style={styles.cover}>
                  <Text style={styles.coverText}>Cover</Text>
                </View>
              ) : (
                <Pressable
                  accessibilityLabel="Make cover photo"
                  onPress={() => setMedia(prev => prev.map((x, j) => ({ ...x, isPrimary: j === i })))}
                  style={[styles.photoBtn, styles.left]}
                >
                  <StarIcon size={13} color={colors.white} />
                </Pressable>
              )}
              <Pressable
                accessibilityLabel="Remove photo"
                onPress={() =>
                  setMedia(prev => {
                    const next = prev.filter((_, j) => j !== i);
                    if (next.length && !next.some(x => x.isPrimary)) next[0] = { ...next[0], isPrimary: true };
                    return next;
                  })
                }
                style={[styles.photoBtn, styles.right]}
              >
                <CloseIcon size={13} color={colors.white} />
              </Pressable>
            </View>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Add photos" disabled={uploading > 0} onPress={addPhotos} style={[styles.photo, styles.addPhoto]}>
            {uploading ? <ActivityIndicator color={colors.secondary} /> : <PlusIcon size={22} color={colors.secondary} strokeWidth={2.2} />}
            <Text style={styles.addText}>{uploading ? `Uploading ${uploading}…` : 'Add'}</Text>
          </Pressable>
        </View>
      </Section>

      <Section title="Tags" subtitle="Type one, or several separated by commas.">
        <View style={styles.tags}>
          {tags.map((t, i) => (
            <View key={`${t.tagSlug}${i}`} style={styles.tag}>
              <Text style={styles.tagText}>{t.tagTitle}</Text>
              <Pressable accessibilityLabel={`Remove tag ${t.tagTitle}`} hitSlop={8} onPress={() => setTags(prev => prev.filter((_, j) => j !== i))}>
                <CloseIcon size={12} color="#4f46e5" />
              </Pressable>
            </View>
          ))}
        </View>
        <View style={styles.skuRow}>
          <Input value={tagDraft} onChangeText={setTagDraft} placeholder="e.g. organic, gluten-free" onSubmitEditing={addTags} returnKeyType="done" style={styles.flex} />
          <Pressable accessibilityRole="button" onPress={addTags} disabled={!tagDraft.trim()} style={[styles.generate, !tagDraft.trim() && styles.disabled]}>
            <Text style={styles.generateText}>Add</Text>
          </Pressable>
        </View>
      </Section>

      <Section title="Labels" subtitle="Highlighted on the store.">
        <SwitchRow label="Featured" value={product.isFeatured} onChange={v => update('isFeatured', v)} />
        <SwitchRow label="New arrival" value={product.isNewArrival} onChange={v => update('isNewArrival', v)} />
        <SwitchRow label="Best seller" value={product.isBestSeller} onChange={v => update('isBestSeller', v)} />
      </Section>

      <Section
        title="Key features"
        subtitle={`Up to ${KEY_FEATURE_COUNT} short highlights, listed under “About this product” in the store. ${product.keyFeatures.filter(v => v.trim()).length}/${KEY_FEATURE_COUNT} added.`}
      >
        {product.keyFeatures.map((v, i) => (
          <Input key={i} value={v} maxLength={500} placeholder={`Highlight ${i + 1}`} onChangeText={t => setAt('keyFeatures', i, t)} accessibilityLabel={`Key feature ${i + 1}`} />
        ))}
      </Section>

      <Section title="Search" subtitle="Besides its name, store search also matches these words.">
        <Field label="Search keywords" hint="Comma-separated, e.g. basmati, long grain, biryani rice">
          <Input value={product.searchKeywords} maxLength={1000} onChangeText={v => update('searchKeywords', v)} multiline />
        </Field>
        {product.searchTerms.map((v, i) => (
          <Input key={i} value={v} maxLength={255} placeholder={`Search phrase ${i + 1}`} onChangeText={t => setAt('searchTerms', i, t)} accessibilityLabel={`Search term ${i + 1}`} />
        ))}
      </Section>

      <Section title="Terms & legal" subtitle="Optional. Shown on the product page under “Terms & disclaimer”.">
        <Field label="Terms & conditions" hint={`${product.termsAndConditions.length}/2000`}>
          <Input value={product.termsAndConditions} maxLength={2000} onChangeText={v => update('termsAndConditions', v)} multiline />
        </Field>
        <Field label="Legal disclaimer" hint={`${product.legalDisclaimer.length}/2000`}>
          <Input value={product.legalDisclaimer} maxLength={2000} onChangeText={v => update('legalDisclaimer', v)} multiline />
        </Field>
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 14 },
  disabled: { opacity: 0.45 },
  storeList: { gap: 8 },
  store: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  storeOn: { borderColor: colors.secondary, backgroundColor: '#fffaf5' },
  storeText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  storeTextOn: { color: colors.secondaryDark },
  storeCode: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  skuRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  generate: { height: 46, paddingHorizontal: 14, borderRadius: radius.md, justifyContent: 'center', backgroundColor: colors.primary },
  generateText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.white },
  warn: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.warningDark },
  preview: { padding: 12, borderRadius: radius.md, backgroundColor: colors.primaryLight, gap: 3 },
  previewTitle: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text },
  previewText: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary },
  long: { minHeight: 140 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { width: '30.5%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.background },
  photoImg: { width: '100%', height: '100%' },
  cover: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.secondary },
  coverText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.white },
  photoBtn: { position: 'absolute', top: 6, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3,19,41,0.55)' },
  left: { left: 6 },
  right: { right: 6 },
  addPhoto: { alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.secondarySoft, backgroundColor: '#fffaf5' },
  addText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.secondary },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full, backgroundColor: '#eef2ff' },
  tagText: { fontFamily: fonts.semibold, fontSize: 12, color: '#4338ca' },
});
