import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { COUNTRY_CODES, EMPTY_USER, GENDER_OPTIONS, PASSWORD_RULES, STATUS_OPTIONS, userProblem, type UserForm } from '../../lib/users';
import { userService } from '../../services/user-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Choices, Field, Input, SelectField } from '../../components/form/Fields';
import { FormFooter } from '../../components/form/FormFooter';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { opsStyles } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { AlertCircleIcon, CheckCircleIcon, EyeIcon, EyeOffIcon, LockIcon, ShieldCheckIcon, UserIcon, UsersIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

/** Add a staff user (a seller user under this seller) or edit one. */
export function UserFormScreen({ navigation, route }: ScreenProps<'UserForm'>) {
  const { t } = useTranslation();
  const id = route.params?.id;
  const isEdit = !!id;
  const { hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission(isEdit ? 'users:edit' : 'users:create');
  const roles = useFetch(() => (allowed ? userService.assignableRoles() : Promise.resolve([])), [allowed]);
  const [form, setForm] = useState<UserForm>(EMPTY_USER);
  const [loadedRole, setLoadedRole] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const set = <K extends keyof UserForm>(k: K, v: UserForm[K]) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!id || !allowed) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([userService.get(id), userService.profile(id).catch(() => null)])
      .then(([u, p]) => {
        if (cancelled) return;
        setForm({
          ...EMPTY_USER,
          firstName: u.firstName ?? '',
          lastName: u.lastName ?? '',
          displayName: u.userDisplayName ?? '',
          email: u.email ?? '',
          countryCode: u.countryCode || '91',
          phoneNumber: u.phoneNumber ?? '',
          gender: u.gender ?? '',
          status: u.status || 'ACTIVE',
          roleId: u.roleId ?? '',
          bio: p?.shortDescription ?? '',
        });
        setLoadedRole(u.roleId ?? '');
        setLoadError('');
      })
      .catch(err => !cancelled && setLoadError(extractErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, allowed, reloadKey]);

  const fail = (message: string) => {
    setError(message);
    scroll.current?.scrollToEnd({ animated: true });
  };

  async function save() {
    setError('');
    const problem = userProblem(form, isEdit);
    if (problem) return fail(problem);
    setSaving(true);
    try {
      let userId = id;
      if (id) {
        await userService.update(id, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          displayName: form.displayName.trim() || undefined,
          gender: form.gender || undefined,
          status: form.status,
        });
        if (form.roleId !== loadedRole || form.designationTitle.trim()) {
          await userService.assignRole(id, { roleId: form.roleId, ...(form.designationTitle.trim() ? { designationTitle: form.designationTitle.trim() } : {}) });
        }
      } else {
        const created = await userService.create({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          countryCode: form.countryCode,
          phoneNumber: form.phoneNumber.trim(),
          userType: 'SELLER_USER',
          roleId: form.roleId,
          ...(form.password ? { password: form.password } : {}),
          ...(form.displayName.trim() ? { displayName: form.displayName.trim() } : {}),
          ...(form.gender ? { gender: form.gender } : {}),
          ...(form.designationTitle.trim() ? { designationTitle: form.designationTitle.trim() } : {}),
        });
        userId = created.id;
      }
      if (userId && form.bio.trim()) {
        // The profile is an extra: the account is saved even if this fails.
        await userService.upsertProfile(userId, { shortDescription: form.bio.trim() }).catch(() => {});
      }
      toast(isEdit ? t('users.userUpdated') : form.password ? t('users.userCreated') : t('users.userCreatedTheirPasswordHasBeen'));
      navigation.goBack();
    } catch (err) {
      fail(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit ? t('users.editUser') : t('users.addNewUser');
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ComingSoon label={t('users.users')} icon={UsersIcon} allowed={false} />
      </View>
    );
  }
  if (loading || loadError) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        {loadError ? <ErrorState message={loadError} onRetry={() => setReloadKey(k => k + 1)} /> : <ListSkeleton rows={3} height={160} />}
      </View>
    );
  }

  const roleOptions = (roles.data ?? []).map(r => ({ value: r.id, label: r.roleTitle, hint: r.roleDescription ?? undefined }));

  return (
    <KeyboardAvoidingView style={opsStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title={title} subtitle={t('users.users')} onBack={navigation.goBack} />
      <ScrollView ref={scroll} contentContainerStyle={[opsStyles.content, styles.content]} keyboardShouldPersistTaps="handled">
        <Text style={opsStyles.meta}>{isEdit ? t('users.updateThisTeamMembersDetailsAnd') : t('users.addATeamMemberWithTheir')}</Text>

        <SectionCard icon={UserIcon} title={t('common.account')}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field label={t('users.firstName')} required>
                <Input value={form.firstName} onChangeText={v => set('firstName', v)} placeholder={t('users.firstName')} maxLength={100} autoCapitalize="words" accessibilityLabel={t('users.firstName')} />
              </Field>
            </View>
            <View style={styles.flex}>
              <Field label={t('users.lastName')} required>
                <Input value={form.lastName} onChangeText={v => set('lastName', v)} placeholder={t('users.lastName')} maxLength={100} autoCapitalize="words" accessibilityLabel={t('users.lastName')} />
              </Field>
            </View>
          </View>
          <Field label={t('common.email')} required={!isEdit} hint={isEdit ? t('users.emailCanTBeChangedHere') : t('users.theySignInWithThisEmail')}>
            <Input
              value={form.email}
              onChangeText={v => set('email', v)}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isEdit}
              style={isEdit ? styles.readOnly : undefined}
              maxLength={255}
              accessibilityLabel={t('common.email')}
            />
          </Field>
          <View style={styles.row}>
            <View style={styles.code}>
              <SelectField label={t('users.code')} value={form.countryCode} options={COUNTRY_CODES} onChange={v => set('countryCode', v)} disabled={isEdit} />
            </View>
            <View style={styles.flex}>
              <Field label={t('common.mobileNumber')} required={!isEdit}>
                <Input
                  value={form.phoneNumber}
                  onChangeText={v => set('phoneNumber', v.replace(/\D/g, ''))}
                  placeholder="98765 43210"
                  keyboardType="phone-pad"
                  editable={!isEdit}
                  style={isEdit ? styles.readOnly : undefined}
                  maxLength={15}
                  accessibilityLabel={t('common.mobileNumber')}
                />
              </Field>
            </View>
          </View>
          {!isEdit ? (
            <Field label={t('common.password')} hint={t('users.optionalLeaveBlankAndWeLl')}>
              <View style={styles.passwordWrap}>
                <Input
                  value={form.password}
                  onChangeText={v => set('password', v)}
                  placeholder={t('users.setAPassword')}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={255}
                  style={styles.passwordInput}
                  accessibilityLabel={t('common.password')}
                />
                <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? t('common.hidePassword') : t('common.showPassword')} hitSlop={8} onPress={() => setShowPassword(s => !s)} style={styles.eye}>
                  {showPassword ? <EyeOffIcon size={18} color={colors.textSecondary} /> : <EyeIcon size={18} color={colors.textSecondary} />}
                </Pressable>
              </View>
              {form.password ? (
                <View style={styles.rules}>
                  {PASSWORD_RULES.map(r => {
                    const met = r.test(form.password);
                    return (
                      <View key={r.label} style={styles.rule}>
                        {met ? <CheckCircleIcon size={14} color={colors.success} /> : <View style={styles.ruleDot} />}
                        <Text style={[styles.ruleText, met && styles.ruleMet]}>{r.label}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </Field>
          ) : null}
        </SectionCard>

        <SectionCard icon={ShieldCheckIcon} title={t('users.access')} subtitle={t('users.theRoleDecidesWhatTheyCan')}>
          <SelectField
            label={t('common.role')}
            required
            value={form.roleId}
            options={roleOptions}
            onChange={v => set('roleId', v)}
            placeholder={roles.loading ? t('users.loadingRoles') : t('users.selectRole')}
            emptyText={roles.error ? t('users.rolesCouldnTBeLoaded') : t('users.noRolesYouCanAssign')}
          />
          <Field label={t('users.designationTitle')} hint={t('users.optionalEGCashierStoreManager')}>
            <Input value={form.designationTitle} onChangeText={v => set('designationTitle', v)} placeholder="e.g. Cashier" maxLength={100} accessibilityLabel={t('users.designationTitle')} />
          </Field>
          {isEdit ? (
            <Field label={t('common.status')}>
              <Choices options={STATUS_OPTIONS} value={form.status} onChange={v => set('status', v)} />
            </Field>
          ) : null}
        </SectionCard>

        <SectionCard icon={LockIcon} title={t('users.profile')} subtitle={t('users.optionalDetailsThatHelpYourTeam')}>
          <Field label={t('common.displayName')}>
            <Input value={form.displayName} onChangeText={v => set('displayName', v)} placeholder="e.g. ravi.k" autoCapitalize="none" maxLength={100} accessibilityLabel={t('common.displayName')} />
          </Field>
          <Field label={t('common.gender')}>
            <Choices options={GENDER_OPTIONS} value={form.gender} onChange={v => set('gender', v === form.gender ? '' : v)} />
          </Field>
          <Field label={t('users.bio')} hint={`${form.bio.length}/500`}>
            <Input value={form.bio} onChangeText={v => set('bio', v)} placeholder={t('users.aShortNoteAboutThisTeam')} multiline maxLength={500} accessibilityLabel={t('users.bio')} />
          </Field>
        </SectionCard>

        {error ? (
          <View style={opsStyles.error}>
            <AlertCircleIcon size={16} color={colors.errorDark} />
            <Text style={opsStyles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
      <FormFooter title={isEdit ? t('common.saveChanges') : t('users.createUser')} loading={saving} onSave={save} onCancel={navigation.goBack} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  content: { gap: 12, paddingBottom: 24 },
  row: { flexDirection: 'row', gap: 10 },
  code: { width: 120 },
  readOnly: { color: colors.textSecondary, backgroundColor: colors.background },
  passwordWrap: { justifyContent: 'center' },
  passwordInput: { paddingRight: 44 },
  eye: { position: 'absolute', right: 12 },
  rules: { gap: 4, marginTop: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.background },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.textMuted },
  ruleText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  ruleMet: { fontFamily: fonts.medium, color: colors.textSecondary },
});
