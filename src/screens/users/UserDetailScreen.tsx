import React, { useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatDay, formatWhen } from '../../lib/date';
import { deviceGroups, genderLabel, userInitials, userName, userPhone, userStatus } from '../../lib/users';
import { userService } from '../../services/user-service';
import { authService } from '../../services/auth-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { ErrorState, FilterChips, ListSkeleton } from '../../components/list/ListParts';
import { confirmAction, Detail, opsStyles } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { AssignRoleSheet } from './UsersScreen';
import { BanIcon, CheckCircleIcon, ClockIcon, EditIcon, LockIcon, LogoutIcon, MailIcon, MobileIcon, PhoneIcon, ShieldCheckIcon, TrashIcon, UserIcon, UsersIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

type Tab = 'overview' | 'logins' | 'activity' | 'devices';

/** One staff user: their account, role and profile, sign-ins, activity and devices. */
export function UserDetailScreen({ navigation, route }: ScreenProps<'UserDetail'>) {
  const { t } = useTranslation();
  const { id } = route.params;
  const { hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission('users:view');
  const canEdit = hasPermission('users:edit');
  const canDelete = hasPermission('users:delete');
  const user = useFetch(() => (allowed ? userService.get(id) : Promise.resolve(null)), [allowed, id]);
  const profile = useFetch(() => (allowed ? userService.profile(id).catch(() => null) : Promise.resolve(null)), [allowed, id]);
  const roles = useFetch(() => (hasPermission('users:create') ? userService.assignableRoles().catch(() => []) : Promise.resolve([])), [id]);
  const sessions = useFetch(() => (allowed ? userService.sessions(id).catch(() => []) : Promise.resolve([])), [allowed, id]);
  const activity = useFetch(() => (allowed ? userService.activity(id).catch(() => []) : Promise.resolve([])), [allowed, id]);
  const [tab, setTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const devices = useMemo(() => deviceGroups(sessions.data ?? []), [sessions.data]);

  const header = <AppHeader title={user.data ? userName(user.data) : t('users.user')} subtitle={t('users.users')} onBack={navigation.goBack} />;
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ComingSoon label={t('users.users')} icon={UsersIcon} allowed={false} />
      </View>
    );
  }
  if (user.loading && !user.data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <View style={opsStyles.content}>
          <ListSkeleton rows={3} height={140} />
        </View>
      </View>
    );
  }
  if (!user.data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ErrorState message={user.error || t('users.thisUserCouldnTBeLoaded')} onRetry={() => user.reload()} />
      </View>
    );
  }

  const u = user.data;
  const status = userStatus(u.status);
  const isActive = u.status === 'ACTIVE';
  const role = (roles.data ?? []).find(r => r.id === u.roleId)?.roleTitle ?? null;
  const phone = userPhone(u);
  const canToggle = hasPermission(isActive ? 'users:deactivate' : 'users:activate') || canEdit;
  const refresh = () => {
    user.reload(true);
    profile.reload();
    sessions.reload();
    activity.reload();
  };

  async function act(key: string, action: () => Promise<unknown>, message: string, after?: () => void) {
    setBusy(key);
    try {
      await action();
      toast(message);
      if (after) after();
      else refresh();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword() {
    if (!u.email) return;
    if (!(await confirmAction(t('users.sendAPasswordResetLink'), t('users.weLlEmailEmailALink', { email: u.email }), t('users.sendLink')))) return;
    act('reset', () => authService.forgotPassword(u.email!), t('users.passwordResetLinkSent'), () => {});
  }

  async function toggle() {
    if (!(await confirmAction(`${isActive ? 'Deactivate' : 'Activate'} ${userName(u)}?`, isActive ? t('users.theyCanTSignInUntil') : t('users.theyCanSignInAgainStraight'), isActive ? t('common.deactivate') : t('common.activate'), isActive))) return;
    act('toggle', () => userService.setActive(id, !isActive), isActive ? t('users.userDeactivated') : t('users.userActivated'));
  }

  async function remove() {
    if (!(await confirmAction(t('users.deleteUser'), t('users.uWillBeRemovedAndCan', { u: userName(u) }), t('common.delete'), true))) return;
    act('delete', () => userService.remove(id), t('users.userDeleted'), () => navigation.goBack());
  }

  const tabs = [
    { value: 'overview', label: t('common.overview') },
    { value: 'logins', label: t('users.loginHistory'), count: sessions.data?.length },
    { value: 'activity', label: t('common.activity'), count: activity.data?.length },
    { value: 'devices', label: t('users.devices'), count: devices.length },
  ];

  return (
    <View style={opsStyles.screen}>
      {header}
      <ScrollView
        contentContainerStyle={opsStyles.content}
        refreshControl={<RefreshControl refreshing={user.refreshing} onRefresh={refresh} tintColor={colors.secondary} colors={[colors.secondary]} />}
      >
        {/* Who they are */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userInitials(u)}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>
              {userName(u)}
            </Text>
            {u.userDisplayName ? <Text style={styles.handle}>{`@${u.userDisplayName}`}</Text> : null}
            <View style={styles.wrap}>
              <Badge label={status.label} tone={status.tone} />
              {role ? <Badge label={role} tone="orange" /> : null}
            </View>
          </View>
        </View>

        <View style={styles.contact}>
          {phone ? (
            <Pressable accessibilityRole="button" onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)} style={[opsStyles.smallBtn, styles.grow]}>
              <PhoneIcon size={14} color={colors.text} />
              <Text style={opsStyles.smallBtnText}>{t('common.call')}</Text>
            </Pressable>
          ) : null}
          {u.email ? (
            <Pressable accessibilityRole="button" onPress={() => Linking.openURL(`mailto:${u.email}`)} style={[opsStyles.smallBtn, styles.grow]}>
              <MailIcon size={14} color={colors.text} />
              <Text style={opsStyles.smallBtnText}>{t('common.email')}</Text>
            </Pressable>
          ) : null}
          {canEdit ? (
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('UserForm', { id })} style={[opsStyles.smallBtn, styles.grow]}>
              <EditIcon size={14} color={colors.text} />
              <Text style={opsStyles.smallBtnText}>{t('common.edit')}</Text>
            </Pressable>
          ) : null}
        </View>

        <FilterChips options={tabs} value={tab} onChange={v => setTab(v as Tab)} />

        {tab === 'overview' ? (
          <>
            <SectionCard icon={UsersIcon} title={t('users.userDetails')}>
              <Detail label={t('common.userType')} value="Seller user (staff)" />
              <Detail label={t('common.role')} value={role ?? (roles.loading ? 'Loading…' : 'No role')} />
              <Detail label={t('common.email')} value={u.email} />
              <Detail label={t('common.phone')} value={phone} />
              <Detail label={t('common.emailVerified')} value={u.isEmailVerification == null ? null : u.isEmailVerification ? 'Yes' : 'No'} />
              <Detail label={t('common.phoneVerified')} value={u.isPhoneVerification == null ? null : u.isPhoneVerification ? 'Yes' : 'No'} />
              <Detail label={t('users.lastSignIn')} value={u.lastLoginAt ? formatWhen(u.lastLoginAt) : null} />
              <Detail label={t('common.added')} value={u.createdAt ? formatDay(u.createdAt) : null} />
              <Detail label={t('common.updated')} value={u.updatedAt ? formatDay(u.updatedAt) : null} />
            </SectionCard>

            <SectionCard icon={UserIcon} title={t('users.profile')}>
              <Detail label={t('common.displayName')} value={u.userDisplayName} />
              <Detail label={t('common.gender')} value={genderLabel(u.gender)} />
              <Detail label={t('users.bio')} value={profile.data?.shortDescription ?? null} />
            </SectionCard>

            {canEdit || canDelete ? (
              <SectionCard icon={ShieldCheckIcon} title={t('users.access')}>
                {canEdit ? <ActionRow icon={ShieldCheckIcon} label={t('users.assignRole')} hint={t('users.changeWhatThisUserCanSee')} onPress={() => setAssigning(true)} /> : null}
                {u.email ? <ActionRow icon={LockIcon} label={busy === 'reset' ? t('common.sending') : t('users.sendPasswordResetLink')} hint={t('users.emailsEmailAResetLink', { email: u.email })} disabled={!!busy} onPress={resetPassword} /> : null}
                {canToggle ? (
                  <ActionRow
                    icon={isActive ? BanIcon : CheckCircleIcon}
                    label={busy === 'toggle' ? t('common.saving') : isActive ? t('users.deactivateUser') : t('users.activateUser')}
                    hint={isActive ? t('users.blocksSignInWithoutDeletingThe') : t('users.letsThemSignInAgain')}
                    tone={isActive ? 'warn' : 'success'}
                    disabled={!!busy}
                    onPress={toggle}
                  />
                ) : null}
                {canDelete ? <ActionRow icon={TrashIcon} label={busy === 'delete' ? t('common.deleting') : t('users.deleteUser2')} hint={t('users.removesTheAccountThisCanT')} tone="danger" disabled={!!busy} onPress={remove} /> : null}
              </SectionCard>
            ) : null}
          </>
        ) : null}

        {tab === 'logins' ? (
          <SectionCard icon={ClockIcon} title={t('users.loginHistory2')}>
            {(sessions.data ?? []).length ? (
              (sessions.data ?? []).map(s => {
                const live = Boolean(s.isActive) && !s.logoutTime;
                return (
                  <View key={s.id} style={styles.item}>
                    <View style={styles.flex}>
                      <Text style={opsStyles.title}>{s.startTime ? formatWhen(s.startTime) : '—'}</Text>
                      <Text style={opsStyles.muted}>{[s.logoutTime ? t('users.signedOutLogouttime', { logoutTime: formatWhen(s.logoutTime) }) : null, s.ipAddress ? t('users.ipIpaddress', { ipAddress: s.ipAddress }) : null].filter(Boolean).join(' · ') || ' '}</Text>
                    </View>
                    <Badge label={live ? t('common.active') : t('common.ended')} tone={live ? 'green' : 'slate'} />
                  </View>
                );
              })
            ) : (
              <Text style={[opsStyles.muted, styles.center]}>{sessions.loading ? t('common.loading') : t('users.noSignInsRecordedForThis')}</Text>
            )}
          </SectionCard>
        ) : null}

        {tab === 'activity' ? (
          <SectionCard icon={ClockIcon} title={t('common.activity')}>
            {(activity.data ?? []).length ? (
              (activity.data ?? []).map(a => {
                const Icon = a.action === 'LOGOUT' ? LogoutIcon : a.action === 'LOGIN' ? LockIcon : ClockIcon;
                return (
                  <View key={a.id} style={styles.item}>
                    <View style={styles.dotIcon}>
                      <Icon size={14} color={colors.secondary} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={opsStyles.title}>{a.description || a.action}</Text>
                      <Text style={opsStyles.muted}>{formatWhen(a.createdAt)}</Text>
                    </View>
                    <Badge label={a.action} tone="slate" />
                  </View>
                );
              })
            ) : (
              <Text style={[opsStyles.muted, styles.center]}>{activity.loading ? t('common.loading') : t('users.noAccountActivityRecordedYet')}</Text>
            )}
          </SectionCard>
        ) : null}

        {tab === 'devices' ? (
          <SectionCard icon={MobileIcon} title={t('users.devices')}>
            {devices.length ? (
              devices.map(d => (
                <View key={d.key} style={styles.item}>
                  <View style={styles.dotIcon}>
                    <MobileIcon size={14} color={colors.secondary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={opsStyles.title} numberOfLines={1}>
                      {d.name}
                    </Text>
                    <Text style={opsStyles.muted} numberOfLines={1}>
                      {[d.detail, t('users.sessionCount', { count: d.sessions }), d.lastSeen ? t('users.lastSeen', { when: formatWhen(d.lastSeen) }) : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {d.active ? <Badge label={t('common.active')} tone="green" /> : null}
                </View>
              ))
            ) : (
              <Text style={[opsStyles.muted, styles.center]}>{sessions.loading ? t('common.loading') : t('users.noDevicesRecordedForThisUser')}</Text>
            )}
          </SectionCard>
        ) : null}
      </ScrollView>

      <AssignRoleSheet
        user={assigning ? u : null}
        roles={roles.data ?? []}
        onClose={() => setAssigning(false)}
        onDone={() => {
          setAssigning(false);
          refresh();
        }}
      />
    </View>
  );
}

function ActionRow({
  icon: Icon,
  label,
  hint,
  tone,
  disabled,
  onPress,
}: {
  icon: typeof LockIcon;
  label: string;
  hint: string;
  tone?: 'warn' | 'danger' | 'success';
  disabled?: boolean;
  onPress: () => void;
}) {
  const color = tone === 'danger' ? colors.error : tone === 'warn' ? colors.warningDark : tone === 'success' ? colors.successDark : colors.text;
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed, disabled && styles.disabled]}>
      <Icon size={16} color={color} />
      <View style={styles.flex}>
        <Text style={[styles.actionLabel, { color }]}>{label}</Text>
        <Text style={opsStyles.muted}>{hint}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grow: { flexGrow: 1, justifyContent: 'center' },
  center: { textAlign: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, backgroundColor: colors.surface, ...shadow.card },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff1e6' },
  avatarText: { fontFamily: fonts.bold, fontSize: 19, color: '#ea580c' },
  name: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  handle: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  contact: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  dotIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryLight },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderRadius: radius.md },
  actionLabel: { fontFamily: fonts.semibold, fontSize: 14 },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.5 },
});
