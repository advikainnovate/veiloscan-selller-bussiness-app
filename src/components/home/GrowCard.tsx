import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme';
import { Gradient } from '../ui/Gradient';
import { ArrowRightIcon } from '../icons';
import { RocketArt } from './Illustrations';

/** "Grow Your Business": a nudge to add products. */
export function GrowCard({ onAddProduct }: { onAddProduct: () => void }) {
  return (
    <View style={styles.card}>
      <Gradient colors={['#fff1e6', '#fffaf5', '#ffffff']} direction="horizontal" borderRadius={radius.xl} />
      <RocketArt size={60} />
      <View style={styles.copy}>
        <Text style={styles.title}>Grow Your Business</Text>
        <Text style={styles.text}>Add more products, run offers and reach more customers.</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onAddProduct}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>Add Product</Text>
        <ArrowRightIcon size={15} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#ffe4cc',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 15.5, fontFamily: fonts.extrabold, color: colors.text },
  text: { marginTop: 3, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    ...shadow.button,
  },
  buttonPressed: { backgroundColor: colors.secondaryDark },
  buttonText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
});
