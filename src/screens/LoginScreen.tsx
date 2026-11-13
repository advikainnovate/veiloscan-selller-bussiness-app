import React, { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type TextInputInstance,
} from 'react-native';
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
import {
  KeyboardScroll,
  useKeyboardHeight,
} from '../components/layout/KeyboardScroll';
import type { ScreenProps } from '../navigation/types';
import { useTranslation } from 'react-i18next';

type Mode = 'password' | 'otp';

const MODES: [Mode, string, ComponentType<IconProps>][] = [
  ['otp', 'auth.mobileOtp', MobileIcon],
  ['password', 'auth.emailAndPassword', MailIcon],
];

/**
 * Seller sign in. The compact brand header and focused form keep the login
 * clear on both short screens and when the keyboard is open.
 */
export function LoginScreen({ navigation, route }: ScreenProps<'Login'>) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const typing = useKeyboardHeight() > 0;
  const [mode, setMode] = useState<Mode>('otp');
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
      return showError(new Error(t('common.enterAValidEmailAddress2')));
    if (!password) return showError(new Error(t('auth.enterYourPassword')));

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

      <KeyboardScroll
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.main}>
          <View
            style={styles.top}
          >
            {typing ? (
              <View
                style={styles.brand}
                accessible
                accessibilityLabel={t('common.veiloscanBusiness')}
              >
                <Logo variant="white" size={32} tagline={null} />
              </View>
            ) : (
              // Centered brand lockup from the supplied login reference.
              <View
                style={styles.brand}
                accessible
                accessibilityLabel={t('common.veiloscanBusiness')}
              >
                <Logo variant="white" layout="stacked" size={82} tagline={null} />
                <View style={styles.sellerTitleRow}>
                  {/* <View style={styles.sellerTitleRule} /> */}
                  <Text style={styles.sellerTitle}>{t('auth.bussiness')}</Text>
                  {/* <View style={styles.sellerTitleRule} /> */}
                </View>
              </View>
            )}
          </View>

          <View style={[styles.card, typing && styles.cardTyping]}>
            <View style={styles.cardAccent} />
            <View accessibilityRole="tablist" style={styles.tabs}>
              {MODES.map(([key, labelKey, Icon]) => {
                const label = t(labelKey);
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
                        colors={['#ff9400', colors.secondaryDark]}
                        direction="horizontal"
                        borderRadius={28}
                      />
                    ) : null}
                    <Icon
                      size={18}
                      color={selected ? colors.white : '#cbd6e8'}
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
                  label={t('auth.emailAddress')}
                  hideLabel
                  placeholder={t('auth.emailAddress')}
                  icon={<MailIcon size={20} color={colors.primary} />}
                  fieldStyle={styles.field}
                  style={styles.input}
                  placeholderTextColor="#64748b"
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
                  label={t('common.password')}
                  hideLabel
                  placeholder={t('common.password')}
                  icon={<LockIcon size={20} color={colors.primary} />}
                  fieldStyle={styles.field}
                  style={styles.input}
                  placeholderTextColor="#64748b"
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                />
                <View style={styles.row}>
                    <Checkbox
                    label={t('auth.rememberMe')}
                    checked={remember}
                    onChange={setRemember}
                      labelColor="#d3dced"
                  />
                  <Pressable
                    accessibilityRole="link"
                    hitSlop={10}
                    onPress={handleForgotPassword}
                  >
                    <Text style={styles.link}>{t('auth.forgotPassword2')}</Text>
                  </Pressable>
                </View>
                <Button
                  title={t('auth.logIn')}
                  loadingTitle={t('auth.loggingIn')}
                  loading={isLoading}
                  onPress={handleSubmit}
                  icon={<ArrowRightIcon size={20} color={colors.white} />}
                  style={styles.submit}
                />
              </View>
            )}
          </View>
        </View>

      </KeyboardScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#031b43'},
  scroll: { flexGrow: 1 },
  // The logo and card sit in the middle of the space above the waves.
  main: { flexGrow: 1, justifyContent: 'center' },
  top: { paddingHorizontal: 22 },
  brand: { alignItems: 'center' },
  sellerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  sellerTitleRule: { height: 1.5, width: 44, backgroundColor: '#899bb9' },
  sellerTitle: { fontFamily: fonts.semibold, fontSize: 22, letterSpacing: -0.5, color: colors.white },
  card: {
    overflow: 'hidden',
    marginTop: 54,
    marginHorizontal: 20,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 16,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  cardTyping: { marginTop: 24 },
  // A thin orange strip along the card's top edge.
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 0,
    backgroundColor: 'transparent',
  },
  tabs: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    ...shadow.card,
  },
  tab: {
    flex: 1,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
    borderRadius: 28,
  },
  tabSelected: { ...shadow.raised },
  tabText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    letterSpacing: -0.1,
    color: '#cbd6e8',
  },
  tabTextSelected: { color: colors.white },
  notice: { marginTop: 16 },
  form: { marginTop: 18, gap: 14 },
  field: { height: 56, borderRadius: 16, paddingHorizontal: 16, gap: 12, borderColor: '#cbd5e1', backgroundColor: colors.white },
  input: { fontSize: 15.5, letterSpacing: -0.1, color: colors.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  link: { fontSize: 13.5, fontFamily: fonts.semibold, color: '#ff9a4d' },
  submit: { height: 52, marginTop: 2 },
});
