import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';

type SaveResultButtonProps = {
  readonly onPress: () => void;
  readonly disabled?: boolean;
};

export function SaveResultButton({ onPress, disabled = false }: SaveResultButtonProps) {
  return (
    <Pressable
      accessibilityLabel="Lưu Kết Quả"
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={styles.label}>Lưu Kết Quả</Text>
      <Ionicons color="#FFFFFF" name="arrow-forward" size={30} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    borderRadius: 32,
    backgroundColor: colors.olive,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.55,
  },
});
