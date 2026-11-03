import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const NAVY = '#0b2a52';

/** The soft grey sweep at the top right of the login screen. */
export function TopSweep({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[styles.top, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 400 260" preserveAspectRatio="none">
        <Path d="M230 0 C 250 90, 320 150, 400 170 L400 0 Z" fill="#e9eef7" />
        <Path d="M300 0 C 310 50, 350 80, 400 90 L400 0 Z" fill="#dfe6f2" opacity={0.7} />
      </Svg>
    </View>
  );
}

/** Navy and orange waves along the bottom of the login screen. */
export function BottomWaves({ height = 150, children }: { height?: number; children?: React.ReactNode }) {
  return (
    <View style={{ height }}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 400 150" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="loginPeach" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#ffd9bd" stopOpacity={0.3} />
            <Stop offset="1" stopColor="#ffb27a" stopOpacity={0.9} />
          </LinearGradient>
          <LinearGradient id="loginOrange" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#ff8a33" />
            <Stop offset="1" stopColor="#ff6b00" />
          </LinearGradient>
        </Defs>
        <Path d="M0 60 C 110 20, 230 110, 400 10 L400 150 L0 150 Z" fill="#e7ecf5" />
        <Path d="M120 90 C 230 90, 290 40, 400 22 L400 150 L120 150 Z" fill="url(#loginPeach)" />
        <Path d="M90 112 C 220 120, 300 70, 400 50 L400 150 L90 150 Z" fill="url(#loginOrange)" />
        <Path d="M0 82 C 80 74, 150 120, 260 130 C 320 136, 370 128, 400 120 L400 150 L0 150 Z" fill={NAVY} />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, right: 0, width: '100%', height: 260 },
});
