import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

type AppHeaderProps = {
  readonly onBellPress: () => void;
  readonly accountLabel?: string;
  readonly onAccountPress?: () => void;
};

export function AppHeader({ onBellPress, accountLabel, onAccountPress }: AppHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.logoFrame}><Ionicons color={colors.olive} name="leaf-outline" size={22} /></View>

      <Text style={styles.title}>JoyfulMind</Text>

      {onAccountPress && (
        <Pressable
          accessibilityLabel={accountLabel ? `Tài khoản ${accountLabel}, đăng xuất` : 'Đăng nhập hoặc đăng ký'}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onAccountPress}
          style={styles.accountButton}
        >
          <Ionicons color={colors.olive} name={accountLabel ? 'person-circle-outline' : 'log-in-outline'} size={23} />
        </Pressable>
      )}

      <Pressable
        accessibilityLabel="Hỗ trợ ngay"
        accessibilityRole="button"
        hitSlop={10}
        onPress={onBellPress}
        style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}
      >
        <Ionicons name="help-circle-outline" color={colors.olive} size={25} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 66,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navigationBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
    zIndex: 2,
  },
  logoFrame: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  title: {
    flex: 1,
    marginLeft: 10,
    color: colors.black,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  bellButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  accountButton: {
    width: 42,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
});
