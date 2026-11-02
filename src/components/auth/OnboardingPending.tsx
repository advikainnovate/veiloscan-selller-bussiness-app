import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, fonts } from '../../theme';
import { ONBOARDING_STEPS } from '../../lib/seller-access';
import { CheckCircleIcon, ClockIcon } from '../icons';

/**
 * Why a Sales Portal seller can't sign in yet: their onboarding steps, with
 * the pending one highlighted and the API's explanation under it.
 */
export function OnboardingPending({ step, label, message }: { step: number; label: string; message: string }) {
  return (
    <View style={styles.box}>
      <View style={styles.titleRow}>
        <ClockIcon size={16} color={colors.warningDark} />
        <Text style={styles.title}>{label}</Text>
      </View>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.steps}>
        {ONBOARDING_STEPS.map((name, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <View key={name} style={styles.stepRow}>
              {done ? (
                <CheckCircleIcon size={16} color={colors.successDark} />
              ) : (
                <View style={[styles.dot, current ? styles.dotCurrent : null]}>
                  <Text style={[styles.dotText, current ? styles.dotTextCurrent : null]}>{i + 1}</Text>
                </View>
              )}
              <Text
                style={[
                  styles.stepText,
                  done ? styles.stepDone : current ? styles.stepCurrent : styles.stepTodo,
                ]}
              >
                {name}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    padding: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontFamily: fonts.bold, color: colors.warningDark },
  message: { marginTop: 4, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.warningDark },
  steps: { marginTop: 12, gap: 7 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCurrent: { backgroundColor: colors.warning },
  dotText: { fontSize: 10, fontFamily: fonts.bold, color: colors.textSecondary },
  dotTextCurrent: { color: colors.white },
  stepText: { fontFamily: fonts.regular, fontSize: 13 },
  stepDone: { color: colors.successDark },
  stepCurrent: { color: '#78350f', fontFamily: fonts.bold },
  stepTodo: { color: colors.textMuted },
});
