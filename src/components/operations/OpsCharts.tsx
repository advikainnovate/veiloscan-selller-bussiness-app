import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { formatRupees } from '../../lib/format';
import { CHART_INK, shortRupees } from '../../lib/sales-report';
import { useTranslation } from 'react-i18next';

export interface Series {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
}

function niceStep(span: number) {
  const raw = span / 4 || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

const MIN_SLOT = 20;

/**
 * Money over time: optional bars (e.g. sales) with lines over them (profit,
 * expenses…), one ₹ axis. Tap a column for its figures. The panel's
 * SalesComboChart and MultiLineChart in one.
 */
export function ComboChart({ labels, fullLabels, bars, lines, height = 220 }: { labels: string[]; fullLabels: string[]; bars?: Series; lines: Series[]; height?: number }) {
  const { t: tr } = useTranslation();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const n = Math.max(1, labels.length);
  const selected = picked !== null && picked < labels.length ? picked : null;
  const pad = { left: 46, right: 8, top: 8, bottom: 22 };
  const W = Math.max(width, pad.left + pad.right + n * MIN_SLOT);
  const plotW = W - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const slot = plotW / n;

  const all = [bars, ...lines].flatMap(s => (s ? s.values.filter((v): v is number => v !== null) : []));
  const lo = Math.min(0, ...all);
  const hi = Math.max(1, ...all);
  const step = niceStep(hi - lo);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(v);
  const y = (v: number) => pad.top + plotH - ((v - min) / (max - min || 1)) * plotH;
  const cx = (i: number) => pad.left + slot * i + slot / 2;
  const zero = y(0);
  const barW = Math.max(3, Math.min(18, slot * 0.6));
  const every = Math.max(1, Math.ceil((n * 44) / plotW));
  const series = [...(bars ? [bars] : []), ...lines];

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      <View style={styles.legend}>
        {series.map(s => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[s === bars ? styles.dot : styles.line, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>{s.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.readout}>
        {selected !== null ? (
          <>
            <Text style={styles.readoutTitle}>{fullLabels[selected]}</Text>
            <View style={styles.readoutRow}>
              {series.map(s => (
                <View key={s.key} style={styles.reading}>
                  <View style={[styles.dot, { backgroundColor: s.color }]} />
                  <Text style={styles.readingLabel}>{s.label}</Text>
                  <Text style={styles.readingValue}>{s.values[selected] == null ? '—' : formatRupees(Math.round(s.values[selected] as number))}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.hint}>{tr('operations.tapTheChartToSeeA')}</Text>
        )}
      </View>
      {width > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={W > width}>
          <Svg width={W} height={height} accessibilityLabel={tr('operations.chartOverTime')}>
            {ticks.map(t => (
              <G key={t}>
                <Line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? CHART_INK.baseline : CHART_INK.grid} />
                <SvgText x={pad.left - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill={CHART_INK.muted}>
                  {shortRupees(t)}
                </SvgText>
              </G>
            ))}
            {selected !== null ? <Line x1={cx(selected)} x2={cx(selected)} y1={pad.top} y2={pad.top + plotH} stroke={CHART_INK.baseline} strokeDasharray="3 3" /> : null}
            {bars
              ? bars.values.map((v, i) => {
                  if (v == null) return null;
                  const top = Math.min(y(v), zero);
                  const h = Math.abs(y(v) - zero);
                  return h < 0.5 ? null : (
                    <Rect
                      key={i}
                      x={cx(i) - barW / 2}
                      y={top}
                      width={barW}
                      height={h}
                      rx={Math.min(3, barW / 2)}
                      fill={bars.color}
                      opacity={selected !== null && selected !== i ? 0.45 : 1}
                    />
                  );
                })
              : null}
            {lines.map(s => {
              const pts = s.values.map((v, i) => (v == null ? null : `${cx(i).toFixed(1)},${y(v).toFixed(1)}`));
              const d = pts.reduce<string>((acc, pt, i) => (pt ? `${acc}${acc && pts[i - 1] ? 'L' : 'M'}${pt}` : acc), '');
              return (
                <G key={s.key}>
                  <Path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
                  {n <= 40
                    ? s.values.map((v, i) => (v == null ? null : <Circle key={i} cx={cx(i)} cy={y(v)} r={selected === i ? 4 : 2.5} fill={s.color} stroke={CHART_INK.surface} strokeWidth={1.5} />))
                    : null}
                </G>
              );
            })}
            {labels.map((l, i) =>
              i % every === 0 || i === n - 1 ? (
                <SvgText key={i} x={cx(i)} y={height - 6} textAnchor="middle" fontSize={10} fill={CHART_INK.muted}>
                  {l}
                </SvgText>
              ) : null,
            )}
            {labels.map((_, i) => (
              <Rect key={`t${i}`} x={pad.left + slot * i} y={pad.top} width={slot} height={plotH} fill="transparent" onPress={() => setPicked(p => (p === i ? null : i))} />
            ))}
          </Svg>
        </ScrollView>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

/** Ranked rows with a share bar (By Category, Top Suppliers…). */
export function BarList({ rows, color = colors.secondary }: { rows: { label: string; value: number; sub?: string }[]; color?: string }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <View style={styles.bars}>
      {rows.map(r => (
        <View key={r.label}>
          <View style={styles.barTop}>
            <Text style={styles.barLabel} numberOfLines={1}>
              {r.label}
              {r.sub ? <Text style={styles.barSub}>{` · ${r.sub}`}</Text> : null}
            </Text>
            <Text style={styles.barValue}>{shortRupees(r.value)}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(2, (r.value / max) * 100)}%`, backgroundColor: color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary },
  dot: { width: 9, height: 9, borderRadius: 5 },
  line: { width: 16, height: 2, borderRadius: 1 },
  readout: { minHeight: 44, justifyContent: 'center', marginBottom: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.background },
  readoutTitle: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  readoutRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2, marginTop: 3 },
  reading: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  readingLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  readingValue: { fontFamily: fonts.bold, fontSize: 12, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  bars: { gap: 12 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  barLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  barSub: { color: colors.textMuted },
  barValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  track: { marginTop: 5, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  fill: { height: 6, borderRadius: 3 },
});
