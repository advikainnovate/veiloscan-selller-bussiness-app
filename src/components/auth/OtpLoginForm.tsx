
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {  fonts } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth-service';
import { ArrowRightIcon, MailIcon, MobileIcon } from '../icons';
import { Alert } from '../ui/Alert';
import { Checkbox } from '../ui/Checkbox';
import { OtpInput } from '../ui/OtpInput';
import { TextField } from '../ui/TextField';
import { useTranslation } from 'react-i18next';

const RESEND_SECONDS = 30;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

// Treat input as an email as soon as it contains a letter or "@".
function looksLikeEmail(value: string) {
  return /[a-zA-Z@]/.test(value);
}

function isValidIdentifier(value: string) {
  return looksLikeEmail(value)
    ? EMAIL_PATTERN.test(value)
    : PHONE_PATTERN.test(value.replace(/[\s-]/g, ''));
}

const UI = {
  orange: '#FF8500',
  orangeDark: '#FF6500',
  white: '#FFFFFF',
  inputBackground: '#E7F1FF',
  text: '#F8FAFC',
  muted: '#AEBBD1',
  border: '#52708F',
  navy: '#09264A',
};

type OtpLoginFormProps = {
  onError: (error: unknown) => void;
  onClearError: () => void;
};

export function OtpLoginForm({
  onError,
  onClearError,
}: OtpLoginFormProps) {
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

    const timer = setTimeout(() => {
      setResendIn(value => value - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendCode() {
    const value = identifier.trim();

    if (!value) {
      onError(new Error(t('auth.enterYourEmailAddressOrMobile')));
      return;
    }

    if (!isValidIdentifier(value)) {
      onError(new Error(t('auth.invalidEmailOrMobile')));
      return;
    }

    onClearError();
    setIsLoading(true);
    setInfo(null);

    try {
      const response = await authService.sendLoginOtp(value);

      setInfo(response.message);
      setCodeSent(true);
      setOtp('');
      setResendIn(RESEND_SECONDS);
    } catch (error) {
      onError(error);
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
    } catch (error) {
      onError(error);
      setOtp('');
      setIsLoading(false);
    }
  }

  function changeIdentifier() {
    setCodeSent(false);
    setInfo(null);
    setOtp('');
    setResendIn(0);
    onClearError();
  }

  function renderPrimaryButton(
    title: string,
    onPress: () => void,
    loading = false,
    disabled = false,
  ) {
    return (
      <Pressable
        onPress={onPress}
        disabled={loading || disabled}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.buttonPressed,
          (loading || disabled) && styles.buttonDisabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={UI.white} size="small" />
        ) : (
          <>
            <Text style={styles.primaryButtonText}>{title}</Text>
            <ArrowRightIcon size={22} color={UI.white} />
          </>
        )}
      </Pressable>
    );
  }

  // STEP 1: Enter email or mobile number and request OTP
  if (!codeSent) {
    const isEmail = looksLikeEmail(identifier);

    return (
      <View style={styles.form}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>
            {t('auth.emailOrMobile')}
          </Text>

          <TextField
            label={t('auth.emailOrMobile')}
            hideLabel
            placeholder={t('auth.enterEmailOrMobile')}
            icon={
              isEmail ? (
                <MailIcon size={21} color="#344C68" />
              ) : (
                <MobileIcon size={21} color="#344C68" />
              )
            }
            fieldStyle={styles.field}
            style={styles.input}
            placeholderTextColor="#718096"
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
            {t('auth.weLlSendOtpToEmailOrMobile')}
          </Text>
        </View>

        {renderPrimaryButton(
          t('auth.sendOtp'),
          sendCode,
          isLoading,
        )}
      </View>
    );
  }

  // STEP 2: Verify OTP
  return (
    <View style={styles.form}>
      {info ? (
        <Alert variant="success" message={info} />
      ) : null}

      <View style={styles.codeGroup}>
        <View style={styles.row}>
          <Text style={styles.codeFor} numberOfLines={1}>
            {t('auth.codeForTrim', {
              trim: identifier.trim(),
            })}
          </Text>

          <Pressable onPress={changeIdentifier} hitSlop={10}>
            <Text style={styles.link}>
              {t('common.change')}
            </Text>
          </Pressable>
        </View>

        <OtpInput
          value={otp}
          autoFocus
          dark
          disabled={isLoading}
          onChange={next => {
            setOtp(next);

            if (next.length === 6) {
              verify(next);
            }
          }}
        />
      </View>

      <View style={styles.row}>
        <Checkbox
          label={t('auth.rememberMe')}
          checked={remember}
          onChange={setRemember}
          labelColor={UI.muted}
        />

        {resendIn > 0 ? (
          <Text style={styles.muted}>
            {t('auth.resendInResendinS', {
              resendIn,
            })}
          </Text>
        ) : (
          <Pressable
            onPress={sendCode}
            disabled={isLoading}
            hitSlop={10}
          >
            <Text style={styles.link}>
              {t('auth.resendCode')}
            </Text>
          </Pressable>
        )}
      </View>

      {renderPrimaryButton(
        t('auth.verifyAndLogin'),
        () => verify(),
        isLoading,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    marginTop: 16,
    gap: 14,
    width: '100%',
  },

  fieldGroup: {
    gap: 7,
  },

  fieldLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: UI.text,
    marginBottom: 1,
  },

  field: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#D8E5F5',
    backgroundColor: UI.inputBackground,
  },

  input: {
    fontSize: 16,
    letterSpacing: 0,
    color: UI.navy,
    fontFamily: fonts.regular,
  },

  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: UI.muted,
  },

  primaryButton: {
    height: 48,
    borderRadius: 16,
    backgroundColor: UI.orangeDark,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    shadowColor: UI.orange,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },

  primaryButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: UI.white,
  },

  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  codeGroup: {
    gap: 18,
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
    color: '#E6EDF8',
  },

  link: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: '#FF9A4D',
  },

  muted: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: UI.muted,
  },
});
