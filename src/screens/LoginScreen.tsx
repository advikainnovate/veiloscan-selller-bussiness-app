import React, { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextInputInstance,
} from 'react-native';
import { colors, radius, shadow, fonts } from '../theme';
import { SHOP_URL } from '../config/env';
import { useAuth } from '../context/AuthContext';
import { extractErrorCode, extractErrorMessage } from '../lib/api';
import { pendingOnboardingStep, type PendingStep } from '../lib/seller-access';
import { EMAIL_PATTERN } from '../lib/password-rules';
import {
  ArrowRightIcon,
  LockIcon,
  MailIcon,
  MobileIcon,
  type IconProps,
} from '../components/icons';
import { Logo } from '../components/ui/Logo';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Checkbox } from '../components/ui/Checkbox';
import { PasswordField } from '../components/ui/PasswordField';
import { TextField } from '../components/ui/TextField';
import { OnboardingPending } from '../components/auth/OnboardingPending';
import { OtpLoginForm } from '../components/auth/OtpLoginForm';
import { AuthCard, AuthScreen } from '../components/auth/AuthScreen';
import type { ScreenProps } from '../navigation/types';

type Mode = 'password' | 'otp';

const MODES: [Mode, string, ComponentType<IconProps>][] = [
  ['password', 'Password', LockIcon],
  ['otp', 'One-time code', MobileIcon],
];

/** Seller Sign In: the Seller Panel's login card, on its peach background. */
export function LoginScreen({ navigation, route }: ScreenProps<'Login'>) {
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when sign in was refused because onboarding isn't finished.
  const [pending, setPending] = useState<PendingStep | null>(null);
  // A success message handed back by another screen, e.g. after a password reset.
  const [notice, setNotice] = useState<string | null>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (route.params?.email) setEmail(route.params.email);
    if (route.params?.notice) {
      setNotice(route.params.notice);
      setMode('password');
      setError(null);
      setPending(null);
      setPassword('');
    }
  }, [route.params]);

  function showError(err: unknown) {
    setError(extractErrorMessage(err));
    setPending(pendingOnboardingStep(extractErrorCode(err)));
  }

  function clearError() {
    setError(null);
    setPending(null);
    setNotice(null);
  }

  async function handleSubmit() {
    if (isLoading) return;
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed))
      return showError(new Error('Enter a valid email address.'));
    if (!password) return showError(new Error('Enter your password.'));

    clearError();
    setIsLoading(true);
    try {
      // On success the navigator switches to the app; nothing else to do here.
      await login(trimmed, password, remember);
    } catch (err) {
      showError(err);
      setIsLoading(false);
    }
  }

  function handleForgotPassword() {
    clearError();
    navigation.navigate('ForgotPassword', { email: email.trim() || undefined });
  }

  return (
    <AuthScreen>
      <AuthCard>
        <View style={styles.header}>
          <Logo layout="stacked" size={56} />
          <Text style={styles.title}>Seller Sign In</Text>
          <Text style={styles.subtitle}>
            Access your store to manage products, orders, inventory and more.
          </Text>
        </View>

        {error && pending ? (
          <View style={styles.notice}>
            <OnboardingPending
              step={pending.index}
              label={pending.label}
              message={error}
            />
          </View>
        ) : error ? (
          <View style={styles.notice}>
            <Alert message={error} />
          </View>
        ) : notice ? (
          <View style={styles.notice}>
            <Alert variant="success" message={notice} />
          </View>
        ) : null}

        <View accessibilityRole="tablist" style={styles.tabs}>
          {MODES.map(([key, label, Icon]) => {
            const selected = mode === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => {
                  setMode(key);
                  clearError();
                }}
                style={[styles.tab, selected && styles.tabSelected]}
              >
                <Icon
                  size={16}
                  color={selected ? colors.secondary : colors.textSecondary}
                />
                <Text
                  style={[styles.tabText, selected && styles.tabTextSelected]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'otp' ? (
          <OtpLoginForm onError={showError} onClearError={clearError} />
        ) : (
          <View style={styles.form}>
            <TextField
              label="Email Address"
              placeholder="Enter your email address"
              icon={<MailIcon size={18} color={colors.textMuted} />}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              submitBehavior="submit"
            />
            <PasswordField
              ref={passwordRef}
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              labelExtra={
                <Pressable hitSlop={8} onPress={handleForgotPassword}>
                  <Text style={styles.link}>Forgot Password?</Text>
                </Pressable>
              }
            />
            <Checkbox
              label="Remember me"
              checked={remember}
              onChange={setRemember}
            />
            <Button
              title="Sign In"
              loadingTitle="Signing in..."
              loading={isLoading}
              onPress={handleSubmit}
              icon={<ArrowRightIcon size={18} color={colors.white} />}
            />
          </View>
        )}
      </AuthCard>

      <View style={styles.footer}>
        <View style={styles.footerLinks}>
          {/* The legal pages and Help Center live on the marketplace site. */}
          {[
            ['Privacy', '/privacy-policy'],
            ['Terms', '/terms'],
            ['Support', '/faq'],
          ].map(([label, path]) => (
            <Text
              key={label}
              style={styles.footerLink}
              onPress={() => Linking.openURL(`${SHOP_URL}${path}`)}
            >
              {label}
            </Text>
          ))}
        </View>
        <Text style={styles.copyright}>
          © {new Date().getFullYear()} VeiloScan. All rights reserved.
        </Text>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center' },
  title: { marginTop: 18, fontSize: 26, fontFamily: fonts.extrabold, color: colors.text },
  subtitle: {
    marginTop: 6,
    fontFamily: fonts.regular, fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: colors.textSecondary,
    paddingHorizontal: 8,
  },
  notice: { marginTop: 18 },
  tabs: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
  },
  tab: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 9,
  },
  tabSelected: { backgroundColor: colors.white, ...shadow.card },
  tabText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary },
  tabTextSelected: { color: colors.text },
  form: { marginTop: 20, gap: 18 },
  link: { fontSize: 13.5, fontFamily: fonts.semibold, color: colors.secondary },
  footer: { marginTop: 22, alignItems: 'center', gap: 8 },
  footerLinks: { flexDirection: 'row', gap: 24 },
  footerLink: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  copyright: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
});
