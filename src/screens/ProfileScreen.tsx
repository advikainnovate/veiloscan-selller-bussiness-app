import React, { useEffect, useState, type ComponentType, type ReactNode } from 'react';
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
import { authService } from '../services/auth-service';
import { fileService, type PickedFile } from '../services/products-service';
import { profileService, type Rec, type SalesTeamState } from '../services/profile-service';
import { subscriptionService } from '../services/subscription-service';
import { AppHeader } from '../components/layout/AppHeader';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Gradient } from '../components/ui/Gradient';
import { OtpInput } from '../components/ui/OtpInput';
import { PasswordField } from '../components/ui/PasswordField';
import { Sheet } from '../components/ui/Sheet';
import { Choices, Field, Input } from '../components/form/Fields';
import { confirmAction, opsStyles } from '../components/operations/OpsParts';
import {
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

const titleCase = (v: unknown) => {
  const s = String(v ?? '');
  return s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : '—';
};
const ACCOUNT_TONE: Record<string, BadgeTone> = { ACTIVE: 'green', INACTIVE: 'slate', PENDING: 'amber', SUSPENDED: 'red', BLOCKED: 'red' };
const PLAN_TONE: Record<string, BadgeTone> = { TRIALING: 'amber', ACTIVE: 'green', PAST_DUE: 'red', PAUSED: 'slate', CANCELLED: 'slate', EXPIRED: 'slate', PENDING: 'amber' };
const SALES_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Awaiting approval', tone: 'amber' },
  APPROVED: { label: 'Approved', tone: 'green' },
  REJECTED: { label: 'Not approved', tone: 'red' },
};

/** My Profile: who you are, how complete your profile is, security, plan and sales team, as the panel's page. */
export function ProfileScreen({ navigation }: ScreenProps<'Profile'>) {
  const { user, roles, logout, refreshUser } = useAuth();
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
    { done: !!avatarUrl, label: 'Add a profile photo' },
    { done: !!p?.shortDescription, label: 'Write a short bio' },
    { done: !!user.userDisplayName, label: 'Set a display name' },
    { done: !!user.gender, label: 'Add your gender' },
    { done: !!user.isEmailVerification, label: 'Verify your email' },
    { done: !!user.isPhoneVerification, label: 'Verify your phone' },
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
    if (await confirmAction('Sign out?', 'You will need to sign in again to manage your store.', 'Sign Out', true)) logout();
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title="My Profile" subtitle="Account" onBack={navigation.canGoBack() ? navigation.goBack : undefined} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {/* Who you are */}
        <View style={styles.hero}>
          <View style={styles.banner}>
            <Gradient colors={[colors.primaryDeep, '#0d2a55', colors.secondary]} direction="diagonal" />
            <View style={[styles.glow, styles.glowOne]} />
            <View style={[styles.glow, styles.glowTwo]} />
          </View>
          <View style={styles.heroBody}>
            <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={() => setEditing(true)} style={styles.avatarWrap}>
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
              <Chip icon={CalendarIcon} label={`Joined ${formatDay(user.createdAt)}`} />
            </View>
            <View style={styles.about}>
              <Text style={styles.kicker}>ABOUT ME</Text>
              {p?.shortDescription ? (
                <Text style={styles.bio}>{String(p.shortDescription)}</Text>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => setEditing(true)}>
                  <Text style={styles.addBio}>{profile.loading ? 'Loading…' : 'No bio yet — add a short one ›'}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* How complete it is */}
        <View style={styles.card}>
          <View style={opsStyles.rowBetween}>
            <Text style={opsStyles.title}>Profile completeness</Text>
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
          <Tile icon={ShieldCheckIcon} tint="#fff7ed" color={colors.secondary} label="Role" value={roleTitle} />
          <Tile icon={UsersIcon} tint="#eef2ff" color="#4f46e5" label="User type" value={titleCase(user.userType)} />
          <Tile icon={CheckCircleIcon} tint="#ecfdf5" color="#059669" label="Account" value={titleCase(status)} />
          <Tile icon={ClockIcon} tint="#f0f9ff" color="#0284c7" label="Last login" value={user.lastLoginAt ? formatDay(user.lastLoginAt) : 'No recent logins'} />
        </View>

        <Group title="Personal Information" action={{ label: 'Edit', onPress: () => setEditing(true) }}>
          <Row label="Full Name" value={fullName} />
          <Row label="Display Name" value={user.userDisplayName as string} />
          <Row label="Username" value={user.username as string} />
          <Row label="Email Address" value={user.email as string} />
          <Row label="Phone Number" value={phone} />
          <Row label="Gender" value={user.gender ? titleCase(user.gender) : null} last />
        </Group>

        <Group title="Security" action={{ label: 'Change password', onPress: () => setChangingPassword(true) }}>
          <Row label="Password" value="••••••••••" />
          <Row label="Email" value={<Verified on={!!user.isEmailVerification} />} />
          <Row label="Phone" value={<Verified on={!!user.isPhoneVerification} />} />
          <Row label="Password changed" value={user.passwordChangedAt ? formatDay(user.passwordChangedAt) : 'Never'} />
          <Row label="Recent login attempts" value={String((user.loginAttempt as number | undefined) ?? 0)} last />
        </Group>

        <Group title="Documents & Verification">
          <Row label="ID Proof" value={<Uploaded on={!!p?.idProofDocId} />} />
          <Row label="Address Proof" value={<Uploaded on={!!p?.addressProofDocId} />} />
          <Row label="Profile Status" value={<Badge label={titleCase(p?.status ?? 'ACTIVE')} tone={ACCOUNT_TONE[String(p?.status ?? 'ACTIVE')] ?? 'slate'} />} last />
        </Group>

        <PlanGroup plan={plan.data?.plan ?? null} loading={plan.loading} />

        {isOwner ? <SalesTeamGroup state={sales.data ?? null} loading={sales.loading} onRequest={() => setJoining(true)} /> : null}

        <Group title="Account">
          <Action icon={EditIcon} tone="green" title="Edit Profile" sub="Update your name, photo and bio" onPress={() => setEditing(true)} />
          <Action icon={LockIcon} title="Change Password" sub="We email you a 6-digit code" onPress={() => setChangingPassword(true)} />
          <Action icon={AwardIcon} title="Subscription" sub="Your plan and billing" onPress={() => openMenuKey('subscription')} />
          <Action icon={LogoutIcon} tone="red" title="Sign Out" sub="End your current session" onPress={signOut} last />
        </Group>
      </ScrollView>

      <EditProfileSheet
        visible={editing}
        user={user as Rec}
        profile={p}
        onClose={() => setEditing(false)}
        onSaved={async () => {
          setEditing(false);
          toast('Profile updated');
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

function Group({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Text style={styles.groupTitle}>{title.toUpperCase()}</Text>
        {action ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={action.onPress}>
            <Text style={styles.link}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: ReactNode; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowLine]}>
      <Text style={styles.rowLabel}>{label}</Text>
      {typeof value === 'string' || value == null ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value || '—'}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

const Verified = ({ on }: { on: boolean }) => (
  <View style={styles.inline}>
    <CheckCircleIcon size={14} color={on ? colors.success : colors.warning} />
    <Text style={[styles.rowValue, on ? styles.ok : styles.amber]}>{on ? 'Verified' : 'Not verified'}</Text>
  </View>
);

const Uploaded = ({ on }: { on: boolean }) => <Text style={[styles.rowValue, on ? styles.ok : styles.mutedValue]}>{on ? 'Uploaded' : 'Not uploaded'}</Text>;

function Action({ icon: Icon, title, sub, onPress, tone = 'slate', last }: { icon: ComponentType<IconProps>; title: string; sub: string; onPress: () => void; tone?: 'slate' | 'green' | 'red'; last?: boolean }) {
  const tones = { slate: ['#f1f5f9', colors.textSecondary], green: ['#ecfdf5', '#059669'], red: ['#fef2f2', colors.error] } as const;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.action, !last && styles.rowLine, pressed && styles.pressed]}>
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
  const manage = { label: 'Manage', onPress: () => openMenuKey('subscription') };
  if (!plan) {
    return (
      <Group title="Subscription Plan" action={manage}>
        <Row label="Plan" value={loading ? 'Loading…' : 'Unavailable right now'} last />
      </Group>
    );
  }
  const status = String(plan.status ?? '');
  const price =
    plan.amount == null
      ? 'Custom pricing'
      : `${new Intl.NumberFormat('en-IN', { style: 'currency', currency: plan.currency ?? 'INR', maximumFractionDigits: 0 }).format(plan.amount)} / ${plan.billingCycle === 'YEARLY' ? 'year' : 'month'}`;
  const trialEnds = status === 'TRIALING' && plan.trialEndsAt ? formatDay(plan.trialEndsAt) : null;
  return (
    <Group title="Subscription Plan" action={manage}>
      <Row
        label="Current Plan"
        value={
          <View style={styles.inline}>
            <Text style={styles.rowValue}>{plan.planName ?? '—'}</Text>
            {plan.isDefault ? <Badge label="Free" tone="slate" /> : null}
          </View>
        }
      />
      {plan.isDefault ? (
        <Row label="Status" value="No paid plan yet — choose one to start a free trial" last />
      ) : (
        <>
          <Row label="Status" value={<Badge label={titleCase(status)} tone={PLAN_TONE[status] ?? 'slate'} />} />
          <Row label="Billing" value={price} />
          {trialEnds ? <Row label="Free Trial Ends" value={trialEnds} /> : null}
          <Row label={trialEnds ? 'First Charge' : 'Renews On'} value={plan.currentPeriodEnd ? formatDay(plan.currentPeriodEnd) : '—'} />
          <Row label="Auto-renew" value={<Text style={[styles.rowValue, plan.autoRenew ? styles.ok : styles.mutedValue]}>{plan.autoRenew ? 'On' : 'Off'}</Text>} />
          <Row label="Started On" value={plan.startedAt ? formatDay(plan.startedAt) : '—'} last />
        </>
      )}
    </Group>
  );
}

function SalesTeamGroup({ state, loading, onRequest }: { state: SalesTeamState | null; loading: boolean; onRequest: () => void }) {
  const action = state?.canRequest ? { label: state.standing === 'REJECTED' ? 'Request again' : 'Join', onPress: onRequest } : undefined;
  if (!state) {
    return (
      <Group title="Sales Team">
        <Row label="Status" value={loading ? 'Loading…' : 'Unavailable right now'} last />
      </Group>
    );
  }
  const latest = state.history[0];
  const s = SALES_STATUS[state.standing];
  return (
    <Group title="Sales Team" action={action}>
      {state.salesTeam ? (
        <>
          <Row label="Sales Team ID" value={<Text style={[styles.rowValue, styles.mono]}>{state.salesTeam.salesId}</Text>} />
          <Row label="Account Status" value={<Badge label={titleCase(state.salesTeam.status)} tone={ACCOUNT_TONE[state.salesTeam.status] ?? 'slate'} />} />
          <Row label="Member Since" value={formatDay(state.salesTeam.createdAt)} />
          <Row
            label="Sign In"
            value={
              state.salesPortalUrl ? (
                <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`${state.salesPortalUrl}/login`)}>
                  <Text style={styles.link}>Open the Sales Portal</Text>
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
          <Row label="Status" value={s ? <Badge label={s.label} tone={s.tone} /> : 'Not a member'} last={!latest} />
          {latest ? <Row label="Requested On" value={formatDay(latest.createdAt)} last={!(latest.status === 'REJECTED' && latest.decisionNote)} /> : null}
          {latest?.status === 'REJECTED' && latest.decisionNote ? <Text style={[styles.note, opsStyles.danger]}>{`Reason: ${latest.decisionNote}`}</Text> : null}
          {state.standing === 'NONE' ? (
            <View style={styles.pitch}>
              <ChartTrendIcon size={16} color={colors.secondary} />
              <Text style={[opsStyles.muted, styles.flex]}>Sell VeiloScan plans to other sellers. Once approved you get a Sales Team ID and sign in to the Sales Portal with a one-time code.</Text>
            </View>
          ) : null}
          {state.standing === 'PENDING' ? <Text style={styles.note}>An admin is reviewing your request. You'll be notified when it's decided.</Text> : null}
        </>
      )}
    </Group>
  );
}

// ── Sheets ───────────────────────────────────────────────────────────────

function EditProfileSheet({ visible, user, profile, onClose, onSaved }: { visible: boolean; user: Rec; profile: Rec | null; onClose: () => void; onSaved: () => void }) {
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
    if (!form.firstName.trim()) return setError('Enter your first name');
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
    <Sheet visible={visible} title="Edit Profile" onClose={onClose} footer={<Button title="Save changes" loading={saving} onPress={save} />}>
      <View style={styles.photoRow}>
        <View style={styles.photo}>{preview ? <Image source={{ uri: preview }} style={styles.fill} /> : <UserIcon size={24} color={colors.textMuted} />}</View>
        <Pressable accessibilityRole="button" accessibilityLabel="Change photo" onPress={pick} style={opsStyles.smallBtn}>
          <ImageIcon size={14} color={colors.text} />
          <Text style={opsStyles.smallBtnText}>{preview ? 'Change photo' : 'Add photo'}</Text>
        </Pressable>
      </View>
      <Field label="First Name" required>
        <Input value={form.firstName} onChangeText={v => set('firstName', v)} maxLength={50} accessibilityLabel="First Name" />
      </Field>
      <Field label="Last Name">
        <Input value={form.lastName} onChangeText={v => set('lastName', v)} maxLength={50} accessibilityLabel="Last Name" />
      </Field>
      <Field label="Display Name">
        <Input value={form.displayName} onChangeText={v => set('displayName', v)} maxLength={50} autoCapitalize="none" accessibilityLabel="Display Name" />
      </Field>
      <Field label="Gender">
        <Choices
          options={[
            { value: 'MALE', label: 'Male' },
            { value: 'FEMALE', label: 'Female' },
            { value: 'OTHER', label: 'Other' },
          ]}
          value={form.gender}
          onChange={v => set('gender', v)}
        />
      </Field>
      <Field label="About Me" hint={`${form.bio.length} / 255`}>
        <Input value={form.bio} onChangeText={v => set('bio', v)} maxLength={255} multiline placeholder="A short bio about yourself" style={styles.textArea} accessibilityLabel="About Me" />
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
    if (otp.length !== 6) return setError('Enter the 6-digit code from the email');
    if (!meetsPasswordRules(password)) return setError('The new password doesn’t meet the rules below');
    if (password !== confirm) return setError('The passwords don’t match');
    setBusy(true);
    try {
      await authService.resetPassword(email, otp, password);
      toast('Password changed');
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
      title="Change Password"
      subtitle={step === 'send' ? `We'll email a 6-digit code to ${email}.` : `Enter the code sent to ${email}, then your new password.`}
      onClose={onClose}
      footer={<Button title={step === 'send' ? 'Send Code' : 'Change Password'} loading={busy} onPress={step === 'send' ? send : reset} />}
    >
      {step === 'reset' ? (
        <>
          <OtpInput value={otp} onChange={setOtp} autoFocus disabled={busy} />
          <PasswordField label="New Password" placeholder="Enter a new password" value={password} onChangeText={setPassword} />
          <PasswordField label="Confirm Password" placeholder="Enter it again" value={confirm} onChangeText={setConfirm} />
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
            <Text style={styles.link}>Send a new code</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.pitch}>
          <MailIcon size={16} color={colors.secondary} />
          <Text style={[opsStyles.muted, styles.flex]}>The code is valid for a few minutes. Your other devices may need to sign in again afterwards.</Text>
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
      toast('Request sent — an admin will review it');
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
      title="Become a Sales Team member"
      subtitle="An admin reviews your request. Once approved, a separate Sales Team account is created with a Sales Team ID for the Sales Portal; your seller account stays as it is."
      onClose={onClose}
      footer={<Button title="Send request" loading={busy} onPress={send} />}
    >
      <Field label="Note (optional)">
        <Input value={note} onChangeText={setNote} maxLength={500} multiline placeholder="e.g. I'd like to onboard sellers in my area" style={styles.textArea} accessibilityLabel="Note" />
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
  group: { gap: 6 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  groupTitle: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.textSecondary },
  groupBody: { overflow: 'hidden', paddingHorizontal: 14, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 46, paddingVertical: 10 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary },
  rowValue: { flexShrink: 1, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  mutedValue: { color: colors.textMuted },
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
