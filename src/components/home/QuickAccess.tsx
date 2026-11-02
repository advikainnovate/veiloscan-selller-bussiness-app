import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { MENU_ITEMS, type MenuItem } from '../../navigation/menu';
import { openMenuKey } from '../../navigation/navigationRef';
import { Button } from '../ui/Button';
import { CheckIcon, SlidersIcon } from '../icons';

export const MAX_QUICK_ACCESS = 8;

// A colour pair per menu item (by its place in the menu), so a page keeps its
// colour wherever it appears.
const TONES = [
  { bg: '#fff1e6', fg: '#ff6b00' },
  { bg: '#e0f2fe', fg: '#2563eb' },
  { bg: '#f3e8ff', fg: '#9333ea' },
  { bg: '#dcfce7', fg: '#16a34a' },
  { bg: '#fee2e2', fg: '#dc2626' },
  { bg: '#fef3c7', fg: '#d97706' },
  { bg: '#e0e7ff', fg: '#4f46e5' },
  { bg: '#ffedd5', fg: '#ea580c' },
];
function toneOf(item: MenuItem) {
  return TONES[MENU_ITEMS.indexOf(item) % TONES.length];
}

/** The quick-access grid with its saved choice; up to eight pages the role can open (not tabs). */
export function QuickAccess() {
  const { user, hasPermission } = useAuth();
  const storageKey = `home.quickAccess.${user?.id ?? user?.email ?? 'me'}`;
  // Pages the user can open that aren't already a bottom tab.
  const available = useMemo(
    () => MENU_ITEMS.filter(item => !item.tab && (!item.permission || hasPermission(item.permission))),
    [hasPermission],
  );
  const [saved, setSaved] = useState<string[] | null>(null);
  const [customizing, setCustomizing] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then(
      raw => setSaved(raw ? (JSON.parse(raw) as string[]) : null),
      () => setSaved(null),
    );
  }, [storageKey]);

  // The saved choice (dropping pages the role no longer allows), else the first eight.
  const shown = saved
    ? saved.map(key => available.find(item => item.key === key)).filter((item): item is MenuItem => !!item)
    : available.slice(0, MAX_QUICK_ACCESS);

  function save(keys: string[] | null) {
    setSaved(keys);
    setCustomizing(false);
    if (keys) AsyncStorage.setItem(storageKey, JSON.stringify(keys));
    else AsyncStorage.removeItem(storageKey);
  }

  if (!available.length) return null;

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Quick Access</Text>
        <Text style={styles.subtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          Manage your store faster
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setCustomizing(true)}
          hitSlop={8}
          style={({ pressed }) => [styles.customize, pressed && styles.pressedText]}
        >
          <SlidersIcon size={17} color={colors.secondary} />
          <Text style={styles.customizeText}>Customize</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {shown.map(item => {
          const { bg, fg } = toneOf(item);
          const Icon = item.icon;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              onPress={() => openMenuKey(item.key)}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            >
              <View style={[styles.tileIcon, { backgroundColor: bg }]}>
                <Icon size={24} color={fg} />
              </View>
              <Text style={styles.tileText} numberOfLines={2}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
        {!shown.length ? (
          <Pressable onPress={() => setCustomizing(true)} style={styles.empty}>
            <Text style={styles.emptyText}>Tap Customize to choose your shortcuts.</Text>
          </Pressable>
        ) : null}
      </View>

      <CustomizeSheet
        visible={customizing}
        available={available}
        selected={shown.map(item => item.key)}
        onClose={() => setCustomizing(false)}
        onSave={save}
      />
    </View>
  );
}

function CustomizeSheet({
  visible,
  available,
  selected: initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  available: MenuItem[];
  selected: string[];
  onClose: () => void;
  /** null resets to the default choice. */
  onSave: (keys: string[] | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(initial);
  const full = selected.length >= MAX_QUICK_ACCESS;

  // Start from the current choice each time the sheet opens.
  useEffect(() => {
    if (visible) setSelected(initial);
    // Only on open: `initial` is rebuilt on every render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function toggle(key: string) {
    setSelected(current =>
      current.includes(key) ? current.filter(k => k !== key) : current.length < MAX_QUICK_ACCESS ? [...current, key] : current,
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <Text style={styles.sheetTitle}>Customize Quick Access</Text>
        <Text style={styles.sheetText}>
          Choose up to {MAX_QUICK_ACCESS} shortcuts for your Home screen ({selected.length}/{MAX_QUICK_ACCESS}).
        </Text>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {available.map(item => {
            const checked = selected.includes(item.key);
            const disabled = !checked && full;
            const { bg, fg } = toneOf(item);
            const Icon = item.icon;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked, disabled }}
                onPress={() => toggle(item.key)}
                disabled={disabled}
                style={[styles.row, checked && styles.rowChecked, disabled && styles.rowDisabled]}
              >
                <View style={[styles.rowIcon, { backgroundColor: bg }]}>
                  <Icon size={18} color={fg} />
                </View>
                <Text style={styles.rowText}>{item.label}</Text>
                <View style={[styles.check, checked && styles.checkOn]}>
                  {checked ? <CheckIcon size={13} color={colors.white} strokeWidth={3} /> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable onPress={() => onSave(null)} hitSlop={8} style={styles.reset}>
            <Text style={styles.resetText}>Reset to default</Text>
          </Pressable>
          <Button title="Save" onPress={() => onSave(selected)} style={styles.saveBtn} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontSize: 17, fontFamily: fonts.extrabold, color: colors.text },
  subtitle: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  customize: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pressedText: { opacity: 0.6 },
  customizeText: { fontFamily: fonts.bold, fontSize: 13, color: colors.secondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '22.5%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  tilePressed: { backgroundColor: colors.background },
  tileIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontSize: 12, lineHeight: 15, fontFamily: fonts.semibold, color: colors.text, textAlign: 'center' },
  empty: { flex: 1, padding: 18, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(3,19,41,0.45)' },
  sheet: {
    maxHeight: '80%',
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.text },
  sheetText: { marginTop: 4, fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  list: { marginTop: 14 },
  listContent: { gap: 8, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowChecked: { borderColor: colors.secondarySoft, backgroundColor: '#fffaf5' },
  rowDisabled: { opacity: 0.45 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  actions: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 16 },
  reset: { paddingVertical: 8 },
  resetText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  saveBtn: { flex: 1 },
});
