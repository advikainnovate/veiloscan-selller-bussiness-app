import React, { type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, fonts } from '../../theme';
import { LockIcon, type IconProps } from '../icons';

/**
 * The body of a page whose module isn't in the app yet, or that the user's
 * role can't open.
 */
export function ComingSoon({ label, icon: Icon, allowed }: { label: string; icon: ComponentType<IconProps>; allowed: boolean }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={[styles.badge, !allowed && styles.badgeLocked]}>
          {allowed ? <Icon size={30} color={colors.secondary} /> : <LockIcon size={28} color={colors.textSecondary} />}
        </View>
        <Text style={styles.title}>{allowed ? label : 'No access'}</Text>
        <Text style={styles.text}>
          {allowed
            ? `${label} is coming to the app soon. Until then you can manage it from the Seller Panel on the web.`
            : `Your role doesn't include ${label}. Ask your store owner to give you access.`}
        </Text>
        {allowed ? (
          <View style={styles.chip}>
            <Text style={styles.chipText}>Coming soon</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, justifyContent: 'center' },
  card: { alignItems: 'center', padding: 28, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadow.card },
  badge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondaryLight,
    borderWidth: 1,
    borderColor: colors.secondarySoft,
  },
  badgeLocked: { backgroundColor: colors.primaryLight, borderColor: colors.border },
  title: { marginTop: 16, fontSize: 20, fontFamily: fonts.extrabold, color: colors.text, textAlign: 'center' },
  text: { marginTop: 8, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSecondary, textAlign: 'center' },
  chip: { marginTop: 16, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.secondaryLight },
  chipText: { fontSize: 12, fontFamily: fonts.bold, color: colors.secondaryDark, letterSpacing: 0.3 },
});
