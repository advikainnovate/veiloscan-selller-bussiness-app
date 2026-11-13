import React, { useEffect, useState, type ComponentType } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFetch } from '../hooks/useFetch';
import { extractErrorMessage } from '../lib/api';
import { formatDay } from '../lib/date';
import { pickImages } from '../lib/pick-image';
import { meetsPasswordRules, PASSWORD_RULES } from '../lib/password-rules';
import { openMenuKey } from '../navigation/navigationRef';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGES } from '../i18n';
import { authService } from '../services/auth-service';
import { fileService, type PickedFile } from '../services/products-service';
import { profileService, type Rec, type SalesTeamState } from '../services/profile-service';
import { subscriptionService } from '../services/subscription-service';
import { AppHeader } from '../components/layout/AppHeader';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Gradient } from '../components/ui/Gradient';
import { Group, groupStyles, Row } from '../components/ui/GroupList';
import { OtpInput } from '../components/ui/OtpInput';
import { PasswordField } from '../components/ui/PasswordField';
import { Sheet } from '../components/ui/Sheet';
import { Choices, Field, Input } from '../components/form/Fields';
import { confirmAction, opsStyles } from '../components/operations/OpsParts';
import {
  GlobeIcon,
  AlertCircleIcon,
  AwardIcon,
  CalendarIcon,
  ChartTrendIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  EditIcon,
  ImageIcon,
  LockIcon,
  LogoutIcon,
  MailIcon,
  PhoneIcon,
  ShieldCheckIcon,
  UserIcon,
  UsersIcon,
  type IconProps,
} from '../components/icons';
import type { ScreenProps } from '../navigation/types';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

const titleCase = (v: unknown) => {
  const s = String(v ?? '');
  return s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : '—';
};
const ACCOUNT_TONE: Record<string, BadgeTone> = { ACTIVE: 'green', INACTIVE: 'slate', PENDING: 'amber', SUSPENDED: 'red', BLOCKED: 'red' };
const PLAN_TONE: Record<string, BadgeTone> = { TRIALING: 'amber', ACTIVE: 'green', PAST_DUE: 'red', PAUSED: 'slate', CANCELLED: 'slate', EXPIRED: 'slate', PENDING: 'amber' };
const SALES_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { get label() { return i18n.t('common.awaitingApproval'); }, tone: 'amber' },
  APPROVED: { get label() { return i18n.t('common.approved'); }, tone: 'green' },
  REJECTED: { get label() { return i18n.t('common.notApproved'); }, tone: 'red' },
};

/** My Profile: who you are, how complete your profile is, security, plan and sales team, as the panel's page. */
export function ProfileScreen({ navigation }: ScreenProps<'Profile'>) {
  const { t } = useTranslation();
  const { user, roles, logout, refreshUser } = useAuth();
  const { language } = useLanguage();
  const toast = useToast();
  const userId = String(user?.id ?? '');
  const profile = useFetch(() => (userId ? profileService.get(userId).catch(() => null) : Promise.resolve(null)), [userId]);
  const plan = useFetch(() => subscriptionService.mine().catch(() => null), []);
  const isOwner = user?.userType === 'SELLER';
  const sales = useFetch(() => (isOwner ? profileService.salesTeam().catch(() => null) : Promise.resolve(null)), [isOwner]);
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [joining, setJoining] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!user) return null;

  const p = profile.data ?? null;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
  const initials = ([user.firstName, user.lastName].filter(Boolean) as string[]).map(s => s[0]).join('').slice(0, 2).toUpperCase() || (user.email?.[0] ?? 'S').toUpperCase();
  const avatarUrl = (p?.displayPic as Rec | undefined)?.url as string | undefined;
  const roleTitle = roles[0] || titleCase(user.userType);
  const status = String(user.status ?? 'ACTIVE');
  const phone = user.phoneNumber ? `+${String(user.countryCode ?? '')} ${String(user.phoneNumber)}` : '—';

  // What makes a complete profile, and what's still missing.
  const checklist = [
    { done: !!avatarUrl, label: t('profile.addAProfilePhoto') },
    { done: !!p?.shortDescription, label: t('profile.writeAShortBio') },
    { done: !!user.userDisplayName, label: t('profile.setADisplayName') },
    { done: !!user.gender, label: t('profile.addYourGender') },
    { done: !!user.isEmailVerification, label: t('profile.verifyYourEmail') },
    { done: !!user.isPhoneVerification, label: t('profile.verifyYourPhone') },
  ];
  const done = checklist.filter(c => c.done).length;
  const percent = Math.round((done / checklist.length) * 100);
  const next = checklist.find(c => !c.done);

  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([refreshUser().catch(() => {}), profile.reload(), plan.reload(), sales.reload()]);
    } finally {
      setRefreshing(false);
    }
  }

  async function signOut() {
    if (await confirmAction(t('common.signOut2'), t('common.youWillNeedToSignIn'), t('common.signOut'), true)) logout();
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={t('common.myProfile')} subtitle={t('common.account')} onBack={navigation.canGoBack() ? navigation.goBack : undefined} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {/* Who you are */}
        <View style={styles.hero}>
          <View style={styles.banner}>
            <Gradient colors={[colors.primaryDeep, '#0d2a55', colors.secondary]} direction="diagonal" />
            <View style={[styles.glow, styles.glowOne]} />
            <View style={[styles.glow, styles.glowTwo]} />
          </View>
          <View style={styles.heroBody}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('profile.changeProfilePhoto')} onPress={() => setEditing(true)} style={styles.avatarWrap}>
              <View style={styles.avatar}>{avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.fill} /> : <Text style={styles.initials}>{initials}</Text>}</View>
              <View style={styles.camera}>
                <ImageIcon size={13} color={colors.white} />
              </View>
            </Pressable>
            <Text style={styles.name} numberOfLines={2}>
              {fullName}
            </Text>
            <View style={styles.wrap}>
              <Text style={styles.role}>{roleTitle}</Text>
              <Badge label={titleCase(status)} tone={ACCOUNT_TONE[status] ?? 'slate'} />
              {user.userDisplayName ? <Text style={opsStyles.muted}>{`@${String(user.userDisplayName)}`}</Text> : null}
            </View>
            <View style={styles.chips}>
              <Chip icon={MailIcon} label={String(user.email ?? '—')} onPress={user.email ? () => Linking.openURL(`mailto:${String(user.email)}`) : undefined} />
              <Chip icon={PhoneIcon} label={phone} />
              <Chip icon={CalendarIcon} label={t('profile.joinedCreatedat', { createdAt: formatDay(user.createdAt) })} />
            </View>
            <View style={styles.about}>
              <Text style={styles.kicker}>{t('profile.aboutMe')}</Text>
              {p?.shortDescription ? (
                <Text style={styles.bio}>{String(p.shortDescription)}</Text>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => setEditing(true)}>
                  <Text style={styles.addBio}>{profile.loading ? t('common.loading') : t('profile.noBioYetAddAShort')}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* How complete it is */}
        <View style={styles.card}>
          <View style={opsStyles.rowBetween}>
            <Text style={opsStyles.title}>{t('profile.profileCompleteness')}</Text>
            <Text style={[styles.percent, percent === 100 && styles.ok]}>{`${percent}%`}</Text>
          </View>
          <View style={styles.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
            <View style={[styles.barFill, percent === 100 && styles.barDone, { width: `${percent}%` }]} />
          </View>
          <View style={styles.checklist}>
            {checklist.map(c => (
              <View key={c.label} style={styles.check}>
                {c.done ? <CheckCircleIcon size={15} color={colors.success} /> : <View style={styles.open} />}
                <Text style={[styles.checkText, c.done && styles.checkDone]}>{c.label}</Text>
              </View>
            ))}
          </View>
          {next && !next.label.startsWith('Verify') ? (
            <Pressable accessibilityRole="button" onPress={() => setEditing(true)}>
              <Text style={styles.link}>{`${next.label} ›`}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* At a glance */}
        <View style={styles.tiles}>
          <Tile icon={ShieldCheckIcon} tint="#fff7ed" color={colors.secondary} label={t('common.role')} value={roleTitle} />
          <Tile icon={UsersIcon} tint="#eef2ff" color="#4f46e5" label={t('common.userType')} value={titleCase(user.userType)} />
          <Tile icon={CheckCircleIcon} tint="#ecfdf5" color="#059669" label={t('common.account')} value={titleCase(status)} />
          <Tile icon={ClockIcon} tint="#f0f9ff" color="#0284c7" label={t('common.lastLogin')} value={user.lastLoginAt ? formatDay(user.lastLoginAt) : 'No recent logins'} />
        </View>

        <Group title={t('profile.personalInformation')} action={{ label: t('common.edit'), onPress: () => setEditing(true) }}>
          <Row label={t('profile.fullName')} value={fullName} />
          <Row label={t('profile.displayName')} value={user.userDisplayName as string} />
          <Row label={t('common.username')} value={user.username as string} />
          <Row label={t('common.emailAddress')} value={user.email as string} />
          <Row label={t('profile.phoneNumber')} value={phone} />
          <Row label={t('common.gender')} value={user.gender ? titleCase(user.gender) : null} last />
        </Group>

        <Group title={t('profile.security')} action={{ label: t('profile.changePassword'), onPress: () => setChangingPassword(true) }}>
          <Row label={t('common.password')} value="••••••••••" />
          <Row label={t('common.email')} value={<Verified on={!!user.isEmailVerification} />} />
          <Row label={t('common.phone')} value={<Verified on={!!user.isPhoneVerification} />} />
          <Row label={t('profile.passwordChanged')} value={user.passwordChangedAt ? formatDay(user.passwordChangedAt) : 'Never'} />
          <Row label={t('profile.recentLoginAttempts')} value={String((user.loginAttempt as number | undefined) ?? 0)} last />
        </Group>

        <Group title={t('profile.documentsAndVerification')}>
          <Row label={t('profile.idProof')} value={<Uploaded on={!!p?.idProofDocId} />} />
          <Row label={t('common.addressProof')} value={<Uploaded on={!!p?.addressProofDocId} />} />
          <Row label={t('profile.profileStatus')} value={<Badge label={titleCase(p?.status ?? 'ACTIVE')} tone={ACCOUNT_TONE[String(p?.status ?? 'ACTIVE')] ?? 'slate'} />} last />
        </Group>

        <PlanGroup plan={plan.data?.plan ?? null} loading={plan.loading} />

        {isOwner ? <SalesTeamGroup state={sales.data ?? null} loading={sales.loading} onRequest={() => setJoining(true)} /> : null}

        <Group title={t('common.account')}>
          <Action icon={EditIcon} tone="green" title={t('profile.editProfile')} sub={t('profile.updateYourNamePhotoAndBio')} onPress={() => setEditing(true)} />
          <Action icon={LockIcon} title={t('profile.changePassword2')} sub={t('profile.weEmailYouA6Digit')} onPress={() => setChangingPassword(true)} />
          <Action icon={AwardIcon} title={t('common.subscription')} sub={t('profile.yourPlanAndBilling')} onPress={() => openMenuKey('subscription')} />
          <Action icon={GlobeIcon} title={t('nav.languageAndRegion')} sub={LANGUAGES.find(l => l.code === language)?.nativeName ?? ''} onPress={() => openMenuKey('language')} />
          <Action icon={LogoutIcon} tone="red" title={t('common.signOut')} sub={t('profile.endYourCurrentSession')} onPress={signOut} last />
        </Group>
      </ScrollView>

      <EditProfileSheet
        visible={editing}
        user={user as Rec}
        profile={p}
        onClose={() => setEditing(false)}
        onSaved={async () => {
          setEditing(false);
          toast(t('profile.profileUpdated'));
          await Promise.all([refreshUser().catch(() => {}), profile.reload()]);
        }}
      />
      <ChangePasswordSheet visible={changingPassword} email={String(user.email ?? '')} onClose={() => setChangingPassword(false)} />
      <SalesTeamSheet
        visible={joining}
        onClose={() => setJoining(false)}
        onSent={() => {
          setJoining(false);
          sales.reload();
        }}
      />
    </View>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

function Chip({ icon: Icon, label, onPress }: { icon: ComponentType<IconProps>; label: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole={onPress ? 'link' : undefined} disabled={!onPress} onPress={onPress} style={styles.chip}>
      <Icon size={13} color={colors.textMuted} />
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Tile({ icon: Icon, tint, color, label, value }: { icon: ComponentType<IconProps>; tint: string; color: string; label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: tint }]}>
        <Icon size={15} color={color} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const Verified = ({ on }: { on: boolean }) => {
  const { t } = useTranslation();
  return (
  <View style={styles.inline}>
    <CheckCircleIcon size={14} color={on ? colors.success : colors.warning} />
    <Text style={[groupStyles.value, on ? styles.ok : styles.amber]}>{on ? t('common.verified') : t('profile.notVerified')}</Text>
  </View>
);
};

const Uploaded = ({ on }: { on: boolean }) => {
  const { t } = useTranslation();
  return <Text style={[groupStyles.value, on ? styles.ok : groupStyles.muted]}>{on ? t('profile.uploaded') : t('common.notUploaded')}</Text>;
};

function Action({ icon: Icon, title, sub, onPress, tone = 'slate', last }: { icon: ComponentType<IconProps>; title: string; sub: string; onPress: () => void; tone?: 'slate' | 'green' | 'red'; last?: boolean }) {
  const tones = { slate: ['#f1f5f9', colors.textSecondary], green: ['#ecfdf5', '#059669'], red: ['#fef2f2', colors.error] } as const;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.action, !last && groupStyles.line, pressed && styles.pressed]}>
      <View style={[styles.actionIcon, { backgroundColor: tones[tone][0] }]}>
        <Icon size={16} color={tones[tone][1]} />
      </View>
      <View style={styles.flex}>
        <Text style={[opsStyles.title, tone === 'red' && opsStyles.danger]}>{title}</Text>
        <Text style={opsStyles.muted}>{sub}</Text>
      </View>
      <ChevronRightIcon size={16} color={colors.border} />
    </Pressable>
  );
}

function PlanGroup({ plan, loading }: { plan: NonNullable<Awaited<ReturnType<typeof subscriptionService.mine>>>['plan'] | null; loading: boolean }) {
  const { t } = useTranslation();
  const manage = { label: t('common.manage'), onPress: () => openMenuKey('subscription') };
  if (!plan) {
    return (
      <Group title={t('profile.subscriptionPlan')} action={manage}>
        <Row label={t('common.plan')} value={loading ? 'Loading…' : 'Unavailable right now'} last />
      </Group>
    );
  }
  const status = String(plan.status ?? '');
  const price =
    plan.amount == null
      ? t('common.customPricing')
      : `${new Intl.NumberFormat('en-IN', { style: 'currency', currency: plan.currency ?? 'INR', maximumFractionDigits: 0 }).format(plan.amount)} / ${plan.billingCycle === 'YEARLY' ? 'year' : 'month'}`;
  const trialEnds = status === 'TRIALING' && plan.trialEndsAt ? formatDay(plan.trialEndsAt) : null;
  return (
    <Group title={t('profile.subscriptionPlan')} action={manage}>
      <Row
        label={t('profile.currentPlan')}
        value={
          <View style={styles.inline}>
            <Text style={groupStyles.value}>{plan.planName ?? '—'}</Text>
            {plan.isDefault ? <Badge label={t('common.free')} tone="slate" /> : null}
          </View>
        }
      />
      {plan.isDefault ? (
        <Row label={t('common.status')} value="No paid plan yet — choose one to start a free trial" last />
      ) : (
        <>
          <Row label={t('common.status')} value={<Badge label={titleCase(status)} tone={PLAN_TONE[status] ?? 'slate'} />} />
          <Row label={t('profile.billing')} value={price} />
          {trialEnds ? <Row label={t('profile.freeTrialEnds')} value={trialEnds} /> : null}
          <Row label={trialEnds ? t('profile.firstCharge') : t('profile.renewsOn')} value={plan.currentPeriodEnd ? formatDay(plan.currentPeriodEnd) : '—'} />
          <Row label="Auto-renew" value={<Text style={[groupStyles.value, plan.autoRenew ? styles.ok : groupStyles.muted]}>{plan.autoRenew ? t('common.on') : t('common.off')}</Text>} />
          <Row label={t('profile.startedOn')} value={plan.startedAt ? formatDay(plan.startedAt) : '—'} last />
        </>
      )}
    </Group>
  );
}

function SalesTeamGroup({ state, loading, onRequest }: { state: SalesTeamState | null; loading: boolean; onRequest: () => void }) {
  const { t } = useTranslation();
  const action = state?.canRequest ? { label: state.standing === 'REJECTED' ? t('common.requestAgain') : t('profile.join'), onPress: onRequest } : undefined;
  if (!state) {
    return (
      <Group title={t('profile.salesTeam')}>
        <Row label={t('common.status')} value={loading ? 'Loading…' : 'Unavailable right now'} last />
      </Group>
    );
  }
  const latest = state.history[0];
  const s = SALES_STATUS[state.standing];
  return (
    <Group title={t('profile.salesTeam')} action={action}>
      {state.salesTeam ? (
        <>
          <Row label={t('profile.salesTeamId')} value={<Text style={[groupStyles.value, styles.mono]}>{state.salesTeam.salesId}</Text>} />
          <Row label={t('profile.accountStatus')} value={<Badge label={titleCase(state.salesTeam.status)} tone={ACCOUNT_TONE[state.salesTeam.status] ?? 'slate'} />} />
          <Row label={t('profile.memberSince')} value={formatDay(state.salesTeam.createdAt)} />
          <Row
            label={t('profile.signIn')}
            value={
              state.salesPortalUrl ? (
                <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`${state.salesPortalUrl}/login`)}>
                  <Text style={styles.link}>{t('profile.openTheSalesPortal')}</Text>
                </Pressable>
              ) : (
                'Sales Portal, with this ID'
              )
            }
            last
          />
        </>
      ) : (
        <>
          <Row label={t('common.status')} value={s ? <Badge label={s.label} tone={s.tone} /> : 'Not a member'} last={!latest} />
          {latest ? <Row label={t('profile.requestedOn')} value={formatDay(latest.createdAt)} last={!(latest.status === 'REJECTED' && latest.decisionNote)} /> : null}
          {latest?.status === 'REJECTED' && latest.decisionNote ? <Text style={[styles.note, opsStyles.danger]}>{t('profile.reasonDecisionnote', { decisionNote: latest.decisionNote })}</Text> : null}
          {state.standing === 'NONE' ? (
            <View style={styles.pitch}>
              <ChartTrendIcon size={16} color={colors.secondary} />
              <Text style={[opsStyles.muted, styles.flex]}>{t('profile.sellVeiloscanPlansToOtherSellers')}</Text>
            </View>
          ) : null}
          {state.standing === 'PENDING' ? <Text style={styles.note}>{t('profile.anAdminIsReviewingYourRequest')}</Text> : null}
        </>
      )}
    </Group>
  );
}

// ── Sheets ───────────────────────────────────────────────────────────────

function EditProfileSheet({ visible, user, profile, onClose, onSaved }: { visible: boolean; user: Rec; profile: Rec | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ firstName: '', lastName: '', displayName: '', gender: '', bio: '' });
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));
  const current = (profile?.displayPic as Rec | undefined)?.url as string | undefined;

  useEffect(() => {
    if (!visible) return;
    setForm({
      firstName: String(user.firstName ?? ''),
      lastName: String(user.lastName ?? ''),
      displayName: String(user.userDisplayName ?? ''),
      gender: String(user.gender ?? ''),
      bio: String(profile?.shortDescription ?? ''),
    });
    setPhoto(null);
    setError('');
  }, [visible, user, profile]);

  async function pick() {
    try {
      const [file] = await pickImages({ multiple: false });
      if (file) setPhoto(file);
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function save() {
    setError('');
    if (!form.firstName.trim()) return setError(t('profile.enterYourFirstName'));
    setSaving(true);
    try {
      const id = String(user.id);
      await profileService.updateUser(id, { firstName: form.firstName.trim(), lastName: form.lastName.trim(), displayName: form.displayName.trim(), gender: form.gender || undefined });
      let displayPicId: string | undefined;
      if (photo) displayPicId = String((await fileService.upload(photo, 'user-profiles', { documentType: 'display-pic', documentId: id })).id);
      if (form.bio.trim() || displayPicId) {
        await profileService.upsert(id, { ...(form.bio.trim() ? { shortDescription: form.bio.trim() } : {}), ...(displayPicId ? { displayPicId } : {}) });
      }
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const preview = photo?.uri ?? current;
  return (
    <Sheet visible={visible} title={t('profile.editProfile')} onClose={onClose} footer={<Button title={t('common.saveChanges2')} loading={saving} onPress={save} />}>
      <View style={styles.photoRow}>
        <View style={styles.photo}>{preview ? <Image source={{ uri: preview }} style={styles.fill} /> : <UserIcon size={24} color={colors.textMuted} />}</View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('profile.changePhoto')} onPress={pick} style={opsStyles.smallBtn}>
          <ImageIcon size={14} color={colors.text} />
          <Text style={opsStyles.smallBtnText}>{preview ? t('profile.changePhoto') : t('common.addPhoto')}</Text>
        </Pressable>
      </View>
      <Field label={t('profile.firstName')} required>
        <Input value={form.firstName} onChangeText={v => set('firstName', v)} maxLength={50} accessibilityLabel={t('profile.firstName')} />
      </Field>
      <Field label={t('profile.lastName')}>
        <Input value={form.lastName} onChangeText={v => set('lastName', v)} maxLength={50} accessibilityLabel={t('profile.lastName')} />
      </Field>
      <Field label={t('profile.displayName')}>
        <Input value={form.displayName} onChangeText={v => set('displayName', v)} maxLength={50} autoCapitalize="none" accessibilityLabel={t('profile.displayName')} />
      </Field>
      <Field label={t('common.gender')}>
        <Choices
          options={[
            { value: 'MALE', label: t('common.male') },
            { value: 'FEMALE', label: t('common.female') },
            { value: 'OTHER', label: t('common.other') },
          ]}
          value={form.gender}
          onChange={v => set('gender', v)}
        />
      </Field>
      <Field label={t('profile.aboutMe2')} hint={`${form.bio.length} / 255`}>
        <Input value={form.bio} onChangeText={v => set('bio', v)} maxLength={255} multiline placeholder={t('profile.aShortBioAboutYourself')} style={styles.textArea} accessibilityLabel={t('profile.aboutMe2')} />
      </Field>
      {error ? (
        <View style={opsStyles.error}>
          <AlertCircleIcon size={16} color={colors.errorDark} />
          <Text style={opsStyles.errorText}>{error}</Text>
        </View>
      ) : null}
    </Sheet>
  );
}

/** Change the password with a code emailed to the account, without signing out. */
function ChangePasswordSheet({ visible, email, onClose }: { visible: boolean; email: string; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [step, setStep] = useState<'send' | 'reset'>('send');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStep('send');
    setOtp('');
    setPassword('');
    setConfirm('');
    setError('');
  }, [visible]);

  async function send() {
    setError('');
    setBusy(true);
    try {
      await authService.forgotPassword(email);
      setStep('reset');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setError('');
    if (otp.length !== 6) return setError(t('profile.enterThe6DigitCodeFrom'));
    if (!meetsPasswordRules(password)) return setError(t('profile.theNewPasswordDoesnTMeet'));
    if (password !== confirm) return setError(t('profile.thePasswordsDonTMatch'));
    setBusy(true);
    try {
      await authService.resetPassword(email, otp, password);
      toast(t('profile.passwordChanged'));
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title={t('profile.changePassword2')}
      subtitle={step === 'send' ? t('profile.weLlEmailA6Digit', { email }) : t('profile.enterTheCodeSentToEmail', { email })}
      onClose={onClose}
      footer={<Button title={step === 'send' ? t('common.sendCode') : t('profile.changePassword2')} loading={busy} onPress={step === 'send' ? send : reset} />}
    >
      {step === 'reset' ? (
        <>
          <OtpInput value={otp} onChange={setOtp} autoFocus disabled={busy} />
          <PasswordField label={t('common.newPassword')} placeholder={t('profile.enterANewPassword')} value={password} onChangeText={setPassword} />
          <PasswordField label={t('profile.confirmPassword')} placeholder={t('profile.enterItAgain')} value={confirm} onChangeText={setConfirm} />
          <View style={styles.rules}>
            {PASSWORD_RULES.map(r => {
              const ok = r.test(password);
              return (
                <View key={r.label} style={styles.rule}>
                  {ok ? <CheckCircleIcon size={14} color={colors.success} /> : <View style={styles.open} />}
                  <Text style={[styles.checkText, ok && styles.ok]}>{r.label}</Text>
                </View>
              );
            })}
          </View>
          <Pressable accessibilityRole="button" disabled={busy} onPress={send}>
            <Text style={styles.link}>{t('profile.sendANewCode')}</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.pitch}>
          <MailIcon size={16} color={colors.secondary} />
          <Text style={[opsStyles.muted, styles.flex]}>{t('profile.theCodeIsValidForA')}</Text>
        </View>
      )}
      {error ? (
        <View style={opsStyles.error}>
          <AlertCircleIcon size={16} color={colors.errorDark} />
          <Text style={opsStyles.errorText}>{error}</Text>
        </View>
      ) : null}
    </Sheet>
  );
}

function SalesTeamSheet({ visible, onClose, onSent }: { visible: boolean; onClose: () => void; onSent: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) {
      setNote('');
      setError('');
    }
  }, [visible]);
  async function send() {
    setBusy(true);
    setError('');
    try {
      await profileService.requestSalesTeam(note.trim());
      toast(t('profile.requestSentAnAdminWillReview'));
      onSent();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      visible={visible}
      title={t('profile.becomeASalesTeamMember')}
      subtitle={t('profile.anAdminReviewsYourRequestOnce')}
      onClose={onClose}
      footer={<Button title={t('profile.sendRequest')} loading={busy} onPress={send} />}
    >
      <Field label={t('common.noteOptional')}>
        <Input value={note} onChangeText={setNote} maxLength={500} multiline placeholder="e.g. I'd like to onboard sellers in my area" style={styles.textArea} accessibilityLabel={t('common.note')} />
      </Field>
      {error ? (
        <View style={opsStyles.error}>
          <AlertCircleIcon size={16} color={colors.errorDark} />
          <Text style={opsStyles.errorText}>{error}</Text>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  fill: { width: '100%', height: '100%' },
  pressed: { backgroundColor: colors.background },
  content: { gap: 14, padding: 16, paddingBottom: 40 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ok: { color: colors.successDark },
  amber: { color: colors.warningDark },
  mono: { fontFamily: fonts.bold, letterSpacing: 0.8, color: '#4f46e5' },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary },
  hero: { overflow: 'hidden', borderRadius: radius.xl, backgroundColor: colors.surface, ...shadow.card },
  banner: { height: 96, overflow: 'hidden' },
  glow: { position: 'absolute', borderRadius: 999 },
  glowOne: { width: 180, height: 180, top: -80, right: -40, backgroundColor: 'rgba(255,255,255,0.12)' },
  glowTwo: { width: 120, height: 120, bottom: -70, left: 30, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroBody: { alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingBottom: 18, marginTop: -48 },
  avatarWrap: { marginBottom: 4 },
  avatar: { width: 96, height: 96, borderRadius: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.white, backgroundColor: colors.secondary, ...shadow.raised },
  initials: { fontFamily: fonts.extrabold, fontSize: 32, color: colors.white },
  camera: { position: 'absolute', right: -4, bottom: -4, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white, backgroundColor: colors.primary },
  name: { fontFamily: fonts.extrabold, fontSize: 21, color: colors.text, textAlign: 'center', letterSpacing: -0.3 },
  role: { overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, fontFamily: fonts.bold, fontSize: 11.5, color: '#c2410c', backgroundColor: '#fff7ed' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', paddingHorizontal: 10, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.border },
  chipText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  about: { alignSelf: 'stretch', gap: 4, marginTop: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  kicker: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1.4, color: colors.textMuted },
  bio: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary },
  addBio: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  card: { gap: 10, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  percent: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.secondary },
  bar: { height: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: colors.background },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.secondary },
  barDone: { backgroundColor: colors.success },
  checklist: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 7, width: '50%' },
  open: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, borderColor: colors.border },
  checkText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  checkDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, gap: 4, padding: 12, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  tileIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  tileLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textMuted },
  tileValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  note: { paddingBottom: 12, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  pitch: { flexDirection: 'row', gap: 8, paddingVertical: 12 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10 },
  actionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photo: { width: 72, height: 72, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  rules: { gap: 6 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 7 },
});
