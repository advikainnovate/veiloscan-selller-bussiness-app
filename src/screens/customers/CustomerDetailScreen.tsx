import React, { useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { formatDay, formatWhen } from '../../lib/date';
import { formatNumber, formatRupees } from '../../lib/format';
import { customerEmail, customerInitials, customerName, customerPhone } from '../../lib/customers';
import { creditStatus, dueHint } from '../../lib/customer-credit';
import { orderStatusLabel, orderStatusTone } from '../../lib/orders';
import { genderLabel, userStatus } from '../../lib/users';
import { customerService, type CustomerAddress } from '../../services/customer-service';
import { customerCreditService } from '../../services/customer-credit-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { ErrorState, FilterChips, ListSkeleton } from '../../components/list/ListParts';
import { CountTiles, TILE_COLORS } from '../../components/list/CompactList';
import { Detail, opsStyles } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { ChevronRightIcon, MailIcon, MapPinIcon, PhoneIcon, ShoppingBagIcon, UserIcon, UsersIcon, WalletIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

type Tab = 'overview' | 'orders' | 'addresses' | 'credit';

/** One customer: account, their orders with you, saved addresses and credit. */
export function CustomerDetailScreen({ navigation, route }: ScreenProps<'CustomerDetail'>) {
  const { id } = route.params;
  const { hasPermission } = useAuth();
  const allowed = hasPermission('customers:manage');
  const canSeeCredit = hasPermission('customer-credit:manage');
  const customer = useFetch(() => (allowed ? customerService.get(id) : Promise.resolve(null)), [allowed, id]);
  const orders = useFetch(() => (allowed ? customerService.orders(id).catch(() => []) : Promise.resolve([])), [allowed, id]);
  const addresses = useFetch(() => (allowed ? customerService.addresses(id).catch(() => []) : Promise.resolve([])), [allowed, id]);
  const credit = useFetch(() => (allowed && canSeeCredit ? customerCreditService.customer(id).catch(() => null) : Promise.resolve(null)), [allowed, canSeeCredit, id]);
  const [tab, setTab] = useState<Tab>(route.params.tab ?? 'overview');

  const header = <AppHeader title={customer.data ? customerName(customer.data) : 'Customer'} subtitle="Customers" onBack={navigation.goBack} />;
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ComingSoon label="Customers" icon={UsersIcon} allowed={false} />
      </View>
    );
  }
  if (customer.loading && !customer.data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <View style={opsStyles.content}>
          <ListSkeleton rows={3} height={130} />
        </View>
      </View>
    );
  }
  if (!customer.data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ErrorState message={customer.error || "This customer couldn't be loaded."} onRetry={() => customer.reload()} />
      </View>
    );
  }

  const c = customer.data;
  const phone = customerPhone(c);
  const email = customerEmail(c.email);
  const status = userStatus(c.status);
  const orderList = orders.data ?? [];
  const addressList = addresses.data ?? [];
  const spent = orderList.filter(o => o.orderStatus !== 'CANCELLED').reduce((s, o) => s + (Number(o.clientAmount ?? o.totalAmount) || 0), 0);
  const lastOrder = orderList.reduce<string | null>((latest, o) => {
    const at = o.orderDateTime ?? o.createdAt ?? null;
    return at && (!latest || at > latest) ? at : latest;
  }, null);
  const refresh = () => {
    customer.reload(true);
    orders.reload();
    addresses.reload();
    credit.reload();
  };

  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'orders', label: 'Orders', count: orders.data ? orderList.length : undefined },
    { value: 'addresses', label: 'Addresses', count: addresses.data ? addressList.length : undefined },
    ...(canSeeCredit ? [{ value: 'credit', label: 'Credit' }] : []),
  ];

  return (
    <View style={opsStyles.screen}>
      {header}
      <ScrollView
        contentContainerStyle={opsStyles.content}
        refreshControl={<RefreshControl refreshing={customer.refreshing} onRefresh={refresh} tintColor={colors.secondary} colors={[colors.secondary]} />}
      >
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{customerInitials(c)}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>
              {customerName(c)}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {[c.idd, phone].filter(Boolean).join(' · ') || '—'}
            </Text>
            <View style={styles.wrap}>
              <Badge label={status.label} tone={status.tone} />
              {credit.data && credit.data.outstanding > 0 ? <Badge label={`${formatRupees(credit.data.outstanding)} due`} tone={credit.data.overdueAmount > 0 ? 'red' : 'amber'} /> : null}
            </View>
          </View>
        </View>

        {phone || email ? (
          <View style={styles.contact}>
            {phone ? (
              <Pressable accessibilityRole="button" onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)} style={[opsStyles.smallBtn, styles.grow]}>
                <PhoneIcon size={14} color={colors.text} />
                <Text style={opsStyles.smallBtnText}>Call</Text>
              </Pressable>
            ) : null}
            {email ? (
              <Pressable accessibilityRole="button" onPress={() => Linking.openURL(`mailto:${email}`)} style={[opsStyles.smallBtn, styles.grow]}>
                <MailIcon size={14} color={colors.text} />
                <Text style={opsStyles.smallBtnText}>Email</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <CountTiles
          tiles={[
            { key: 'orders', label: 'Orders with you', count: formatNumber(orderList.length), info: true, ...TILE_COLORS.violet },
            { key: 'spent', label: 'Purchases', count: formatRupees(Math.round(spent)), info: true, ...TILE_COLORS.green },
            ...(canSeeCredit ? [{ key: 'due', label: 'Credit due', count: credit.data ? formatRupees(credit.data.outstanding) : '—', info: true, ...TILE_COLORS.orange }] : []),
          ]}
          loading={orders.loading && !orders.data}
        />

        <FilterChips options={tabs} value={tab} onChange={v => setTab(v as Tab)} />

        {tab === 'overview' ? (
          <>
            <SectionCard icon={UserIcon} title="Account details">
              <Detail label="Mobile" value={phone} />
              <Detail label="Email" value={email ?? 'No email (store customer)'} />
              <Detail label="Username" value={c.username} />
              <Detail label="Display name" value={c.userDisplayName} />
              <Detail label="Gender" value={genderLabel(c.gender)} />
              <Detail label="Email verified" value={c.isEmailVerification == null ? null : c.isEmailVerification ? 'Yes' : 'No'} />
              <Detail label="Phone verified" value={c.isPhoneVerification == null ? null : c.isPhoneVerification ? 'Yes' : 'No'} />
              <Detail label="Customer since" value={formatDay(c.createdAt)} />
              <Detail label="Last login" value={c.lastLoginAt ? formatWhen(c.lastLoginAt) : null} />
            </SectionCard>
            <SectionCard icon={ShoppingBagIcon} title="Quick stats">
              <Detail label="Orders with you" value={formatNumber(orderList.length)} />
              <Detail label="Last order" value={lastOrder ? formatDay(lastOrder) : null} />
              <Detail label="Saved addresses" value={formatNumber(addressList.length)} />
              <Detail label="Default shipping" value={addressLine(addressList.find(a => a.isDefaultShipping))} />
            </SectionCard>
          </>
        ) : null}

        {tab === 'orders' ? (
          <SectionCard icon={ShoppingBagIcon} title="Orders" subtitle="Orders this customer placed with your stores">
            {orderList.length ? (
              orderList.map(o => (
                <Pressable key={o.id} accessibilityRole="button" onPress={() => navigation.navigate('OrderDetail', { id: o.id })} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
                  <View style={styles.flex}>
                    <Text style={opsStyles.title}>{o.uniqueOrderId}</Text>
                    <Text style={opsStyles.muted}>{[formatDay(o.orderDateTime ?? o.createdAt), o.paymentStatus ? titleCase(o.paymentStatus) : null].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <View style={styles.right}>
                    <Text style={opsStyles.amount}>{formatRupees(Number(o.clientAmount ?? o.totalAmount) || 0)}</Text>
                    <Badge label={orderStatusLabel(o)} tone={orderStatusTone(o.orderStatus)} />
                  </View>
                  <ChevronRightIcon size={16} color={colors.textMuted} />
                </Pressable>
              ))
            ) : (
              <Text style={[opsStyles.muted, styles.center]}>{orders.loading ? 'Loading…' : 'No orders placed yet.'}</Text>
            )}
          </SectionCard>
        ) : null}

        {tab === 'addresses' ? (
          <SectionCard icon={MapPinIcon} title="Saved addresses">
            {addressList.length ? (
              addressList.map(a => (
                <View key={a.id} style={styles.address}>
                  <View style={styles.wrap}>
                    <Text style={styles.addressType}>{titleCase(a.addressType || 'Address')}</Text>
                    {a.isDefaultShipping ? <Badge label="Default shipping" tone="green" /> : null}
                    {a.isDefaultBilling ? <Badge label="Default billing" tone="amber" /> : null}
                  </View>
                  {a.firstName || a.lastName ? <Text style={opsStyles.title}>{[a.firstName, a.lastName].filter(Boolean).join(' ')}</Text> : null}
                  <Text style={opsStyles.meta}>{addressLine(a)}</Text>
                  {a.phone ? (
                    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`tel:${a.phone}`)}>
                      <Text style={styles.link}>{a.phone}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={[opsStyles.muted, styles.center]}>{addresses.loading ? 'Loading…' : 'No addresses saved yet.'}</Text>
            )}
          </SectionCard>
        ) : null}

        {tab === 'credit' && canSeeCredit ? (
          credit.loading && !credit.data ? (
            <ListSkeleton rows={2} height={90} />
          ) : !credit.data ? (
            <ErrorState message="Credit couldn't be loaded." onRetry={() => credit.reload()} />
          ) : (
            <>
              <View style={styles.creditGrid}>
                <CreditFigure label="Total credit" value={credit.data.totalCredit} bg="#f5f3ff" fg="#5b21b6" />
                <CreditFigure label="Total paid" value={credit.data.totalPaid} bg="#ecfdf5" fg="#065f46" />
                <CreditFigure label="Outstanding" value={credit.data.outstanding} bg="#fff7ed" fg="#9a3412" />
                <CreditFigure label="Overdue" value={credit.data.overdueAmount} bg={credit.data.overdueAmount > 0 ? '#fef2f2' : colors.background} fg={credit.data.overdueAmount > 0 ? '#991b1b' : colors.textSecondary} />
              </View>
              <SectionCard icon={WalletIcon} title="Credits">
                {credit.data.credits.length ? (
                  credit.data.credits.map(cr => {
                    const st = creditStatus(cr.status);
                    const hint = dueHint(cr);
                    return (
                      <Pressable key={cr.id} accessibilityRole="button" onPress={() => navigation.navigate('CreditDetail', { id: cr.id })} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
                        <View style={styles.flex}>
                          <Text style={opsStyles.title}>{`${cr.idd} · ${cr.orderNumber}`}</Text>
                          <Text style={opsStyles.muted}>{`${formatRupees(cr.paidAmount)} of ${formatRupees(cr.creditAmount)} paid · due ${formatDay(cr.dueDate)}`}</Text>
                          {hint ? <Text style={[styles.hint, cr.overdueDays > 0 && styles.overdue]}>{hint}</Text> : null}
                        </View>
                        <View style={styles.right}>
                          <Text style={opsStyles.amount}>{formatRupees(cr.outstandingAmount)}</Text>
                          <Badge label={st.label} tone={st.tone} />
                        </View>
                        <ChevronRightIcon size={16} color={colors.textMuted} />
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={[opsStyles.muted, styles.center]}>This customer has no credit with your stores.</Text>
                )}
              </SectionCard>
            </>
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

function CreditFigure({ label, value, bg, fg }: { label: string; value: number; bg: string; fg: string }) {
  return (
    <View style={[styles.figure, { backgroundColor: bg }]}>
      <Text style={[styles.figureLabel, { color: fg }]}>{label}</Text>
      <Text style={[styles.figureValue, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {formatRupees(value)}
      </Text>
    </View>
  );
}

const addressLine = (a: CustomerAddress | undefined) =>
  a ? [a.addressLine1, a.addressLine2, a.landmark, a.city, [a.state, a.pincode].filter(Boolean).join(' '), a.country].filter(Boolean).join(', ') || null : null;

const titleCase = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, ch => ch.toUpperCase());

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grow: { flexGrow: 1, justifyContent: 'center' },
  center: { textAlign: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, backgroundColor: colors.surface, ...shadow.card },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf2fb' },
  avatarText: { fontFamily: fonts.bold, fontSize: 19, color: '#3b82f6' },
  name: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  sub: { marginTop: 1, marginBottom: 6, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  contact: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pressed: { opacity: 0.6 },
  right: { alignItems: 'flex-end', gap: 4 },
  address: { gap: 3, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  addressType: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary },
  hint: { marginTop: 2, fontFamily: fonts.medium, fontSize: 11.5, color: colors.textMuted },
  overdue: { color: colors.error },
  creditGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  figure: { flexBasis: '47%', flexGrow: 1, padding: 12, borderRadius: radius.md },
  figureLabel: { fontFamily: fonts.medium, fontSize: 12, opacity: 0.85 },
  figureValue: { marginTop: 2, fontFamily: fonts.bold, fontSize: 18 },
});
