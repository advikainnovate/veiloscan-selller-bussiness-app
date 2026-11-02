import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type ScrollViewInstance,
  type NativeSyntheticEvent,
} from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { Gradient } from '../ui/Gradient';
import { ChartArt, DeliveryArt, StorefrontArt } from './Illustrations';

const AUTO_ADVANCE_MS = 5000;
const SIDE_PADDING = 16;

interface Slide {
  /** Line one, then line two's plain start and its highlighted end. */
  title: [string, string, string];
  text: string;
  colors: readonly string[];
  art: (width: number) => ReactNode;
}

const SLIDES: Slide[] = [
  {
    title: ['Your Store.', 'Your ', 'Growth.'],
    text: 'Manage orders, products, stock and customers — all in one place.',
    colors: ['#b8460a', '#e85d00', '#ff8a33'],
    art: width => <StorefrontArt width={width} />,
  },
  {
    title: ['Every Order.', '', 'On Time.'],
    text: 'See new orders the moment they arrive and keep deliveries moving.',
    colors: ['#031329', '#0b2a55', '#163f78'],
    art: width => <DeliveryArt width={width} />,
  },
  {
    title: ['Know Your', '', 'Numbers.'],
    text: 'Daily sales and reports that show what to stock and promote next.',
    colors: ['#c2410c', '#ea580c', '#fb923c'],
    art: width => <ChartArt width={width} />,
  },
];

/** The Home banner: three brand slides that advance on their own, with page dots. */
export function HeroCarousel() {
  const { width: screenWidth } = useWindowDimensions();
  const slideWidth = screenWidth - SIDE_PADDING * 2;
  const artWidth = Math.min(150, slideWidth * 0.42);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => {
      const next = (index + 1) % SLIDES.length;
      scrollRef.current?.scrollTo({ x: next * screenWidth, animated: true });
      setIndex(next);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [index, paused, screenWidth]);

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / screenWidth));
    setPaused(false);
  }

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
        accessibilityLabel={`Banner ${index + 1} of ${SLIDES.length}`}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.page, { width: screenWidth }]}>
            <View style={[styles.slide, { width: slideWidth }]}>
              <Gradient colors={slide.colors} direction="diagonal" borderRadius={radius.xl} />
              <View style={styles.ring} />
              <View style={styles.copy}>
                <Text style={styles.title}>
                  {slide.title[0]}
                  {'\n'}
                  {slide.title[1]}
                  <Text style={styles.titleAccent}>{slide.title[2]}</Text>
                </Text>
                <Text style={styles.text}>{slide.text}</Text>
              </View>
              <View style={styles.art}>{slide.art(artWidth)}</View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
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
  art: { paddingRight: 6, alignSelf: 'flex-end' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 18, backgroundColor: colors.secondary },
});
