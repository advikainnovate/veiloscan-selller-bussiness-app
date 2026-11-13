import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { formatRupees } from '../../lib/format';
import { CHART_INK, ORDERS_COLOR, PROFIT_COLOR, SALES_COLOR, shortRupees } from '../../lib/sales-report';
import { useTranslation } from 'react-i18next';

function niceStep(span: number) {
  const raw = span / 4 || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

// Narrowest a bucket gets before the chart scrolls sideways.
const MIN_SLOT = 22;

/**
 * Sales and profit as paired bars on one ₹ axis; orders as a line in their
 * own lane underneath (a count never shares the money axis). Tap a bar for
 * its figures.
 */
export function SalesProfitChart({
  labels,
  fullLabels,
  sales,
  profit,
  orders,
}: {
  labels: string[];
  fullLabels: string[];
  sales: number[];
  profit: (number | null)[] | null;
  orders: number[];
}) {
  const { t: tr } = useTranslation();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const n = Math.max(1, sales.length);
  const selected = picked !== null && picked < sales.length ? picked : null;

  const pad = { left: 46, right: 6, top: 8 };
  const moneyH = 150;
  const gap = 16;
  const laneH = 38;
  const axisH = 20;
  const H = pad.top + moneyH + gap + laneH + axisH;
  const W = Math.max(width, pad.left + pad.right + n * MIN_SLOT);
  const plotW = W - pad.left - pad.right;
  const slot = plotW / n;

  const values = [...sales, ...(profit ?? []).filter((v): v is number => v !== null)];
  const lo = Math.min(0, ...values);
  const hi = Math.max(1, ...values);
  const step = niceStep(hi - lo);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(v);
  const y = (v: number) => pad.top + moneyH - ((v - min) / (max - min || 1)) * moneyH;
  const zero = y(0);

  const bars = profit ? 2 : 1;
  const barW = Math.max(1.5, Math.min(14, (slot * 0.72) / bars - 1));
  const ordersMax = Math.max(1, ...orders);
  const laneTop = pad.top + moneyH + gap;
  const oy = (v: number) => laneTop + laneH - (v / ordersMax) * (laneH - 6);
  const cx = (i: number) => pad.left + slot * i + slot / 2;
  const every = Math.max(1, Math.ceil((n * 44) / plotW));

  const bar = (key: string, x: number, v: number, color: string, faded: boolean) => {
    const top = Math.min(y(v), zero);
    const h = Math.abs(y(v) - zero);
    if (h < 0.5) return null;
    const r = Math.min(3, barW / 2, h);
    // Round only the end away from the baseline.
    const d =
      v >= 0
        ? `M${x},${zero} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${zero} Z`
        : `M${x},${zero} V${zero + h - r} Q${x},${zero + h} ${x + r},${zero + h} H${x + barW - r} Q${x + barW},${zero + h} ${x + barW},${zero + h - r} V${zero} Z`;
    return <Path key={key} d={d} fill={color} opacity={faded ? 0.45 : 1} />;
  };

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      <View style={styles.legend}>
        <Legend color={SALES_COLOR} label={tr('reports.salesAmount')} />
        {profit ? <Legend color={PROFIT_COLOR} label={tr('reports.profit')} /> : null}
        <Legend color={ORDERS_COLOR} label={tr('common.orders')} line />
      </View>

      {/* The tapped bucket's figures (the panel's hover tooltip). */}
      <View style={styles.readout}>
        {selected !== null ? (
          <>
            <Text style={styles.readoutTitle}>{fullLabels[selected]}</Text>
            <View style={styles.readoutRow}>
              <Reading color={SALES_COLOR} label={tr('common.sales')} value={formatRupees(Math.round(sales[selected]))} />
              {profit ? (
                <Reading color={PROFIT_COLOR} label={tr('reports.profit')} value={profit[selected] == null ? '—' : formatRupees(Math.round(profit[selected] as number))} />
              ) : null}
              <Reading color={ORDERS_COLOR} label={tr('common.orders')} value={String(orders[selected])} />
            </View>
          </>
        ) : (
          <Text style={styles.readoutHint}>{tr('reports.tapABarToSeeIts')}</Text>
        )}
      </View>

      {width > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={W > width}>
          <Svg width={W} height={H} accessibilityLabel={tr('reports.salesProfitAndOrdersOverTime')}>
            {ticks.map(t => (
              <G key={t}>
                <Line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? CHART_INK.baseline : CHART_INK.grid} />
                <SvgText x={pad.left - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill={CHART_INK.muted}>
                  {shortRupees(t)}
                </SvgText>
              </G>
            ))}
            <SvgText x={pad.left - 6} y={laneTop + laneH / 2 + 3.5} textAnchor="end" fontSize={10} fill={CHART_INK.muted}>
              {tr('common.orders')}</SvgText>
            <Line x1={pad.left} x2={W - pad.right} y1={laneTop + laneH} y2={laneTop + laneH} stroke={CHART_INK.grid} />

            {selected !== null ? (
              <Line x1={cx(selected)} x2={cx(selected)} y1={pad.top} y2={laneTop + laneH} stroke={CHART_INK.baseline} strokeDasharray="3 3" />
            ) : null}

            {sales.map((s, i) => {
              const faded = selected !== null && selected !== i;
              const start = cx(i) - (barW * bars + (bars - 1)) / 2;
              return (
                <G key={i}>
                  {bar(`s${i}`, start, s, SALES_COLOR, faded)}
                  {profit && profit[i] !== null ? bar(`p${i}`, start + barW + 1, profit[i] as number, PROFIT_COLOR, faded) : null}
                </G>
              );
            })}

            <Path
              d={orders.map((o, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${oy(o).toFixed(1)}`).join(' ')}
              fill="none"
              stroke={ORDERS_COLOR}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {n <= 40
              ? orders.map((o, i) => (
                  <Circle key={i} cx={cx(i)} cy={oy(o)} r={selected === i ? 4 : 2.5} fill={ORDERS_COLOR} stroke={CHART_INK.surface} strokeWidth={1.5} />
                ))
              : null}

            {labels.map((l, i) =>
              i % every === 0 || i === n - 1 ? (
                <SvgText key={i} x={cx(i)} y={H - 5} textAnchor="middle" fontSize={10} fill={CHART_INK.muted}>
                  {l}
                </SvgText>
              ) : null,
            )}

            {/* Tap targets: a whole column per bucket. */}
            {sales.map((_, i) => (
              <Rect
                key={`t${i}`}
                x={pad.left + slot * i}
                y={pad.top}
                width={slot}
                height={moneyH + gap + laneH}
                fill="transparent"
                onPress={() => setPicked(prev => (prev === i ? null : i))}
              />
            ))}
          </Svg>
        </ScrollView>
      ) : (
        <View style={{ height: H }} />
      )}
    </View>
  );
}

function Legend({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[line ? styles.legendLine : styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function Reading({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.reading}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.readingLabel}>{label}</Text>
      <Text style={styles.readingValue}>{value}</Text>
    </View>
  );
}

/** A donut with the total in the middle; the caller draws the legend. */
export function Ring({
  segments,
  centerValue,
  centerLabel,
  selected,
  size = 150,
}: {
  segments: { key: string; value: number; color: string }[];
  centerValue: string;
  centerLabel: string;
  selected: string | null;
  size?: number;
}) {
  const { t } = useTranslation();
  const total = segments.reduce((s, x) => s + x.value, 0);
  const R = 40;
  const C = 2 * Math.PI * R;
  const gapLen = segments.length > 1 ? 1.2 : 0;
  let acc = 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel={t('reports.salesByPaymentMethod')}>
        <G rotation={-90} origin="50, 50">
          <Circle cx="50" cy="50" r={R} fill="none" stroke={CHART_INK.grid} strokeWidth={14} />
          {total > 0
            ? segments.map(s => {
                const frac = s.value / total;
                const dash = Math.max(0, frac * C - gapLen);
                const el = (
                  <Circle
                    key={s.key}
                    cx="50"
                    cy="50"
                    r={R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={selected === s.key ? 16 : 14}
                    strokeDasharray={`${dash} ${C - dash}`}
                    strokeDashoffset={-acc * C}
                    opacity={selected && selected !== s.key ? 0.4 : 1}
                  />
                );
                acc += frac;
                return el;
              })
            : null}
        </G>
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <Text style={styles.ringValue} numberOfLines={1} adjustsFontSizeToFit>
          {centerValue}
        </Text>
        <Text style={styles.ringLabel}>{centerLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 14, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLine: { width: 16, height: 2, borderRadius: 1 },
  legendText: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary },
  readout: { minHeight: 46, justifyContent: 'center', marginBottom: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.background },
  readoutTitle: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  readoutRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 2, marginTop: 3 },
  readoutHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  reading: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  readingLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  readingValue: { fontFamily: fonts.bold, fontSize: 12, color: colors.text },
  ringCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  ringValue: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text },
  ringLabel: { fontFamily: fonts.regular, fontSize: 10.5, color: colors.textSecondary },
});
