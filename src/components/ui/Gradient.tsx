import React, { useId } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

interface GradientProps {
  colors: readonly string[];
  /** Direction: 'horizontal' (left → right), 'vertical' (top → bottom) or 'diagonal'. */
  direction?: 'horizontal' | 'vertical' | 'diagonal';
  /** Stop opacities, one per colour; defaults to fully opaque. */
  opacities?: readonly number[];
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

const VECTORS = {
  horizontal: { x1: '0', y1: '0', x2: '1', y2: '0' },
  vertical: { x1: '0', y1: '0', x2: '0', y2: '1' },
  diagonal: { x1: '0', y1: '0', x2: '1', y2: '1' },
} as const;

const styles = StyleSheet.create({ clip: { overflow: 'hidden' } });

/** A linear gradient that fills its parent (absolutely positioned). */
export function Gradient({ colors, direction = 'horizontal', opacities, borderRadius = 0, style }: GradientProps) {
  const id = useId().replace(/:/g, '');
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, { borderRadius }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} {...VECTORS[direction]}>
            {colors.map((color, i) => (
              <Stop
                key={i}
                offset={colors.length === 1 ? 0 : i / (colors.length - 1)}
                stopColor={color}
                stopOpacity={opacities?.[i] ?? 1}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" rx={borderRadius} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
