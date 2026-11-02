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
  { minutes: 60, label: '1 hour' },
  { minutes: 6 * 60, label: '6 hours' },
  { minutes: 12 * 60, label: '12 hours' },
  { minutes: 24 * 60, label: '24 hours' },
  { minutes: 3 * 24 * 60, label: '3 days' },
  { minutes: 7 * 24 * 60, label: '7 days' },
];
const MAX_DAYS = 30;

const PRICE_CHOICES: { value: PriceVisibility; label: string; hint: string }[] = [
  { value: 'SHOW', label: 'Show prices', hint: "Each variant's live price, even if the store hides prices." },
  { value: 'HIDE', label: 'Hide prices', hint: 'No prices, bag or checkout — only details.' },
  { value: 'STORE', label: 'Same as store', hint: 'Prices show only if the store shows them.' },
];

const STATUS_TONE = { ACTIVE: 'green', EXPIRED: 'slate', REVOKED: 'red' } as const;

const linkUrl = (link: ShareLink) => link.url ?? `${SHOP_URL}${link.path}`;
const variantsText = (link: ShareLink) => {
  const labels = link.variants.map(v => v.label ?? v.sku);
  if (!labels.length) return 'Variant removed';
  return labels.length > 2 ? `${labels.slice(0, 2).join(', ')} +${labels.length - 2} more` : labels.join(', ');
};

/** Share a product: a private expiring link to chosen variants, or its public store page (the Seller Panel's Share). */
export function ShareProductSheet({ visible, product, variants, onClose }: { visible: boolean; product: Row; variants: ProductVariant[]; onClose: () => void }) {
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
      if (!customDate) return toast('Pick the expiry date', 'error');
      // The end of the chosen day, within 30 days.
      const at = new Date(`${customDate}T23:59:00`);
      const days = (at.getTime() - Date.now()) / 86_400_000;
      if (days <= 0 || days > MAX_DAYS) return toast(`Pick an expiry within ${MAX_DAYS} days`, 'error');
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
    <Sheet visible={visible} title="Share product" subtitle={name} onClose={onClose}>
      <Choices
        options={[
          { value: 'variant', label: 'Share variants' },
          { value: 'store', label: 'Store page' },
          { value: 'links', label: `Links${links.data?.length ? ` (${links.data.length})` : ''}` },
        ]}
        value={tab}
        onChange={v => setTab(v as typeof tab)}
      />

      {!live.length && !stores.loading ? <Text style={styles.muted}>The product isn't sold in an active store yet, so it can't be shared.</Text> : null}

      {tab !== 'links' && live.length > 1 ? (
        <SelectField label="Store" value={store?.id ?? ''} options={live.map(s => ({ value: s.id, label: s.name }))} onChange={setStoreId} />
      ) : null}

      {tab === 'store' && store ? (
        <>
          <Text style={styles.url} selectable>
            {storeUrl}
          </Text>
          <Button title="Share store page" onPress={() => share(storeUrl, `${name} at ${store.name}`)} />
        </>
      ) : null}

      {tab === 'variant' && store ? (
        <>
          <Text style={styles.muted}>A private link that expires. It always shows live prices (when prices are shown).</Text>
          {sellable.length > 1 ? (
            <Field label="Variants">
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
          <Field label="Prices">
            <Choices options={PRICE_CHOICES} value={priceVisibility} onChange={v => setPriceVisibility(v as PriceVisibility)} />
            <Text style={styles.muted}>{PRICE_CHOICES.find(p => p.value === priceVisibility)?.hint}</Text>
          </Field>
          <SwitchRow label="Show specifications" value={showSpecifications} onChange={setShowSpecifications} />
          <Field label="Expires in">
            <Choices
              options={[...EXPIRY_PRESETS.map(p => ({ value: String(p.minutes), label: p.label })), { value: 'custom', label: 'Pick a date' }]}
              value={String(expiry)}
              onChange={v => setExpiry(v === 'custom' ? 'custom' : Number(v))}
            />
          </Field>
          {expiry === 'custom' ? <DateField label="Expires at the end of" value={customDate} onChange={setCustomDate} minimumDate={new Date()} /> : null}
          <Field label="For (optional)" hint="A note to recognise the link, e.g. the customer's name.">
            <Input value={recipient} onChangeText={setRecipient} placeholder="e.g. Ravi — bulk enquiry" />
          </Field>
          <Button
            title={chosen.length ? `Create & share link (${chosen.length})` : 'Choose the variants to share'}
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
                {variantsText(link)} · {link.viewCount} view{link.viewCount === 1 ? '' : 's'}
                {link.lastViewedAt ? ` · last ${formatWhen(link.lastViewedAt)}` : ''}
              </Text>
              <Text style={styles.muted}>
                {link.status === 'ACTIVE' ? 'Expires' : 'Ended'} {formatWhen(link.expiresAt)}
                {link.store ? ` · ${link.store.name}` : ''}
              </Text>
              {link.status === 'ACTIVE' ? (
                <View style={styles.linkActions}>
                  <Pressable onPress={() => share(linkUrl(link), `${name} — ${variantsText(link)}`)} hitSlop={6}>
                    <Text style={styles.action}>Share</Text>
                  </Pressable>
                  <Pressable disabled={busyLink === link.id} onPress={() => act(link, () => shareLinks.extend(link.id, 24 * 60), 'Link extended by 24 hours')} hitSlop={6}>
                    <Text style={styles.action}>+24 hours</Text>
                  </Pressable>
                  <Pressable disabled={busyLink === link.id} onPress={() => act(link, () => shareLinks.revoke(link.id), 'Link revoked')} hitSlop={6}>
                    <Text style={[styles.action, styles.danger]}>Revoke</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.muted}>{links.loading ? 'Loading…' : 'No links yet.'}</Text>
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
