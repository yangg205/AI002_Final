import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import {
  Image,
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
import { colors } from '../theme/colors';

type IconName = ComponentProps<typeof Ionicons>['name'];

type AlertScreenProps = {
  readonly onNotify: (text: string) => void;
  readonly onNavigate: (tab: AppTab) => void;
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

const mascot = require('../../assets/illustrations/joy-mascot.png');

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

export function AlertScreen({ onNavigate, onNotify }: AlertScreenProps) {
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const [contact, setContact] = useState<{ name: string; phone: string } | null>(null);
  const [editingContact, setEditingContact] = useState(true);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactError, setContactError] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  const saveContact = () => {
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
    setContact({ name, phone });
    setContactError(null);
    setCallError(null);
    setEditingContact(false);
    onNotify('Đã lưu liên hệ tin cậy cho phiên sử dụng này.');
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
        <View
          accessibilityLabel="Joy đang vẫy tay và ở đây để đồng hành cùng bạn"
          accessible
          style={[
            styles.heroStage,
            compact && styles.compactHeroStage,
          ]}
        >
          <View accessible={false} style={styles.heroDotLarge} />
          <View accessible={false} style={styles.heroDotSmall} />
          <View style={styles.heroCard}>
            <View style={styles.heroWindow}>
              <Image
                accessible={false}
                resizeMode="contain"
                source={mascot}
                style={styles.mascot}
              />
            </View>
          </View>
        </View>

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
            Liên hệ chỉ được giữ trong phiên này, sẽ mất khi tải lại hoặc đóng ứng dụng.
          </Text>
          {editingContact ? (
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
                  onPress={saveContact}
                  style={({ pressed }) => [styles.saveContactButton, pressed && styles.pressed]}
                >
                  <Text style={styles.breathingButtonText}>Lưu liên hệ</Text>
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
            </>
          )}
        </View>

        <View style={styles.supportList}>
          <SupportAction
            backgroundColor="#F57BA7"
            icon="call-outline"
            iconColor="#A42D58"
            label="Gọi người thân"
            onPress={callContact}
            subtitle={contact ? `Mở cuộc gọi đến ${contact.name} · ${contact.phone}` : 'Lưu một liên hệ tin cậy ở trên để gọi nhanh'}
            testID="alert-call-action"
            textColor="#69233E"
          />

          <SupportAction
            backgroundColor={colors.yellow}
            icon="chatbubbles-outline"
            iconColor="#766300"
            label="Tâm sự cùng Joy"
            onPress={() => onNavigate('chat')}
            subtitle="Chia sẻ điều bạn đang cảm thấy"
            testID="alert-chat-action"
            textColor="#514500"
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
  heroStage: {
    width: 220,
    height: 220,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactHeroStage: {
    width: 184,
    height: 184,
  },
  heroCard: {
    width: '82%',
    height: '82%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 43,
    backgroundColor: '#F57BA7',
    shadowColor: '#D55080',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 5,
    transform: [{ rotate: '-4deg' }],
  },
  heroWindow: {
    width: '68%',
    height: '48%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 5,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 12,
    backgroundColor: '#FFF1E8',
    transform: [{ rotate: '4deg' }],
  },
  mascot: {
    width: '86%',
    height: '122%',
  },
  heroDotLarge: {
    position: 'absolute',
    top: 9,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE0EA',
  },
  heroDotSmall: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFD92A',
  },
  title: {
    marginTop: 24,
    color: '#17140F',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.3,
    lineHeight: 47,
    textAlign: 'center',
  },
  compactTitle: {
    marginTop: 19,
    fontSize: 33,
    lineHeight: 39,
  },
  introduction: {
    maxWidth: 500,
    marginTop: 18,
    alignSelf: 'center',
    color: colors.darkText,
    fontSize: 19,
    lineHeight: 30,
    textAlign: 'center',
  },
  compactIntroduction: {
    fontSize: 17,
    lineHeight: 27,
  },
  adviceCard: {
    marginTop: 38,
    padding: 28,
    borderRadius: 42,
    backgroundColor: '#F7F0E7',
    shadowColor: '#B36A80',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  compactAdviceCard: {
    padding: 21,
    borderRadius: 32,
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
    backgroundColor: '#F684AD',
  },
  adviceTitle: {
    flex: 1,
    color: '#211A15',
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 25,
  },
  adviceText: {
    marginTop: 17,
    color: '#443A32',
    fontSize: 16,
    lineHeight: 26,
  },
  breathingButton: {
    minHeight: 50,
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
    borderRadius: 25,
    backgroundColor: '#A42D58',
  },
  breathingButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  supportTitle: {
    marginTop: 40,
    marginLeft: 6,
    color: '#17140F',
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 32,
  },
  supportList: {
    marginTop: 20,
    gap: 16,
  },
  contactCard: { marginTop: 20, padding: 20, borderRadius: 24, backgroundColor: '#FFF6EE' },
  contactTitle: { color: colors.darkText, fontWeight: '800', fontSize: 18 },
  contactHint: { marginTop: 8, color: '#6B4C3B', fontSize: 13, lineHeight: 20 },
  inputLabel: { marginTop: 16, marginBottom: 6, color: colors.darkText, fontSize: 14, fontWeight: '600' },
  contactInput: { minHeight: 48, borderWidth: 1, borderColor: '#D9C4B5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.darkText, backgroundColor: '#FFFFFF', fontSize: 16 },
  errorText: { marginTop: 12, color: '#9B2045', fontSize: 14, lineHeight: 21 },
  contactButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  saveContactButton: { minHeight: 46, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 23, backgroundColor: '#A42D58', justifyContent: 'center' },
  editContactButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 10 },
  editContactText: { color: '#8E244D', fontSize: 14, fontWeight: '700' },
  contactName: { marginTop: 16, color: colors.darkText, fontSize: 17, fontWeight: '700' },
  contactPhone: { marginTop: 4, color: colors.darkText, fontSize: 17 },
  emergencyButton: { minHeight: 50, marginTop: 12, backgroundColor: '#9B2045', borderRadius: 25, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  supportAction: {
    minHeight: 108,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingHorizontal: 21,
    paddingVertical: 17,
    borderRadius: 38,
    shadowColor: '#7B6500',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 3,
  },
  supportIconCircle: {
    width: 64,
    height: 64,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  supportCopy: {
    flex: 1,
    flexShrink: 1,
  },
  supportLabel: {
    fontSize: 18,
    fontWeight: '800',
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
    borderRadius: 18,
    backgroundColor: '#FFF6EE',
  },
  emergencyText: {
    flex: 1,
    color: '#6B4C3B',
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.72,
  },
});
