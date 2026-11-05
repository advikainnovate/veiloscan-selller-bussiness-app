import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type ScrollViewInstance,
  type NativeSyntheticEvent,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius } from '../../theme';
import { Gradient } from '../ui/Gradient';
import { marketingBannerService, type MarketingBanner } from '../../services/marketing-banner-service';
import { ChartArt, DeliveryArt, StorefrontArt } from './Illustrations';

const AUTO_ADVANCE_MS = 5000;
const SIDE_PADDING = 16;
const TONE_COLORS: Record<string, readonly string[]> = {
  gold: ['#b8460a', '#e85d00', '#ff8a33'],
  navy: ['#031329', '#0b2a55', '#163f78'],
  light: ['#c2410c', '#ea580c', '#fb923c'],
};

/** Admin managed Home banners that advance on their own, with page dots. */
export function HeroCarousel() {
  const { width: screenWidth } = useWindowDimensions();
  const slideWidth = screenWidth - SIDE_PADDING * 2;
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [slides, setSlides] = useState<MarketingBanner[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const refresh = () => {
        marketingBannerService.listSellerHome().then(items => {
          if (active) {
            setSlides(items);
            setIndex(0);
            scrollRef.current?.scrollTo({ x: 0, animated: false });
          }
        }).catch(() => {
          // Keep the last successful result visible if the network is temporarily unavailable.
        });
      };
      refresh();
      const timer = setInterval(refresh, 60_000);
      return () => { active = false; clearInterval(timer); };
    }, []),
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const timer = setTimeout(() => {
      const next = (index + 1) % slides.length;
      scrollRef.current?.scrollTo({ x: next * screenWidth, animated: true });
      setIndex(next);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [index, paused, screenWidth, slides.length]);

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / screenWidth));
    setPaused(false);
  }

  if (!slides.length) return null;

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setPaused(true)}
        onMomentumScrollEnd={onScrollEnd}
        accessibilityRole="adjustable"
        accessibilityLabel={`Banner ${index + 1} of ${slides.length}`}
      >
        {slides.map(slide => {
          const gradient = TONE_COLORS[slide.tone ?? 'gold'] ?? TONE_COLORS.gold;
          const artWidth = Math.min(150, slideWidth * 0.42);
          const slideStyle = [
            styles.slide,
            { width: slideWidth },
            slide.imageUrl ? { height: slideWidth * 3 / 8, minHeight: 0, paddingLeft: 0 } : null,
          ];
          const art = slide.imageLabel?.toLowerCase().includes('delivery')
            ? <DeliveryArt width={artWidth} />
            : slide.imageLabel?.toLowerCase().includes('chart')
              ? <ChartArt width={artWidth} />
              : <StorefrontArt width={artWidth} />;
          const content = (
            <>
              <Gradient colors={gradient} direction="diagonal" borderRadius={radius.xl} />
              {slide.imageUrl ? (
                <ImageBackground
                  source={{ uri: slide.imageUrl }}
                  accessibilityLabel={slide.imageLabel ?? undefined}
                  resizeMode="cover"
                  style={styles.image}
                  imageStyle={styles.imageRadius}
                />
              ) : (
                <>
                  <View style={styles.art}>{art}</View>
                  <View style={styles.ring} />
                  <View style={styles.copy}>
                    <Text style={styles.title}>
                      {slide.titleLine1}
                      {slide.titleLine2 ? <><Text>{'\n'}</Text><Text style={styles.titleAccent}>{slide.titleLine2}</Text></> : null}
                    </Text>
                    {slide.detail ? <Text style={styles.text}>{slide.detail}</Text> : null}
                  </View>
                </>
              )}
            </>
          );
          return (
            <View key={slide.id} style={[styles.page, { width: screenWidth }]}>
              {slide.ctaHref ? (
                <Pressable
                  style={slideStyle}
                  onPress={() => { void Linking.openURL(slide.ctaHref!).catch(() => {}); }}
                  accessibilityRole="link"
                >
                  {content}
                </Pressable>
              ) : (
                <View style={slideStyle}>{content}</View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {slides.length > 1 ? (
        <View style={styles.dots}>
          {slides.map((slide, i) => (
            <View key={slide.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: SIDE_PADDING },
  slide: {
    minHeight: 150,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    overflow: 'hidden',
    paddingLeft: 20,
  },
  image: { ...StyleSheet.absoluteFill },
  imageRadius: { borderRadius: radius.xl },
  art: { position: 'absolute', right: 6, bottom: 0 },
  ring: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -70,
    top: -40,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  copy: { flex: 1, paddingVertical: 20 },
  title: { fontSize: 24, lineHeight: 28, fontFamily: fonts.extrabold, color: colors.white, letterSpacing: -0.4 },
  titleAccent: { color: '#ffd166' },
  text: { marginTop: 8, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.92)' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 18, backgroundColor: colors.secondary },
});
