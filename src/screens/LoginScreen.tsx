import React, { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type TextInputInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow, fonts } from '../theme';
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
import { Gradient } from '../components/ui/Gradient';
import { PasswordField } from '../components/ui/PasswordField';
import { TextField } from '../components/ui/TextField';
import { OnboardingPending } from '../components/auth/OnboardingPending';
import { OtpLoginForm } from '../components/auth/OtpLoginForm';
import { BottomWaves, TopSweep } from '../components/auth/LoginArt';
import {
  KeyboardScroll,
  useKeyboardHeight,
} from '../components/layout/KeyboardScroll';
import type { ScreenProps } from '../navigation/types';

type Mode = 'password' | 'otp';

const MODES: [Mode, string, ComponentType<IconProps>][] = [
  ['password', 'Password Login', LockIcon],
  ['otp', 'OTP Login', MobileIcon],
];

/**
 * Seller sign in: the logo over a white card holding the form, with brand
 * waves at the bottom. While typing, the logo shrinks and the focused field
 * stays above the keyboard.
 */
export function LoginScreen({ navigation, route }: ScreenProps<'Login'>) {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const typing = useKeyboardHeight() > 0;
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
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <TopSweep />

      <KeyboardScroll
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.main}>
          <View
            style={[
              styles.top,
              { paddingTop: insets.top + (typing ? 14 : 20) },
            ]}
          >
            {typing ? (
              <View
                style={styles.brand}
                accessible
                accessibilityLabel="VeiloScan Business"
              >
                <Logo size={32} tagline={null} />
              </View>
            ) : (
              // The app's name, stacked: mark, wordmark, then "Business".
              <View
                style={styles.brand}
                accessible
                accessibilityLabel="VeiloScan Business"
              >
                <View style={styles.badge}>
                  <Logo size={46} showWordmark={false} />
                </View>
                <Text style={styles.wordmark}>
                  Veilo<Text style={styles.wordmarkAccent}>Scan</Text>
                </Text>
                <View style={styles.tagline}>
                  <View style={styles.taglineRule} />
                  <Text style={styles.taglineText}>BUSINESS</Text>
                  <View style={styles.taglineRule} />
                </View>
              </View>
            )}
          </View>

          <View style={[styles.card, typing && styles.cardTyping]}>
            <View style={styles.cardAccent} />
            <Text style={styles.title} accessibilityRole="header">
              Welcome back
            </Text>
            <Text style={styles.subtitle}>
              Log in to manage your store, orders and stock.
            </Text>

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
                    {selected ? (
                      <Gradient
                        colors={[colors.primary, '#0b2a52']}
                        direction="horizontal"
                        borderRadius={14}
                      />
                    ) : null}
                    <Icon
                      size={18}
                      color={selected ? colors.white : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.tabText,
                        selected && styles.tabTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
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

            {mode === 'otp' ? (
              <OtpLoginForm onError={showError} onClearError={clearError} />
            ) : (
              <View style={styles.form}>
                <TextField
                  label="Email address"
                  hideLabel
                  placeholder="Email address"
                  icon={<MailIcon size={20} color={colors.primary} />}
                  fieldStyle={styles.field}
                  style={styles.input}
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
                  hideLabel
                  placeholder="Password"
                  icon={<LockIcon size={20} color={colors.primary} />}
                  fieldStyle={styles.field}
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                />
                <View style={styles.row}>
                  <Checkbox
                    label="Remember me"
                    checked={remember}
                    onChange={setRemember}
                  />
                  <Pressable
                    accessibilityRole="link"
                    hitSlop={10}
                    onPress={handleForgotPassword}
                  >
                    <Text style={styles.link}>Forgot password?</Text>
                  </Pressable>
                </View>
                <Button
                  title="Log In"
                  loadingTitle="Logging in..."
                  loading={isLoading}
                  onPress={handleSubmit}
                  icon={<ArrowRightIcon size={20} color={colors.white} />}
                  style={styles.submit}
                />
              </View>
            )}
          </View>
        </View>

        <View style={styles.bottom}>
          <BottomWaves height={90 + insets.bottom} />
        </View>
      </KeyboardScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9fd' },
  scroll: { flexGrow: 1 },
  // The logo and card sit in the middle of the space above the waves.
  main: { flexGrow: 1, justifyContent: 'center' },
  top: { paddingHorizontal: 22 },
  brand: { alignItems: 'center' },
  badge: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.white,
    ...shadow.card,
  },
  wordmark: {
    marginTop: 10,
    fontFamily: fonts.extrabold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: colors.primary,
  },
  wordmarkAccent: { color: colors.secondary },
  tagline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  taglineRule: {
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.secondary,
  },
  taglineText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 5,
    color: colors.primary,
  },
  card: {
    overflow: 'hidden',
    marginTop: 22,
    marginHorizontal: 16,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 20,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#edf1f7',
    backgroundColor: colors.white,
    ...shadow.raised,
  },
  cardTyping: { marginTop: 14 },
  // A thin orange strip along the card's top edge.
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.secondary,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.7,
    color: colors.primary,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 18,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 18,
    backgroundColor: '#eef2f9',
  },
  tab: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 6,
    borderRadius: 14,
  },
  tabSelected: { ...shadow.card },
  tabText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    letterSpacing: -0.1,
    color: colors.textSecondary,
  },
  tabTextSelected: { color: colors.white },
  notice: { marginTop: 16 },
  form: { marginTop: 18, gap: 14 },
  field: { height: 52, borderRadius: 14, paddingHorizontal: 16, gap: 12 },
  input: { fontSize: 15.5, letterSpacing: -0.1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  link: { fontSize: 13.5, fontFamily: fonts.semibold, color: colors.secondary },
  submit: { height: 52, marginTop: 2 },
  bottom: { paddingTop: 16 },
});
