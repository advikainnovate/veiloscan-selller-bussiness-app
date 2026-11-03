import React, { type ReactNode } from 'react';
import {
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '../../theme';
import { ArrowLeftIcon } from '../icons';
import { KeyboardScroll } from '../layout/KeyboardScroll';

/**
 * The signed-out screens' frame: the Seller Panel's peach background with
 * its soft shapes, scrolling that keeps the focused field above the
 * keyboard, and an optional back button.
 */
export function AuthScreen({ children, onBack }: { children: ReactNode; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <KeyboardScroll
        style={styles.flex}
        contentContainerStyle={[
          styles.scroll,
          // Room for the back button above the card.
          { paddingTop: insets.top + (onBack ? 60 : 24), paddingBottom: insets.bottom + 16 },
        ]}
        innerStyle={styles.center}
      >
        {children}
      </KeyboardScroll>

      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [styles.back, { top: insets.top + 8, opacity: pressed ? 0.7 : 1 }]}
        >
          <ArrowLeftIcon size={20} color={colors.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The white card the sign-in forms sit on. */
export function AuthCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.peach, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  blobTop: { width: 340, height: 340, top: -130, right: -120, backgroundColor: 'rgba(255,241,230,0.9)' },
  blobBottom: { width: 420, height: 380, bottom: -180, left: -140, backgroundColor: colors.secondaryLight },
  scroll: { flexGrow: 1, paddingHorizontal: 16 },
  center: { justifyContent: 'center' },
  back: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    ...shadow.card,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingHorizontal: 20,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,241,230,0.9)',
    ...shadow.raised,
  },
});
