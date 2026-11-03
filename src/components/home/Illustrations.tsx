import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

// Flat brand illustrations for the Home banner and cards, drawn in code so
// they stay sharp at any size and need no image assets.

const ORANGE = '#ff6b00';
const ORANGE_DARK = '#e85d00';
const ORANGE_LIGHT = '#ffb27a';
const NAVY = '#1e293b';

/** A shop with a striped awning, shopping bags and a rising chart. */
export function StorefrontArt({ width = 160 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.75} viewBox="0 0 160 120">
      <Defs>
        <LinearGradient id="sf-wall" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="1" stopColor="#e7ecf3" />
        </LinearGradient>
        <LinearGradient id="sf-bag" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#ff9a4d" />
          <Stop offset="1" stopColor={ORANGE_DARK} />
        </LinearGradient>
      </Defs>
      <Ellipse cx="84" cy="112" rx="66" ry="6" fill="#000" opacity="0.12" />

      {/* Building */}
      <Rect x="40" y="34" width="92" height="76" rx="6" fill="url(#sf-wall)" />
      <Rect x="126" y="34" width="6" height="76" rx="3" fill="#cbd5e1" />
      <Rect x="50" y="60" width="40" height="34" rx="3" fill="#dbe4ef" />
      <Path d="M50 76h40M70 60v34" stroke="#ffffff" strokeWidth="2" />
      <Rect x="98" y="62" width="22" height="48" rx="2" fill="#cbd5e1" />
      <Circle cx="115" cy="87" r="1.6" fill="#64748b" />

      {/* Roof and awning */}
      <Rect x="34" y="20" width="104" height="12" rx="4" fill={NAVY} />
      <G>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <Rect key={i} x={36 + i * 16.7} y="31" width="16.7" height="14" fill={i % 2 ? '#ffffff' : ORANGE} />
        ))}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <Circle key={i} cx={44.35 + i * 16.7} cy="45" r="8.35" fill={i % 2 ? '#ffffff' : ORANGE} />
        ))}
      </G>

      {/* Bags and a parcel */}
      <Rect x="10" y="88" width="20" height="20" rx="2" fill="#fcd9b8" />
      <Path d="M10 95h20M20 88v7" stroke="#f0b27a" strokeWidth="1.5" />
      <Rect x="24" y="72" width="28" height="36" rx="4" fill="url(#sf-bag)" />
      <Path d="M31 74v-5a7 7 0 0 1 14 0v5" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* Rising chart card */}
      <Rect x="112" y="44" width="42" height="36" rx="6" fill="#ffffff" />
      <Rect x="119" y="64" width="5" height="10" rx="1" fill={ORANGE_LIGHT} />
      <Rect x="127" y="58" width="5" height="16" rx="1" fill="#ff8a33" />
      <Rect x="135" y="52" width="5" height="22" rx="1" fill={ORANGE} />
      <Path d="M118 60l9-7 6 3 12-9" stroke={ORANGE_DARK} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M140 47h5v5" stroke={ORANGE_DARK} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** A delivery van with parcels: orders on their way. */
export function DeliveryArt({ width = 160 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.75} viewBox="0 0 160 120">
      <Ellipse cx="80" cy="110" rx="66" ry="6" fill="#000" opacity="0.14" />
      {/* Van */}
      <Rect x="18" y="44" width="78" height="54" rx="6" fill="#ffffff" />
      <Path d="M96 58h22l18 18v22H96Z" fill="#e7ecf3" />
      <Path d="M100 62h16l12 12h-28Z" fill="#9fb3cc" />
      <Rect x="18" y="74" width="78" height="8" fill={ORANGE} />
      <Circle cx="42" cy="100" r="11" fill={NAVY} />
      <Circle cx="42" cy="100" r="4.5" fill="#cbd5e1" />
      <Circle cx="116" cy="100" r="11" fill={NAVY} />
      <Circle cx="116" cy="100" r="4.5" fill="#cbd5e1" />
      <Path d="M30 58h20M30 64h12" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
      {/* Parcels */}
      <Rect x="104" y="18" width="30" height="26" rx="3" fill="#fcd9b8" />
      <Path d="M104 27h30M119 18v9" stroke="#f0b27a" strokeWidth="2" />
      <Rect x="124" y="34" width="24" height="22" rx="3" fill="#ffb27a" />
      <Path d="M124 42h24M136 34v8" stroke="#f08a3c" strokeWidth="2" />
      {/* Speed lines */}
      <Path d="M2 56h10M6 66h10M2 76h8" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}

/** A report card with a rising line and coins. */
export function ChartArt({ width = 160 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.75} viewBox="0 0 160 120">
      <Ellipse cx="82" cy="112" rx="62" ry="6" fill="#000" opacity="0.12" />
      <Rect x="26" y="14" width="96" height="92" rx="10" fill="#ffffff" />
      <Rect x="36" y="24" width="40" height="6" rx="3" fill="#e2e8f0" />
      <Rect x="36" y="34" width="24" height="5" rx="2.5" fill="#ffd3b3" />
      <Path d="M36 92l18-18 14 9 22-26 22 10" stroke={ORANGE} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M36 92l18-18 14 9 22-26 22 10V96H36Z" fill={ORANGE} opacity="0.12" />
      <Circle cx="90" cy="57" r="4" fill="#ffffff" stroke={ORANGE} strokeWidth="2.5" />
      {/* Coins */}
      <Ellipse cx="130" cy="100" rx="16" ry="5" fill="#d97706" />
      <Rect x="114" y="86" width="32" height="14" fill="#f59e0b" />
      <Ellipse cx="130" cy="86" rx="16" ry="5" fill="#fbbf24" />
      <Rect x="114" y="74" width="32" height="12" fill="#f59e0b" />
      <Ellipse cx="130" cy="74" rx="16" ry="5" fill="#fcd34d" />
    </Svg>
  );
}

/** A rocket taking off: growth. */
export function RocketArt({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="rk-body" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="1" stopColor="#ffd3b3" />
        </LinearGradient>
      </Defs>
      {/* Flame */}
      <Path d="M14 40c-5 2-8 8-9 17 9-1 15-4 17-9Z" fill="#fbbf24" />
      <Path d="M15 43c-3 1.5-5 5-5.5 10 5-.5 8.5-2.5 10-5.5Z" fill={ORANGE} />
      {/* Fins */}
      <Path d="M20 30l-9 2-6 9 12-2Z" fill={ORANGE_DARK} />
      <Path d="M34 44l-2 9-9 6 2-12Z" fill={ORANGE_DARK} />
      {/* Body */}
      <Path d="M17 47c4-14 14-31 41-41-6 20-21 33-35 39Z" fill="url(#rk-body)" />
      <Path d="M50 8c2.5 1 4.5 3 5.5 5.5L58 6Z" fill={ORANGE} />
      <Circle cx="38" cy="26" r="6" fill="#ffffff" stroke={ORANGE} strokeWidth="3" />
      <Circle cx="38" cy="26" r="2.5" fill="#7dd3fc" />
    </Svg>
  );
}

/** Three customers, the middle one in brand orange: the Customers banner. */
export function CustomersArt({ width = 150 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.66} viewBox="0 0 150 100">
      <Defs>
        <LinearGradient id="cu-side" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#f8fafc" />
          <Stop offset="1" stopColor="#bfd3ea" />
        </LinearGradient>
        <LinearGradient id="cu-main" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffb020" />
          <Stop offset="1" stopColor={ORANGE} />
        </LinearGradient>
      </Defs>
      <Ellipse cx="75" cy="94" rx="62" ry="5" fill="#000000" opacity="0.18" />
      {/* Side customers */}
      <Circle cx="34" cy="38" r="13" fill="url(#cu-side)" />
      <Path d="M10 92c0-18 10.5-30 24-30s24 12 24 30Z" fill="url(#cu-side)" />
      <Circle cx="116" cy="38" r="13" fill="url(#cu-side)" />
      <Path d="M92 92c0-18 10.5-30 24-30s24 12 24 30Z" fill="url(#cu-side)" />
      {/* The customer in front */}
      <Circle cx="75" cy="28" r="17" fill="url(#cu-main)" />
      <Path d="M43 94c0-24 14-40 32-40s32 16 32 40Z" fill="url(#cu-main)" />
      <Path d="M58 30a17 17 0 0 0 10 13" stroke={ORANGE_LIGHT} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
    </Svg>
  );
}
