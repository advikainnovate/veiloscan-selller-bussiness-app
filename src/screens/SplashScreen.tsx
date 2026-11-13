import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useTranslation } from 'react-i18next';

const markWhite = require('../assets/brand/logo-mark-white.png');

// How long the intro plays before the app may move on, even when the
// session check finished sooner.
const INTRO_MS = 1600;

/**
 * The brand intro on the Seller Panel's navy, shown while a saved sign-in is
 * checked. Calls `onFinish` once the intro has played and `ready` is true.
 */
export function SplashScreen({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const { t } = useTranslation();
  const markScale = useRef(new Animated.Value(0.6)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textShift = useRef(new Animated.Value(14)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const introDone = useRef(false);
  const finished = useRef(false);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  function finishIfReady() {
    if (introDone.current && readyRef.current && !finished.current) {
      finished.current = true;
      onFinish();
    }
  }

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(markScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
        Animated.timing(markOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(textShift, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    Animated.timing(progress, {
      toValue: 1,
      duration: INTRO_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      introDone.current = true;
      finishIfReady();
    });
    // The animations run once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(finishIfReady);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      {/* Soft orange and navy glows, as in the brand artwork. */}
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <View style={styles.center}>
        <Animated.View style={[styles.markWrap, { opacity: markOpacity, transform: [{ scale: markScale }] }]}>
          <Image source={markWhite} style={styles.mark} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={[styles.center2, { opacity: textOpacity, transform: [{ translateY: textShift }] }]}>
          <Text style={styles.wordmark}>
            {t('common.veilo')}<Text style={styles.accent}>{t('common.scan')}</Text>
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t('common.business')}</Text>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, { opacity: textOpacity }]}>
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.bar,
              {
                transform: [
                  { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }) },
                ],
              },
            ]}
          />
        </View>
        <Text style={styles.tagline}>{t('auth.sellManageGrow')}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primaryDeep, overflow: 'hidden' },
  glow: { position: 'absolute', borderRadius: 999 },
  glowTop: { width: 360, height: 360, top: -140, right: -140, backgroundColor: 'rgba(255,107,0,0.08)' },
  glowBottom: { width: 420, height: 420, bottom: -200, left: -160, backgroundColor: 'rgba(56,189,248,0.07)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 },
  center2: { alignItems: 'center' },
  markWrap: {
    width: 116,
    height: 116,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  mark: { width: 84, height: 84 },
  wordmark: { fontSize: 38, fontFamily: fonts.extrabold, color: colors.white, letterSpacing: -0.8 },
  accent: { color: colors.secondary },
  badge: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.55)',
    backgroundColor: 'rgba(255,107,0,0.14)',
  },
  badgeText: { fontSize: 11, fontFamily: fonts.bold, letterSpacing: 3, color: '#ff9a4d' },
  footer: { alignItems: 'center', gap: 14, paddingBottom: 56 },
  track: { width: 120, height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)' },
  bar: { width: 120, height: 4, borderRadius: 2, backgroundColor: colors.secondary },
  tagline: { fontFamily: fonts.regular, fontSize: 12.5, letterSpacing: 1.5, color: 'rgba(255,255,255,0.6)' },
});
