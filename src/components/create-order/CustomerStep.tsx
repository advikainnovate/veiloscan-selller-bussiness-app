import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useFetch } from '../../hooks/useFetch';
import { formatDay } from '../../lib/date';
import { formatRupees } from '../../lib/format';
import { sellerOrderService, type StoreCustomer } from '../../services/seller-order-service';
import { Checkbox } from '../ui/Checkbox';
import { TextField } from '../ui/TextField';
import { SearchBar } from '../list/ListParts';
import { CheckCircleIcon, MailIcon, MapPinIcon, PhoneIcon, UserIcon } from '../icons';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

export type CustomerType = 'INDIVIDUAL' | 'BUSINESS';

export interface CustomerDraft {
  countryCode: string;
  phone: string;
  name: string;
  email: string;
  address: string;
  customerType: CustomerType;
  note: string;
  saveCustomer: boolean;
}

export const EMPTY_CUSTOMER: CustomerDraft = {
  countryCode: '91',
  phone: '',
  name: '',
  email: '',
  address: '',
  customerType: 'INDIVIDUAL',
  note: '',
  saveCustomer: true,
};

/** Why the customer can't be used yet (first reason), as the Seller Panel checks it. */
export function customerProblem(draft: CustomerDraft, existing: StoreCustomer | null, mode: 'EXISTING' | 'NEW'): string | null {
  if (mode === 'EXISTING' && !existing) return i18n.t('orders.selectACustomer');
  const name = mode === 'EXISTING' ? existing?.name.trim() ?? '' : draft.name.trim();
  const phoneValid = draft.countryCode === '91' ? /^[6-9]\d{9}$/.test(draft.phone) : /^\d{10}$/.test(draft.phone);
  if (!phoneValid) return i18n.t('orders.enterTheCustomers10DigitMobile');
  if (name.length < 2 || !/^\p{L}[\p{L}\p{M} .'-]*$/u.test(name)) return i18n.t('orders.enterTheCustomersName');
  if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) return i18n.t('orders.checkTheCustomersEmail');
  return null;
}

const SEARCH_DELAY_MS = 300;

/** Pick one of the store's customers, searched by name or mobile. */
export function ExistingCustomerPicker({
  storeId,
  selected,
  onSelect,
  onAddNew,
}: {
  storeId: string;
  selected: StoreCustomer | null;
  onSelect: (customer: StoreCustomer | null) => void;
  /** Start a new customer from what was searched. */
  onAddNew: (query: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);
  const results = useFetch(() => sellerOrderService.customers(storeId, debounced || undefined), [storeId, debounced]);

  if (selected) {
    return (
      <View style={styles.selected}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{selected.name.trim()[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.selectedName}>{selected.name}</Text>
          <Text style={styles.selectedMeta}>{selected.phone}</Text>
          <Text style={styles.selectedMeta}>
            {[t('common.orderCount', { count: selected.orders }), t('orders.amountSpent', { amount: formatRupees(selected.spent) }), selected.lastOrderAt ? t('orders.lastOrderOn', { date: formatDay(selected.lastOrderAt) }) : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => onSelect(null)} hitSlop={8}>
          <Text style={styles.change}>{t('common.change')}</Text>
        </Pressable>
      </View>
    );
  }

  const list = results.data ?? [];
  return (
    <View style={styles.picker}>
      <SearchBar value={query} onChange={setQuery} placeholder={t('orders.searchNameOrMobileNumber')} />
      {results.loading ? <Text style={styles.hint}>{t('common.searching')}</Text> : null}
      {!results.loading && !list.length ? (
        <Text style={styles.hint}>{debounced ? t('orders.noCustomerMatches') : t('orders.noCustomersYet')}</Text>
      ) : null}
      {list.slice(0, 20).map(customer => (
        <Pressable
          key={customer.id}
          accessibilityRole="button"
          onPress={() => onSelect(customer)}
          style={({ pressed }) => [styles.result, pressed && styles.resultPressed]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{customer.name.trim()[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.resultName} numberOfLines={1}>
              {customer.name}
            </Text>
            <Text style={styles.resultMeta} numberOfLines={1}>
              {`${customer.phone} · ${t('common.orderCount', { count: customer.orders })}`}
            </Text>
          </View>
          {!customer.active ? <Text style={styles.inactive}>{t('common.inactive')}</Text> : null}
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" onPress={() => onAddNew(debounced)} style={styles.addNew}>
        <Text style={styles.addNewText}>{debounced ? t('orders.addNewCustomerNamed', { name: debounced }) : t('orders.addANewCustomer')}</Text>
      </Pressable>
    </View>
  );
}

/** A new customer's details; saved to the store for next time unless unticked. */
export function NewCustomerForm({ value, onChange }: { value: CustomerDraft; onChange: (next: CustomerDraft) => void }) {
  const { t } = useTranslation();
  const set = (patch: Partial<CustomerDraft>) => onChange({ ...value, ...patch });
  return (
    <View style={styles.form}>
      <View style={styles.phoneRow}>
        <View style={styles.codeBox}>
          <Text style={styles.plus}>+</Text>
          <TextInput
            value={value.countryCode}
            onChangeText={text => set({ countryCode: text.replace(/\D/g, '').slice(0, 4) })}
            keyboardType="number-pad"
            accessibilityLabel={t('orders.countryCode')}
            style={styles.codeInput}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label={t('common.mobileNumber')}
            placeholder={t('orders.n10DigitMobileNumber')}
            icon={<PhoneIcon size={17} color={colors.textMuted} />}
            value={value.phone}
            onChangeText={text => set({ phone: text.replace(/\D/g, '').slice(0, 10) })}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
          />
        </View>
      </View>
      <TextField
        label={t('common.name')}
        placeholder={t('orders.customersName')}
        icon={<UserIcon size={17} color={colors.textMuted} />}
        value={value.name}
        onChangeText={name => set({ name })}
        autoCapitalize="words"
        textContentType="name"
      />
      <TextField
        label={t('common.emailOptional')}
        placeholder="name@example.com"
        icon={<MailIcon size={17} color={colors.textMuted} />}
        value={value.email}
        onChangeText={email => set({ email })}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextField
        label={t('orders.addressOptional')}
        placeholder={t('orders.houseStreetCity')}
        icon={<MapPinIcon size={17} color={colors.textMuted} />}
        value={value.address}
        onChangeText={address => set({ address })}
      />
      <View style={styles.typeRow}>
        {(['INDIVIDUAL', 'BUSINESS'] as const).map(type => (
          <Pressable
            key={type}
            accessibilityRole="radio"
            accessibilityState={{ selected: value.customerType === type }}
            onPress={() => set({ customerType: type })}
            style={[styles.type, value.customerType === type && styles.typeOn]}
          >
            <Text style={[styles.typeText, value.customerType === type && styles.typeTextOn]}>
              {type === 'INDIVIDUAL' ? t('orders.individual') : t('orders.business')}
            </Text>
          </Pressable>
        ))}
      </View>
      <Checkbox label={t('orders.saveThisCustomerForNextTime')} checked={value.saveCustomer} onChange={saveCustomer => set({ saveCustomer })} />
    </View>
  );
}

/** A note from the customer, printed on the order. */
export function CustomerNote({ value, onChange }: { value: string; onChange: (note: string) => void }) {
  const { t } = useTranslation();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={t('orders.noteFromTheCustomerOptional')}
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.secondary}
      multiline
      style={styles.note}
    />
  );
}

export function CustomerDone({ name, phone }: { name: string; phone: string }) {
  return (
    <View style={styles.done}>
      <CheckCircleIcon size={18} color={colors.success} />
      <Text style={styles.doneText}>
        {name} · {phone}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  picker: { gap: 8 },
  hint: { paddingVertical: 6, fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultPressed: { backgroundColor: colors.background },
  resultName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  resultMeta: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  inactive: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textMuted },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  avatarText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
  addNew: { paddingVertical: 10 },
  addNewText: { fontFamily: fonts.bold, fontSize: 14, color: colors.secondary },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.secondarySoft,
    backgroundColor: '#fffaf5',
  },
  selectedName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  selectedMeta: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  change: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.secondary },
  form: { gap: 14 },
  phoneRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  codeBox: {
    width: 74,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  plus: { fontFamily: fonts.semibold, fontSize: 15, color: colors.textSecondary },
  codeInput: { flex: 1, height: '100%', paddingVertical: 0, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  typeRow: { flexDirection: 'row', gap: 8 },
  type: { flex: 1, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  typeOn: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  typeText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.textSecondary },
  typeTextOn: { color: colors.secondaryDark },
  note: {
    minHeight: 70,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
  },
  done: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
});
