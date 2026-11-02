import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow } from '../theme';
import { AlertCircleIcon, CheckCircleIcon } from '../components/icons';

type ToastKind = 'success' | 'error';
interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

const SHOW_MS = 3200;

/** Short confirmations ("Order accepted") and errors, shown above the tab bar. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const nextId = useRef(0);
  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    setToast({ id: ++nextId.current, message, kind });
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onDone={() => setToast(null)} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(SHOW_MS),
      Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => finished && onDone());
  }, [progress, onDone]);

  const error = toast.kind === 'error';
  const Icon = error ? AlertCircleIcon : CheckCircleIcon;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 90 }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[
          styles.toast,
          error && styles.toastError,
          { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
        ]}
      >
        <Icon size={18} color={error ? '#fecaca' : '#86efac'} />
        <Text style={styles.text}>{toast.message}</Text>
      </Animated.View>
    </View>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 480,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    ...shadow.raised,
  },
  toastError: { backgroundColor: '#7f1d1d' },
  text: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.white },
});
