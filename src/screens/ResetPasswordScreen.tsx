import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import { colors, radius, fonts } from '../theme';
import { extractErrorMessage } from '../lib/api';
import { meetsPasswordRules, PASSWORD_RULES } from '../lib/password-rules';
import { authService } from '../services/auth-service';
import { ArrowRightIcon, CheckIcon, ShieldCheckIcon } from '../components/icons';
import { AuthCard, AuthScreen } from '../components/auth/AuthScreen';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { OtpInput } from '../components/ui/OtpInput';
import { PasswordField } from '../components/ui/PasswordField';
import type { ScreenProps } from '../navigation/types';
import { Trans, useTranslation } from 'react-i18next';

const RESEND_SECONDS = 30;

/** Step 2 of a password reset: the emailed code and a new password. */
export function ResetPasswordScreen({ navigation, route }: ScreenProps<'ResetPassword'>) {
  const { t } = useTranslation();
  const { email } = route.params;
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const confirmRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const mismatch = confirm.length > 0 && confirm !== password;

  async function resend() {
    setError(null);
    setInfo(null);
    try {
      await authService.forgotPassword(email);
      setInfo(t('auth.aNewCodeIsOnIts'));
      setOtp('');
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleSubmit() {
    if (isLoading) return;
    if (otp.length !== 6) return setError(t('auth.enterThe6DigitCodeFrom'));
    if (!meetsPasswordRules(password)) return setError(t('auth.chooseAPasswordThatMeetsEvery'));
    if (password !== confirm) return setError(t('auth.thePasswordsDonTMatchType'));

    setError(null);
    setInfo(null);
    setIsLoading(true);
    try {
      await authService.resetPassword(email, otp, password);
      navigation.popTo('Login', { email, notice: t('auth.yourPasswordHasBeenResetSign') });
    } catch (err) {
      setError(extractErrorMessage(err));
      setIsLoading(false);
    }
  }

  return (
    <AuthScreen onBack={navigation.goBack}>
      <AuthCard>
        <View style={styles.header}>
          <View style={styles.badge}>
            <ShieldCheckIcon size={30} color={colors.secondary} />
          </View>
          <Text style={styles.title}>{t('auth.resetPassword')}</Text>
          <Text style={styles.subtitle}>
            <Trans i18nKey="auth.enterCodeEmailedToAndChoosePassword" values={{ email }} components={{ b: <Text style={styles.email} /> }} />
          </Text>
        </View>

        {error ? (
          <View style={styles.notice}>
            <Alert message={error} />
          </View>
        ) : info ? (
          <View style={styles.notice}>
            <Alert variant="success" message={info} />
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.group}>
            <View style={styles.row}>
              <Text style={styles.label}>{t('auth.resetCode')}</Text>
              {resendIn > 0 ? (
                <Text style={styles.muted}>{t('auth.resendInResendinS', { resendIn })}</Text>
              ) : (
                <Pressable hitSlop={8} onPress={resend}>
                  <Text style={styles.link}>{t('auth.resendCode')}</Text>
                </Pressable>
              )}
            </View>
            <OtpInput value={otp} onChange={setOtp} autoFocus disabled={isLoading} />
          </View>

          <PasswordField
            label={t('common.newPassword')}
            placeholder={t('auth.chooseANewPassword')}
            value={password}
            onChangeText={setPassword}
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            submitBehavior="submit"
          />
          <PasswordField
            ref={confirmRef}
            label={t('auth.confirmNewPassword')}
            placeholder={t('auth.typeTheNewPasswordAgain')}
            value={confirm}
            onChangeText={setConfirm}
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            error={mismatch ? t('auth.thePasswordsDonTMatchYet') : null}
          />

          <View style={styles.rules}>
            <Text style={styles.rulesTitle}>{t('auth.passwordMustInclude')}</Text>
            {PASSWORD_RULES.map(rule => {
              const met = rule.test(password);
              return (
                <View key={rule.label} style={styles.rule}>
                  <View style={[styles.ruleDot, met && styles.ruleDotMet]}>
                    {met ? <CheckIcon size={11} color={colors.white} strokeWidth={3} /> : null}
                  </View>
                  <Text style={[styles.ruleText, met && styles.ruleTextMet]}>{rule.label}</Text>
                </View>
              );
            })}
          </View>

          <Button
            title={t('auth.resetPassword')}
            loadingTitle={t('auth.resetting')}
            loading={isLoading}
            onPress={handleSubmit}
            icon={<ArrowRightIcon size={18} color={colors.white} />}
          />
        </View>
      </AuthCard>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center' },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondaryLight,
    borderWidth: 1,
    borderColor: colors.secondarySoft,
  },
  title: { marginTop: 18, fontSize: 26, fontFamily: fonts.extrabold, color: colors.text },
  subtitle: { marginTop: 6, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, textAlign: 'center', color: colors.textSecondary, paddingHorizontal: 4 },
  email: { fontFamily: fonts.bold, color: colors.text },
  notice: { marginTop: 18 },
  form: { marginTop: 24, gap: 18 },
  group: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
  muted: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textMuted },
  link: { fontSize: 13.5, fontFamily: fonts.semibold, color: colors.secondary },
  rules: { gap: 8, padding: 14, borderRadius: radius.md, backgroundColor: '#fff5ee' },
  rulesTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text, marginBottom: 2 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ruleDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  ruleDotMet: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  ruleText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  ruleTextMet: { color: colors.text },
});
