import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import type { AppTab } from '../navigation/tabs';
import { ApiError, deleteTrustedContact, getTrustedContact, saveTrustedContact, type TrustedContact } from '../services/api';
import {
  deleteLocalTrustedContact,
  hasPendingTrustedContactSync,
  loadLocalTrustedContact,
  saveLocalTrustedContact,
} from '../services/trustedContact';
import { colors } from '../theme/colors';

type IconName = ComponentProps<typeof Ionicons>['name'];

function canSaveContactOffline(reason: unknown): reason is ApiError {
  return reason instanceof ApiError && (
    reason.kind === 'network' || reason.kind === 'timeout' || reason.status === 503
  );
}

type AlertScreenProps = {
  readonly onNotify: (text: string) => void;
  readonly onNavigate: (tab: AppTab) => void;
  readonly accountKey?: string;
  readonly accessToken?: string;
  readonly active?: boolean;
};

type SupportActionProps = {
  readonly backgroundColor: string;
  readonly icon: IconName;
  readonly iconColor: string;
  readonly label: string;
  readonly onPress: () => void;
  readonly subtitle: string;
  readonly testID: string;
  readonly textColor: string;
};

function SupportAction({
  backgroundColor,
  icon,
  iconColor,
  label,
  onPress,
  subtitle,
  testID,
  textColor,
}: SupportActionProps) {
  return (
    <Pressable
      accessibilityHint={subtitle}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.supportAction,
        { backgroundColor },
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <View style={styles.supportIconCircle}>
        <Ionicons color={iconColor} name={icon} size={31} />
      </View>

      <View style={styles.supportCopy}>
        <Text style={[styles.supportLabel, { color: textColor }]}>{label}</Text>
        <Text style={[styles.supportSubtitle, { color: textColor }]}>
          {subtitle}
        </Text>
      </View>

      <Ionicons color={textColor} name="chevron-forward" size={26} />
    </Pressable>
  );
}

export function AlertScreen({ onNavigate, onNotify, accountKey, accessToken, active = true }: AlertScreenProps) {
  const localContactKey = accountKey ?? 'guest';
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const [contact, setContact] = useState<TrustedContact | null>(null);
  const [editingContact, setEditingContact] = useState(false);
  const [contactLoading, setContactLoading] = useState(true);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSyncMessage, setContactSyncMessage] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    if (!active) return () => { current = false; };
    setContactLoading(true);
    setContactError(null);
    setContactSyncMessage(null);
    const showContact = (saved: TrustedContact | null) => {
      if (!current) return;
      setContact(saved);
      setContactName(saved?.name ?? '');
      setContactPhone(saved?.phone ?? '');
      setEditingContact(!saved);
    };
    const load = async () => {
      try {
        if (!accessToken) {
          showContact(await loadLocalTrustedContact(localContactKey));
          return;
        }

        const saved = await getTrustedContact(accessToken);
        if (saved) {
          showContact(saved);
          setContactSyncMessage(null);
          void saveLocalTrustedContact(localContactKey, saved).catch(() => undefined);
          return;
        }

        const local = await loadLocalTrustedContact(localContactKey);
        if (local && await hasPendingTrustedContactSync(localContactKey)) {
          try {
            const synced = await saveTrustedContact(accessToken, local);
            showContact(synced);
            setContactSyncMessage(null);
            void saveLocalTrustedContact(localContactKey, synced).catch(() => undefined);
          } catch (reason) {
            showContact(local);
            setContactSyncMessage(reason instanceof Error
              ? `Đang dùng bản lưu trên thiết bị. Chưa đồng bộ được vào tài khoản: ${reason.message}`
              : 'Đang dùng bản lưu trên thiết bị. Chưa đồng bộ được vào tài khoản.');
          }
          return;
        }

        await deleteLocalTrustedContact(localContactKey);
        showContact(null);
        setContactSyncMessage(null);
      } catch (reason) {
        const local = await loadLocalTrustedContact(localContactKey).catch(() => null);
        if (canSaveContactOffline(reason) && local) {
          showContact(local);
          setContactSyncMessage(reason.status === 503
            ? 'Chưa tải được liên hệ từ máy chủ; đang dùng bản lưu trên thiết bị.'
            : 'Đang dùng số đã lưu trên thiết bị; chưa kết nối được tài khoản để đồng bộ.');
          return;
        }
        if (!current) return;
        setContactError(reason instanceof Error ? reason.message : 'Chưa tải được liên hệ tin cậy.');
        setEditingContact(true);
      } finally {
        if (current) setContactLoading(false);
      }
    };
    void load();
    return () => { current = false; };
  }, [accessToken, active, localContactKey]);

  const saveContact = async () => {
    const name = contactName.trim();
    const phone = contactPhone.replace(/[\s().-]/g, '');
    if (!name) {
      setContactError('Nhập tên người bạn muốn liên hệ.');
      return;
    }
    if (!/^\+?[0-9]{7,15}$/.test(phone)) {
      setContactError('Nhập số điện thoại gồm 7–15 chữ số, có thể bắt đầu bằng +.');
      return;
    }
    setContactSaving(true);
    setContactError(null);
    setContactSyncMessage(null);
    let savedOffline = false;
    try {
      let saved: TrustedContact;
      if (accessToken) {
        try {
          saved = await saveTrustedContact(accessToken, { name, phone });
          await saveLocalTrustedContact(localContactKey, saved).catch(() => undefined);
        } catch (reason) {
          if (!canSaveContactOffline(reason)) throw reason;
          saved = { name, phone };
          await saveLocalTrustedContact(localContactKey, saved, true);
          savedOffline = true;
          setContactSyncMessage(reason.status === 503
            ? `Đã lưu trên thiết bị này. Chưa ghi được vào tài khoản: ${reason.message}`
            : 'Đã lưu trên thiết bị này. Kết nối máy chủ để đồng bộ liên hệ vào tài khoản.');
          onNotify('Đã lưu trên thiết bị; chưa đồng bộ được liên hệ vào tài khoản.');
        }
      } else {
        await saveLocalTrustedContact(localContactKey, { name, phone });
        saved = { name, phone };
      }
      setContact(saved);
      setContactName(saved.name);
      setContactPhone(saved.phone);
      setCallError(null);
      setEditingContact(false);
      if (!accessToken || !savedOffline) {
        onNotify(accessToken ? 'Đã lưu liên hệ tin cậy vào tài khoản.' : 'Đã lưu liên hệ trên thiết bị này.');
      }
    } catch (reason) {
      setContactError(reason instanceof Error ? reason.message : 'Chưa lưu được liên hệ tin cậy.');
    } finally {
      setContactSaving(false);
    }
  };

  const removeContact = async () => {
    setContactSaving(true);
    setContactError(null);
    setContactSyncMessage(null);
    try {
      if (accessToken) await deleteTrustedContact(accessToken);
      await deleteLocalTrustedContact(localContactKey);
      setContact(null);
      setContactName('');
      setContactPhone('');
      setEditingContact(true);
      onNotify('Đã xóa liên hệ tin cậy đã lưu.');
    } catch (reason) {
      setContactError(reason instanceof Error ? reason.message : 'Chưa xóa được liên hệ tin cậy.');
    } finally {
      setContactSaving(false);
    }
  };

  const callNumber = async (phone: string) => {
    setCallError(null);
    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      const message = `Không mở được ứng dụng gọi điện. Bạn có thể gọi trực tiếp số ${phone}.`;
      setCallError(message);
      onNotify(message);
    }
  };

  const callContact = () => {
    if (!contact) {
      setEditingContact(true);
      setContactError('Lưu tên và số điện thoại người bạn tin cậy trước khi gọi.');
      onNotify('Bạn cần cấu hình số điện thoại người thân trước khi gọi');
      return;
    }
    void callNumber(contact.phone);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <View style={styles.content}>
        <Text
          accessibilityRole="header"
          style={[styles.title, compact && styles.compactTitle]}
        >
          Chúng mình đang ở đây
        </Text>
        <Text style={[styles.introduction, compact && styles.compactIntroduction]}>
          Bạn không cần đối diện với căng thẳng một mình. Hãy chọn cách hỗ trợ
          phù hợp với bạn lúc này.
        </Text>

        <View style={[styles.adviceCard, compact && styles.compactAdviceCard]}>
          <View style={styles.adviceHeading}>
            <View accessible={false} style={styles.adviceIcon}>
              <Ionicons color="#8E244D" name="leaf-outline" size={28} />
            </View>
            <Text accessibilityRole="header" style={styles.adviceTitle}>
              Lời khuyên từ JoyfulMind
            </Text>
          </View>

          <Text style={styles.adviceText}>
            JoyfulMind hỗ trợ bạn chia sẻ cảm xúc, không chẩn đoán hay thay thế
            chuyên gia sức khỏe. Bạn có thể dành một khoảng nghỉ, thử bài tập
            nhẹ nhàng hoặc liên hệ với người mình tin tưởng.
          </Text>

          <Pressable
            accessibilityHint="Mở danh sách bài tập và chọn bài hít thở"
            accessibilityLabel="Thử bài tập hít thở"
            accessibilityRole="button"
            onPress={() => onNavigate('exercises')}
            style={({ pressed }) => [
              styles.breathingButton,
              pressed && styles.pressed,
            ]}
            testID="alert-breathing-action"
          >
            <Ionicons color="#FFFFFF" name="leaf-outline" size={20} />
            <Text style={styles.breathingButtonText}>Thử bài tập hít thở</Text>
            <Ionicons color="#FFFFFF" name="arrow-forward" size={20} />
          </Pressable>
        </View>

        <Text accessibilityRole="header" style={styles.supportTitle}>
          Hỗ trợ ngay lập tức
        </Text>

        <View style={styles.contactCard}>
          <Text accessibilityRole="header" style={styles.contactTitle}>Liên hệ tin cậy</Text>
          <Text style={styles.contactHint}>
            {accessToken ? 'Liên hệ được lưu trong tài khoản để dùng lại sau khi đăng nhập.' : 'Liên hệ được lưu trên thiết bị này. Đăng nhập để đồng bộ với tài khoản.'}
          </Text>
          {contactSyncMessage && <Text accessibilityRole="alert" style={styles.contactSyncMessage}>{contactSyncMessage}</Text>}
          {contactLoading ? <Text style={styles.contactHint}>Đang tải liên hệ đã lưu…</Text> : editingContact ? (
            <>
              <Text style={styles.inputLabel}>Tên người thân hoặc bạn bè</Text>
              <TextInput
                accessibilityLabel="Tên liên hệ tin cậy"
                autoCapitalize="words"
                maxLength={60}
                onChangeText={setContactName}
                placeholder="Ví dụ: Chị Lan"
                placeholderTextColor="#82796F"
                style={styles.contactInput}
                value={contactName}
              />
              <Text style={styles.inputLabel}>Số điện thoại</Text>
              <TextInput
                accessibilityLabel="Số điện thoại liên hệ tin cậy"
                autoComplete="tel"
                keyboardType="phone-pad"
                maxLength={32}
                onChangeText={setContactPhone}
                placeholder="Ví dụ: 0912 345 678"
                placeholderTextColor="#82796F"
                style={styles.contactInput}
                value={contactPhone}
              />
              {contactError && <Text accessibilityRole="alert" style={styles.errorText}>{contactError}</Text>}
              <View style={styles.contactButtons}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Lưu liên hệ tin cậy"
                  onPress={() => void saveContact()}
                  disabled={contactSaving}
                  style={({ pressed }) => [styles.saveContactButton, pressed && styles.pressed]}
                >
                  <Text style={styles.breathingButtonText}>{contactSaving ? 'Đang lưu…' : 'Lưu liên hệ'}</Text>
                </Pressable>
                {contact && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Hủy sửa liên hệ"
                    onPress={() => { setEditingContact(false); setContactError(null); }}
                    style={styles.editContactButton}
                  >
                    <Text style={styles.editContactText}>Hủy</Text>
                  </Pressable>
                )}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.contactName}>{contact?.name}</Text>
              <Text selectable style={styles.contactPhone}>{contact?.phone}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sửa liên hệ tin cậy"
                onPress={() => {
                  setContactName(contact?.name ?? '');
                  setContactPhone(contact?.phone ?? '');
                  setEditingContact(true);
                }}
                style={styles.editContactButton}
              >
                <Text style={styles.editContactText}>Sửa liên hệ</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={contactSaving} onPress={() => void removeContact()} style={styles.removeContactButton}>
                <Text style={styles.removeContactText}>Xóa liên hệ đã lưu</Text>
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.supportList}>
          <SupportAction
            backgroundColor={colors.cream}
            icon="call-outline"
            iconColor={colors.olive}
            label="Gọi người thân"
            onPress={callContact}
            subtitle={contact ? `Mở cuộc gọi đến ${contact.name} · ${contact.phone}` : 'Lưu một liên hệ tin cậy ở trên để gọi nhanh'}
            testID="alert-call-action"
            textColor={colors.darkText}
          />

          <SupportAction
            backgroundColor={colors.highlight}
            icon="chatbubbles-outline"
            iconColor={colors.olive}
            label="Tâm sự cùng Joy"
            onPress={() => onNavigate('chat')}
            subtitle="Chia sẻ điều bạn đang cảm thấy"
            testID="alert-chat-action"
            textColor={colors.darkText}
          />
        </View>

        {callError && <Text accessibilityRole="alert" style={styles.errorText}>{callError}</Text>}

        <View accessibilityRole="summary" style={styles.emergencyNote}>
          <Ionicons color="#7C5642" name="information-circle-outline" size={21} />
          <Text style={styles.emergencyText}>
            Nếu bạn hoặc người khác đang gặp nguy hiểm hay cần cấp cứu y tế,
            gọi 115 tại Việt Nam. Nếu ở nước khác, gọi số khẩn cấp địa phương.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gọi cấp cứu y tế 115"
          accessibilityHint="Mở ứng dụng gọi điện với số cấp cứu y tế tại Việt Nam"
          onPress={() => { void callNumber('115'); }}
          style={({ pressed }) => [styles.emergencyButton, pressed && styles.pressed]}
          testID="alert-emergency-action"
        >
          <Ionicons color="#FFFFFF" name="call-outline" size={20} />
          <Text style={styles.breathingButtonText}>Gọi cấp cứu y tế 115</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 42,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  title: {
    marginTop: 14,
    color: colors.black,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 38,
    textAlign: 'center',
  },
  compactTitle: {
    marginTop: 12,
    fontSize: 28,
    lineHeight: 36,
  },
  introduction: {
    maxWidth: 500,
    marginTop: 10,
    alignSelf: 'center',
    color: colors.darkText,
    fontSize: 16,
    lineHeight: 25,
    textAlign: 'center',
  },
  compactIntroduction: {
    fontSize: 15,
    lineHeight: 23,
  },
  adviceCard: {
    marginTop: 26,
    padding: 20,
    borderRadius: 14,
    backgroundColor: colors.cream,
  },
  compactAdviceCard: {
    padding: 17,
    borderRadius: 14,
  },
  adviceHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  adviceIcon: {
    width: 54,
    height: 54,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
    backgroundColor: colors.mint,
  },
  adviceTitle: {
    flex: 1,
    color: colors.black,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 25,
  },
  adviceText: {
    marginTop: 17,
    color: colors.darkText,
    fontSize: 15,
    lineHeight: 24,
  },
  breathingButton: {
    minHeight: 50,
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: colors.olive,
  },
  breathingButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  supportTitle: {
    marginTop: 30,
    marginLeft: 6,
    color: colors.black,
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 28,
  },
  supportList: {
    marginTop: 20,
    gap: 10,
  },
  contactCard: { marginTop: 20, padding: 18, borderRadius: 14, backgroundColor: colors.cream },
  contactTitle: { color: colors.darkText, fontWeight: '700', fontSize: 17 },
  contactHint: { marginTop: 8, color: colors.darkText, fontSize: 13, lineHeight: 20 },
  contactSyncMessage: { marginTop: 10, color: '#79572F', fontSize: 13, lineHeight: 19 },
  inputLabel: { marginTop: 16, marginBottom: 6, color: colors.darkText, fontSize: 14, fontWeight: '600' },
  contactInput: { minHeight: 48, borderWidth: 1, borderColor: colors.outline, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: colors.darkText, backgroundColor: '#FFFFFF', fontSize: 16 },
  errorText: { marginTop: 12, color: '#9B2045', fontSize: 14, lineHeight: 21 },
  contactButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  saveContactButton: { minHeight: 46, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.olive, justifyContent: 'center' },
  editContactButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 10 },
  editContactText: { color: '#8E244D', fontSize: 14, fontWeight: '700' },
  removeContactButton: { minHeight: 40, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 10 },
  removeContactText: { color: colors.burgundy, fontSize: 13, fontWeight: '600' },
  contactName: { marginTop: 16, color: colors.darkText, fontSize: 17, fontWeight: '700' },
  contactPhone: { marginTop: 4, color: colors.darkText, fontSize: 17 },
  emergencyButton: { minHeight: 50, marginTop: 12, backgroundColor: colors.burgundy, borderRadius: 10, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  supportAction: {
    minHeight: 108,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingHorizontal: 21,
    paddingVertical: 17,
    borderRadius: 14,
  },
  supportIconCircle: {
    width: 48,
    height: 48,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  supportCopy: {
    flex: 1,
    flexShrink: 1,
  },
  supportLabel: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  supportSubtitle: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.86,
  },
  emergencyNote: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.cream,
  },
  emergencyText: {
    flex: 1,
    color: colors.darkText,
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.72,
  },
});
