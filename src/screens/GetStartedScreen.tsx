import React, { useState } from 'react';
import { Image, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, shadow } from '../theme';
import { Logo } from '../components/ui/Logo';
import { Gradient } from '../components/ui/Gradient';
import { ArrowRightIcon, CheckIcon } from '../components/icons';
import { BottomWaves } from '../components/auth/LoginArt';
import { setOnboarded } from '../lib/session';
import type { ScreenProps } from '../navigation/types';

const slides = [
  {
    image: require('../assets/onboarding/store.jpg'),
    title: 'Manage Your Store',
    description: 'Add products, update inventory and handle orders easily.',
  },
  {
    image: require('../assets/onboarding/orders.jpg'),
    title: 'Track Orders',
    description: 'Stay updated with new orders, payments and order status in real time.',
  },
  {
    image: require('../assets/onboarding/growth.jpg'),
    title: 'Grow Your Business',
    description: 'See sales, customers and reports to make smarter decisions.',
  },
];

export function GetStartedScreen({ navigation }: ScreenProps<'GetStarted'>) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const compact = height < 760;
  const slide = slides[index];
  const artWidth = Math.min(width - 28, height * (compact ? 0.34 : 0.43) * (670 / 600));
  const artHeight = artWidth * (600 / 670);

  async function finishOnboarding() {
    await setOnboarded();
    navigation.replace('Login');
  }

  function next() {
    if (index === slides.length - 1) {
      void finishOnboarding();
      return;
    }
    setIndex(current => current + 1);
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { paddingTop: insets.top + (compact ? 5 : 12) }]}>
        <Logo variant="white" layout="stacked" size={compact ? 54 : 62} tagline={null} />
        <View style={styles.appTitleRow}>
          <View style={styles.headerRule} />
          <Text style={styles.appTitle}>Seller App</Text>
          <View style={styles.headerRule} />
        </View>
      </View>

      <View style={styles.artStage}>
        <Image source={slide.image} style={{ width: artWidth, height: artHeight }} resizeMode="contain" />
      </View>

      <View style={styles.copy}>
        <Text style={[styles.title, compact && styles.titleCompact]} accessibilityRole="header">
          {slide.title}
        </Text>
        <Text style={[styles.description, compact && styles.descriptionCompact]}>{slide.description}</Text>
      </View>

      <View style={styles.dots} accessibilityLabel={`Onboarding page ${index + 1} of ${slides.length}`}>
        {slides.map((item, dotIndex) => (
          <View key={item.title} style={[styles.dot, dotIndex === index && styles.dotActive]} />
        ))}
      </View>

      <View style={[styles.actions, { marginBottom: compact ? 8 : 14 }]}>
        <Pressable accessibilityRole="button" onPress={() => { void finishOnboarding(); }} hitSlop={12} style={styles.skip}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={next} style={styles.nextButton}>
          <Gradient colors={['#ff9c00', '#ff5b00']} borderRadius={32} />
          <View style={styles.nextContent}>
            <Text style={styles.nextText}>{index === slides.length - 1 ? 'Get Started' : 'Next'}</Text>
            {index === slides.length - 1
              ? <CheckIcon size={22} color={colors.white} strokeWidth={2.8} />
              : <ArrowRightIcon size={22} color={colors.white} strokeWidth={2.4} />}
          </View>
        </Pressable>
      </View>

      <BottomWaves height={(compact ? 45 : 58) + insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#031b43' },
  header: { alignItems: 'center', paddingHorizontal: 20 },
  appTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 5 },
  headerRule: { width: 28, height: 1.5, backgroundColor: 'rgba(255,255,255,0.82)' },
  appTitle: { color: colors.white, fontFamily: fonts.semibold, fontSize: 19, letterSpacing: -0.3 },
  artStage: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  copy: { alignItems: 'center', paddingHorizontal: 26 },
  title: { color: colors.white, fontFamily: fonts.bold, fontSize: 31, lineHeight: 38, textAlign: 'center', letterSpacing: -0.6 },
  titleCompact: { fontSize: 27, lineHeight: 33 },
  description: { marginTop: 8, color: '#d4def4', fontFamily: fonts.regular, fontSize: 17, lineHeight: 23, textAlign: 'center' },
  descriptionCompact: { fontSize: 15, lineHeight: 20, marginTop: 5 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 18 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#536b9f' },
  dotActive: { backgroundColor: '#ff7900' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 26 },
  skip: { paddingVertical: 14, paddingRight: 18 },
  skipText: { color: '#d9e2f7', fontFamily: fonts.medium, fontSize: 19 },
  nextButton: { minWidth: 174, height: 58, borderRadius: 32, overflow: 'hidden', justifyContent: 'center', ...shadow.button },
  nextContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  nextText: { color: colors.white, fontFamily: fonts.bold, fontSize: 18 },
});
