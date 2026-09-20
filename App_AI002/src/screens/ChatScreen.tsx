import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import type { AppTab } from '../navigation/tabs';
import { getApiBaseUrl, getHealth, sendChat, setApiBaseUrl, type ChatReply, type HealthStatus, type HistoryMessage } from '../services/api';
import { colors } from '../theme/colors';
import { activateAccountSettings } from '../services/accountSettings';

type Message = HistoryMessage & { id: number; result?: ChatReply };
type PendingMessage = { id: number; text: string; history: HistoryMessage[] };
type ChatScreenProps = {
  readonly onNotify: (text: string) => void;
  readonly onNavigate?: (tab: AppTab) => void;
  readonly onRequestAssessment?: () => void;
  readonly active?: boolean;
  readonly username?: string;
  readonly accountKey?: string;
  readonly onServerUrlChange?: (url: string) => void;
  readonly onServerUrlSave?: (url: string) => void;
};
// Giữ lượt phản hồi đầu tiên giống chatbot-demo. Lượt này cũng được gửi trong
// lịch sử để giao diện Streamlit và ứng dụng này cung cấp cùng ngữ cảnh cho mô hình.
const welcome: Message = {
  id: 0,
  role: 'assistant',
  content: 'Chào bạn, mình là Hệ thống hỗ trợ cảm xúc. Dạo này bạn thế nào? Bạn có thể kể bất cứ điều gì đang ở trong đầu, mình nghe.',
};
const suggestions = ['Mình đang thấy áp lực', 'Hôm nay mình có chuyện vui', 'Mình muốn thử tiếp đất'];
const modeLabels: Record<ChatReply['mode'], string> = {
  ai: 'Phản hồi AI', rag: 'Tham khảo tài liệu WHO', crisis: 'Hỗ trợ an toàn',
  scripted: 'Phản hồi có sẵn', unavailable: 'Dịch vụ AI hoặc tài liệu tạm thời chưa sẵn sàng',
};
function MessageText({ text }: { text: string }) {
  return <Text selectable style={styles.messageText}>{text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (
    <Text key={index} style={part.startsWith('**') ? styles.bold : undefined}>{part.startsWith('**') ? part.slice(2, -2) : part}</Text>
  ))}</Text>;
}
export function ChatScreen({ onNotify, onNavigate, onRequestAssessment, active = true, username, accountKey, onServerUrlChange, onServerUrlSave }: ChatScreenProps) {
  const welcomeForUser = username
    ? { ...welcome, content: `Chào ${username}, mình là Hệ thống hỗ trợ cảm xúc. Dạo này bạn thế nào? Bạn có thể kể bất cứ điều gì đang ở trong đầu, mình nghe.` }
    : welcome;
  const [messages, setMessages] = useState<Message[]>([welcomeForUser]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<PendingMessage | null>(null);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [settings, setSettings] = useState(false);
  const [serverUrl, setServerUrl] = useState(getApiBaseUrl);
  const [settingsError, setSettingsError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const shouldScroll = useRef(false);
  const sequence = useRef(0);
  const requestVersion = useRef(0);
  const busy = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  const healthController = useRef<AbortController | null>(null);
  const checkConnection = useCallback(async () => {
    healthController.current?.abort();
    const controller = new AbortController();
    healthController.current = controller;
    setChecking(true);
    try {
      const status = await getHealth(controller.signal);
      if (!controller.signal.aborted) setHealth(status);
    } catch {
      if (!controller.signal.aborted) setHealth(null);
    } finally {
      if (!controller.signal.aborted) setChecking(false);
    }
  }, []);
  useEffect(() => {
    if (username) {
      setMessages(current => current.length === 1 && current[0]?.id === 0
        ? [{ ...current[0], content: welcomeForUser.content }]
        : current);
    }
  }, [username]);
  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      if (accountKey && accountKey !== 'guest') {
        const url = await activateAccountSettings(accountKey);
        if (cancelled) return;
        setServerUrl(url);
        onServerUrlChange?.(url);
      } else {
        setServerUrl(getApiBaseUrl());
      }
      if (!cancelled && active) void checkConnection();
    };
    void loadSettings();
    return () => { cancelled = true; };
  }, [accountKey, checkConnection, onServerUrlChange]);
  useEffect(() => { if (active) void checkConnection(); }, [active, checkConnection]);
  useEffect(() => () => {
    ++requestVersion.current;
    abortController.current?.abort();
    healthController.current?.abort();
  }, []);
  const requestReply = async (item: PendingMessage) => {
    if (busy.current) return;
    busy.current = true;
    const version = ++requestVersion.current;
    const controller = new AbortController();
    abortController.current = controller;
    setPending(true); setFailed(null); setError('');
    shouldScroll.current = true;
    try {
      const result = await sendChat(item.text, item.history, controller.signal);
      if (requestVersion.current !== version) return;
      setMessages(current => [...current, { id: ++sequence.current, role: 'assistant', content: result.reply, result }]);
      shouldScroll.current = true;
    } catch (reason) {
      if (requestVersion.current !== version) return;
      setFailed(item);
      setError(reason instanceof Error ? reason.message : 'Chưa nhận được phản hồi. Bạn thử lại nhé.');
    } finally {
      if (requestVersion.current === version) {
        busy.current = false; setPending(false); abortController.current = null;
      }
    }
  };
  const handleSend = () => {
    const text = draft.trim();
    if (!text || busy.current || failed) return;
    const id = ++sequence.current;
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages(current => [...current, { id, role: 'user', content: text }]);
    setDraft('');
    void requestReply({ id, text, history });
  };
  const reset = () => {
    ++requestVersion.current; abortController.current?.abort(); busy.current = false;
    setPending(false); setFailed(null); setError(''); setDraft(''); setMessages([welcomeForUser]); setConfirmReset(false);
    onNotify('Đã bắt đầu cuộc trò chuyện mới');
  };
  const saveServer = () => {
    try {
      setApiBaseUrl(serverUrl); setServerUrl(getApiBaseUrl()); onServerUrlChange?.(getApiBaseUrl()); onServerUrlSave?.(getApiBaseUrl()); setSettingsError(''); setSettings(false);
      void checkConnection();
    } catch (reason) { setSettingsError(reason instanceof Error ? reason.message : 'Địa chỉ không hợp lệ.'); }
  };
  const canSend = !!draft.trim() && !pending && !failed;
  const connectionLabel = checking ? 'Đang kiểm tra kết nối…' : health ?
    health.ai_available ? 'Máy chủ sẵn sàng · AI đã cấu hình' : 'Máy chủ sẵn sàng · chế độ cơ bản' : 'Chưa kết nối máy chủ';
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cài đặt kết nối" disabled={pending}
          onPress={() => { setServerUrl(getApiBaseUrl()); setSettings(true); }} style={styles.statusButton}>
          <View style={[styles.statusDot, { backgroundColor: health ? colors.green : '#A17D37' }]} />
          <Text style={styles.statusText}>{connectionLabel}</Text>
          <Ionicons name="settings-outline" size={17} color={colors.olive} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Cuộc trò chuyện mới" onPress={() => setConfirmReset(true)} style={styles.iconButton}>
          <Ionicons name="create-outline" size={25} color={colors.olive} />
        </Pressable>
      </View>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => { if (shouldScroll.current) { shouldScroll.current = false; scroll.current?.scrollToEnd({ animated: true }); } }}>
        <View style={styles.content}>
          <View style={styles.intro}>
            <Image accessibilityLabel="Joy luôn sẵn sàng lắng nghe" source={require('../../assets/illustrations/chat-hero.png')} style={styles.hero} />
            <Text accessibilityRole="header" style={styles.title}>{username ? `Chào ${username}!` : 'Chào bạn!'}</Text>
            <Text style={styles.subtitle}>Mình là Joy, luôn ở đây để lắng nghe mọi tâm sự của bạn.</Text>
          </View>
          <View style={styles.privacyNote}>
            <Ionicons name="information-circle-outline" size={20} color={colors.olive} />
            <Text style={styles.noteText}>Joy là AI hỗ trợ cảm xúc, không thay thế chuyên gia. Khi gửi, nội dung được chuyển đến máy chủ và dịch vụ AI để phản hồi. Lịch sử trò chuyện chỉ giữ trong phiên đang mở.</Text>
          </View>
          <View accessibilityLabel="Cuộc trò chuyện" style={styles.messages}>
            {messages.map(message => (
              <View key={message.id} style={[styles.messageRow, message.role === 'user' && styles.userRow]}>
                {message.role === 'assistant' && <Image accessible={false} source={require('../../assets/illustrations/joy-mascot.png')} style={styles.avatar} />}
                <View style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.joyBubble]}>
                  <MessageText text={message.content} />
                  {message.result && <Text style={styles.mode}>
                    {message.result.engine === 'chatbot-demo' ? 'Backend chatbot-demo · ' : ''}{modeLabels[message.result.mode]}
                  </Text>}
                  {message.result?.sources?.map((source, index) => <Text key={index} style={styles.source}>{source.title}{source.pages ? ` · trang ${source.pages}` : ''}</Text>)}
                  {message.result?.risk && onNavigate && <Pressable accessibilityRole="button" accessibilityLabel="Mở các kênh hỗ trợ ngay" onPress={() => onNavigate('alerts')} style={styles.supportButton}>
                    <Ionicons name="call-outline" color={colors.burgundy} size={20} /><Text style={styles.supportText}>Mở các kênh hỗ trợ ngay</Text>
                  </Pressable>}
                  {message.result?.suggest_assessment && !message.result.risk && onRequestAssessment && (
                    <Pressable accessibilityRole="button" accessibilityLabel="Tìm hiểu bài đánh giá PSS-10" onPress={onRequestAssessment} style={styles.supportButton}>
                      <Text style={styles.supportText}>Tìm hiểu bài đánh giá PSS-10</Text><Ionicons name="arrow-forward" size={18} color={colors.burgundy} />
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
            {pending && <View accessibilityRole="progressbar" accessibilityLabel="Joy đang trả lời" style={styles.pending}>
              <ActivityIndicator color={colors.olive} /><Text style={styles.noteText}>Joy đang lắng nghe và trả lời…</Text>
              <Pressable accessibilityRole="button" onPress={() => abortController.current?.abort()}><Text style={styles.link}>Dừng chờ</Text></Pressable>
            </View>}
            {failed && <View accessibilityRole="alert" style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <View style={styles.actionRow}>
                <Pressable accessibilityRole="button" onPress={() => void requestReply(failed)} style={styles.smallButton}><Text style={styles.link}>Gửi lại</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => {
                  setDraft(failed.text); setMessages(current => current.filter(message => message.id !== failed.id)); setFailed(null); setError('');
                }} style={styles.smallButton}><Text style={styles.link}>Sửa tin nhắn</Text></Pressable>
              </View>
            </View>}
          </View>
          {messages.length === 1 && <View style={styles.suggestions}>{suggestions.map(text => (
            <Pressable accessibilityRole="button" key={text} onPress={() => setDraft(text)} style={styles.chip}><Text style={styles.chipText}>{text}</Text></Pressable>
          ))}</View>}
        </View>
      </ScrollView>
      <View style={styles.composerArea}>
        <View style={styles.composer}>
          <TextInput accessibilityLabel="Tin nhắn cho Joy" placeholder="Nhắn tin cho Joy…" placeholderTextColor="#8B8678"
            multiline maxLength={2000} editable={!failed} value={draft} onChangeText={setDraft} style={styles.input}
            onSubmitEditing={handleSend} submitBehavior={Platform.OS === 'web' ? 'submit' : 'newline'} />
          <Pressable accessibilityLabel="Gửi tin nhắn" accessibilityRole="button" accessibilityState={{ disabled: !canSend }}
            disabled={!canSend} onPress={handleSend} style={[styles.send, !canSend && styles.disabled]}>
            <Ionicons color="white" name="send-outline" size={24} />
          </Pressable>
        </View>
        <View style={styles.composerFooter}>
          {onNavigate && <Pressable accessibilityRole="button" onPress={() => onNavigate('alerts')}><Text style={styles.footerText}>Cần hỗ trợ ngay?</Text></Pressable>}
          <Text style={styles.footerText}>{draft.length}/2000</Text>
        </View>
      </View>
      <Modal visible={settings} transparent animationType="fade" onRequestClose={() => setSettings(false)}>
        <View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}>
          <Text accessibilityRole="header" style={styles.dialogTitle}>Kết nối với Joy</Text>
          <Text style={styles.dialogCopy}>Nhập địa chỉ máy chủ của bạn. Khi dùng điện thoại, máy chủ cần ở cùng mạng Wi-Fi. Địa chỉ chỉ được giữ trong phiên này.</Text>
          <TextInput accessibilityLabel="Địa chỉ máy chủ" autoCapitalize="none" autoCorrect={false} keyboardType="url" value={serverUrl} onChangeText={setServerUrl} style={styles.urlInput} />
          {!!settingsError && <Text accessibilityRole="alert" style={styles.errorText}>{settingsError}</Text>}
          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" onPress={() => setSettings(false)} style={styles.smallButton}><Text style={styles.link}>Đóng</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={saveServer} style={styles.primaryButton}><Text style={styles.primaryText}>Lưu và kiểm tra</Text></Pressable>
          </View>
        </View></View>
      </Modal>
      <Modal visible={confirmReset} transparent animationType="fade" onRequestClose={() => setConfirmReset(false)}>
        <View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}>
          <Text accessibilityRole="header" style={styles.dialogTitle}>Bắt đầu lại cùng Joy?</Text>
          <Text style={styles.dialogCopy}>Cuộc trò chuyện hiện tại sẽ được xóa khỏi app. Bạn có thể bắt đầu một câu chuyện mới bất cứ lúc nào.</Text>
          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" onPress={() => setConfirmReset(false)} style={styles.smallButton}><Text style={styles.link}>Giữ cuộc trò chuyện</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={reset} style={styles.primaryButton}><Text style={styles.primaryText}>Bắt đầu mới</Text></Pressable>
          </View>
        </View></View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  toolbar: { width: '100%', maxWidth: 604, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusButton: { flexDirection: 'row', gap: 7, alignItems: 'center', minHeight: 42, flexShrink: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 }, statusText: { color: colors.olive, fontSize: 12, flexShrink: 1 },
  iconButton: { padding: 10 }, scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center' }, intro: { alignItems: 'center', paddingTop: 8 },
  hero: { width: 138, height: 138, borderRadius: 38 }, title: { marginTop: 16, color: colors.black, fontSize: 29, fontWeight: '800' },
  subtitle: { marginTop: 8, maxWidth: 360, color: colors.darkText, fontSize: 17, lineHeight: 25, textAlign: 'center' },
  privacyNote: { marginTop: 24, flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 13, backgroundColor: '#F6F2E5', borderRadius: 14 },
  noteText: { flexShrink: 1, color: '#6D6248', fontSize: 12, lineHeight: 19 }, messages: { marginTop: 26 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18, gap: 9 }, userRow: { justifyContent: 'flex-end' },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFF0B9' },
  bubble: { maxWidth: '84%', padding: 15, borderRadius: 20, flexShrink: 1 }, joyBubble: { borderTopLeftRadius: 4, backgroundColor: colors.creamMuted },
  userBubble: { borderTopRightRadius: 4, backgroundColor: colors.yellow }, messageText: { color: colors.darkText, fontSize: 16, lineHeight: 25 }, bold: { fontWeight: '700' },
  mode: { color: '#6A624C', fontSize: 10, lineHeight: 16, marginTop: 10 }, source: { color: colors.oliveDark, fontSize: 11, lineHeight: 17, marginTop: 4 },
  supportButton: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: '#DACDB7', flexDirection: 'row', gap: 7, alignItems: 'center', minHeight: 44 },
  supportText: { color: colors.burgundy, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, flexWrap: 'wrap' },
  errorBox: { borderRadius: 15, padding: 15, backgroundColor: '#FFF0E6', marginBottom: 12 }, errorText: { color: '#8B3B29', fontSize: 13, lineHeight: 21 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12, flexWrap: 'wrap' }, smallButton: { padding: 10, minHeight: 44, justifyContent: 'center' },
  link: { color: colors.oliveDark, fontWeight: '700', fontSize: 13 }, suggestions: { gap: 9, alignItems: 'flex-start' },
  chip: { paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: colors.outline, borderRadius: 24 }, chipText: { color: colors.oliveDark, fontSize: 13 },
  composerArea: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, width: '100%', maxWidth: 592, alignSelf: 'center' },
  composer: { borderWidth: 1, borderColor: colors.outline, borderRadius: 28, backgroundColor: 'white', padding: 6, flexDirection: 'row', alignItems: 'flex-end' },
  input: { flex: 1, minWidth: 0, minHeight: 46, maxHeight: 140, paddingHorizontal: 13, paddingVertical: 12, fontSize: 16, color: colors.darkText },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.4 },
  composerFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 5, paddingHorizontal: 10 }, footerText: { color: '#786C51', fontSize: 11, paddingVertical: 5 },
  overlay: { flex: 1, backgroundColor: 'rgba(35, 30, 16, 0.4)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  dialog: { width: '100%', maxWidth: 440, backgroundColor: colors.background, borderRadius: 24, padding: 24 },
  dialogTitle: { color: colors.black, fontSize: 22, fontWeight: '800' }, dialogCopy: { color: colors.darkText, fontSize: 14, lineHeight: 22, marginVertical: 14 },
  urlInput: { borderWidth: 1, borderColor: colors.outline, backgroundColor: 'white', padding: 13, borderRadius: 12, fontSize: 15, marginBottom: 8, color: colors.darkText },
  primaryButton: { padding: 13, borderRadius: 14, backgroundColor: colors.olive, justifyContent: 'center' }, primaryText: { color: 'white', fontSize: 13, fontWeight: '700' },
});
