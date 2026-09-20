import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppTab } from '../navigation/tabs';
import {
  getAssessmentQuestions,
  scoreAssessment,
  type AssessmentQuestion,
  type AssessmentResult,
} from '../services/api';
import { colors } from '../theme/colors';

type PssAssessmentProps = {
  readonly onClose: () => void;
  readonly onNavigate?: (tab: AppTab) => void;
};

type Phase = 'consent' | 'loading' | 'questions' | 'result';

function Action({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => { onPress(); }}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PssAssessment({ onClose, onNavigate }: PssAssessmentProps) {
  const [phase, setPhase] = useState<Phase>('consent');
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const requestId = useRef(0);
  const busy = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => () => { requestId.current += 1; }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [index, phase]);

  const close = () => {
    requestId.current += 1;
    onClose();
  };

  const loadQuestions = async () => {
    if (busy.current) return;
    busy.current = true;
    const id = ++requestId.current;
    setError(null);
    setPhase('loading');
    try {
      const data = await getAssessmentQuestions();
      if (id !== requestId.current) return;
      // Answer positions must match the backend's ten scoring items.
      if (
        data.questions.length !== 10 ||
        data.questions.some((question, position) =>
          question.item_id !== position + 1 || question.options.length !== 5,
        )
      ) {
        throw new Error('Bộ câu hỏi chưa đầy đủ. Vui lòng thử lại.');
      }
      setQuestions(data.questions);
      setAnswers(data.questions.map(() => null));
      setIndex(0);
      setPhase('questions');
    } catch (failure) {
      if (id !== requestId.current) return;
      setError(failure instanceof Error ? failure.message : 'Không tải được câu hỏi. Vui lòng thử lại.');
    } finally {
      if (id === requestId.current) busy.current = false;
    }
  };

  const submit = async () => {
    if (busy.current || answers.length !== 10 || answers.some((answer) => answer === null)) return;
    busy.current = true;
    const id = ++requestId.current;
    setSubmitting(true);
    setError(null);
    try {
      const scored = await scoreAssessment(answers as number[]);
      if (id !== requestId.current) return;
      setResult(scored);
      setPhase('result');
    } catch (failure) {
      if (id !== requestId.current) return;
      setError(failure instanceof Error ? failure.message : 'Chưa tính được kết quả. Vui lòng thử gửi lại.');
    } finally {
      if (id === requestId.current) {
        busy.current = false;
        setSubmitting(false);
      }
    }
  };

  const navigate = (tab: AppTab) => {
    close();
    onNavigate?.(tab);
  };
  const question = questions[index];
  const isLastQuestion = index === questions.length - 1;

  return (
    <Modal animationType="slide" onRequestClose={close} presentationStyle="fullScreen" visible>
      <SafeAreaView style={styles.screen}>
        <View accessibilityViewIsModal style={styles.screen}>
          <View style={styles.topBar}>
            <Text style={styles.eyebrow}>CHĂM SÓC CẢM XÚC · PSS-10</Text>
            <Pressable accessibilityRole="button" onPress={close} style={styles.closeButton}>
              <Text style={styles.closeText}>{phase === 'result' ? 'Đóng' : 'Dừng bài đánh giá'}</Text>
            </Pressable>
          </View>
          <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
            <View style={styles.content}>
              {phase === 'consent' && (
                <View style={styles.stack}>
                  <Text accessibilityRole="header" style={styles.title}>Lắng nghe mức căng thẳng của bạn</Text>
                  <Text style={styles.body}>10 câu hỏi PSS-10 giúp bạn tự nhìn lại cảm nhận trong tháng vừa qua. Hãy chọn câu trả lời gần với trải nghiệm của mình nhất.</Text>
                  <View style={styles.noteCard}>
                    <Text style={styles.body}>Đây là công cụ tham khảo, không phải chẩn đoán và không thay thế hỗ trợ từ chuyên gia.</Text>
                    <Text style={styles.caption}>Khi bạn bấm xem kết quả, 10 câu trả lời sẽ được gửi đến máy chủ để tính điểm. Bạn có thể dừng trước khi gửi.</Text>
                  </View>
                  <Action label="Đồng ý, bắt đầu" onPress={loadQuestions} />
                  <Action label="Để lúc khác" onPress={close} secondary />
                </View>
              )}

              {phase === 'loading' && (
                <View style={styles.stack}>
                  <Text accessibilityRole="header" style={styles.title}>Bài đánh giá PSS-10</Text>
                  {error ? (
                    <>
                      <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
                      <Action label="Thử tải lại" onPress={loadQuestions} />
                    </>
                  ) : (
                    <View accessibilityLiveRegion="polite" style={styles.loading}>
                      <ActivityIndicator color={colors.olive} size="large" />
                      <Text style={styles.body}>Đang tải câu hỏi…</Text>
                    </View>
                  )}
                </View>
              )}

              {phase === 'questions' && question && (
                <View style={styles.stack}>
                  <Text accessibilityLiveRegion="polite" style={styles.eyebrow}>Câu {index + 1} / {questions.length}</Text>
                  <View
                    accessibilityRole="progressbar"
                    accessibilityValue={{ min: 0, max: 10, now: answers.filter((answer) => answer !== null).length }}
                    style={styles.progressTrack}
                  >
                    <View style={[styles.progressFill, { width: `${((index + 1) / questions.length) * 100}%` }]} />
                  </View>
                  <Text style={styles.caption}>Hãy nghĩ về tháng vừa qua.</Text>
                  <Text accessibilityRole="header" style={styles.question}>{question.text_vi}</Text>
                  <View accessibilityRole="radiogroup" style={styles.stack}>
                    {question.options.map((option, value) => (
                      <Pressable
                        key={`${question.item_id}-${value}`}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: answers[index] === value, disabled: submitting }}
                        disabled={submitting}
                        onPress={() => {
                          setAnswers((current) => current.map((answer, position) => position === index ? value : answer));
                          setError(null);
                        }}
                        style={({ pressed }) => [styles.option, answers[index] === value && styles.selectedOption, pressed && styles.pressed]}
                      >
                        <View style={[styles.radio, answers[index] === value && styles.selectedRadio]} />
                        <Text style={styles.optionText}>{option}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
                  {submitting && <Text accessibilityLiveRegion="polite" style={styles.caption}>Đang tính kết quả…</Text>}
                  <Action
                    disabled={answers[index] === null || submitting}
                    label={isLastQuestion ? (error ? 'Thử gửi lại' : 'Xem kết quả') : 'Câu tiếp theo'}
                    onPress={isLastQuestion ? submit : () => { setError(null); setIndex((current) => current + 1); }}
                  />
                  <Action disabled={index === 0 || submitting} label="Câu trước" onPress={() => { setError(null); setIndex((current) => current - 1); }} secondary />
                </View>
              )}

              {phase === 'result' && result && (
                <View style={styles.stack}>
                  <Text accessibilityRole="header" style={styles.title}>Kết quả PSS-10</Text>
                  <View style={styles.resultCard}>
                    <Text style={styles.caption}>Tổng điểm</Text>
                    <Text accessibilityLabel={`${result.total} trên ${result.maximum} điểm`} style={styles.score}>{result.total}<Text style={styles.scoreMaximum}> / {result.maximum}</Text></Text>
                    <Text style={styles.resultLevel}>{result.level}</Text>
                  </View>
                  <Text style={styles.body}>{result.explanation}</Text>
                  <Text style={styles.caption}>Kết quả phản ánh cảm nhận bạn vừa chia sẻ, không phải chẩn đoán sức khỏe tâm thần.</Text>
                  {result.skills.length > 0 && (
                    <View style={styles.noteCard}>
                      <Text accessibilityRole="header" style={styles.sectionTitle}>Kỹ năng gợi ý cho bạn</Text>
                      {result.skills.map((skill) => <Text key={skill.id} style={styles.body}>• {skill.title}</Text>)}
                    </View>
                  )}
                  {result.needs_support && (
                    <View style={styles.supportCard}>
                      <Text style={styles.body}>Bạn có thể cân nhắc chia sẻ với một người tin cậy hoặc chuyên gia tâm lý để được hỗ trợ thêm.</Text>
                      {onNavigate && <Action label="Xem kênh hỗ trợ" onPress={() => navigate('alerts')} secondary />}
                    </View>
                  )}
                  {onNavigate && (
                    <>
                      <Action label="Khám phá bài tập" onPress={() => navigate('exercises')} />
                      <Action label="Tâm sự cùng AI" onPress={() => navigate('chat')} secondary />
                    </>
                  )}
                  <Action label="Làm lại bài đánh giá" onPress={() => { setResult(null); setError(null); setPhase('consent'); }} secondary />
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: { padding: 18, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.outline },
  eyebrow: { color: colors.olive, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  closeButton: { alignSelf: 'flex-start', paddingVertical: 10 },
  closeText: { color: colors.darkText, fontWeight: '600', fontSize: 15 },
  scrollContent: { flexGrow: 1, padding: 24, paddingBottom: 40 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  stack: { gap: 16 },
  title: { color: colors.black, fontSize: 30, lineHeight: 39, fontWeight: '800', letterSpacing: -0.7 },
  question: { color: colors.black, fontSize: 24, lineHeight: 34, fontWeight: '700' },
  body: { color: colors.darkText, fontSize: 17, lineHeight: 27 },
  caption: { color: colors.darkText, fontSize: 14, lineHeight: 22 },
  noteCard: { backgroundColor: colors.cream, padding: 20, borderRadius: 22, gap: 12 },
  supportCard: { backgroundColor: colors.blush, padding: 20, borderRadius: 22, gap: 16 },
  button: { minHeight: 54, paddingVertical: 15, paddingHorizontal: 20, borderRadius: 28, backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.white, fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  secondaryButton: { backgroundColor: colors.cream },
  secondaryButtonText: { color: colors.darkText },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  loading: { alignItems: 'center', padding: 40, gap: 20 },
  error: { color: colors.burgundy, fontSize: 16, lineHeight: 24 },
  progressTrack: { height: 8, backgroundColor: colors.creamMuted, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.olive, borderRadius: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, padding: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.outline, borderRadius: 18 },
  selectedOption: { borderColor: colors.olive, backgroundColor: colors.cream },
  optionText: { flex: 1, color: colors.darkText, fontSize: 16, lineHeight: 23 },
  radio: { height: 22, width: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.outline },
  selectedRadio: { borderColor: colors.olive, borderWidth: 7 },
  resultCard: { alignItems: 'center', padding: 30, borderRadius: 28, backgroundColor: colors.yellow, gap: 8 },
  score: { fontSize: 58, color: colors.black, fontWeight: '800' },
  scoreMaximum: { fontSize: 26, fontWeight: '500' },
  resultLevel: { color: colors.darkText, fontSize: 22, fontWeight: '700' },
  sectionTitle: { color: colors.black, fontSize: 20, fontWeight: '700' },
});
