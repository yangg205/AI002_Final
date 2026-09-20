import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AuthUser } from '../services/api';
import { colors } from '../theme/colors';

type AccountInfoScreenProps = {
  readonly user: AuthUser | null;
  readonly onLogout: () => void;
  readonly onBack: () => void;
};

export function AccountInfoScreen({ user, onLogout, onBack }: AccountInfoScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} style={styles.back}>
          <Ionicons color={colors.oliveDark} name="arrow-back" size={21} />
          <Text style={styles.backText}>Quay lại ứng dụng</Text>
        </Pressable>

        <View style={styles.profileCard}>
          <View style={styles.avatar}><Ionicons color={colors.oliveDark} name="person" size={38} /></View>
          <Text accessibilityRole="header" style={styles.title}>Thông tin tài khoản</Text>
          <Text style={styles.subtitle}>Thông tin phiên sử dụng JoyfulMind</Text>
          <View style={styles.userRow}>
            <Ionicons color={colors.olive} name="person-circle-outline" size={24} />
            <View style={styles.userCopy}>
              <Text style={styles.label}>Tên đăng nhập</Text>
              <Text style={styles.username}>{user?.username ?? 'Khách'}</Text>
            </View>
          </View>
          <View style={styles.userRow}>
            <Ionicons color={colors.green} name="checkmark-circle-outline" size={24} />
            <View style={styles.userCopy}>
              <Text style={styles.label}>Trạng thái</Text>
              <Text style={styles.status}>{user ? 'Đã đăng nhập' : 'Đang sử dụng với tư cách khách'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.teamCard}>
          <View style={styles.teamHeading}>
            <View style={styles.teamIcon}><Ionicons color={colors.burgundy} name="people-outline" size={23} /></View>
            <View style={styles.userCopy}>
              <Text accessibilityRole="header" style={styles.teamTitle}>Nhóm phát triển</Text>
              <Text style={styles.teamSubtitle}>Ứng dụng JoyfulMind</Text>
            </View>
          </View>
          <Text style={styles.teamDescription}>
            JoyfulMind được xây dựng như một không gian hỗ trợ chia sẻ cảm xúc và chăm sóc sức khỏe tinh thần.
          </Text>
          <View style={styles.creditRow}>
            <Ionicons color={colors.olive} name="code-slash-outline" size={18} />
            <Text style={styles.credit}>Nhóm phát triển JoyfulMind</Text>
          </View>
          <Text style={styles.teamNote}>Thông tin thành viên cụ thể chưa được cung cấp trong ứng dụng.</Text>
        </View>

        <Pressable accessibilityRole="button" onPress={onLogout} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
          <Ionicons color={colors.white} name="log-out-outline" size={21} />
          <Text style={styles.logoutText}>{user ? 'Đăng xuất' : 'Quay lại đăng nhập'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 22, paddingBottom: 36 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 18 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { color: colors.oliveDark, fontSize: 15, fontWeight: '700' },
  profileCard: { alignItems: 'center', padding: 25, borderRadius: 26, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.creamMuted, gap: 8 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0B9' },
  title: { marginTop: 7, color: colors.black, fontSize: 25, fontWeight: '800' },
  subtitle: { color: colors.darkText, fontSize: 14, textAlign: 'center' },
  userRow: { width: '100%', minHeight: 63, flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 14, padding: 13, borderRadius: 16, backgroundColor: colors.background },
  userCopy: { flex: 1 },
  label: { color: colors.darkText, fontSize: 12 },
  username: { marginTop: 3, color: colors.black, fontSize: 17, fontWeight: '800' },
  status: { marginTop: 3, color: colors.green, fontSize: 14, fontWeight: '700' },
  teamCard: { padding: 21, borderRadius: 24, backgroundColor: colors.cream, gap: 15 },
  teamHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teamIcon: { width: 45, height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush },
  teamTitle: { color: colors.black, fontSize: 19, fontWeight: '800' },
  teamSubtitle: { marginTop: 2, color: colors.darkText, fontSize: 13 },
  teamDescription: { color: colors.darkText, fontSize: 15, lineHeight: 23 },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  credit: { color: colors.oliveDark, fontSize: 14, fontWeight: '700' },
  teamNote: { color: colors.darkText, fontSize: 12, lineHeight: 18 },
  logout: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 18, backgroundColor: colors.burgundy },
  logoutText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});
