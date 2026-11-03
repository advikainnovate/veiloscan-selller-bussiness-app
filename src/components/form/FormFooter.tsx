import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow } from '../../theme';
import { Button } from '../ui/Button';

/** A form's sticky save bar: an optional summary line, Cancel and the save button. */
export function FormFooter({
  summary,
  title,
  onSave,
  onCancel,
  loading,
  disabled,
}: {
  summary?: string;
  title: string;
  onSave: () => void;
  onCancel: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
      {summary ? (
        <Text style={styles.summary} numberOfLines={1}>
          {summary}
        </Text>
      ) : null}
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={onCancel} disabled={loading} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <View style={styles.flex}>
          <Button title={title} loading={loading} disabled={disabled} onPress={onSave} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { gap: 8, paddingHorizontal: 16, paddingTop: 10, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, ...shadow.raised },
  summary: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancel: { height: 52, paddingHorizontal: 18, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  cancelText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
});
