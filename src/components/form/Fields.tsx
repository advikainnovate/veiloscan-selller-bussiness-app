import React, { useMemo, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, fonts, radius } from '../../theme';
import { formatDay } from '../../lib/date';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { SearchBar } from '../list/ListParts';
import { CalendarIcon, CheckIcon, ChevronDownIcon } from '../icons';

// Form building blocks for the longer editors (product wizard): a labelled
// field, text input, single-choice chips, a searchable picker and a date.

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {children}
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Input({ style, multiline, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.secondary}
      multiline={multiline}
      style={[styles.input, multiline && styles.multiline, style]}
      {...props}
    />
  );
}

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

/** One of a few options, as chips. */
export function Choices({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.choices}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled }}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            style={[
              styles.choice,
              on && styles.choiceOn,
              disabled && styles.disabled,
            ]}
          >
            <Text style={[styles.choiceText, on && styles.choiceTextOn]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A select that opens a searchable list in a sheet. */
export function SelectField({
  label,
  required,
  hint,
  placeholder = 'Select…',
  value,
  options,
  onChange,
  disabled,
  emptyText = 'Nothing to choose from',
  allowClear,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  disabled?: boolean;
  emptyText?: string;
  allowClear?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find(o => o.value === value);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <Field label={label} required={required} hint={hint}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? 'not chosen'}`}
        disabled={disabled}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        style={[styles.select, disabled && styles.disabled]}
      >
        <Text
          style={[styles.selectText, !selected && styles.placeholder]}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDownIcon size={16} color={colors.textMuted} />
      </Pressable>
      <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
        {options.length > 8 ? (
          <SearchBar value={query} onChange={setQuery} placeholder="Search…" />
        ) : null}
        {allowClear ? (
          <OptionRow
            label={allowClear}
            on={!value}
            onPress={() => {
              onChange('');
              setOpen(false);
            }}
          />
        ) : null}
        {shown.length ? (
          shown.map(o => (
            <OptionRow
              key={o.value}
              label={o.label}
              hint={o.hint}
              on={o.value === value}
              onPress={() => {
                onChange(o.value);
                setOpen(false);
              }}
            />
          ))
        ) : (
          <Text style={styles.hint}>{emptyText}</Text>
        )}
      </Sheet>
    </Field>
  );
}

function OptionRow({
  label,
  hint,
  on,
  onPress,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.option, on && styles.optionOn]}
    >
      <View style={styles.flex}>
        <Text style={[styles.optionText, on && styles.optionTextOn]}>
          {label}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {on ? (
        <CheckIcon size={16} color={colors.secondary} strokeWidth={2.6} />
      ) : null}
    </Pressable>
  );
}

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
const fromISO = (s: string) => (s ? new Date(`${s}T00:00:00`) : new Date());

/** A date (YYYY-MM-DD), picked with the phone's own calendar. */
export function DateField({
  label,
  required,
  hint,
  value,
  onChange,
  minimumDate,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  value: string;
  onChange: (iso: string) => void;
  minimumDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(fromISO(value));
  return (
    <Field label={label} required={required} hint={hint}>
      <View style={styles.dateRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${
            value ? formatDay(value) : 'not set'
          }`}
          onPress={() => {
            setDraft(fromISO(value));
            setOpen(true);
          }}
          style={[styles.select, styles.flex]}
        >
          <CalendarIcon size={16} color={colors.textMuted} />
          <Text style={[styles.selectText, !value && styles.placeholder]}>
            {value ? formatDay(value) : 'Choose a date'}
          </Text>
        </Pressable>
        {value && !required ? (
          <Pressable
            accessibilityLabel={`Clear ${label}`}
            onPress={() => onChange('')}
            hitSlop={8}
          >
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draft}
          mode="date"
          minimumDate={minimumDate}
          onChange={(event, date) => {
            setOpen(false);
            if (event.type === 'set' && date) onChange(toISO(date));
          }}
        />
      ) : null}
      {Platform.OS === 'ios' ? (
        <Sheet
          visible={open}
          title={label}
          onClose={() => setOpen(false)}
          footer={
            <Button
              title="Done"
              onPress={() => {
                onChange(toISO(draft));
                setOpen(false);
              }}
            />
          }
        >
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            minimumDate={minimumDate}
            accentColor={colors.secondary}
            onChange={(_, date) => date && setDraft(date)}
          />
        </Sheet>
      ) : null}
    </Field>
  );
}

/** A titled group of fields inside a step. */
export function Section({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.flex}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? (
            <Text style={styles.sectionSubtitle}>{subtitle}</Text>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  field: { gap: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  required: { color: colors.error },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  error: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.error,
  },
  input: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    color: colors.text,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    paddingHorizontal: 13,
    minHeight: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  choiceOn: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondaryLight,
  },
  choiceText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  choiceTextOn: { color: colors.secondaryDark },
  disabled: { opacity: 0.5 },
  select: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    color: colors.text,
  },
  placeholder: { color: colors.textMuted },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionOn: { backgroundColor: '#fffaf5' },
  optionText: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.text },
  optionTextOn: { fontFamily: fonts.bold, color: colors.secondaryDark },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clear: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  section: {
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.text },
  sectionSubtitle: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
