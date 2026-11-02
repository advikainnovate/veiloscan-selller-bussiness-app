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

const RESEND_SECONDS = 30;

/**
 * Sign in with a one-time code instead of the password: enter the account's
 * email or mobile number, then the code sent to its email and phone. Errors
 * go to the login card, which knows how to show "onboarding pending".
 */
export function OtpLoginForm({ onError, onClearError }: { onError: (error: unknown) => void; onClearError: () => void }) {
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
      onError(new Error('Enter your email address or mobile number.'));
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
      onError(new Error('Enter the 6-digit code.'));
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
            label="Email or Mobile Number"
            placeholder="Enter your email or mobile number"
            icon={<MailIcon size={18} color={colors.textMuted} />}
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
          <Text style={styles.hint}>We'll send a 6-digit code to your email and phone.</Text>
        </View>
        <Button
          title="Send Code"
          loadingTitle="Sending..."
          loading={isLoading}
          onPress={sendCode}
          icon={<ArrowRightIcon size={18} color={colors.white} />}
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
            Code for {identifier.trim()}
          </Text>
          <Pressable
            hitSlop={8}
            onPress={() => {
              setCodeSent(false);
              setInfo(null);
              onClearError();
            }}
          >
            <Text style={styles.link}>Change</Text>
          </Pressable>
        </View>
        <OtpInput
          value={otp}
          autoFocus
          disabled={isLoading}
          onChange={next => {
            setOtp(next);
            if (next.length === 6) verify(next);
          }}
        />
      </View>

      <View style={styles.row}>
        <Checkbox label="Remember me" checked={remember} onChange={setRemember} />
        {resendIn > 0 ? (
          <Text style={styles.muted}>Resend in {resendIn}s</Text>
        ) : (
          <Pressable hitSlop={8} onPress={sendCode} disabled={isLoading}>
            <Text style={styles.link}>Resend code</Text>
          </Pressable>
        )}
      </View>

      <Button
        title="Verify & Login"
        loadingTitle="Verifying..."
        loading={isLoading}
        onPress={() => verify()}
        icon={<ArrowRightIcon size={18} color={colors.white} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: 20, gap: 18 },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  codeFor: { flex: 1, fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
  link: { fontSize: 14, fontFamily: fonts.semibold, color: colors.secondary },
  muted: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  fieldGroup: { gap: 6 },
  codeGroup: { gap: 10 },
});
