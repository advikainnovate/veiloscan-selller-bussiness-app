import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { Sheet } from '../ui/Sheet';
import { CheckIcon, ChevronDownIcon, StoreIcon } from '../icons';

/** Choose the store the whole app works in. */
export function StorePickerSheet({ visible, onClose, onSwitched }: { visible: boolean; onClose: () => void; onSwitched?: () => void }) {
  const { stores, current, select } = useStore();
  const toast = useToast();
  return (
    <Sheet
      visible={visible}
      title="Switch store"
      subtitle="Orders, customers, products and reports show the store you pick."
      onClose={onClose}
    >
      <View style={styles.options}>
        {stores.map(store => {
          const on = store.id === current?.id;
          return (
            <Pressable
              key={store.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${store.name}${on ? ', current store' : ''}`}
              onPress={() => {
                onClose();
                if (on) return;
                select(store.id);
                onSwitched?.();
                toast(`Switched to ${store.name}`);
              }}
              style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && !on && styles.optionPressed]}
            >
              <View style={[styles.optionIcon, on && styles.optionIconOn]}>
                <StoreIcon size={18} color={on ? colors.white : colors.textSecondary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.optionName} numberOfLines={1}>
                  {store.name}
                </Text>
                {store.code || (store.status && store.status !== 'ACTIVE') ? (
                  <Text style={styles.optionMeta} numberOfLines={1}>
                    {[store.code, store.status && store.status !== 'ACTIVE' ? store.status.toLowerCase() : null].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              {on ? <CheckIcon size={18} color={colors.secondary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

/** The slim bar under the header: the current store, tap to switch. Only with more than one store. */
export function StoreBar() {
  const { stores, current } = useStore();
  const [open, setOpen] = useState(false);
  if (stores.length < 2 || !current) return null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Store: ${current.name}. Switch store`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.bar, pressed && styles.barPressed]}
      >
        <StoreIcon size={15} color={colors.secondary} />
        <Text style={styles.barLabel}>Store</Text>
        <Text style={styles.barName} numberOfLines={1}>
          {current.name}
        </Text>
        <Text style={styles.barAction}>Switch</Text>
        <ChevronDownIcon size={14} color={colors.secondary} strokeWidth={2.2} />
      </Pressable>
      <StorePickerSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 14,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryLight,
  },
  barPressed: { backgroundColor: colors.secondarySoft },
  barLabel: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  barName: { flex: 1, fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  barAction: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.secondary },
  options: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionOn: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  optionPressed: { backgroundColor: colors.background },
  optionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  optionIconOn: { backgroundColor: colors.secondary },
  optionName: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  optionMeta: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
});
