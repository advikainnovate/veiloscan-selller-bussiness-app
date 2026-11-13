import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import type { SessionUser } from '../../lib/session';
import i18n from '../../i18n';

export function displayName(user: SessionUser | null) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || i18n.t('layout.seller');
}

function initials(user: SessionUser | null) {
  const parts = [user?.firstName, user?.lastName].filter(Boolean) as string[];
  if (parts.length) return parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (user?.email?.[0] ?? 'S').toUpperCase();
}

/** The user's initials on an orange circle. */
export function Avatar({ user, size = 36 }: { user: SessionUser | null; size?: number }) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials(user)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.white, fontFamily: fonts.bold },
});
