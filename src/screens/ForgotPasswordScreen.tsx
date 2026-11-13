import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { extractErrorMessage } from '../lib/api';
import { EMAIL_PATTERN } from '../lib/password-rules';
import { authService } from '../services/auth-service';
import { ArrowRightIcon, LockIcon, MailIcon } from '../components/icons';
import { AuthCard, AuthScreen } from '../components/auth/AuthScreen';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import type { ScreenProps } from '../navigation/types';
import { useTranslation } from 'react-i18next';

/** Step 1 of a password reset: email a 6-digit code to the account. */
export function ForgotPasswordScreen({ navigation, route }: ScreenProps<'ForgotPassword'>) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit() {
    if (isLoading) return;
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError(t('common.enterAValidEmailAddress2'));
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await authService.forgotPassword(trimmed);
      navigation.navigate('ResetPassword', { email: trimmed });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthScreen onBack={navigation.goBack}>
      <AuthCard>
        <View style={styles.header}>
          <View style={styles.badge}>
            <LockIcon size={28} color={colors.secondary} />
          </View>
          <Text style={styles.title}>{t('auth.forgotPassword')}</Text>
          <Text style={styles.subtitle}>{t('auth.enterYourAccountEmailAndWe')}</Text>
        </View>

        {error ? (
          <View style={styles.notice}>
            <Alert message={error} />
          </View>
        ) : null}

        <View style={styles.form}>
          <TextField
            label={t('common.emailAddress')}
            placeholder={t('auth.enterYourEmailAddress')}
            icon={<MailIcon size={18} color={colors.textMuted} />}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            autoFocus={!email}
            returnKeyType="send"
            onSubmitEditing={handleSubmit}
          />
          <Button
            title={t('common.sendCode')}
            loadingTitle={t('auth.sending')}
            loading={isLoading}
            onPress={handleSubmit}
            icon={<ArrowRightIcon size={18} color={colors.white} />}
          />
        </View>

        <Pressable hitSlop={8} onPress={navigation.goBack} style={styles.backLink}>
          <Text style={styles.backText}>
            {t('auth.rememberedIt')}{' '}<Text style={styles.link}>{t('auth.backToSignIn')}</Text>
          </Text>
        </Pressable>
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
  notice: { marginTop: 18 },
  form: { marginTop: 24, gap: 18 },
  backLink: { marginTop: 20, alignSelf: 'center' },
  backText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
  link: { color: colors.secondary, fontFamily: fonts.bold },
});
