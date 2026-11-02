import React, { type ComponentType } from 'react';
import { Image, ScrollView, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, featureTones, radius, type FeatureTone, fonts } from '../theme';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { Gradient } from '../components/ui/Gradient';
import {
  ArrowRightIcon,
  BoxIcon,
  ChartTrendIcon,
  HelpCircleIcon,
  LayersIcon,
  LockIcon,
  ShieldCheckIcon,
  StoreIcon,
  type IconProps,
} from '../components/icons';
import { setOnboarded } from '../lib/session';
import type { ScreenProps } from '../navigation/types';

const hero = require('../assets/brand/login-hero.jpg');
// The artwork's width / height; the seller sits in its lower half.
const HERO_RATIO = 581 / 760;

// The Seller Panel login's story, for a phone.
const features: { Icon: ComponentType<IconProps>; tone: FeatureTone; title: string; description: string }[] = [
  { Icon: StoreIcon, tone: 'orange', title: 'Store Management', description: 'Products and categories' },
  { Icon: BoxIcon, tone: 'green', title: 'Order Tracking', description: 'Real-time order updates' },
  { Icon: LayersIcon, tone: 'blue', title: 'Inventory Control', description: 'Stock always in sync' },
  { Icon: ChartTrendIcon, tone: 'violet', title: 'Business Insights', description: 'Reports to help you grow' },
];

const promises: { Icon: ComponentType<IconProps>; label: string }[] = [
  { Icon: ShieldCheckIcon, label: 'Trusted Platform' },
  { Icon: LockIcon, label: 'Secure & Reliable' },
  { Icon: HelpCircleIcon, label: 'Dedicated Support' },
];

export function GetStartedScreen({ navigation }: ScreenProps<'GetStarted'>) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const heroHeight = Math.min(Math.max(height * 0.36, 230), 360);

  async function goToLogin() {
    await setOnboarded();
    navigation.replace('Login');
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <ScrollView bounces={false} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* The seller photo, fading into the navy below it. */}
        <View style={[styles.hero, { height: heroHeight + insets.top }]}>
          {/* Full width and pinned to the bottom, so the crop keeps the seller, not the sky. */}
          <Image source={hero} style={[styles.heroImage, { width, height: width / HERO_RATIO }]} resizeMode="cover" />
          <Gradient colors={[colors.primaryDeep, colors.primaryDeep]} opacities={[0.55, 0]} direction="vertical" style={styles.heroTopShade} />
          <Gradient
            colors={[colors.primaryDeep, colors.primaryDeep]}
            opacities={[0, 1]}
            direction="vertical"
            style={styles.heroBottomShade}
          />
          <View style={[styles.logoRow, { paddingTop: insets.top + 14 }]}>
            <Logo variant="white" size={38} tagline={null} />
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.pill}>
            <View style={styles.pillIcon}>
              <StoreIcon size={14} color="#ff8a33" />
            </View>
            <Text style={styles.pillText} numberOfLines={1}>
              LOCAL SHOPS <Text style={styles.pillDivider}>|</Text> RETAIL <Text style={styles.pillDivider}>|</Text> GROWING BRANDS
            </Text>
          </View>

          <Text style={styles.title}>
            Your Store.{'\n'}
            <Text style={styles.titleAccent}>Your Growth.</Text>
          </Text>
          <View style={styles.rule} />
          <Text style={styles.lead}>
            Manage your products, orders, inventory and customers with ease — your whole VeiloScan store, in your pocket.
          </Text>

          <View style={styles.grid}>
            {features.map(({ Icon, tone, title, description }) => (
              <View key={title} style={styles.card}>
                <View style={styles.cardIcon}>
                  <Gradient colors={featureTones[tone]} direction="diagonal" borderRadius={12} />
                  <Icon size={20} color={colors.white} />
                </View>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardText}>{description}</Text>
              </View>
            ))}
          </View>

          <View style={styles.promises}>
            {promises.map(({ Icon, label }, i) => (
              <View key={label} style={[styles.promise, i < promises.length - 1 && styles.promiseDivider]}>
                <Icon size={18} color={colors.secondary} />
                <Text style={styles.promiseText}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        <Button title="Get Started" onPress={goToLogin} icon={<ArrowRightIcon size={18} color={colors.white} />} />
        <Text style={styles.signInHint}>
          Already selling on VeiloScan?{' '}
          <Text style={styles.signInLink} onPress={goToLogin} accessibilityRole="link">
            Sign In
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primaryDeep },
  scroll: { paddingBottom: 24 },
  hero: { overflow: 'hidden' },
  heroImage: { position: 'absolute', left: 0, bottom: 0 },
  heroTopShade: { height: '40%' },
  heroBottomShade: { top: '45%' },
  logoRow: { paddingHorizontal: 22 },
  body: { paddingHorizontal: 22, marginTop: -28 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    maxWidth: '100%',
  },
  pillIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,138,51,0.6)',
    backgroundColor: 'rgba(255,107,0,0.15)',
  },
  pillText: { flexShrink: 1, fontSize: 10.5, fontFamily: fonts.bold, letterSpacing: 0.6, color: 'rgba(255,255,255,0.9)' },
  pillDivider: { color: 'rgba(255,255,255,0.4)' },
  title: { marginTop: 18, fontSize: 36, lineHeight: 40, fontFamily: fonts.extrabold, letterSpacing: -0.8, color: colors.white },
  titleAccent: { color: colors.secondary },
  rule: { marginTop: 14, width: 56, height: 4, borderRadius: 2, backgroundColor: colors.secondary },
  lead: { marginTop: 14, fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: 'rgba(255,255,255,0.82)' },
  grid: { marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.white },
  cardText: { marginTop: 3, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: 'rgba(255,255,255,0.62)' },
  promises: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
    flexDirection: 'row',
  },
  promise: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  promiseDivider: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(255,255,255,0.18)' },
  promiseText: { fontFamily: fonts.regular, fontSize: 11.5, textAlign: 'center', color: 'rgba(255,255,255,0.82)' },
  actions: {
    paddingHorizontal: 22,
    paddingTop: 14,
    gap: 14,
    backgroundColor: colors.primaryDeep,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  signInHint: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  signInLink: { color: colors.secondary, fontFamily: fonts.bold },
});
