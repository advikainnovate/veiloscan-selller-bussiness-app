import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatDay } from '../../lib/date';
import { filterUsers, STATUS_OPTIONS, USER_FILTERS, userInitials, userName, userPhone, userStatus, type UserFilters } from '../../lib/users';
import { userService, type StaffUser } from '../../services/user-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Sheet } from '../../components/ui/Sheet';
import { Field, Input, SelectField } from '../../components/form/Fields';
import { EmptyState, ErrorState, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { ActionSheet, compactStyles, CountTiles, Fab, ListTop, RowCard, Separator, SummaryLine, TILE_COLORS, useListPadding } from '../../components/list/CompactList';
import { confirmAction, opsStyles } from '../../components/operations/OpsParts';
import { BanIcon, CheckCircleIcon, EditIcon, EyeIcon, ShieldCheckIcon, SlidersIcon, TrashIcon, UsersIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 15;
const DAY = 24 * 60 * 60 * 1000;

/** Management › Users: the seller's staff accounts, their roles and access. */
export function UsersScreen({ navigation }: ScreenProps<'Users'>) {
  const { t } = useTranslation();
  const { hasPermission, user: me } = useAuth();
  const toast = useToast();
  const listPadding = useListPadding();
  const allowed = hasPermission('users:view');
  const canCreate = hasPermission('users:create');
  const canEdit = hasPermission('users:edit');
  const canDelete = hasPermission('users:delete');
  const users = useFetch(() => (allowed ? userService.list() : Promise.resolve([])), [allowed]);
  // Role names and the plan's allowance are extras: the list shows without them.
  const roles = useFetch(() => (canCreate ? userService.assignableRoles().catch(() => []) : Promise.resolve([])), [canCreate]);
  const usage = useFetch(() => (allowed ? userService.staffUsage().catch(() => null) : Promise.resolve(null)), [allowed]);
  const [filters, setFilters] = useState<UserFilters>(USER_FILTERS);
  const [moreFilters, setMoreFilters] = useState(false);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [actionsFor, setActionsFor] = useState<StaffUser | null>(null);
  const [assigning, setAssigning] = useState<StaffUser | null>(null);

  const refreshAll = useCallback(() => {
    users.reload();
    usage.reload();
  }, [users, usage]);
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) refreshAll();
      focused.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Never list the signed-in seller among their own staff.
  const rows = useMemo(() => (users.data ?? []).filter(u => u.id !== me?.id), [users.data, me?.id]);
  const filtered = useMemo(() => filterUsers(rows, filters), [rows, filters]);
  const roleName = useMemo(() => {
    const map = new Map((roles.data ?? []).map(r => [r.id, r.roleTitle]));
    return (id: string | null | undefined) => (id ? map.get(id) ?? null : null);
  }, [roles.data]);
  const [now] = useState(() => Date.now());
  const active = rows.filter(u => u.status === 'ACTIVE').length;
  const fresh = rows.filter(u => u.createdAt && now - new Date(u.createdAt).getTime() <= 30 * DAY).length;
  const isFiltered = Object.values(filters).some(Boolean);
  const extra = [filters.roleId].filter(Boolean).length;
  const limitReached = !!usage.data && usage.data.remaining !== null && usage.data.remaining <= 0;
  const set = <K extends keyof UserFilters>(k: K, v: UserFilters[K]) => {
    setFilters(f => ({ ...f, [k]: v }));
    setShown(PAGE_SIZE);
  };

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={t('users.users')} onBack={navigation.goBack} />
        <ComingSoon label={t('users.users')} icon={UsersIcon} allowed={false} />
      </View>
    );
  }

  async function toggle(u: StaffUser) {
    const off = u.status === 'ACTIVE';
    if (!(await confirmAction(`${off ? 'Deactivate' : 'Activate'} ${userName(u)}?`, off ? t('users.theyCanTSignInUntil') : t('users.theyCanSignInAgainStraight'), off ? t('common.deactivate') : t('common.activate'), off))) return;
    try {
      await userService.setActive(u.id, !off);
      toast(off ? t('users.userDeactivated') : t('users.userActivated'));
      refreshAll();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function remove(u: StaffUser) {
    if (!(await confirmAction(t('users.deleteUser'), t('users.uWillBeRemovedAndCan2', { u: userName(u) }), t('common.delete'), true))) return;
    try {
      await userService.remove(u.id);
      toast(t('users.userDeleted'));
      refreshAll();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  const tile = (key: string, label: string, count: number, c: keyof typeof TILE_COLORS, info = false) => ({ key, label, count, info, ...TILE_COLORS[c] });

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={t('users.users')} subtitle={t('users.staffAccounts')} onBack={navigation.goBack} />
      <ListTop>
        <SearchBar value={filters.search} onChange={v => set('search', v)} placeholder={t('users.searchNameEmailMobile')} />
        <CountTiles
          tiles={[
            tile('', t('common.all'), rows.length, 'violet'),
            tile('ACTIVE', t('common.active'), active, 'green'),
            tile('INACTIVE', t('common.inactive'), rows.length - active, 'slate'),
            tile('new', t('users.new30d'), fresh, 'orange', true),
          ]}
          value={filters.status}
          onSelect={k => set('status', k === filters.status ? '' : k)}
          loading={users.loading && !users.data}
        />
        {usage.data && usage.data.allowed !== null ? (
          <View style={[styles.usage, limitReached && styles.usageFull]}>
            <View style={styles.flex}>
              <Text style={styles.usageTitle}>{t('users.staffAccountsOnYourPlanUsed', { used: usage.data.used, allowed: usage.data.allowed })}</Text>
              <View style={styles.bar}>
                <View style={[styles.barFill, limitReached && styles.barFull, { width: `${Math.min(100, (usage.data.used / Math.max(1, usage.data.allowed)) * 100)}%` }]} />
              </View>
            </View>
            {limitReached ? (
              <Pressable accessibilityRole="link" onPress={() => navigation.navigate('Subscription')}>
                <Text style={styles.upgrade}>{t('common.upgrade')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <SummaryLine
          filtered={isFiltered}
          shown={filtered.length}
          total={rows.length}
          noun="user"
          onClear={() => setFilters(USER_FILTERS)}
          extra={
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.moreFilters')} hitSlop={8} onPress={() => setMoreFilters(true)} style={styles.filterBtn}>
              <SlidersIcon size={14} color={extra ? colors.secondary : colors.textSecondary} />
              <Text style={[styles.filterText, extra ? styles.accent : null]}>{extra ? t('common.filtersExtra', { extra }) : t('common.filters')}</Text>
            </Pressable>
          }
        />
      </ListTop>

      {users.error && !users.data ? (
        <ErrorState message={users.error} onRetry={refreshAll} />
      ) : (
        <FlatList
          data={users.loading && !users.data ? [] : filtered.slice(0, shown)}
          keyExtractor={u => u.id}
          contentContainerStyle={listPadding}
          ItemSeparatorComponent={Separator}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={users.refreshing} onRefresh={refreshAll} tintColor={colors.secondary} colors={[colors.secondary]} />}
          onEndReached={() => setShown(n => (n < filtered.length ? n + PAGE_SIZE : n))}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            users.loading && !users.data ? (
              <ListSkeleton rows={5} height={84} />
            ) : (
              <View style={compactStyles.empty}>
                <EmptyState
                  icon={UsersIcon}
                  title={isFiltered ? t('users.noUsersMatch') : t('users.noStaffUsersYet')}
                  text={isFiltered ? t('common.tryAnotherFilterOrSearchTerm') : t('users.addYourTeamSoTheyCan')}
                />
              </View>
            )
          }
          renderItem={({ item }) => (
            <UserCard
              user={item}
              role={roleName(item.roleId)}
              onOpen={() => navigation.navigate('UserDetail', { id: item.id })}
              onMore={canEdit || canDelete ? () => setActionsFor(item) : undefined}
            />
          )}
        />
      )}

      {canCreate ? (
        <Fab
          label={t('users.addUser')}
          onPress={() => {
            if (limitReached) {
              toast(t('users.planAllowsStaffAccounts', { count: usage.data!.allowed }), 'error');
              return;
            }
            navigation.navigate('UserForm');
          }}
        />
      ) : null}

      <Sheet visible={moreFilters} title={t('common.filters')} onClose={() => setMoreFilters(false)}>
        <SelectField label={t('common.status')} value={filters.status} options={STATUS_OPTIONS} onChange={v => set('status', v)} allowClear={t('common.allStatus')} placeholder={t('common.allStatus')} />
        <SelectField
          label={t('common.role')}
          value={filters.roleId}
          options={(roles.data ?? []).map(r => ({ value: r.id, label: r.roleTitle }))}
          onChange={v => set('roleId', v)}
          allowClear={t('users.allRoles')}
          placeholder={t('users.allRoles')}
          emptyText={t('users.noRolesAvailable')}
        />
      </Sheet>

      <ActionSheet
        visible={!!actionsFor}
        title={actionsFor ? userName(actionsFor) : ''}
        subtitle={actionsFor?.email ?? undefined}
        onClose={() => setActionsFor(null)}
        actions={
          actionsFor
            ? [
                { label: t('common.view'), icon: EyeIcon, onPress: () => navigation.navigate('UserDetail', { id: actionsFor.id }) },
                { label: t('common.edit'), icon: EditIcon, hidden: !canEdit, onPress: () => navigation.navigate('UserForm', { id: actionsFor.id }) },
                { label: t('users.assignRole'), icon: ShieldCheckIcon, hidden: !canEdit, onPress: () => setAssigning(actionsFor) },
                {
                  label: actionsFor.status === 'ACTIVE' ? t('common.deactivate') : t('common.activate'),
                  icon: actionsFor.status === 'ACTIVE' ? BanIcon : CheckCircleIcon,
                  hidden: !hasPermission(actionsFor.status === 'ACTIVE' ? 'users:deactivate' : 'users:activate') && !canEdit,
                  onPress: () => toggle(actionsFor),
                },
                { label: t('common.delete'), icon: TrashIcon, danger: true, hidden: !canDelete, onPress: () => remove(actionsFor) },
              ]
            : []
        }
      />

      <AssignRoleSheet
        user={assigning}
        roles={roles.data ?? []}
        onClose={() => setAssigning(null)}
        onDone={() => {
          setAssigning(null);
          refreshAll();
        }}
      />
    </View>
  );
}

function UserCard({ user, role, onOpen, onMore }: { user: StaffUser; role: string | null; onOpen: () => void; onMore?: () => void }) {
  const { t } = useTranslation();
  const status = userStatus(user.status);
  return (
    <RowCard label={t('users.openUser', { user: userName(user) })} onPress={onOpen}>
      <View style={compactStyles.head}>
        <View style={[compactStyles.thumb, styles.avatar]}>
          <Text style={styles.avatarText}>{userInitials(user)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={compactStyles.name} numberOfLines={1}>
            {userName(user)}
          </Text>
          <Text style={compactStyles.meta} numberOfLines={1}>
            {user.email ?? '—'}
          </Text>
        </View>
        <Badge label={status.label} tone={status.tone} />
        {onMore ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('users.moreForUser', { user: userName(user) })} hitSlop={10} onPress={onMore} style={compactStyles.more}>
            <Text style={compactStyles.dots}>⋮</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.cardBottom}>
        {role ? <Badge label={role} tone="orange" /> : <Text style={compactStyles.meta}>{t('users.noRole')}</Text>}
        <Text style={compactStyles.meta} numberOfLines={1}>
          {[userPhone(user), user.createdAt ? t('users.addedCreatedat', { createdAt: formatDay(user.createdAt) }) : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </RowCard>
  );
}

/** Gives a user one of the roles the seller may hand out. */
export function AssignRoleSheet({
  user,
  roles,
  onClose,
  onDone,
}: {
  user: StaffUser | null;
  roles: { id: string; roleTitle: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [roleId, setRoleId] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!user) return;
    setRoleId(user.roleId ?? '');
    setTitle('');
  }, [user]);

  async function save() {
    if (!user || !roleId) return;
    setSaving(true);
    try {
      await userService.assignRole(user.id, { roleId, ...(title.trim() ? { designationTitle: title.trim() } : {}) });
      toast(t('users.roleAssigned'));
      onDone();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      visible={!!user}
      title={t('users.assignRole')}
      subtitle={user ? userName(user) : undefined}
      onClose={onClose}
      footer={
        <Pressable accessibilityRole="button" disabled={!roleId || saving} onPress={save} style={[opsStyles.primaryBtn, styles.sheetBtn, (!roleId || saving) && styles.disabled]}>
          <Text style={opsStyles.primaryBtnText}>{saving ? t('users.assigning') : t('users.assign')}</Text>
        </Pressable>
      }
    >
      <SelectField label={t('common.role')} required value={roleId} options={roles.map(r => ({ value: r.id, label: r.roleTitle }))} onChange={setRoleId} emptyText={t('users.noRolesYouCanAssign')} />
      <DesignationInput value={title} onChange={setTitle} />
    </Sheet>
  );
}

function DesignationInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <Field label={t('users.designationTitle')} hint={t('users.optionalEGCashierStoreManager')}>
      <Input value={value} onChangeText={onChange} placeholder="e.g. Cashier" maxLength={100} accessibilityLabel={t('users.designationTitle')} />
    </Field>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  accent: { color: colors.secondary },
  disabled: { opacity: 0.5 },
  avatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff1e6' },
  avatarText: { fontFamily: fonts.bold, fontSize: 13, color: '#ea580c' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  usage: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  usageFull: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  usageTitle: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
  bar: { height: 6, marginTop: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.border },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.success },
  barFull: { backgroundColor: colors.error },
  upgrade: { fontFamily: fonts.bold, fontSize: 13, color: colors.secondary },
  sheetBtn: { justifyContent: 'center', height: 48 },
});
