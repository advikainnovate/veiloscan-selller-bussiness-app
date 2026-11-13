import React, { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { SHOP_URL } from '../../config/env';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { api, extractErrorMessage } from '../../lib/api';
import { formatWhen } from '../../lib/date';
import { formatRupees } from '../../lib/format';
import type { ProductVariant } from '../../services/product-builder-service';
import { productsService, type Row } from '../../services/products-service';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { Choices, DateField, Field, Input, SelectField } from '../form/Fields';
import { SwitchRow } from './ProductEditors';
import { CheckIcon } from '../icons';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

// Private, expiring links to chosen variants of a product (eshop-backend /product-share-links).
type ShareLinkStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';
type PriceVisibility = 'STORE' | 'SHOW' | 'HIDE';

interface ShareLink {
  id: string;
  path: string;
  url: string | null;
  status: ShareLinkStatus;
  recipientLabel: string | null;
  priceVisibility: PriceVisibility;
  expiresAt: string;
  createdAt: string;
  viewCount: number;
  lastViewedAt: string | null;
  store: { id: string; name: string; slug: string } | null;
  variants: { id: string; sku: string; label: string | null; currentPrice: number | null; priceChanged: boolean }[];
}

const shareLinks = {
  list: (productId: string): Promise<ShareLink[]> => api.get('/product-share-links', { params: { productId } }).then(r => (Array.isArray(r.data) ? r.data : [])),
  create: (payload: Record<string, unknown>): Promise<ShareLink> => api.post('/product-share-links', payload).then(r => r.data),
  revoke: (id: string): Promise<ShareLink> => api.post(`/product-share-links/${id}/revoke`).then(r => r.data),
  extend: (id: string, expiresInMinutes: number): Promise<ShareLink> => api.post(`/product-share-links/${id}/extend`, { expiresInMinutes }).then(r => r.data),
};

const EXPIRY_PRESETS = [
  { minutes: 60, get label() { return i18n.t('products.n1Hour'); } },
  { minutes: 6 * 60, get label() { return i18n.t('products.n6Hours'); } },
  { minutes: 12 * 60, get label() { return i18n.t('products.n12Hours'); } },
  { minutes: 24 * 60, get label() { return i18n.t('products.n24Hours'); } },
  { minutes: 3 * 24 * 60, get label() { return i18n.t('products.n3Days'); } },
  { minutes: 7 * 24 * 60, get label() { return i18n.t('products.n7Days'); } },
];
const MAX_DAYS = 30;

const PRICE_CHOICES: { value: PriceVisibility; label: string; hint: string }[] = [
  { value: 'SHOW', get label() { return i18n.t('products.showPrices'); }, get hint() { return i18n.t('products.eachVariantsLivePriceEvenIf'); } },
  { value: 'HIDE', get label() { return i18n.t('products.hidePrices'); }, get hint() { return i18n.t('products.noPricesBagOrCheckoutOnly'); } },
  { value: 'STORE', get label() { return i18n.t('products.sameAsStore'); }, get hint() { return i18n.t('products.pricesShowOnlyIfTheStore'); } },
];

const STATUS_TONE = { ACTIVE: 'green', EXPIRED: 'slate', REVOKED: 'red' } as const;

const linkUrl = (link: ShareLink) => link.url ?? `${SHOP_URL}${link.path}`;
const variantsText = (link: ShareLink) => {
  const labels = link.variants.map(v => v.label ?? v.sku);
  if (!labels.length) return i18n.t('products.variantRemoved');
  return labels.length > 2 ? i18n.t('products.joinLengthMore', { join: labels.slice(0, 2).join(', '), length: labels.length - 2 }) : labels.join(', ');
};

/** Share a product: a private expiring link to chosen variants, or its public store page (the Seller Panel's Share). */
export function ShareProductSheet({ visible, product, variants, onClose }: { visible: boolean; product: Row; variants: ProductVariant[]; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const productId = product.id;
  const name = String(product.productName ?? '');
  const [tab, setTab] = useState<'variant' | 'store' | 'links'>('variant');
  const [storeId, setStoreId] = useState('');
  const [variantIds, setVariantIds] = useState<string[]>([]);
  const [priceVisibility, setPriceVisibility] = useState<PriceVisibility>('SHOW');
  const [showSpecifications, setShowSpecifications] = useState(true);
  const [expiry, setExpiry] = useState<number | 'custom'>(12 * 60);
  const [customDate, setCustomDate] = useState('');
  const [recipient, setRecipient] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyLink, setBusyLink] = useState<string | null>(null);
  const stores = useFetch(() => (visible ? productsService.stores() : Promise.resolve([])), [visible]);
  const links = useFetch(() => (visible ? shareLinks.list(productId) : Promise.resolve([])), [visible, productId]);

  const storeIds = (product.storeIds as string[] | undefined) ?? [];
  const live = (stores.data ?? []).filter(s => (product.storeScope !== 'SPECIFIC_STORES' || storeIds.includes(s.id)) && s.status === 'ACTIVE');
  const store = live.find(s => s.id === storeId) ?? live[0];
  const sellable = useMemo(() => variants.filter(v => v.status === 1), [variants]);
  // A product with one variant shares it.
  const chosen = sellable.length === 1 ? sellable : sellable.filter(v => variantIds.includes(v.id));
  const storeUrl = store ? `${SHOP_URL}/shops/${encodeURIComponent(store.slug || store.code.toLowerCase())}/products/${encodeURIComponent(String(product.productSlug ?? ''))}` : '';

  async function share(url: string, message: string) {
    try {
      await Share.share({ message: `${message}\n${url}`, url, title: name });
    } catch {
      // Dismissed.
    }
  }

  async function create() {
    if (!store || !chosen.length) return;
    let expiryPayload: Record<string, unknown>;
    if (expiry === 'custom') {
      if (!customDate) return toast(t('products.pickTheExpiryDate'), 'error');
      // The end of the chosen day, within 30 days.
      const at = new Date(`${customDate}T23:59:00`);
      const days = (at.getTime() - Date.now()) / 86_400_000;
      if (days <= 0 || days > MAX_DAYS) return toast(t('products.pickAnExpiryWithinMaxDays', { MAX_DAYS }), 'error');
      expiryPayload = { expiresAt: at.toISOString() };
    } else expiryPayload = { expiresInMinutes: expiry };
    setCreating(true);
    try {
      const link = await shareLinks.create({
        productId,
        variantIds: chosen.map(v => v.id),
        storeId: store.id,
        priceVisibility,
        showSpecifications,
        recipientLabel: recipient.trim() || undefined,
        ...expiryPayload,
      });
      links.reload();
      setRecipient('');
      await share(linkUrl(link), `${name} — ${variantsText(link)}`);
      setTab('links');
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setCreating(false);
    }
  }

  async function act(link: ShareLink, action: () => Promise<unknown>, message: string) {
    setBusyLink(link.id);
    try {
      await action();
      toast(message);
      links.reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setBusyLink(null);
    }
  }

  return (
    <Sheet visible={visible} title={t('products.shareProduct')} subtitle={name} onClose={onClose}>
      <Choices
        options={[
          { value: 'variant', label: t('products.shareVariants') },
          { value: 'store', label: t('products.storePage') },
          { value: 'links', label: links.data?.length ? t('products.linksWithCount', { count: links.data.length }) : t('products.links') },
        ]}
        value={tab}
        onChange={v => setTab(v as typeof tab)}
      />

      {!live.length && !stores.loading ? <Text style={styles.muted}>{t('products.theProductIsnTSoldIn')}</Text> : null}

      {tab !== 'links' && live.length > 1 ? (
        <SelectField label={t('common.store')} value={store?.id ?? ''} options={live.map(s => ({ value: s.id, label: s.name }))} onChange={setStoreId} />
      ) : null}

      {tab === 'store' && store ? (
        <>
          <Text style={styles.url} selectable>
            {storeUrl}
          </Text>
          <Button title={t('products.shareStorePage')} onPress={() => share(storeUrl, t('products.nameAtName2', { name, name2: store.name }))} />
        </>
      ) : null}

      {tab === 'variant' && store ? (
        <>
          <Text style={styles.muted}>{t('products.aPrivateLinkThatExpiresIt')}</Text>
          {sellable.length > 1 ? (
            <Field label={t('products.variants')}>
              {sellable.map(v => {
                const on = variantIds.includes(v.id);
                return (
                  <Pressable
                    key={v.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    onPress={() => setVariantIds(ids => (on ? ids.filter(x => x !== v.id) : [...ids, v.id]))}
                    style={[styles.variant, on && styles.variantOn]}
                  >
                    <View style={[styles.check, on && styles.checkOn]}>{on ? <CheckIcon size={12} color={colors.white} strokeWidth={3} /> : null}</View>
                    <Text style={styles.variantText}>{v.label}</Text>
                    <Text style={styles.muted}>{formatRupees(v.sellingPrice)}</Text>
                  </Pressable>
                );
              })}
            </Field>
          ) : null}
          <Field label={t('products.prices')}>
            <Choices options={PRICE_CHOICES} value={priceVisibility} onChange={v => setPriceVisibility(v as PriceVisibility)} />
            <Text style={styles.muted}>{PRICE_CHOICES.find(p => p.value === priceVisibility)?.hint}</Text>
          </Field>
          <SwitchRow label={t('products.showSpecifications')} value={showSpecifications} onChange={setShowSpecifications} />
          <Field label={t('products.expiresIn')}>
            <Choices
              options={[...EXPIRY_PRESETS.map(p => ({ value: String(p.minutes), label: p.label })), { value: 'custom', label: t('products.pickADate') }]}
              value={String(expiry)}
              onChange={v => setExpiry(v === 'custom' ? 'custom' : Number(v))}
            />
          </Field>
          {expiry === 'custom' ? <DateField label={t('products.expiresAtTheEndOf')} value={customDate} onChange={setCustomDate} minimumDate={new Date()} /> : null}
          <Field label={t('products.forOptional')} hint={t('products.aNoteToRecogniseTheLink')}>
            <Input value={recipient} onChangeText={setRecipient} placeholder="e.g. Ravi — bulk enquiry" />
          </Field>
          <Button
            title={chosen.length ? t('products.createAndShareLinkChosencount', { chosenCount: chosen.length }) : t('products.chooseTheVariantsToShare')}
            loading={creating}
            disabled={!chosen.length}
            onPress={create}
          />
        </>
      ) : null}

      {tab === 'links' ? (
        (links.data ?? []).length ? (
          (links.data ?? []).map(link => (
            <View key={link.id} style={styles.link}>
              <View style={styles.linkHead}>
                <Badge label={link.status.toLowerCase()} tone={STATUS_TONE[link.status]} />
                <Text style={styles.linkTitle} numberOfLines={1}>
                  {link.recipientLabel || variantsText(link)}
                </Text>
              </View>
              <Text style={styles.muted}>
                {[variantsText(link), t('products.viewCount', { count: link.viewCount }), link.lastViewedAt ? t('products.lastViewedOn', { date: formatWhen(link.lastViewedAt) }) : null].filter(Boolean).join(' · ')}
              </Text>
              <Text style={styles.muted}>
                {link.status === 'ACTIVE' ? t('products.expiresOn', { date: formatWhen(link.expiresAt) }) : t('products.endedOn', { date: formatWhen(link.expiresAt) })}
                {link.store ? ` · ${link.store.name}` : ''}
              </Text>
              {link.status === 'ACTIVE' ? (
                <View style={styles.linkActions}>
                  <Pressable onPress={() => share(linkUrl(link), `${name} — ${variantsText(link)}`)} hitSlop={6}>
                    <Text style={styles.action}>{t('common.share')}</Text>
                  </Pressable>
                  <Pressable disabled={busyLink === link.id} onPress={() => act(link, () => shareLinks.extend(link.id, 24 * 60), t('products.linkExtendedBy24Hours'))} hitSlop={6}>
                    <Text style={styles.action}>{t('products.n24Hours2')}</Text>
                  </Pressable>
                  <Pressable disabled={busyLink === link.id} onPress={() => act(link, () => shareLinks.revoke(link.id), t('products.linkRevoked'))} hitSlop={6}>
                    <Text style={[styles.action, styles.danger]}>{t('products.revoke')}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.muted}>{links.loading ? t('common.loading') : t('products.noLinksYet')}</Text>
        )
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary },
  url: { padding: 12, borderRadius: radius.md, backgroundColor: colors.background, fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  variant: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  variantOn: { borderColor: colors.secondary, backgroundColor: '#fffaf5' },
  variantText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  check: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  link: { gap: 4, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  linkHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  linkActions: { marginTop: 4, flexDirection: 'row', gap: 18 },
  action: { fontFamily: fonts.bold, fontSize: 13, color: colors.secondary },
  danger: { color: colors.error },
});
