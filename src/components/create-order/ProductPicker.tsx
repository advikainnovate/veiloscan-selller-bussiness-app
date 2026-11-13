import React, { useEffect, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../../theme';
import { useFetch } from '../../hooks/useFetch';
import { priceText } from '../../lib/order-lines';
import { sellingOf } from '../../lib/selling';
import { sellerOrderService, type CatalogItem } from '../../services/seller-order-service';
import { EmptyState, ErrorState, FilterChips, ListSkeleton, SearchBar } from '../list/ListParts';
import { BoxIcon, CheckIcon, CloseIcon, PlusIcon } from '../icons';
import { useTranslation } from 'react-i18next';

const SEARCH_DELAY_MS = 300;

/**
 * The store's catalog to add items from: search (name, SKU, barcode) and
 * categories. Tapping an item adds it at its starting quantity; `inOrder`
 * badges what's already in the order.
 */
export function ProductPicker({
  visible,
  storeId,
  inOrder,
  onAdd,
  onClose,
}: {
  visible: boolean;
  storeId: string;
  inOrder: Map<string, number>;
  onAdd: (item: CatalogItem) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const categories = useFetch(() => (visible ? sellerOrderService.categories(storeId) : Promise.resolve([])), [storeId, visible]);
  const catalog = useFetch(
    () => (visible ? sellerOrderService.catalog(storeId, debounced || undefined, categoryId || undefined) : Promise.resolve([])),
    [storeId, debounced, categoryId, visible],
  );

  const chips = [{ value: '', label: t('common.all') }, ...(categories.data ?? []).map(c => ({ value: c.id, label: c.name, count: c.products }))];
  const added = [...inOrder.values()].reduce((n, c) => n + c, 0);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('orders.addProducts')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={10} onPress={onClose} style={styles.close}>
            <CloseIcon size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.filters}>
          <SearchBar value={query} onChange={setQuery} placeholder={t('orders.searchNameSkuOrBarcode')} />
          {chips.length > 1 ? <FilterChips options={chips} value={categoryId} onChange={setCategoryId} /> : null}
        </View>

        <FlatList
          data={catalog.loading ? [] : catalog.data ?? []}
          keyExtractor={item => item.variantId}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <CatalogRow item={item} count={inOrder.get(item.variantId) ?? 0} onAdd={() => onAdd(item)} />}
          ListEmptyComponent={
            catalog.loading ? (
              <ListSkeleton rows={6} height={72} />
            ) : catalog.error ? (
              <ErrorState message={catalog.error} onRetry={() => catalog.reload()} />
            ) : (
              <EmptyState icon={BoxIcon} title={t('common.noProductsFound')} text={debounced ? t('orders.tryAnotherNameSkuOrBarcode') : t('orders.thisStoreHasNoProductsTo')} />
            )
          }
        />

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.footerText}>{added ? t('orders.itemsInTheOrder', { count: added }) : t('orders.tapAProductToAddIt')}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.done}>
            <Text style={styles.doneText}>{t('common.done')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function CatalogRow({ item, count, onAdd }: { item: CatalogItem; count: number; onAdd: () => void }) {
  const { t } = useTranslation();
  const selling = sellingOf(item);
  const outOfStock = item.stock !== null && item.stock <= 0;
  const unit = selling.sellingUom === 'PCS' ? '' : ` ${selling.sellingUom}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('orders.addProductName', { name: item.variantLabel ? `${item.productName}, ${item.variantLabel}` : item.productName })}
      onPress={onAdd}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <BoxIcon size={20} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={2}>
          {item.productName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[item.variantLabel, item.sku].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{priceText(item)}</Text>
          {item.mrp && item.mrp > item.price ? <Text style={styles.mrp}>₹{item.mrp}</Text> : null}
          <Text style={[styles.stock, outOfStock && styles.stockOut]}>
            {item.stock === null ? '' : outOfStock ? t('common.outOfStock2') : t('orders.countUnitInStock', { count: Math.round(item.stock * 100) / 100, unit })}
          </Text>
        </View>
      </View>
      <View style={[styles.add, count > 0 && styles.added]}>
        {count > 0 ? <CheckIcon size={14} color={colors.white} strokeWidth={3} /> : <PlusIcon size={16} color={colors.secondary} strokeWidth={2.4} />}
        {count > 0 ? <Text style={styles.addedText}>{count}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  title: { flex: 1, fontSize: 20, fontFamily: fonts.extrabold, color: colors.text },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  filters: { gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  rowPressed: { backgroundColor: '#fffaf5' },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: colors.background },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  meta: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  priceRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  mrp: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, textDecorationLine: 'line-through' },
  stock: { marginLeft: 'auto', fontFamily: fonts.medium, fontSize: 11.5, color: colors.successDark },
  stockOut: { color: colors.error },
  add: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1.5,
    borderColor: colors.secondarySoft,
    backgroundColor: colors.secondaryLight,
  },
  added: { backgroundColor: colors.success, borderColor: colors.success },
  addedText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary },
  done: { paddingHorizontal: 22, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  doneText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
});
