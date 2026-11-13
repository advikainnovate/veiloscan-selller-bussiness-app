import React from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { addDaysISO, formatDay } from '../../lib/date';
import { REMINDER_TYPES, type ReminderType } from '../../lib/orders';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

export interface CreditTerms {
  /** Days from today until the due date. */
  days: number;
  reminderEnabled: boolean;
  /** Days before the due date. */
  reminderDays: number;
  channels: ReminderType[];
  notes: string;
}

export const defaultCreditTerms = (maxDays: number): CreditTerms => ({
  days: Math.min(15, maxDays) || maxDays,
  reminderEnabled: true,
  reminderDays: 1,
  channels: ['IN_APP'],
  notes: '',
});

/** Why the terms can't be used, or null. */
export function creditTermsProblem(
  terms: CreditTerms,
  maxDays: number,
): string | null {
  if (terms.days < 1 || terms.days > maxDays)
    return i18n.t('orders.pickADueDateWithinMaxdays', { maxDays });
  if (terms.reminderEnabled && !terms.channels.length)
    return i18n.t('orders.chooseAtLeastOneReminderChannel');
  return null;
}

/** The `credit` part of a payment payload (amount added by the caller). */
export function creditPayload(terms: CreditTerms) {
  return {
    dueDate: addDaysISO(terms.days),
    reminderEnabled: terms.reminderEnabled,
    ...(terms.reminderEnabled
      ? { reminderDays: terms.reminderDays, reminderChannels: terms.channels }
      : {}),
    ...(terms.notes.trim() ? { notes: terms.notes.trim() } : {}),
  };
}

const REMINDER_DAY_OPTIONS = [0, 1, 2, 3, 7];

/** Customer Credit terms, as in the Seller Panel: due date, reminder and a note. */
export function CreditTermsForm({
  value,
  onChange,
  maxDays,
}: {
  value: CreditTerms;
  onChange: (next: CreditTerms) => void;
  maxDays: number;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<CreditTerms>) => onChange({ ...value, ...patch });
  const dayOptions = [
    ...new Set([7, 15, 30, maxDays].filter(d => d > 0 && d <= maxDays)),
  ].sort((a, b) => a - b);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('orders.dueIn')}</Text>
      <View style={styles.chips}>
        {dayOptions.map(days => (
          <Chip
            key={days}
            label={t('orders.daysDays', { days })}
            selected={value.days === days}
            onPress={() => set({ days })}
          />
        ))}
      </View>
      <Text style={styles.due}>
        {t('orders.dueDateUpToMaxdaysDays', { date: formatDay(addDaysISO(value.days)), maxDays })}</Text>

      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={styles.label}>{t('orders.remindTheCustomer')}</Text>
          <Text style={styles.hint}>{t('orders.beforeTheDueDate')}</Text>
        </View>
        <Switch
          value={value.reminderEnabled}
          onValueChange={reminderEnabled => set({ reminderEnabled })}
          trackColor={{ true: '#7c3aed', false: colors.border }}
          thumbColor={colors.white}
        />
      </View>
      {value.reminderEnabled ? (
        <>
          <View style={styles.chips}>
            {REMINDER_DAY_OPTIONS.map(days => (
              <Chip
                key={days}
                label={
                  days === 0
                    ? t('orders.onTheDay')
                    : t('orders.daysBefore', { count: days })
                }
                selected={value.reminderDays === days}
                onPress={() => set({ reminderDays: days })}
              />
            ))}
          </View>
          <Text style={styles.label}>{t('common.by')}</Text>
          <View style={styles.chips}>
            {REMINDER_TYPES.map(type => {
              const on = value.channels.includes(type.value);
              return (
                <Chip
                  key={type.value}
                  label={type.label}
                  selected={on}
                  multi
                  onPress={() =>
                    set({
                      channels: on
                        ? value.channels.filter(c => c !== type.value)
                        : [...value.channels, type.value],
                    })
                  }
                />
              );
            })}
          </View>
        </>
      ) : null}

      <TextInput
        value={value.notes}
        onChangeText={notes => set({ notes })}
        placeholder={t('common.noteOptional')}
        placeholderTextColor={colors.textMuted}
        selectionColor="#7c3aed"
        style={styles.notes}
      />
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  multi,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: selected } : { selected }}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 8 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: '#5b21b6' },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: '#7c3aed' },
  due: { fontFamily: fonts.medium, fontSize: 12.5, color: '#6d28d9' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  chipText: { fontFamily: fonts.semibold, fontSize: 12, color: '#6d28d9' },
  chipTextOn: { color: colors.white },
  switchRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notes: {
    marginTop: 4,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    backgroundColor: colors.white,
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: colors.text,
  },
});
