import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import type { AppTab } from '../navigation/tabs';
import {
  getApiBaseUrl, getConversation, getConversationHistory, getHealth, getLatestHistory,
  recordStorageConsent, sendChat, setApiBaseUrl,
  type AuthUser, type ChatReply, type ConversationSummary, type HealthStatus, type HistoryMessage,
} from '../services/api';
import { colors } from '../theme/colors';
import { activateAccountSettings } from '../services/accountSettings';
import { PssAssessment } from '../components/PssAssessment';

type Message = HistoryMessage & { id: number; result?: ChatReply };
type PendingMessage = { id: number; text: string; history: HistoryMessage[] };
type StressHandoff = { readonly id: number; readonly text: string };
type ChatScreenProps = {
  readonly onNotify: (text: string) => void;
  readonly onNavigate?: (tab: AppTab) => void;
  readonly onRequestAssessment?: () => void;
  readonly stressHandoff?: StressHandoff | null;
  readonly active?: boolean;
  readonly username?: string;
  readonly accountKey?: string;
  readonly accessToken?: string;
  readonly consentAt?: string | null;
  readonly onConsentChange?: (user: AuthUser) => void;
  readonly historyRevision?: number;
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
export function ChatScreen({ onNotify, onNavigate, active = true, username, accountKey, accessToken, consentAt, onConsentChange, historyRevision = 0, onServerUrlChange, onServerUrlSave, stressHandoff }: ChatScreenProps) {
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
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversationList, setConversationList] = useState<ConversationSummary[]>([]);
  const [historyListLoading, setHistoryListLoading] = useState(false);
  const [historyListError, setHistoryListError] = useState('');
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(Boolean(accessToken && consentAt));
  const [historyError, setHistoryError] = useState('');
  const [consentMessage, setConsentMessage] = useState<PendingMessage | null>(null);
  const declinedStorageConsent = useRef(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const scroll = useRef<ScrollView>(null);
  const shouldScroll = useRef(false);
  const sequence = useRef(0);
  const historyLoadKey = useRef('');
  const historyRequestVersion = useRef(0);
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
    if (!stressHandoff) return;
    setDraft(stressHandoff.text);
    setFailed(null);
    setError('');
  }, [stressHandoff]);
  useEffect(() => {
    setDraft('');
    setFailed(null);
    setError('');
  }, [accountKey]);
  useEffect(() => {
    if (!active) return;
    const loadKey = `${accountKey ?? 'guest'}:${historyRevision}:${accessToken ?? ''}`;
    if (historyLoadKey.current === loadKey) return;
    historyLoadKey.current = loadKey;
    declinedStorageConsent.current = false;
    setMessages([welcomeForUser]);
    setConversationId(null);
    sequence.current = 0;
    if (!accessToken || !consentAt) {
      setHistoryLoading(false);
      setHistoryError('');
      return;
    }
    const loadVersion = ++historyRequestVersion.current;
    setHistoryLoading(true);
    void getLatestHistory(accessToken).then(history => {
      if (historyRequestVersion.current !== loadVersion) return;
      const restored: Message[] = history.messages.map((message, index) => ({ ...message, id: index + 1 }));
      sequence.current = restored.length;
      setMessages([welcomeForUser, ...restored]);
      setConversationId(history.conversation_id);
      setHistoryError('');
    }).catch(reason => {
      if (historyRequestVersion.current === loadVersion) setHistoryError(reason instanceof Error ? reason.message : 'Chưa tải được lịch sử trò chuyện.');
    }).finally(() => {
      if (historyRequestVersion.current === loadVersion) setHistoryLoading(false);
    });
  }, [accountKey, accessToken, active, historyRevision]);
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
    ++historyRequestVersion.current;
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
      const result = await sendChat(item.text, item.history, controller.signal, accessToken, conversationId);
      if (requestVersion.current !== version) return;
      if (result.conversation_id) setConversationId(result.conversation_id);
      const replyResult = accessToken && consentAt && typeof result.history_saved !== 'boolean'
        ? {
          ...result,
          history_saved: false,
          history_error: 'Máy chủ chưa xác nhận lưu lịch sử. Hãy khởi động lại backend rồi thử phiên chat mới.',
        }
        : result;
      setMessages(current => [...current, { id: ++sequence.current, role: 'assistant', content: result.reply, result: replyResult }]);
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
    if (!text || busy.current || failed || historyLoading || !active) return;
    const id = ++sequence.current;
    const history = messages.map(({ role, content }) => ({ role, content }));
    const item = { id, text, history };
    if (accessToken && !consentAt && !declinedStorageConsent.current) {
      setConsentMessage(item);
      setConsentOpen(true);
      return;
    }
    startMessage(item);
  };
  const startMessage = (item: PendingMessage) => {
    setMessages(current => [...current, { id: item.id, role: 'user', content: item.text }]);
    setDraft('');
    void requestReply(item);
  };
  const reset = () => {
    ++requestVersion.current; abortController.current?.abort(); busy.current = false;
    setPending(false); setFailed(null); setError(''); setDraft(''); setMessages([welcomeForUser]); setConversationId(null); setConfirmReset(false);
    onNotify('Đã bắt đầu cuộc trò chuyện mới');
  };
  const openHistory = async () => {
    setHistoryOpen(true);
    setHistoryListError('');
    if (!accessToken || !consentAt) {
      setConversationList([]);
      setHistoryListLoading(false);
      return;
    }
    setHistoryListLoading(true);
    try {
      setConversationList(await getConversationHistory(accessToken));
    } catch (reason) {
      setHistoryListError(reason instanceof Error ? reason.message : 'Chưa tải được lịch sử trò chuyện.');
    } finally {
      setHistoryListLoading(false);
    }
  };
  const enableHistoryFromModal = async () => {
    if (!accessToken) return;
    setHistoryListLoading(true);
    setHistoryListError('');
    try {
      const user = await recordStorageConsent(accessToken);
      onConsentChange?.(user);
      setConversationList(await getConversationHistory(accessToken));
      onNotify('Đã bật lưu lịch sử cho các tin nhắn tiếp theo.');
    } catch (reason) {
      setHistoryListError(reason instanceof Error ? reason.message : 'Chưa bật được lưu lịch sử.');
    } finally {
      setHistoryListLoading(false);
    }
  };
  const openConversation = async (conversation: ConversationSummary) => {
    if (!accessToken) return;
    setHistoryListLoading(true);
    setHistoryListError('');
    try {
      const detail = await getConversation(accessToken, conversation.id);
      const restored: Message[] = detail.messages.map((message, index) => ({ ...message, id: index + 1 }));
      sequence.current = restored.length;
      setMessages([welcomeForUser, ...restored]);
      setConversationId(detail.conversation_id);
      setFailed(null);
      setError('');
      setHistoryOpen(false);
      shouldScroll.current = true;
    } catch (reason) {
      setHistoryListError(reason instanceof Error ? reason.message : 'Chưa tải được cuộc trò chuyện đã chọn.');
    } finally {
      setHistoryListLoading(false);
    }
  };
  const handleConsentChoice = async (agree: boolean) => {
    const item = consentMessage;
    if (!item) return;
    setConsentBusy(true);
    if (agree && accessToken) {
      try {
        const user = await recordStorageConsent(accessToken);
        onConsentChange?.(user);
      } catch (reason) {
        setConsentBusy(false);
        setError(reason instanceof Error ? reason.message : 'Chưa ghi nhận được lựa chọn của bạn.');
        return;
      }
    } else {
      declinedStorageConsent.current = true;
    }
    setConsentBusy(false);
    setConsentOpen(false);
    setConsentMessage(null);
    startMessage(item);
  };
  const saveServer = () => {
    try {
      setApiBaseUrl(serverUrl); setServerUrl(getApiBaseUrl()); onServerUrlChange?.(getApiBaseUrl()); onServerUrlSave?.(getApiBaseUrl()); setSettingsError(''); setSettings(false);
      void checkConnection();
    } catch (reason) { setSettingsError(reason instanceof Error ? reason.message : 'Địa chỉ không hợp lệ.'); }
  };
  const canSend = !!draft.trim() && !pending && !failed && !historyLoading && !consentOpen && active;
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
        <Pressable accessibilityRole="button" accessibilityLabel="Làm bài đánh giá PSS-10" onPress={() => setAssessmentOpen(true)} style={styles.assessmentShortcut}>
          <Ionicons name="clipboard-outline" size={17} color={colors.olive} />
          <Text style={styles.assessmentShortcutText}>Đánh giá</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Lịch sử trò chuyện" onPress={() => void openHistory()} style={styles.iconButton}>
          <Ionicons name="time-outline" size={23} color={colors.olive} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Cuộc trò chuyện mới" onPress={() => setConfirmReset(true)} style={styles.iconButton}>
          <Ionicons name="create-outline" size={25} color={colors.olive} />
        </Pressable>
      </View>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => { if (shouldScroll.current) { shouldScroll.current = false; scroll.current?.scrollToEnd({ animated: true }); } }}>
        <View style={styles.content}>
          <View style={styles.intro}>
            <Text accessibilityRole="header" style={styles.title}>{username ? `Chào ${username}!` : 'Chào bạn!'}</Text>
            <Text style={styles.subtitle}>Một không gian riêng để bạn chia sẻ và tìm hiểu cách ứng phó với căng thẳng.</Text>
          </View>
          <View style={styles.privacyNote}>
            <Ionicons name="information-circle-outline" size={20} color={colors.olive} />
            <Text style={styles.noteText}>{!accessToken
              ? 'Bạn đang dùng chế độ khách. Nội dung được chuyển đến máy chủ và dịch vụ AI để phản hồi; lịch sử chỉ giữ trong phiên này.'
              : consentAt
                ? 'Lịch sử được lưu vào tài khoản. Email và số điện thoại được che trước khi lưu. Bạn có thể xóa lịch sử trong mục tài khoản.'
                : 'Nội dung được chuyển đến máy chủ và dịch vụ AI để phản hồi. Lịch sử chưa được lưu vào tài khoản; bạn có thể đồng ý lưu hoặc tiếp tục trong phiên này.'} Hệ thống hỗ trợ cảm xúc, không thay thế chuyên gia.</Text>
          </View>
          {!!historyError && <Text accessibilityRole="alert" style={styles.historyError}>{historyError}</Text>}
          {historyLoading && <View style={styles.pending}><ActivityIndicator color={colors.olive} /><Text style={styles.noteText}>Đang tải lịch sử đã lưu…</Text></View>}
          <View accessibilityLabel="Cuộc trò chuyện" style={styles.messages}>
            {messages.map(message => (
              <View key={message.id} style={[styles.messageRow, message.role === 'user' && styles.userRow]}>
                <View style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.joyBubble]}>
                  <MessageText text={message.content} />
                  {message.result && <Text style={styles.mode}>
                    {modeLabels[message.result.mode]}
                  </Text>}
                  {message.result?.sources?.map((source, index) => <Text key={index} style={styles.source}>{source.title}{source.pages ? ` · trang ${source.pages}` : ''}</Text>)}
                  {message.result?.history_saved === false && <Text style={styles.saveError}>
                    {message.result.history_error ?? (!accessToken
                      ? 'Phiên này chưa được lưu. Đăng nhập và bật lưu lịch sử để xem lại sau.'
                      : !consentAt
                        ? 'Phiên này chưa được lưu vì bạn chưa bật đồng ý lưu lịch sử.'
                        : 'Phiên này chưa được lưu vào tài khoản.')}
                  </Text>}
                  {message.result?.risk && onNavigate && <Pressable accessibilityRole="button" accessibilityLabel="Mở các kênh hỗ trợ ngay" onPress={() => onNavigate('alerts')} style={styles.supportButton}>
                    <Ionicons name="call-outline" color={colors.burgundy} size={20} /><Text style={styles.supportText}>Mở các kênh hỗ trợ ngay</Text>
                  </Pressable>}
                  {message.result?.suggest_assessment && !message.result.risk && (
                    <Text style={styles.assessmentHint}>Bạn có thể làm bài PSS-10 bằng nút “Đánh giá” ở phía trên.</Text>
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
            multiline maxLength={2000} editable={!failed && !historyLoading} value={draft} onChangeText={setDraft} style={styles.input}
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
          <Text accessibilityRole="header" style={styles.dialogTitle}>Bắt đầu phiên mới?</Text>
          <Text style={styles.dialogCopy}>Phiên mới sẽ mở trong ứng dụng. Lịch sử đã lưu trong tài khoản vẫn được giữ lại.</Text>
          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" onPress={() => setConfirmReset(false)} style={styles.smallButton}><Text style={styles.link}>Quay lại</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={reset} style={styles.primaryButton}><Text style={styles.primaryText}>Bắt đầu mới</Text></Pressable>
          </View>
        </View></View>
      </Modal>
      <Modal visible={historyOpen} transparent animationType="fade" onRequestClose={() => setHistoryOpen(false)}>
        <View style={styles.overlay}><View accessibilityViewIsModal style={styles.historyDialog}>
          <View style={styles.historyHeader}>
            <View style={styles.historyTitleGroup}>
              <Text accessibilityRole="header" style={styles.dialogTitle}>Lịch sử trò chuyện</Text>
              <Text style={styles.historySubtitle}>Các cuộc trò chuyện đã lưu vào tài khoản</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Đóng lịch sử" onPress={() => setHistoryOpen(false)} style={styles.historyClose}>
              <Ionicons name="close" size={24} color={colors.oliveDark} />
            </Pressable>
          </View>
          {!accessToken
            ? <Text style={styles.historyEmpty}>Đăng nhập để lưu và xem lại lịch sử trò chuyện.</Text>
            : !consentAt
              ? <View style={styles.historyConsentPrompt}>
                <Text style={styles.historyEmpty}>Lịch sử chỉ bắt đầu được lưu sau khi bạn đồng ý. Các phiên trước đó chưa được lưu.</Text>
                <Pressable accessibilityRole="button" disabled={historyListLoading} onPress={() => void enableHistoryFromModal()} style={styles.primaryButton}>
                  {historyListLoading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Bật lưu lịch sử</Text>}
                </Pressable>
              </View>
              : historyListLoading && conversationList.length === 0
                ? <View style={styles.pending}><ActivityIndicator color={colors.olive} /><Text style={styles.noteText}>Đang tải lịch sử…</Text></View>
                : conversationList.length === 0
                  ? <Text style={styles.historyEmpty}>Chưa có cuộc trò chuyện nào được lưu.</Text>
                  : <ScrollView style={styles.historyList}>
                    {conversationList.map(conversation => (
                      <Pressable key={conversation.id} accessibilityRole="button" disabled={historyListLoading} onPress={() => void openConversation(conversation)} style={({ pressed }) => [styles.historyItem, pressed && styles.pressed]}>
                        <View style={styles.historyItemIcon}><Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.olive} /></View>
                        <View style={styles.historyItemCopy}>
                          <Text numberOfLines={2} style={styles.historyItemTitle}>{conversation.title || 'Cuộc trò chuyện'}</Text>
                          <Text style={styles.historyItemMeta}>{new Date(conversation.started_at).toLocaleString('vi-VN')} · {Math.floor(conversation.messages / 2)} lượt</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.olive} />
                      </Pressable>
                    ))}
                  </ScrollView>}
          {!!historyListError && <Text accessibilityRole="alert" style={styles.errorText}>{historyListError}</Text>}
          {historyListLoading && conversationList.length > 0 && <View style={styles.historyLoading}><ActivityIndicator color={colors.olive} /><Text style={styles.noteText}>Đang mở cuộc trò chuyện…</Text></View>}
          <View style={styles.actionRow}>
            {accessToken && consentAt && <Pressable accessibilityRole="button" disabled={historyListLoading} onPress={() => void openHistory()} style={styles.smallButton}><Text style={styles.link}>Làm mới</Text></Pressable>}
            <Pressable accessibilityRole="button" onPress={() => setHistoryOpen(false)} style={styles.primaryButton}><Text style={styles.primaryText}>Đóng</Text></Pressable>
          </View>
        </View></View>
      </Modal>
      <Modal visible={consentOpen} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}>
          <Text accessibilityRole="header" style={styles.dialogTitle}>Đồng ý lưu lịch sử trò chuyện?</Text>
          <Text style={styles.dialogCopy}>Nếu đồng ý, tin nhắn của bạn và phản hồi sẽ được lưu trong cơ sở dữ liệu gắn với tài khoản để xem lại ở lần đăng nhập sau. Email và số điện thoại được che trước khi lưu. Bạn có thể tiếp tục dùng chat mà không lưu; có thể đổi lựa chọn trong mục tài khoản.</Text>
          {!!error && <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}
          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" disabled={consentBusy} onPress={() => void handleConsentChoice(false)} style={styles.smallButton}><Text style={styles.link}>Chỉ lưu trong phiên</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={consentBusy} onPress={() => void handleConsentChoice(true)} style={styles.primaryButton}>
              {consentBusy ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Đồng ý lưu</Text>}
            </Pressable>
          </View>
        </View></View>
      </Modal>
      {assessmentOpen && <PssAssessment onClose={() => setAssessmentOpen(false)} onNavigate={onNavigate} />}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  toolbar: { width: '100%', maxWidth: 604, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusButton: { flexDirection: 'row', gap: 7, alignItems: 'center', minHeight: 42, flexShrink: 1 },
  assessmentShortcut: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 40, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.outline },
  assessmentShortcutText: { color: colors.olive, fontSize: 13, fontWeight: '600' },
  statusDot: { width: 7, height: 7, borderRadius: 4 }, statusText: { color: colors.olive, fontSize: 12, flexShrink: 1 },
  iconButton: { padding: 10 }, scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center' }, intro: { alignItems: 'center', paddingTop: 8 },
  title: { marginTop: 16, color: colors.black, fontSize: 27, fontWeight: '700' },
  subtitle: { marginTop: 8, maxWidth: 360, color: colors.darkText, fontSize: 17, lineHeight: 25, textAlign: 'center' },
  privacyNote: { marginTop: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 13, backgroundColor: colors.cream, borderRadius: 10 },
  noteText: { flexShrink: 1, color: colors.darkText, fontSize: 12, lineHeight: 19 }, messages: { marginTop: 24 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 9 }, userRow: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '88%', padding: 14, borderRadius: 14, flexShrink: 1 }, joyBubble: { borderTopLeftRadius: 4, backgroundColor: colors.creamMuted },
  userBubble: { borderTopRightRadius: 4, backgroundColor: '#E4EBE5' }, messageText: { color: colors.darkText, fontSize: 16, lineHeight: 25 }, bold: { fontWeight: '700' },
  mode: { color: '#6A624C', fontSize: 10, lineHeight: 16, marginTop: 10 }, source: { color: colors.oliveDark, fontSize: 11, lineHeight: 17, marginTop: 4 },
  supportButton: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: '#DACDB7', flexDirection: 'row', gap: 7, alignItems: 'center', minHeight: 44 },
  supportText: { color: colors.burgundy, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  assessmentHint: { marginTop: 10, color: colors.oliveDark, fontSize: 12, lineHeight: 19 },
  saveError: { color: colors.burgundy, fontSize: 12, lineHeight: 18, marginTop: 8 },
  historyError: { color: colors.burgundy, fontSize: 13, lineHeight: 20, marginTop: 12 },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, flexWrap: 'wrap' },
  errorBox: { borderRadius: 15, padding: 15, backgroundColor: '#FFF0E6', marginBottom: 12 }, errorText: { color: '#8B3B29', fontSize: 13, lineHeight: 21 },
  historyDialog: { width: '100%', maxWidth: 480, maxHeight: '80%', backgroundColor: colors.background, borderRadius: 18, padding: 20 },
  historyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, historyTitleGroup: { flex: 1 },
  historySubtitle: { marginTop: 4, color: colors.darkText, fontSize: 13, lineHeight: 19 },
  historyClose: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  historyList: { marginTop: 14 }, historyEmpty: { paddingVertical: 28, color: colors.darkText, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  historyConsentPrompt: { alignItems: 'center', gap: 8 },
  historyItem: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.outline },
  historyItemIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  historyItemCopy: { flex: 1 }, historyItemTitle: { color: colors.black, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  historyItemMeta: { marginTop: 3, color: colors.darkText, fontSize: 11 }, historyLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10 },
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
