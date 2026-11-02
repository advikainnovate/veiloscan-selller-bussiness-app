import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme';
import { formatRupees } from '../../lib/format';
import { lineProblem, priceText, quantityNotes, rulesHint, startOf, stockShortfall, type OrderLine } from '../../lib/order-lines';
import type { LineQuantityDiscount } from '../../lib/seller-order-pricing';
import { quantityLabel, round4, sellingOf } from '../../lib/selling';
import { BoxIcon, CloseIcon } from '../icons';

/** One item in a new order: quantity, its own discount, and the line total. */
export function LineCard({
  line,
  total,
  quantityDiscount,
  onQuantity,
  onDiscount,
  onRemove,
}: {
  line: OrderLine;
  total: number;
  quantityDiscount: LineQuantityDiscount | null;
  onQuantity: (quantity: number, uom: string) => void;
  onDiscount: (discount: string) => void;
  onRemove: () => void;
}) {
  const { item } = line;
  const problem = lineProblem(line, quantityDiscount?.discount ?? 0);
  const short = stockShortfall(line);
  const notes = quantityNotes(quantityDiscount);
  const rules = rulesHint(item);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <BoxIcon size={18} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={2}>
            {item.productName}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[item.variantLabel, priceText(item)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.productName}`} hitSlop={10} onPress={onRemove}>
          <CloseIcon size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <QuantityControl line={line} onChange={onQuantity} />
      {rules ? <Text style={styles.rules}>{rules}</Text> : null}

      <View style={styles.bottom}>
        <View style={styles.discountBox}>
          <Text style={styles.discountLabel}>Discount ₹</Text>
          <TextInput
            value={line.discount}
            onChangeText={text => onDiscount(text.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.secondary}
            accessibilityLabel={`Discount on ${item.productName}`}
            style={styles.discountInput}
          />
        </View>
        <Text style={styles.total}>{formatRupees(total)}</Text>
      </View>

      {notes.earned ? <Text style={styles.earned}>{notes.earned}</Text> : null}
      {notes.next ? <Text style={styles.next}>{notes.next}</Text> : null}
      {problem ? <Text style={styles.problem}>{problem}</Text> : null}
      {short ? <Text style={styles.short}>{short}</Text> : null}
    </View>
  );
}

/**
 * Whole units with − / + for fixed selling; an amount in any allowed unit
 * (with the quick-select amounts) for products sold by weight, volume, length…
 */
function QuantityControl({ line, onChange }: { line: OrderLine; onChange: (quantity: number, uom: string) => void }) {
  const selling = sellingOf(line.item);
  const [text, setText] = useState(String(line.quantity));

  // Follow outside changes (adding the same item again, a unit switch).
  useEffect(() => {
    setText(current => (Number(current) === line.quantity ? current : String(line.quantity)));
  }, [line.quantity]);

  function commit(value: string) {
    setText(value);
    const n = Number(value);
    if (value.trim() && Number.isFinite(n)) onChange(n, line.uom);
  }

  if (selling.method === 'FIXED') {
    const step = selling.step ?? 1;
    const min = startOf(line.item).quantity;
    return (
      <View style={styles.stepper}>
        <StepButton label="−" disabled={line.quantity - step < min} onPress={() => onChange(round4(line.quantity - step), line.uom)} />
        <TextInput
          value={text}
          onChangeText={value => commit(value.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          selectionColor={colors.secondary}
          accessibilityLabel={`Quantity of ${line.item.productName}`}
          style={styles.stepInput}
        />
        <StepButton label="+" onPress={() => onChange(round4(line.quantity + step), line.uom)} />
        {selling.sellingUom !== 'PCS' ? <Text style={styles.unit}>{selling.sellingUom}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.variable}>
      <View style={styles.amountRow}>
        <TextInput
          value={text}
          onChangeText={value => commit(value.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          selectionColor={colors.secondary}
          accessibilityLabel={`Amount of ${line.item.productName}`}
          style={styles.amountInput}
        />
        {selling.units.map(unit => (
          <Pressable
            key={unit.code}
            accessibilityRole="radio"
            accessibilityState={{ selected: unit.code === line.uom }}
            onPress={() => onChange(line.quantity, unit.code)}
            style={[styles.unitChip, unit.code === line.uom && styles.unitChipOn]}
          >
            <Text style={[styles.unitText, unit.code === line.uom && styles.unitTextOn]}>{unit.code}</Text>
          </Pressable>
        ))}
      </View>
      {selling.quickSelect.length ? (
        <View style={styles.quick}>
          {selling.quickSelect.map(q => (
            <Pressable key={`${q.quantity}${q.uom}`} onPress={() => onChange(q.quantity, q.uom)} style={styles.quickChip}>
              <Text style={styles.quickText}>{quantityLabel(q.quantity, q.uom)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function StepButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'More' : 'Less'}
      disabled={disabled}
      onPress={onPress}
      style={[styles.stepBtn, disabled && styles.stepBtnDisabled]}
    >
      <Text style={styles.stepBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.background },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  meta: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  rules: { marginTop: -4, fontFamily: fonts.regular, fontSize: 11.5, color: colors.textMuted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondaryLight,
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepBtnText: { fontFamily: fonts.bold, fontSize: 20, color: colors.secondary, marginTop: -2 },
  stepInput: {
    width: 64,
    height: 38,
    paddingVertical: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
  },
  unit: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  variable: { gap: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  amountInput: {
    width: 84,
    height: 38,
    paddingVertical: 0,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
  },
  unitChip: { paddingHorizontal: 10, height: 32, borderRadius: radius.full, justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  unitChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  unitText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  unitTextOn: { color: colors.white },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.primaryLight },
  quickText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primary },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  discountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  discountLabel: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  discountInput: { width: 64, height: '100%', paddingVertical: 0, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  total: { marginLeft: 'auto', fontFamily: fonts.extrabold, fontSize: 16, color: colors.text },
  earned: { fontFamily: fonts.medium, fontSize: 12, color: colors.successDark },
  next: { fontFamily: fonts.medium, fontSize: 11.5, color: '#4f46e5' },
  problem: { fontFamily: fonts.medium, fontSize: 12, color: colors.error },
  short: { fontFamily: fonts.medium, fontSize: 12, color: colors.warningDark },
});
