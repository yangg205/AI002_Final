import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

type AppHeaderProps = {
  readonly onBellPress: () => void;
  readonly accountLabel?: string;
  readonly onAccountPress?: () => void;
};

export function AppHeader({ onBellPress, accountLabel, onAccountPress }: AppHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.logoFrame}>
        <Image
          accessibilityLabel="Linh vật JoyfulMind"
          accessible
          resizeMode="contain"
          source={require('../../assets/illustrations/joy-mascot.png')}
          style={styles.logoImage}
        />
      </View>

      <Text style={styles.title}>JoyfulMind</Text>

      {onAccountPress && (
        <Pressable
          accessibilityLabel={accountLabel ? `Tài khoản ${accountLabel}, đăng xuất` : 'Đăng nhập hoặc đăng ký'}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onAccountPress}
          style={styles.accountButton}
        >
          <Ionicons color="#625300" name={accountLabel ? 'person-circle-outline' : 'log-in-outline'} size={26} />
        </Pressable>
      )}

      <Pressable
        accessibilityLabel="Hỗ trợ ngay"
        accessibilityRole="button"
        hitSlop={10}
        onPress={onBellPress}
        style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}
      >
        <Ionicons name="heart-circle-outline" color="#625300" size={30} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 78,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navigationBackground,
    shadowColor: '#7B6500',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 2,
  },
  logoFrame: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0B9',
    overflow: 'hidden',
  },
  logoImage: {
    width: 46,
    height: 46,
  },
  title: {
    flex: 1,
    marginLeft: 12,
    color: '#625300',
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  bellButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
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
