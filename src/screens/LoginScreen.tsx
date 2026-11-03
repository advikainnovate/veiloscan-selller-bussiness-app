import React, { useEffect, useRef, useState, type ComponentType } from 'react';
import { Linking, Pressable, StatusBar, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, fonts } from '../theme';
import { SHOP_URL } from '../config/env';
import { useAuth } from '../context/AuthContext';
import { extractErrorCode, extractErrorMessage } from '../lib/api';
import { pendingOnboardingStep, type PendingStep } from '../lib/seller-access';
import { EMAIL_PATTERN } from '../lib/password-rules';
import { ArrowRightIcon, BoxIcon, ChartTrendIcon, LockIcon, MailIcon, MobileIcon, ShieldCheckIcon, ShoppingBagIcon, type IconProps } from '../components/icons';
import { Logo } from '../components/ui/Logo';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Checkbox } from '../components/ui/Checkbox';
import { Gradient } from '../components/ui/Gradient';
import { PasswordField } from '../components/ui/PasswordField';
import { TextField } from '../components/ui/TextField';
import { OnboardingPending } from '../components/auth/OnboardingPending';
import { OtpLoginForm } from '../components/auth/OtpLoginForm';
import { KeyboardScroll, useKeyboardHeight } from '../components/layout/KeyboardScroll';
import type { ScreenProps } from '../navigation/types';

type Mode = 'password' | 'otp';

const MODES: [Mode, string, ComponentType<IconProps>][] = [
  ['password', 'Password', LockIcon],
  ['otp', 'One-time code', MobileIcon],
];

const HIGHLIGHTS: [ComponentType<IconProps>, string][] = [
  [ShoppingBagIcon, 'Orders'],
  [BoxIcon, 'Stock'],
  [ChartTrendIcon, 'Sales'],
];

/**
 * Seller Sign In: a navy brand header over a white sheet holding the form.
 * While typing, the header shrinks and the focused field stays above the
 * keyboard.
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
    if (!EMAIL_PATTERN.test(trimmed)) return showError(new Error('Enter a valid email address.'));
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
      <StatusBar barStyle="light-content" />
      {/* The sheet's white continues past the bottom when scrolled up. */}
      <View style={styles.sheetUnderlay} />

      <KeyboardScroll bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { paddingTop: insets.top + (typing ? 12 : 28) }, typing && styles.heroCompact]}>
          <Gradient colors={[colors.primaryDeep, '#0b2a52']} direction="diagonal" />
          <View style={[styles.glow, styles.glowOrange]} />
          <View style={[styles.glow, styles.glowBlue]} />

          <Logo variant="white" size={typing ? 30 : 40} tagline={typing ? null : undefined} />
          {typing ? null : (
            <>
              <Text style={styles.kicker}>WELCOME BACK</Text>
              <Text style={styles.heroTitle}>
                Run your store,{'\n'}
                <Text style={styles.heroAccent}>from anywhere.</Text>
              </Text>
              <View style={styles.highlights}>
                {HIGHLIGHTS.map(([Icon, label]) => (
                  <View key={label} style={styles.highlight}>
                    <Icon size={14} color="#ff8a33" />
                    <Text style={styles.highlightText}>{label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">
            Seller Sign In
          </Text>
          <Text style={styles.subtitle}>Access your store to manage products, orders, inventory and more.</Text>

          {error && pending ? (
            <View style={styles.notice}>
              <OnboardingPending step={pending.index} label={pending.label} message={error} />
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
                  <Icon size={16} color={selected ? colors.secondary : colors.textSecondary} />
                  <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {mode === 'otp' ? (
            <View style={styles.form}>
              <OtpLoginForm onError={showError} onClearError={clearError} />
            </View>
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
              />
              <View style={styles.row}>
                <Checkbox label="Remember me" checked={remember} onChange={setRemember} />
                <Pressable accessibilityRole="link" hitSlop={10} onPress={handleForgotPassword}>
                  <Text style={styles.link}>Forgot Password?</Text>
                </Pressable>
              </View>
              <Button
                title="Sign In"
                loadingTitle="Signing in..."
                loading={isLoading}
                onPress={handleSubmit}
                icon={<ArrowRightIcon size={18} color={colors.white} />}
              />
            </View>
          )}

          <View style={styles.secure}>
            <ShieldCheckIcon size={14} color={colors.success} />
            <Text style={styles.secureText}>Secure sign-in for VeiloScan sellers and their staff.</Text>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerLinks}>
              {/* The legal pages and Help Center live on the marketplace site. */}
              {[
                ['Privacy', '/privacy-policy'],
                ['Terms', '/terms'],
                ['Support', '/faq'],
              ].map(([label, path]) => (
                <Text key={label} accessibilityRole="link" style={styles.footerLink} onPress={() => Linking.openURL(`${SHOP_URL}${path}`)}>
                  {label}
                </Text>
              ))}
            </View>
            <Text style={styles.copyright}>© {new Date().getFullYear()} VeiloScan. All rights reserved.</Text>
          </View>
        </View>
      </KeyboardScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primaryDeep },
  sheetUnderlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%', backgroundColor: colors.white },
  scroll: { flexGrow: 1 },
  hero: { overflow: 'hidden', paddingHorizontal: 24, paddingBottom: 44 },
  heroCompact: { paddingBottom: 30 },
  glow: { position: 'absolute', borderRadius: 999 },
  glowOrange: { width: 260, height: 260, top: -90, right: -90, backgroundColor: 'rgba(255,107,0,0.22)' },
  glowBlue: { width: 220, height: 220, bottom: -120, left: -70, backgroundColor: 'rgba(56,132,255,0.18)' },
  kicker: { marginTop: 28, fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 1.6, color: '#ff8a33' },
  heroTitle: { marginTop: 8, fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, color: colors.white, letterSpacing: -0.4 },
  heroAccent: { color: '#ffb27a' },
  highlights: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  highlightText: { fontFamily: fonts.semibold, fontSize: 12.5, color: 'rgba(255,255,255,0.88)' },
  sheet: {
    flexGrow: 1,
    marginTop: -22,
    paddingHorizontal: 22,
    paddingTop: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.white,
    ...shadow.raised,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, marginBottom: 18, borderRadius: 2, backgroundColor: colors.border },
  title: { fontSize: 24, fontFamily: fonts.extrabold, color: colors.text, letterSpacing: -0.3 },
  subtitle: { marginTop: 4, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  notice: { marginTop: 16 },
  tabs: { marginTop: 20, flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  tab: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 9 },
  tabSelected: { backgroundColor: colors.white, ...shadow.card },
  tabText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary },
  tabTextSelected: { color: colors.text },
  form: { marginTop: 20, gap: 18 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  link: { fontSize: 13.5, fontFamily: fonts.semibold, color: colors.secondary },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18 },
  secureText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  footer: { marginTop: 'auto', paddingTop: 24, alignItems: 'center', gap: 8 },
  footerLinks: { flexDirection: 'row', gap: 24 },
  footerLink: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  copyright: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
});
