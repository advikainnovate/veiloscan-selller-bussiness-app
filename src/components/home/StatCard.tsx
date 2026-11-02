import React, { useEffect, useRef, type ComponentType } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme';
import type { Trend } from '../../lib/format';
import { ArrowDownIcon, ArrowUpIcon, type IconProps } from '../icons';

export const STAT_TONES = {
  orange: { bg: '#fff1e6', fg: '#ff6b00' },
  amber: { bg: '#fef3c7', fg: '#d97706' },
  violet: { bg: '#f3e8ff', fg: '#9333ea' },
  green: { bg: '#dcfce7', fg: '#16a34a' },
} as const;

interface StatCardProps {
  label: string;
  value: string | null;
  icon: ComponentType<IconProps>;
  tone: keyof typeof STAT_TONES;
  /** Against yesterday; omitted for running totals. */
  trend?: Trend;
}

/** One headline figure. `value` null while loading. */
export function StatCard({ label, value, icon: Icon, tone, trend }: StatCardProps) {
  const { bg, fg } = STAT_TONES[tone];
  const trendColor = trend?.direction === 'down' ? colors.error : trend?.direction === 'up' ? colors.success : colors.textSecondary;

  return (
    <View style={styles.card} accessible accessibilityLabel={value === null ? `${label}, loading` : `${label}: ${value}`}>
      <View style={[styles.icon, { backgroundColor: bg }]}>
        <Icon size={22} color={fg} />
      </View>
      <View style={styles.body}>
        <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {label}
        </Text>
        {value === null ? <Skeleton /> : (
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {value}
          </Text>
        )}
        {trend && value !== null ? (
          <View style={styles.trend}>
            {trend.direction === 'up' ? <ArrowUpIcon size={12} color={trendColor} /> : null}
            {trend.direction === 'down' ? <ArrowDownIcon size={12} color={trendColor} /> : null}
            <Text
              style={[styles.trendText, { color: trendColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {trend.label} vs yesterday
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Skeleton() {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.skeleton, { opacity }]} />;
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  label: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  value: { marginTop: 2, fontSize: 21, fontFamily: fonts.extrabold, color: colors.text, letterSpacing: -0.3 },
  trend: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 3 },
  trendText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 10.5 },
  skeleton: { marginTop: 6, height: 20, width: '70%', borderRadius: 6, backgroundColor: colors.primaryLight },
});
