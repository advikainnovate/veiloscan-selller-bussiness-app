import React, { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme';
import { SHOP_URL } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatDay } from '../../lib/date';
import { dateTime } from '../../lib/operations';
import {
  addressLines,
  BUSINESS_CONSTITUTIONS,
  BUSINESS_TYPES,
  CURRENCIES,
  DEFAULT_DOCUMENT_REQUIREMENTS,
  DISPLAY_STATUS,
  displayStatus,
  DOCUMENT_TYPES,
  GST_STATUSES,
  labelFor,
  missingDocuments,
  ONBOARDING_STEPS,
  plainText,
  storeShopUrl,
  TIMEZONES,
  VERIFICATION,
  WEEK_DAYS,
} from '../../lib/store-manage';
import { storeManageService, type Rec, type StoreRecord } from '../../services/store-manage-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Sheet } from '../../components/ui/Sheet';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { confirmAction, Detail, opsStyles } from '../../components/operations/OpsParts';
import { StoreQrTagPanel } from '../../components/store/StoreQrTagPanel';
import { StoreCategoriesPanel } from '../../components/store/StoreCategoriesPanel';
import { ApprovalHistory, BrandingSection, BusinessDetailsSheet, ConfigSection, ContactSection, DocumentsSection, HoursSection, SectionCard, TaxSection } from '../../components/store/StoreSections';
import {
  AlertCircleIcon,
  BanIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  EditIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  MapPinIcon,
  PhoneIcon,
  QrCodeIcon,
  RefreshIcon,
  SettingsIcon,
  StoreIcon,
  UserIcon,
  type IconProps,
} from '../../components/icons';
import type { ScreenProps, StoreSettingsTab } from '../../navigation/types';

const TABS: { key: StoreSettingsTab; label: string; icon: ComponentType<IconProps> }[] = [
  { key: 'overview', label: 'Overview', icon: FileTextIcon },
  { key: 'setup', label: 'Store Setup', icon: StoreIcon },
  { key: 'operations', label: 'Operational Settings', icon: SettingsIcon },
  { key: 'gst', label: 'GST & Documents', icon: FileTextIcon },
  { key: 'categories', label: 'Categories', icon: FolderIcon },
  { key: 'qr-tag', label: 'QR Store Tag', icon: QrCodeIcon },
  { key: 'info', label: 'Additional Info', icon: SettingsIcon },
  { key: 'activity', label: 'Activity Log', icon: RefreshIcon },
];

// The editable tabs: without stores:edit they show the saved values instead.
const EDIT_TABS: StoreSettingsTab[] = ['setup', 'operations', 'gst'];

/** "09:30" → "9:30 AM". */
function clock(value: unknown) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? ''));
  if (!m) return '—';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

const at = (v: unknown) => (v ? dateTime(String(v)) : '—');

/**
 * Store Settings: the current store's page, as the Seller Panel's store
 * detail — overview, setup, operational settings, GST & documents, QR tag,
 * record and approval history. stores:view to open, stores:edit to change,
 * stores:delete to close.
 */
export function StoreSettingsScreen({ navigation, route }: ScreenProps<'StoreSettings'>) {
  const { hasPermission } = useAuth();
  const { current, refresh } = useStore();
  const toast = useToast();
  const canView = hasPermission('stores:view');
  const canEdit = hasPermission('stores:edit');
  const canDelete = hasPermission('stores:delete');
  const canManageCategories = hasPermission('store-categories:manage');
  const visibleTabs = TABS.filter(t => t.key !== 'categories' || canManageCategories);
  const storeId = route.params?.storeId ?? current?.id ?? '';
  const [tab, setTab] = useState<StoreSettingsTab>(route.params?.tab ?? 'overview');
  const shownTab: StoreSettingsTab = visibleTabs.some(t => t.key === tab) ? tab : 'overview';
  const [editing, setEditing] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);

  const { data: store, error, loading, reload } = useFetch(() => (canView && storeId ? storeManageService.get(storeId) : Promise.resolve(null)), [canView, storeId]);

  const header = <AppHeader title="Store Settings" subtitle={store?.name ?? current?.name} onBack={navigation.canGoBack() ? navigation.goBack : undefined} />;
  if (!canView) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ComingSoon label="Store Settings" icon={StoreIcon} allowed={false} />
      </View>
    );
  }
  if (!storeId) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <EmptyState icon={StoreIcon} title="No store yet" text="Set up your store to start selling." />
        {hasPermission('stores:create') ? (
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('CreateStore')} style={[opsStyles.primaryBtn, styles.centerBtn]}>
            <Text style={opsStyles.primaryBtnText}>Set up store</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  if (loading && !store) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ListSkeleton />
      </View>
    );
  }
  if (!store) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ErrorState message={error || 'Store not found'} onRetry={reload} />
      </View>
    );
  }

  const changed = () => {
    reload();
    // The switcher shows the store's name and status too.
    refresh();
  };

  async function changeStatus(status: string, message: string, confirmText?: string) {
    setActionsOpen(false);
    if (confirmText && !(await confirmAction(confirmText, undefined, 'Confirm'))) return;
    try {
      await storeManageService.update(storeId, { status });
      toast(message);
      changed();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function closeStore() {
    setActionsOpen(false);
    if (!(await confirmAction(`Close "${store!.name}"?`, 'It will be removed from the store list.', 'Close Store', true))) return;
    try {
      await storeManageService.remove(storeId);
      toast('Store closed');
      await refresh();
      if (navigation.canGoBack()) navigation.goBack();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  const isApproved = store.approvalStatus === 'APPROVED';
  const actions = [
    {
      label: 'Continue Onboarding',
      icon: EditIcon,
      hidden: !canEdit || store.onboardingStatus === 'COMPLETED',
      onPress: () => {
        setActionsOpen(false);
        navigation.navigate('CreateStore', { storeId });
      },
    },
    {
      label: 'Activate Store',
      icon: CheckCircleIcon,
      // A suspended store is only reactivated by the platform.
      hidden: !canEdit || !isApproved || store.status === 'ACTIVE' || store.status === 'SUSPENDED',
      onPress: () => changeStatus('ACTIVE', 'Store activated'),
    },
    {
      label: 'Mark Inactive',
      icon: ClockIcon,
      hidden: !canEdit || store.status !== 'ACTIVE',
      onPress: () => changeStatus('INACTIVE', 'Store marked inactive', 'Mark this store inactive? It will stop taking orders.'),
    },
    { label: 'Close Store', icon: BanIcon, danger: true, hidden: !canDelete, onPress: closeStore },
  ].filter(a => !a.hidden);

  const pickTab = (t: StoreSettingsTab) => {
    setTab(t);
    navigation.setParams({ tab: t });
  };

  return (
    <View style={opsStyles.screen}>
      {header}
      <ScrollView contentContainerStyle={opsStyles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />} keyboardShouldPersistTaps="handled">
        <StoreHeader store={store} canEdit={canEdit} hasActions={actions.length > 0} onEdit={() => setEditing(true)} onActions={() => setActionsOpen(true)} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {visibleTabs.map(t => {
            const on = t.key === shownTab;
            const Icon = t.icon;
            return (
              <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => pickTab(t.key)} style={[styles.tab, on && styles.tabOn]}>
                <Icon size={15} color={on ? colors.white : colors.textSecondary} />
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!canEdit && EDIT_TABS.includes(shownTab) ? (
          <View style={styles.notice}>
            <AlertCircleIcon size={16} color={colors.warningDark} />
            <Text style={styles.noticeText}>Your role can view this store but not change it.</Text>
          </View>
        ) : null}

        {shownTab === 'overview' ? <Overview store={store} canEdit={canEdit} onEdit={pickTab} onEditBusiness={() => setEditing(true)} /> : null}
        {shownTab === 'setup' ? (
          canEdit ? (
            <>
              <ContactSection key={`c${String(store.settings?.updatedAt)}`} storeId={storeId} settings={store.settings ?? null} onChange={changed} />
              <BrandingSection key={`b${String(store.branding?.updatedAt)}`} storeId={storeId} branding={store.branding ?? null} onChange={changed} />
              <HoursSection key={`h${(store.businessHours ?? []).map(h => h.updatedAt).join()}`} storeId={storeId} hours={store.businessHours ?? []} onChange={changed} />
            </>
          ) : (
            <Overview store={store} canEdit={false} only={['contact', 'images', 'hours']} />
          )
        ) : null}
        {shownTab === 'operations' ? (
          canEdit ? (
            <ConfigSection key={String(store.config?.updatedAt)} storeId={storeId} config={store.config ?? null} onChange={changed} />
          ) : (
            <Overview store={store} canEdit={false} only={['settings']} />
          )
        ) : null}
        {shownTab === 'gst' ? (
          canEdit ? (
            <>
              <TaxSection key={String(store.taxDetails?.updatedAt)} storeId={storeId} taxDetails={store.taxDetails ?? null} onChange={changed} />
              <DocumentsSection storeId={storeId} documents={store.documents ?? []} gstRegistered={!!store.taxDetails?.gstRegistered} onChange={changed} />
            </>
          ) : (
            <Overview store={store} canEdit={false} only={['gst', 'documents']} />
          )
        ) : null}
        {shownTab === 'categories' ? (
          <SectionCard icon={FolderIcon} title="Store Categories" subtitle="Map the catalog categories this store sells in.">
            <StoreCategoriesPanel key={storeId} storeId={storeId} storeName={store.name} />
          </SectionCard>
        ) : null}
        {shownTab === 'qr-tag' ? (
          <SectionCard icon={QrCodeIcon} title="QR Store Tag" subtitle="A printable 4 × 6 in tag for your counter">
            <StoreQrTagPanel storeId={storeId} storeName={store.name} storeStatus={store.status} canEdit={canEdit} />
          </SectionCard>
        ) : null}
        {shownTab === 'info' ? <AdditionalInfo store={store} onContinue={canEdit ? () => navigation.navigate('CreateStore', { storeId }) : undefined} /> : null}
        {shownTab === 'activity' ? (
          <SectionCard icon={RefreshIcon} title="Approval History">
            <ApprovalHistory storeId={storeId} />
          </SectionCard>
        ) : null}
      </ScrollView>

      <BusinessDetailsSheet
        store={store}
        visible={editing}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          changed();
        }}
      />
      <Sheet visible={actionsOpen} title="More Actions" onClose={() => setActionsOpen(false)}>
        {actions.map(a => {
          const Icon = a.icon;
          return (
            <Pressable key={a.label} accessibilityRole="button" onPress={a.onPress} style={styles.action}>
              <Icon size={18} color={a.danger ? colors.error : colors.text} />
              <Text style={[styles.actionText, a.danger && opsStyles.danger]}>{a.label}</Text>
            </Pressable>
          );
        })}
      </Sheet>
    </View>
  );
}

// ── Header ───────────────────────────────────────────────────────────────

function StoreHeader({ store, canEdit, hasActions, onEdit, onActions }: { store: StoreRecord; canEdit: boolean; hasActions: boolean; onEdit: () => void; onActions: () => void }) {
  const status = DISPLAY_STATUS[displayStatus(store)];
  const logoUrl = (store.branding?.logo as Rec | undefined)?.url as string | undefined;
  const shopUrl = storeShopUrl(SHOP_URL, store.code, store.slug);
  const live = store.status === 'ACTIVE';
  const description = plainText(store.description);
  return (
    <>
      <View style={styles.headCard}>
        <View style={styles.headRow}>
          <View style={styles.logo}>{logoUrl ? <Image source={{ uri: logoUrl }} style={styles.fill} /> : <StoreIcon size={28} color={colors.white} />}</View>
          <View style={styles.flex}>
            <Text style={styles.name}>{store.name}</Text>
            <View style={styles.wrapRow}>
              <Badge label={status.label} tone={status.tone} />
              <Text style={opsStyles.meta}>{`#${store.code}`}</Text>
            </View>
          </View>
        </View>
        {description ? (
          <Text style={opsStyles.meta} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
        <View style={styles.wrapRow}>
          <Badge label={labelFor(BUSINESS_TYPES, store.businessType)} tone="blue" />
          {store.businessCategory ? <Badge label={store.businessCategory} tone="slate" /> : null}
        </View>
        <View style={styles.wrapRow}>
          <Pressable accessibilityRole="link" disabled={!live} onPress={() => Linking.openURL(shopUrl)} style={styles.flex}>
            <Text style={live ? styles.link : opsStyles.muted} numberOfLines={1}>
              {live ? shopUrl : 'Shop link works once the store is active'}
            </Text>
          </Pressable>
          {live ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Share shop link" onPress={() => Share.share({ message: `${store.name} — ${shopUrl}` })} style={opsStyles.smallBtn}>
              <Text style={opsStyles.smallBtnText}>Share</Text>
            </Pressable>
          ) : null}
        </View>
        {canEdit || hasActions ? (
          <View style={styles.wrapRow}>
            {canEdit ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Edit store" onPress={onEdit} style={[opsStyles.smallBtn, styles.grow]}>
                <EditIcon size={15} color={colors.secondary} />
                <Text style={[opsStyles.smallBtnText, styles.accent]}>Edit</Text>
              </Pressable>
            ) : null}
            {hasActions ? (
              <Pressable accessibilityRole="button" accessibilityLabel="More Actions" onPress={onActions} style={[opsStyles.smallBtn, styles.grow]}>
                <Text style={opsStyles.smallBtnText}>More Actions</Text>
                <ChevronDownIcon size={15} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.strip}>
        <View style={styles.stripCell}>
          <Text style={styles.stripLabel}>Submitted On</Text>
          <View style={styles.stripValue}>
            <CalendarIcon size={13} color={colors.textMuted} />
            <Text style={styles.stripText}>{store.submittedAt ? dateTime(store.submittedAt) : 'Not submitted'}</Text>
          </View>
        </View>
        <View style={[styles.stripCell, styles.stripMid]}>
          <Text style={styles.stripLabel}>Current Status</Text>
          <Badge label={status.label} tone={status.tone} />
          <Text style={styles.stripHint}>{status.hint}</Text>
        </View>
        <View style={styles.stripCell}>
          <Text style={styles.stripLabel}>Last Updated</Text>
          <View style={styles.stripValue}>
            <ClockIcon size={13} color={colors.textMuted} />
            <Text style={styles.stripText}>{dateTime(store.updatedAt)}</Text>
          </View>
        </View>
      </View>

      {store.approvalStatus === 'REJECTED' && store.rejectionReason ? (
        <View style={styles.rejected}>
          <AlertCircleIcon size={18} color={colors.error} />
          <View style={styles.flex}>
            <Text style={styles.rejectedTitle}>Changes requested — update the store and resubmit from Continue Onboarding</Text>
            <Text style={styles.rejectedText}>{store.rejectionReason}</Text>
          </View>
        </View>
      ) : null}
    </>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────

type OverviewCard = 'business' | 'images' | 'owner' | 'contact' | 'hours' | 'settings' | 'gst' | 'documents';

function EditLink({ onPress }: { onPress?: () => void }) {
  if (!onPress) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Edit" hitSlop={6} onPress={onPress} style={styles.editLink}>
      <EditIcon size={15} color={colors.secondary} />
    </Pressable>
  );
}

function Overview({
  store,
  canEdit,
  onEdit,
  onEditBusiness,
  only,
}: {
  store: StoreRecord;
  canEdit: boolean;
  onEdit?: (tab: StoreSettingsTab) => void;
  onEditBusiness?: () => void;
  only?: OverviewCard[];
}) {
  const settings = store.settings ?? null;
  const config = store.config ?? null;
  const tax = store.taxDetails ?? null;
  const owner = store.owner ?? {};
  const documents = store.documents ?? [];
  const hours = store.businessHours ?? [];
  const address = addressLines(settings);
  const edit = (t: StoreSettingsTab) => (canEdit && onEdit ? () => onEdit(t) : undefined);
  const show = (c: OverviewCard) => !only || only.includes(c);
  const logoUrl = (store.branding?.logo as Rec | undefined)?.url as string | undefined;
  const bannerUrl = (store.branding?.banner as Rec | undefined)?.url as string | undefined;

  const cards: Record<OverviewCard, ReactNode> = {
    business: (
      <SectionCard icon={StoreIcon} title="Business Details" action={<EditLink onPress={canEdit ? onEditBusiness : undefined} />}>
        <Detail label="Store Name" value={store.name} />
        <Detail label="Business Type" value={labelFor(BUSINESS_TYPES, store.businessType)} />
        <Detail label="Business Category" value={store.businessCategory} />
        <Detail label="Description" value={plainText(store.description)} />
        <Detail label="Timezone" value={labelFor(TIMEZONES, store.timezone)} />
        <Detail label="Currency" value={labelFor(CURRENCIES, store.currency)} />
      </SectionCard>
    ),
    images: (
      <SectionCard icon={ImageIcon} title="Store Images" action={<EditLink onPress={edit('setup')} />}>
        <View style={styles.images}>
          {[
            { label: 'Store Logo', url: logoUrl, style: styles.logoImage },
            { label: 'Store Banner', url: bannerUrl, style: styles.bannerImage },
          ].map(img => (
            <View key={img.label} style={styles.imageCol}>
              <Text style={opsStyles.meta}>{img.label}</Text>
              <Pressable disabled={!img.url} onPress={() => img.url && Linking.openURL(img.url)} style={[styles.imageBox, img.style]}>
                {img.url ? <Image source={{ uri: img.url }} style={styles.fill} resizeMode="cover" /> : <Text style={opsStyles.muted}>Not uploaded</Text>}
              </Pressable>
            </View>
          ))}
        </View>
      </SectionCard>
    ),
    owner: (
      <SectionCard icon={UserIcon} title="Owner Details">
        <Detail label="Owner Name" value={[owner.firstName, owner.lastName].filter(Boolean).join(' ')} />
        <Detail label="Email" value={owner.email as string} />
        <Detail label="Phone" value={[owner.countryCode, owner.phoneNumber].filter(Boolean).join(' ')} />
        <Detail label="Alternate Phone" value={settings?.alternatePhone as string} />
        <Detail label="Address" value={address.join('\n')} />
      </SectionCard>
    ),
    contact: (
      <SectionCard icon={PhoneIcon} title="Contact Information" action={<EditLink onPress={edit('setup')} />}>
        {settings ? (
          <>
            <Detail label="Store Email" value={settings.email as string} />
            <Detail label="Store Phone" value={settings.phone as string} />
            <Detail
              label="Website"
              value={
                settings.website ? (
                  <Pressable accessibilityRole="link" onPress={() => Linking.openURL(String(settings.website))}>
                    <Text style={styles.link}>{String(settings.website)}</Text>
                  </Pressable>
                ) : null
              }
            />
            <View style={styles.address}>
              <MapPinIcon size={16} color={colors.textMuted} />
              <View style={styles.flex}>
                {address.map(line => (
                  <Text key={line} style={opsStyles.title}>
                    {line}
                  </Text>
                ))}
              </View>
              {settings.latitude && settings.longitude ? (
                <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`https://www.google.com/maps?q=${String(settings.latitude)},${String(settings.longitude)}`)}>
                  <Text style={styles.link}>Map</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <Text style={opsStyles.muted}>Contact and address have not been added yet.</Text>
        )}
      </SectionCard>
    ),
    hours: (
      <SectionCard icon={ClockIcon} title="Operating Hours" action={<EditLink onPress={edit('setup')} />}>
        {hours.length ? (
          WEEK_DAYS.map(day => {
            const row = hours.find(h => h.dayOfWeek === day.value);
            return (
              <View key={day.value} style={opsStyles.rowBetween}>
                <Text style={opsStyles.meta}>{day.label}</Text>
                <Text style={row?.isOpen ? opsStyles.title : opsStyles.muted}>{row?.isOpen ? `${clock(row.openTime)} - ${clock(row.closeTime)}` : 'Closed'}</Text>
              </View>
            );
          })
        ) : (
          <Text style={opsStyles.muted}>Not set</Text>
        )}
      </SectionCard>
    ),
    settings: (
      <SectionCard icon={SettingsIcon} title="Additional Settings" action={<EditLink onPress={edit('operations')} />}>
        {[
          { label: 'Accept Orders', on: config?.acceptOrders !== false },
          { label: 'Online Payment', on: config?.onlinePaymentEnabled !== false },
          { label: 'Guest Checkout', on: config?.guestCheckoutEnabled !== false },
          { label: 'Customer Credit', on: !!config?.allowCustomerCredit },
        ].map(item => (
          <View key={item.label} style={opsStyles.rowBetween}>
            <View style={opsStyles.row}>
              <CheckCircleIcon size={18} color={item.on ? colors.success : colors.border} />
              <Text style={opsStyles.title}>{item.label}</Text>
            </View>
            <Text style={item.on ? opsStyles.success : opsStyles.muted}>{item.on ? 'Enabled' : 'Disabled'}</Text>
          </View>
        ))}
      </SectionCard>
    ),
    gst: (
      <SectionCard icon={FileTextIcon} title="GST Details" action={<EditLink onPress={edit('gst')} />}>
        <Detail label="GST Registration" value={<Badge label={tax?.gstRegistered ? 'Yes' : 'No'} tone={tax?.gstRegistered ? 'green' : 'slate'} style={styles.selfStart} />} />
        {tax?.gstRegistered ? (
          <>
            <Detail label="GSTIN" value={tax.gstin as string} />
            <Detail label="Legal Business Name" value={tax.legalBusinessName as string} />
            <Detail label="Trade Name" value={tax.tradeName as string} />
            <Detail label="Business Constitution" value={tax.businessConstitution ? labelFor(BUSINESS_CONSTITUTIONS, tax.businessConstitution) : ''} />
            <Detail label="GST Registration Date" value={tax.gstRegistrationDate ? formatDay(tax.gstRegistrationDate) : ''} />
            <Detail label="GST Status" value={tax.gstStatus ? labelFor(GST_STATUSES, tax.gstStatus) : ''} />
            {tax.verificationStatus ? (
              <Detail label="Verification" value={<Badge {...(VERIFICATION[String(tax.verificationStatus)] ?? VERIFICATION.PENDING)} style={styles.selfStart} />} />
            ) : null}
          </>
        ) : null}
      </SectionCard>
    ),
    documents: (
      <SectionCard
        icon={FileTextIcon}
        title="Documents"
        subtitle={`${documents.filter(d => d.verificationStatus === 'VERIFIED').length} of ${documents.length} verified`}
        action={<EditLink onPress={edit('gst')} />}
      >
        {documents.length ? (
          documents.map(doc => {
            const st = VERIFICATION[String(doc.verificationStatus)] ?? VERIFICATION.PENDING;
            return (
              <View key={String(doc.id)} style={opsStyles.rowBetween}>
                <Pressable accessibilityRole="link" disabled={!doc.fileUrl} onPress={() => Linking.openURL(String(doc.fileUrl))} style={styles.flex}>
                  <Text style={opsStyles.title} numberOfLines={1}>
                    {labelFor(DOCUMENT_TYPES, doc.documentType)}
                  </Text>
                  {doc.documentNumber ? <Text style={opsStyles.meta}>{String(doc.documentNumber)}</Text> : null}
                </Pressable>
                <Badge label={st.label} tone={st.tone} />
              </View>
            );
          })
        ) : (
          <Text style={opsStyles.muted}>No documents uploaded</Text>
        )}
      </SectionCard>
    ),
  };

  return <>{(Object.keys(cards) as OverviewCard[]).filter(show).map(k => <React.Fragment key={k}>{cards[k]}</React.Fragment>)}</>;
}

// ── Additional info ──────────────────────────────────────────────────────

function AdditionalInfo({ store, onContinue }: { store: StoreRecord; onContinue?: () => void }) {
  const config = store.config ?? null;
  const tax = store.taxDetails ?? null;
  const reqs = useFetch(() => storeManageService.documentRequirements().catch(() => DEFAULT_DOCUMENT_REQUIREMENTS), []);
  const onboardingDone = store.onboardingStatus === 'COMPLETED';
  const stepDone = (key: string) =>
    key === 'ADDRESS_CONTACT'
      ? !!store.settings
      : key === 'GST_DETAILS'
        ? !!tax
        : key === 'DOCUMENTS'
          ? missingDocuments(!!tax?.gstRegistered, store.documents ?? [], reqs.data?.length ? reqs.data : DEFAULT_DOCUMENT_REQUIREMENTS).length === 0
          : key === 'REVIEW'
            ? onboardingDone
            : true;
  const yes = (v: boolean) => (config ? (v ? 'Yes' : 'No') : '');
  return (
    <>
      <SectionCard icon={StoreIcon} title="Store Record">
        <Detail label="Store Code" value={store.code} />
        <Detail label="Store Slug" value={store.slug} />
        <Detail label="Shop Link" value={storeShopUrl(SHOP_URL, store.code, store.slug)} />
        <Detail label="Store Status" value={store.status} />
        <Detail label="Created On" value={at(store.createdAt)} />
        <Detail label="Last Reviewed" value={store.reviewedAt ? at(store.reviewedAt) : ''} />
        <Detail label="Tagline" value={store.branding?.tagline as string} />
      </SectionCard>
      <SectionCard icon={SettingsIcon} title="Orders & Payments">
        <Detail label="Currency Symbol" value={config?.currencySymbol as string} />
        <Detail label="Order Prefix" value={config?.orderPrefix as string} />
        <Detail label="Minimum Order" value={config?.minOrderAmount as string} />
        <Detail label="Cash on Delivery" value={config ? (config.codEnabled !== false ? 'Enabled' : 'Disabled') : ''} />
        <Detail label="Tax-inclusive Pricing" value={yes(config?.taxInclusivePricing !== false)} />
        <Detail label="Auto-accept Orders" value={yes(!!config?.autoAcceptOrders)} />
      </SectionCard>
      <SectionCard
        icon={CheckCircleIcon}
        title="Onboarding"
        action={
          !onboardingDone && onContinue ? (
            <Pressable accessibilityRole="button" onPress={onContinue}>
              <Text style={styles.link}>Continue</Text>
            </Pressable>
          ) : null
        }
      >
        {ONBOARDING_STEPS.map(s => {
          const done = stepDone(s.key);
          return (
            <View key={s.key} style={opsStyles.row}>
              <CheckCircleIcon size={17} color={done ? colors.success : colors.border} />
              <Text style={done ? opsStyles.title : opsStyles.muted}>{s.label}</Text>
              {s.optional ? <Text style={styles.optional}>OPTIONAL</Text> : null}
            </View>
          );
        })}
        {store.onboardingCompletedAt ? <Text style={opsStyles.meta}>{`Completed ${formatDay(store.onboardingCompletedAt)}`}</Text> : null}
      </SectionCard>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grow: { flexGrow: 1, justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  selfStart: { alignSelf: 'flex-start' },
  centerBtn: { alignSelf: 'center', marginTop: -40 },
  accent: { color: colors.secondary },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  headCard: { gap: 12, padding: 16, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, ...shadow.card },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 64, height: 64, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#065f46' },
  name: { marginBottom: 6, fontFamily: fonts.extrabold, fontSize: 21, color: colors.text, letterSpacing: -0.3 },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.secondary },
  strip: { flexDirection: 'row', borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, ...shadow.card },
  stripCell: { flex: 1, gap: 5, padding: 10 },
  stripMid: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  stripLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  stripValue: { flexDirection: 'row', gap: 4 },
  stripText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  stripHint: { fontFamily: fonts.regular, fontSize: 10.5, color: colors.textMuted },
  rejected: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: '#fecaca', backgroundColor: colors.errorLight },
  rejectedTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.errorDark },
  rejectedText: { marginTop: 2, fontFamily: fonts.regular, fontSize: 13, color: colors.errorDark },
  tabs: { gap: 8, paddingVertical: 2 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tabOn: { borderColor: colors.secondary, backgroundColor: colors.secondary },
  tabText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  tabTextOn: { color: colors.white },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.warningLight },
  noticeText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.warningDark },
  editLink: { padding: 6, borderRadius: 8, backgroundColor: colors.secondaryLight },
  images: { flexDirection: 'row', gap: 10 },
  imageCol: { gap: 6 },
  imageBox: { height: 96, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  logoImage: { width: 96 },
  bannerImage: { width: 190 },
  address: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  optional: { fontFamily: fonts.semibold, fontSize: 9.5, letterSpacing: 0.5, color: colors.textMuted },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  actionText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
});
