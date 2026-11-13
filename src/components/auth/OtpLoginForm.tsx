import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth-service';
import { ArrowRightIcon, MailIcon } from '../icons';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { OtpInput } from '../ui/OtpInput';
import { TextField } from '../ui/TextField';
import { useTranslation } from 'react-i18next';

const RESEND_SECONDS = 30;

/**
 * Sign in with a one-time code instead of the password: enter the account's
 * email or mobile number, then the code sent to its email and phone. Errors
 * go to the login card, which knows how to show "onboarding pending".
 */
export function OtpLoginForm({ onError, onClearError }: { onError: (error: unknown) => void; onClearError: () => void }) {
  const { t } = useTranslation();
  const { loginWithOtp } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [remember, setRemember] = useState(true);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendCode() {
    if (!identifier.trim()) {
      onError(new Error(t('auth.enterYourEmailAddressOrMobile')));
      return;
    }
    onClearError();
    setIsLoading(true);
    try {
      const { message } = await authService.sendLoginOtp(identifier.trim());
      setInfo(message);
      setCodeSent(true);
      setOtp('');
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      onError(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function verify(code = otp) {
    if (isLoading) return;
    if (code.length !== 6) {
      onError(new Error(t('auth.enterThe6DigitCode')));
      return;
    }
    onClearError();
    setIsLoading(true);
    try {
      await loginWithOtp(identifier.trim(), code, remember);
    } catch (err) {
      onError(err);
      setOtp('');
      setIsLoading(false);
    }
  }

  if (!codeSent) {
    return (
      <View style={styles.form}>
        <View style={styles.fieldGroup}>
          <TextField
            label={t('auth.mobileNumberOrEmail')}
            hideLabel
            placeholder={t('auth.enterMobileNumberOrEmail')}
            icon={<MailIcon size={20} color={colors.primary} />}
            fieldStyle={styles.field}
            style={styles.input}
            placeholderTextColor="#64748b"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="username"
            returnKeyType="send"
            onSubmitEditing={sendCode}
          />
          <Text style={styles.hint}>
            {t('auth.weLlSendA6Digit')}</Text>
        </View>
        <Button
          title={t('auth.sendOtp')}
          loadingTitle={t('auth.sending')}
          loading={isLoading}
          onPress={sendCode}
          icon={<ArrowRightIcon size={18} color={colors.white} />}
        style={styles.sendButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      {info ? <Alert variant="success" message={info} /> : null}
      <View style={styles.codeGroup}>
        <View style={styles.row}>
          <Text style={styles.codeFor} numberOfLines={1}>
            {t('auth.codeForTrim', { trim: identifier.trim() })}</Text>
          <Pressable
            hitSlop={8}
            onPress={() => {
              setCodeSent(false);
              setInfo(null);
              onClearError();
            }}
          >
            <Text style={styles.link}>{t('common.change')}</Text>
          </Pressable>
        </View>
        <OtpInput
          value={otp}
          autoFocus
          dark
          disabled={isLoading}
          onChange={next => {
            setOtp(next);
            if (next.length === 6) verify(next);
          }}
        />
      </View>

      <View style={styles.row}>
        <Checkbox
          label={t('auth.rememberMe')}
          checked={remember}
          onChange={setRemember}
          labelColor="#d3dced"
        />
        {resendIn > 0 ? (
          <Text style={styles.muted}>{t('auth.resendInResendinS', { resendIn })}</Text>
        ) : (
          <Pressable hitSlop={8} onPress={sendCode} disabled={isLoading}>
            <Text style={styles.link}>{t('auth.resendCode')}</Text>
          </Pressable>
        )}
      </View>

      <Button
        title={t('auth.verifyAndLogin')}
        loadingTitle={t('auth.verifying')}
        loading={isLoading}
        onPress={() => verify()}
        icon={<ArrowRightIcon size={18} color={colors.white} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: 48, gap: 20 },
  field: { height: 62, borderRadius: 18, paddingHorizontal: 16, gap: 12, borderColor: '#cbd5e1', backgroundColor: colors.white },
  input: { fontSize: 16, letterSpacing: -0.1, color: colors.primary },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 15, color: '#d3dced', marginBottom: -10 },
  sendButton: { height: 64, borderRadius: 20 },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#aebbd1',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  codeFor: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: '#e6edf8',
  },
  link: { fontSize: 14, fontFamily: fonts.semibold, color: '#ff9a4d' },
  muted: { fontFamily: fonts.regular, fontSize: 14, color: '#aebbd1' },
  fieldGroup: { gap: 6 },
  codeGroup: { gap: 10 },
});
