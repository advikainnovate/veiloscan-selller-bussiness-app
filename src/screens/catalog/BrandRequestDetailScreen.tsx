import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatDay } from '../../lib/date';
import { dateTime } from '../../lib/operations';
import { BRAND_STATUS, BRAND_STATUS_LABEL, channelLabel } from '../../lib/catalog';
import { brandRequestService } from '../../services/catalog-service';
import type { Row } from '../../services/products-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { confirmAction, Detail, opsStyles } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { BrandRequestForm } from '../../components/catalog/BrandRequestForm';
import { AlertCircleIcon, CheckCircleIcon, ClockIcon, FileTextIcon, ShieldCheckIcon, TrashIcon } from '../../components/icons';
import { BrandLogo } from './BrandApprovalsScreen';
import type { ScreenProps } from '../../navigation/types';

function DocumentTile({ label, file }: { label: string; file: Row | null | undefined }) {
  const url = file?.url as string | undefined;
  const isImage = !!url && !/\.pdf($|\?)/i.test(url) && !String(file?.mimeType ?? '').includes('pdf');
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`Open ${label}`} disabled={!url} onPress={() => url && Linking.openURL(url)} style={styles.doc}>
      <View style={styles.docThumb}>{url && isImage ? <Image source={{ uri: url }} style={styles.fill} resizeMode="contain" /> : <FileTextIcon size={18} color={url ? colors.secondary : colors.border} />}</View>
      <View style={styles.flex}>
        <Text style={opsStyles.title}>{label}</Text>
        <Text style={url ? styles.link : opsStyles.muted}>{url ? 'Open' : 'Not uploaded'}</Text>
      </View>
    </Pressable>
  );
}

/** One brand request: its status, what to fix, details, documents and progress. */
export function BrandRequestDetailScreen({ navigation, route }: ScreenProps<'BrandRequestDetail'>) {
  const { id } = route.params;
  const { hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission('products-master:manage');
  const { data, error, loading, reload } = useFetch(() => (allowed ? brandRequestService.get(id) : Promise.resolve(null)), [allowed, id]);
  const [editing, setEditing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const brand = data?.brand as Row | undefined;
  const header = <AppHeader title={String(brand?.title ?? 'Brand request')} subtitle="Brand Approvals" onBack={navigation.goBack} />;
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ComingSoon label="Brand Approvals" icon={ShieldCheckIcon} allowed={false} />
      </View>
    );
  }
  if (loading && !data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ListSkeleton rows={3} height={130} />
      </View>
    );
  }
  if (!data?.id) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ErrorState message={error || 'Brand request not found'} onRetry={reload} />
      </View>
    );
  }

  const r = data;
  const status = r.status as number;
  const label = BRAND_STATUS_LABEL[status] ?? BRAND_STATUS_LABEL[0];
  const category = String((r.category as Row | undefined)?.categoryTitle ?? '—');
  const store = String((r.store as Row | undefined)?.name ?? '—');
  const channels = (r.salesChannels as string[] | undefined) ?? [];

  async function withdraw() {
    const ok = await confirmAction(
      'Withdraw this request?',
      r.isNewBrand ? 'The request is deleted, along with the new brand it asked for.' : 'The request is deleted. You can request the brand again later.',
      'Withdraw',
      true,
    );
    if (!ok) return;
    setWithdrawing(true);
    try {
      await brandRequestService.withdraw(id);
      toast('Request withdrawn');
      navigation.goBack();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
      setWithdrawing(false);
    }
  }

  const steps = [
    { label: 'Requested', at: r.createdAt, done: true },
    { label: status === BRAND_STATUS.PENDING ? 'Under review' : status === BRAND_STATUS.APPROVED ? 'Approved' : 'Changes needed', at: r.reviewedAt, done: status !== BRAND_STATUS.PENDING },
  ];

  return (
    <KeyboardAvoidingView style={opsStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ScrollView contentContainerStyle={opsStyles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <BrandLogo brand={brand} size={52} />
          <View style={styles.flex}>
            <View style={styles.wrap}>
              <Badge label={label.label} tone={label.tone} />
              {r.isNewBrand ? <Badge label="New brand" tone="blue" /> : null}
            </View>
            <Text style={opsStyles.meta} numberOfLines={2}>{`${category} · ${store} · ${String(r.idd ?? '')}`}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          {status === BRAND_STATUS.APPROVED ? (
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('ProductEditor', {})} style={[opsStyles.primaryBtn, styles.grow]}>
              <Text style={opsStyles.primaryBtnText}>Add a product</Text>
            </Pressable>
          ) : null}
          {status === BRAND_STATUS.REJECTED && !editing ? (
            <Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={[opsStyles.primaryBtn, styles.grow]}>
              <Text style={opsStyles.primaryBtnText}>Fix & resubmit</Text>
            </Pressable>
          ) : null}
          {status !== BRAND_STATUS.APPROVED ? (
            <Pressable accessibilityRole="button" disabled={withdrawing} onPress={withdraw} style={[opsStyles.smallBtn, styles.grow]}>
              <TrashIcon size={14} color={colors.error} />
              <Text style={[opsStyles.smallBtnText, opsStyles.danger]}>{withdrawing ? 'Withdrawing…' : 'Withdraw'}</Text>
            </Pressable>
          ) : null}
        </View>

        {status === BRAND_STATUS.REJECTED ? (
          <View style={[styles.banner, styles.bannerRed]}>
            <AlertCircleIcon size={18} color={colors.error} />
            <View style={styles.flex}>
              <Text style={[styles.bannerTitle, styles.red]}>What needs to change</Text>
              <Text style={[styles.bannerText, styles.red]}>{(r.remarks as string) || "The reviewer didn't leave a note. Check that your documents are clear and complete."}</Text>
            </View>
          </View>
        ) : status === BRAND_STATUS.PENDING ? (
          <View style={[styles.banner, styles.bannerAmber]}>
            <ClockIcon size={18} color={colors.warningDark} />
            <Text style={[styles.bannerText, styles.amber, styles.flex]}>VeiloScan is reviewing this request, usually within one working day. You'll get a notification and an email with the decision.</Text>
          </View>
        ) : (
          <View style={[styles.banner, styles.bannerGreen]}>
            <CheckCircleIcon size={18} color={colors.success} />
            <Text style={[styles.bannerText, styles.green, styles.flex]}>
              {`Approved. You can now pick ${String(brand?.title ?? '')} for products in ${category} sold in this store.${r.remarks ? `\nNote: ${String(r.remarks)}` : ''}`}
            </Text>
          </View>
        )}

        {editing ? (
          <>
            <Text style={opsStyles.title}>Update your request</Text>
            <BrandRequestForm
              existing={r}
              onCancel={() => setEditing(false)}
              onDone={() => {
                setEditing(false);
                reload();
              }}
            />
          </>
        ) : (
          <>
            <SectionCard icon={ShieldCheckIcon} title="Request details">
              <Detail label="Category" value={category} />
              <Detail label="Store" value={store} />
              <Detail label="Sold today through" value={channels.length ? channels.map(channelLabel).join(', ') : '—'} />
              <Detail label="Brand owner" value={r.isBrandOwner === true ? 'Yes — trademark in my name' : r.isBrandOwner === false ? 'No — authorised reseller' : '—'} />
              {r.isBrandOwner ? (
                <Detail
                  label="Trademark"
                  value={`No. ${String(r.registeredApplicationNumber || '—')} · Class ${String(r.registeredClass || '—')} · ${r.registeredApplicationDate ? formatDay(r.registeredApplicationDate) : '—'}`}
                />
              ) : null}
            </SectionCard>
            <SectionCard icon={FileTextIcon} title="Documents">
              <DocumentTile label="Registered document" file={r.registeredDocumentFile as Row | null} />
              <DocumentTile label="Brand logo" file={r.logoFile as Row | null} />
              <DocumentTile label="MRP tag 1" file={r.mrpTag1File as Row | null} />
              <DocumentTile label="MRP tag 2" file={r.mrpTag2File as Row | null} />
            </SectionCard>
            <SectionCard icon={ClockIcon} title="Progress">
              {steps.map((s, i) => (
                <View key={s.label} style={styles.step}>
                  <View style={[styles.stepDot, s.done ? (status === BRAND_STATUS.REJECTED && i === 1 ? styles.stepRed : styles.stepDone) : styles.stepOpen]}>
                    <Text style={[styles.stepText, s.done ? styles.white : styles.amber]}>{s.done ? '✓' : String(i + 1)}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={opsStyles.title}>{s.label}</Text>
                    <Text style={opsStyles.muted}>{s.done ? dateTime(s.at as string) : 'In progress'}</Text>
                  </View>
                </View>
              ))}
              <Text style={opsStyles.muted}>{label.hint}</Text>
            </SectionCard>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  fill: { width: '100%', height: '100%' },
  grow: { flexGrow: 1, justifyContent: 'center' },
  white: { color: colors.white },
  red: { color: colors.errorDark },
  amber: { color: colors.warningDark },
  green: { color: colors.successDark },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  banner: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1 },
  bannerRed: { borderColor: '#fecaca', backgroundColor: colors.errorLight },
  bannerAmber: { borderColor: '#fde68a', backgroundColor: '#fffbeb' },
  bannerGreen: { borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' },
  bannerTitle: { fontFamily: fonts.semibold, fontSize: 13 },
  bannerText: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18 },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  docThumb: { width: 44, height: 44, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.background },
  link: { fontFamily: fonts.semibold, fontSize: 12, color: colors.secondary },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: colors.secondary },
  stepRed: { backgroundColor: colors.error },
  stepOpen: { backgroundColor: '#fef3c7' },
  stepText: { fontFamily: fonts.bold, fontSize: 11 },
});
