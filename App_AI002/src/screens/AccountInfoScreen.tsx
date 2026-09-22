import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { deleteHistory, recordStorageConsent, revokeStorageConsent, type AuthUser } from '../services/api';
import { colors } from '../theme/colors';

type AccountInfoScreenProps = {
  readonly user: AuthUser | null;
  readonly onLogout: () => void;
  readonly onBack: () => void;
  readonly accessToken?: string;
  readonly onUserChange?: (user: AuthUser) => void;
  readonly onHistoryDeleted?: () => void;
};

export function AccountInfoScreen({ user, onLogout, onBack, accessToken, onUserChange, onHistoryDeleted }: AccountInfoScreenProps) {
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyError, setPrivacyError] = useState('');
  const [privacyNotice, setPrivacyNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleConsent = async () => {
    if (!accessToken) return;
    setPrivacyBusy(true); setPrivacyError(''); setPrivacyNotice('');
    try {
      const updated = user?.consent_at
        ? await revokeStorageConsent(accessToken)
        : await recordStorageConsent(accessToken);
      onUserChange?.(updated);
      setPrivacyNotice(updated.consent_at
        ? 'Lịch sử sẽ được lưu từ những tin nhắn tiếp theo.'
        : 'Đã tắt lưu lịch sử. Dữ liệu đã lưu trước đó vẫn còn cho đến khi bạn xóa.');
    } catch (reason) {
      setPrivacyError(reason instanceof Error ? reason.message : 'Chưa cập nhật được lựa chọn lưu trữ.');
    } finally {
      setPrivacyBusy(false);
    }
  };

  const removeHistory = async () => {
    if (!accessToken) return;
    setPrivacyBusy(true); setPrivacyError('');
    try {
      await deleteHistory(accessToken);
      onHistoryDeleted?.();
      setConfirmDelete(false);
      setPrivacyNotice('Đã xóa lịch sử trò chuyện đã lưu.');
    } catch (reason) {
      setPrivacyError(reason instanceof Error ? reason.message : 'Chưa xóa được lịch sử.');
    } finally {
      setPrivacyBusy(false);
    }
  };

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

        <View style={styles.privacyCard}>
          <Text accessibilityRole="header" style={styles.teamTitle}>Lưu lịch sử trò chuyện</Text>
          <Text style={styles.teamDescription}>{user?.consent_at
            ? 'Đang bật. Tin nhắn mới được lưu vào tài khoản; email và số điện thoại được che trước khi lưu.'
            : 'Đang tắt. Tin nhắn mới không được lưu vào cơ sở dữ liệu. Lịch sử đã lưu trước đây vẫn còn cho đến khi bạn xóa.'}</Text>
          {!!privacyError && <Text accessibilityRole="alert" style={styles.privacyError}>{privacyError}</Text>}
          {!!privacyNotice && <Text accessibilityLiveRegion="polite" style={styles.privacyNotice}>{privacyNotice}</Text>}
          {user && <Pressable accessibilityRole="button" disabled={privacyBusy} onPress={() => void toggleConsent()} style={styles.privacyButton}>
            {privacyBusy ? <ActivityIndicator color={colors.olive} /> : <Text style={styles.privacyButtonText}>{user.consent_at ? 'Ngừng lưu lịch sử' : 'Đồng ý lưu lịch sử'}</Text>}
          </Pressable>}
          {user && <Pressable accessibilityRole="button" disabled={privacyBusy} onPress={() => setConfirmDelete(true)} style={styles.deleteButton}>
            <Text style={styles.deleteText}>Xóa toàn bộ lịch sử đã lưu</Text>
          </Pressable>}
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
            Dự án được phát triển bởi các sinh viên UIT trong môn AI002
          </Text>
          <View style={styles.creditRow}>
            <Ionicons color={colors.olive} name="code-slash-outline" size={18} />
            <Text style={styles.credit}>Nhóm phát triển JoyfulMind</Text>
          </View>
          <Text style={styles.teamNote}>{'Nguyễn Võ Anh Tú – 26410317\nNguyễn Xuân Kiên – 26410229\nNguyễn Chí Bảo – 26410169\nTrần Phúc Hậu – 26410207\nVõ Văn Giang – 26410202'}</Text>
        </View>

        <Pressable accessibilityRole="button" onPress={onLogout} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
          <Ionicons color={colors.white} name="log-out-outline" size={21} />
          <Text style={styles.logoutText}>{user ? 'Đăng xuất' : 'Quay lại đăng nhập'}</Text>
        </Pressable>
      </View>
      <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => { if (!privacyBusy) setConfirmDelete(false); }}>
        <View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}>
          <Text accessibilityRole="header" style={styles.teamTitle}>Xóa lịch sử đã lưu?</Text>
          <Text style={styles.teamDescription}>Toàn bộ cuộc trò chuyện trong tài khoản sẽ bị xóa và không thể khôi phục.</Text>
          <View style={styles.dialogActions}>
            <Pressable accessibilityRole="button" disabled={privacyBusy} onPress={() => setConfirmDelete(false)} style={styles.privacyButton}><Text style={styles.privacyButtonText}>Hủy</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={privacyBusy} onPress={() => void removeHistory()} style={styles.deleteConfirm}>
              {privacyBusy ? <ActivityIndicator color="white" /> : <Text style={styles.deleteConfirmText}>Xóa lịch sử</Text>}
            </Pressable>
          </View>
        </View></View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 22, paddingBottom: 36 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 18 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { color: colors.oliveDark, fontSize: 15, fontWeight: '700' },
  profileCard: { alignItems: 'center', padding: 22, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.outline, gap: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  title: { marginTop: 7, color: colors.black, fontSize: 25, fontWeight: '800' },
  subtitle: { color: colors.darkText, fontSize: 14, textAlign: 'center' },
  userRow: { width: '100%', minHeight: 63, flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 14, padding: 13, borderRadius: 16, backgroundColor: colors.background },
  userCopy: { flex: 1 },
  label: { color: colors.darkText, fontSize: 12 },
  username: { marginTop: 3, color: colors.black, fontSize: 17, fontWeight: '800' },
  status: { marginTop: 3, color: colors.green, fontSize: 14, fontWeight: '700' },
  teamCard: { padding: 18, borderRadius: 16, backgroundColor: colors.cream, gap: 15 },
  teamHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teamIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush },
  teamTitle: { color: colors.black, fontSize: 19, fontWeight: '800' },
  teamSubtitle: { marginTop: 2, color: colors.darkText, fontSize: 13 },
  teamDescription: { color: colors.darkText, fontSize: 15, lineHeight: 23 },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  credit: { color: colors.oliveDark, fontSize: 14, fontWeight: '700' },
  teamNote: { color: colors.darkText, fontSize: 12, lineHeight: 18 },
  privacyCard: { padding: 18, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.outline, gap: 12 },
  privacyButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.outline },
  privacyButtonText: { color: colors.olive, fontSize: 14, fontWeight: '700' },
  deleteButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: colors.burgundy, fontSize: 14, fontWeight: '600' },
  privacyError: { color: colors.burgundy, fontSize: 13, lineHeight: 19 },
  privacyNotice: { color: colors.green, fontSize: 13, lineHeight: 19 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: 'rgba(25, 35, 29, 0.45)' },
  dialog: { width: '100%', maxWidth: 440, padding: 22, gap: 12, borderRadius: 16, backgroundColor: colors.white },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  deleteConfirm: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.burgundy },
  deleteConfirmText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  logout: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 10, backgroundColor: colors.burgundy },
  logoutText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});
