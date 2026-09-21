import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors } from '../theme/colors';
import type { ExerciseRecommendationId } from '../services/moodCheckins';

type IconName = ComponentProps<typeof Ionicons>['name'];

type ExercisesScreenProps = {
  readonly active?: boolean;
  readonly onNotify: (text: string) => void;
  readonly recommendationRequest?: { readonly id: number; readonly exerciseId: ExerciseRecommendationId } | null;
};

type Exercise = {
  readonly id: 'breathing' | 'music' | 'dance';
  readonly title: string;
  readonly description: string;
  readonly duration: string;
  readonly durationSeconds: number;
  readonly instructions: string;
  readonly icon: IconName;
  readonly iconBackground: string;
  readonly iconColor: string;
  readonly buttonColor: string;
  readonly activeBorder: string;
};

const exercises: readonly Exercise[] = [
  {
    id: 'breathing',
    title: 'Hít thở sâu',
    description:
      'Dành một khoảng nghỉ để chú ý đến hơi thở, theo nhịp bạn thấy thoải mái.',
    duration: '3 phút',
    durationSeconds: 180,
    instructions:
      'Ngồi thoải mái. Hít vào nhẹ qua mũi và thở ra qua miệng, không gắng sức. Nhịp đếm chỉ là gợi ý; bạn có thể thở tự nhiên hoặc dừng bất cứ lúc nào.',
    icon: 'leaf-outline',
    iconBackground: colors.mint,
    iconColor: colors.olive,
    buttonColor: colors.olive,
    activeBorder: colors.olive,
  },
  {
    id: 'music',
    title: 'Nghe nhạc vui',
    description:
      'Dành thời gian lắng nghe một bản nhạc bạn yêu thích.',
    duration: '5 phút',
    durationSeconds: 300,
    instructions:
      'Mở bản nhạc bạn thích trong ứng dụng nghe nhạc trước khi bắt đầu, với âm lượng dễ chịu. JoyfulMind chỉ đếm thời gian, không phát nhạc. Chú ý đến những âm thanh bạn nghe thấy.',
    icon: 'headset-outline',
    iconBackground: colors.cream,
    iconColor: colors.olive,
    buttonColor: colors.olive,
    activeBorder: colors.olive,
  },
  {
    id: 'dance',
    title: 'Nhảy theo nhạc',
    description:
      'Thử chuyển động nhẹ nhàng theo nhịp nhạc và khả năng của bạn.',
    duration: '10 phút',
    durationSeconds: 600,
    instructions:
      'Chọn một khoảng trống an toàn và tự mở nhạc nếu muốn. Bắt đầu bằng những chuyển động nhẹ, có thể ngồi hoặc đứng. Nghỉ hoặc dừng khi thấy không thoải mái.',
    icon: 'sparkles-outline',
    iconBackground: colors.cream,
    iconColor: colors.olive,
    buttonColor: colors.olive,
    activeBorder: colors.olive,
  },
] as const;

const feedbackOptions = [
  { id: 'relieved', label: 'Nhẹ nhõm', icon: 'happy-outline' },
  { id: 'calm', label: 'Bình tĩnh', icon: 'happy-outline' },
  { id: 'energized', label: 'Vui hơn', icon: 'sparkles-outline' },
  { id: 'unchanged', label: 'Chưa thay đổi', icon: 'remove-circle-outline' },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  icon: IconName;
}>;

type ExerciseId = Exercise['id'];
type FeedbackId = (typeof feedbackOptions)[number]['id'];

export function ExercisesScreen({ active = true, onNotify, recommendationRequest }: ExercisesScreenProps) {
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const [activeExerciseId, setActiveExerciseId] =
    useState<ExerciseId | null>(null);
  const [selectedFeedback, setSelectedFeedback] =
    useState<FeedbackId | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!active) setRunning(false);
  }, [active]);

  useEffect(() => {
    if (!recommendationRequest) return;
    const recommended = exercises.find((item) => item.id === recommendationRequest.exerciseId);
    if (!recommended) return;
    setActiveExerciseId(recommended.id);
    setRemainingSeconds(recommended.durationSeconds);
    setSelectedFeedback(null);
    setRunning(false);
    onNotify(`Joy gợi ý ${recommended.title} từ lần đo stress gần nhất. Bấm bắt đầu khi bạn sẵn sàng.`);
  }, [recommendationRequest, onNotify]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setRunning(false);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!active || !running) return;

    const interval = setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [active, running]);

  useEffect(() => {
    if (running && remainingSeconds === 0) {
      setRunning(false);
      const exercise = exercises.find((item) => item.id === activeExerciseId);
      onNotify(`Bạn đã hoàn thành bài tập ${exercise?.title ?? ''}. Hãy dành một chút thời gian cảm nhận.`);
    }
  }, [activeExerciseId, onNotify, remainingSeconds, running]);

  const toggleExercise = (exercise: Exercise) => {
    if (!active) return;
    if (activeExerciseId === exercise.id && running) {
      setRunning(false);
      onNotify(`Đã tạm dừng bài tập ${exercise.title}`);
      return;
    }

    const resuming = activeExerciseId === exercise.id && remainingSeconds > 0 && remainingSeconds < exercise.durationSeconds;
    if (!resuming) {
      setRemainingSeconds(exercise.durationSeconds);
      setSelectedFeedback(null);
    }
    setActiveExerciseId(exercise.id);
    setRunning(true);
    onNotify(resuming
      ? `Tiếp tục bài tập ${exercise.title}`
      : `Bắt đầu bài tập ${exercise.title} trong ${exercise.duration}`);
  };

  const resetExercise = (exercise: Exercise) => {
    setRunning(false);
    setRemainingSeconds(exercise.durationSeconds);
    setSelectedFeedback(null);
    onNotify(`Đã đặt lại bài tập ${exercise.title}`);
  };

  const selectFeedback = (id: FeedbackId, label: string) => {
    setSelectedFeedback(id);
    onNotify(`Cảm ơn bạn đã chia sẻ: ${label}`);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <View
        style={[
          styles.content,
          compact && styles.compactContent,
        ]}
      >
        <View accessible accessibilityLabel="Thư giãn cùng JoyfulMind" style={styles.eyebrow}>
          <Ionicons color={colors.burgundy} name="flower-outline" size={16} />
          <Text style={styles.eyebrowText}>Bài tập thư giãn</Text>
        </View>

        <Text
          accessibilityRole="header"
          style={[styles.title, compact && styles.compactTitle]}
        >
          Bài tập thư giãn
        </Text>
        <Text style={styles.subtitle}>
          Dành vài phút cho bản thân. Bộ đếm sẽ tạm dừng khi bạn rời màn hình hoặc chuyển ứng dụng.
        </Text>

        {recommendationRequest && activeExerciseId === recommendationRequest.exerciseId && (
          <View style={styles.recommendationBanner}>
            <Ionicons name="sparkles-outline" size={19} color={colors.oliveDark} />
            <Text style={styles.recommendationText}>
              Bài này được gợi ý theo lần đo stress tự cảm nhận gần nhất. Bạn có thể chọn bài khác nếu muốn.
            </Text>
          </View>
        )}

        <View accessibilityLabel="Danh sách bài tập thư giãn" style={styles.exerciseList}>
          {exercises.map((exercise) => {
            const selected = exercise.id === activeExerciseId;
            const isRunning = selected && running && active;
            const completed = selected && remainingSeconds === 0;
            const started = selected && remainingSeconds < exercise.durationSeconds;
            const actionLabel = isRunning ? 'Tạm dừng' : completed ? 'Tập lại' : started ? 'Tiếp tục' : 'Bắt đầu';
            const elapsedSeconds = exercise.durationSeconds - remainingSeconds;
            const breathPhase = elapsedSeconds % 10;

            return (
              <View
                key={exercise.id}
                style={[
                  styles.exerciseCard,
                  { borderColor: selected ? exercise.activeBorder : colors.outline },
                  compact && styles.compactCard,
                ]}
              >
                <View style={styles.cardHeader}>
                  <View
                    accessible={false}
                    style={[
                      styles.exerciseIcon,
                      { backgroundColor: exercise.iconBackground },
                    ]}
                  >
                    <Ionicons
                      color={exercise.iconColor}
                      name={exercise.icon}
                      size={27}
                    />
                  </View>

                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{exercise.duration}</Text>
                  </View>
                </View>

                <Text accessibilityRole="header" style={styles.cardTitle}>
                  {exercise.title}
                </Text>
                <Text style={styles.cardDescription}>{exercise.description}</Text>

                <Text style={styles.instructions}>{exercise.instructions}</Text>

                {selected && (
                  <View style={styles.timerPanel}>
                    <Text style={styles.timerStatus}>
                      {completed ? 'Hoàn thành' : isRunning ? 'Đang thực hiện' : started ? 'Đã tạm dừng' : 'Sẵn sàng'}
                    </Text>
                    <Text
                      accessibilityLabel={`Thời gian còn lại: ${Math.floor(remainingSeconds / 60)} phút ${remainingSeconds % 60} giây`}
                      style={[styles.timer, { color: exercise.buttonColor }]}
                      testID={`exercise-timer-${exercise.id}`}
                    >
                      {`${Math.floor(remainingSeconds / 60).toString().padStart(2, '0')}:${(remainingSeconds % 60).toString().padStart(2, '0')}`}
                    </Text>
                    <Text style={styles.guidance} testID={`exercise-guidance-${exercise.id}`}>
                      {completed
                        ? 'Bạn đã dành thời gian cho bản thân. Hãy ghi nhận cảm giác của mình bên dưới.'
                        : exercise.id === 'breathing'
                          ? `${breathPhase < 5 ? 'Hít vào nhẹ nhàng' : 'Thở ra nhẹ nhàng'} · ${breathPhase % 5 + 1}/5`
                          : exercise.id === 'music'
                            ? 'Lắng nghe theo cách bạn thấy dễ chịu.'
                            : 'Chuyển động nhẹ nhàng, theo nhịp của bạn.'}
                    </Text>
                    <Pressable
                      accessibilityLabel={`Đặt lại ${exercise.title}`}
                      accessibilityRole="button"
                      onPress={() => resetExercise(exercise)}
                      style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
                    >
                      <Ionicons color={colors.darkText} name="refresh-outline" size={18} />
                      <Text style={styles.resetButtonText}>Đặt lại thời gian</Text>
                    </Pressable>
                  </View>
                )}

                <Pressable
                  accessibilityHint={
                    isRunning
                      ? 'Tạm dừng bài tập đang thực hiện'
                      : `Bắt đầu bài tập kéo dài ${exercise.duration}`
                  }
                  accessibilityLabel={`${actionLabel} ${exercise.title}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isRunning }}
                  onPress={() => toggleExercise(exercise)}
                  style={({ pressed }) => [
                    styles.startButton,
                    { backgroundColor: exercise.buttonColor },
                    pressed && styles.pressed,
                  ]}
                  testID={`exercise-${exercise.id}`}
                >
                  <Ionicons
                    color="#FFFFFF"
                    name={isRunning ? 'pause' : 'play'}
                    size={17}
                  />
                  <Text style={styles.startButtonText}>
                    {actionLabel}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <Text accessibilityRole="header" style={styles.feedbackTitle}>
          Bạn cảm thấy thế nào sau khi tập?
        </Text>
        <Text style={styles.instructions}>Cảm nhận được ghi nhận trong phiên sử dụng này.</Text>

        <ScrollView
          accessibilityRole="radiogroup"
          contentContainerStyle={styles.feedbackRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {feedbackOptions.map((option) => {
            const selected = option.id === selectedFeedback;

            return (
              <Pressable
                accessibilityLabel={option.label}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={option.id}
                onPress={() => selectFeedback(option.id, option.label)}
                style={({ pressed }) => [
                  styles.feedbackChip,
                  selected && styles.selectedFeedbackChip,
                  pressed && styles.pressed,
                ]}
                testID={`exercise-feedback-${option.id}`}
              >
                <Ionicons
                  color={selected ? colors.burgundy : colors.darkText}
                  name={selected ? 'checkmark-circle' : option.icon}
                  size={19}
                />
                <Text
                  style={[
                    styles.feedbackText,
                    selected && styles.selectedFeedbackText,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
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
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  compactContent: {
    width: '100%',
  },
  eyebrow: {
    minHeight: 34,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.cream,
  },
  eyebrowText: {
    color: colors.oliveDark,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  title: {
    marginTop: 18,
    color: colors.black,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  compactTitle: {
    fontSize: 28,
    lineHeight: 35,
  },
  subtitle: {
    maxWidth: 410,
    marginTop: 10,
    color: colors.darkText,
    fontSize: 16,
    lineHeight: 24,
  },
  recommendationBanner: {
    marginTop: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    backgroundColor: colors.mint,
  },
  recommendationText: { flex: 1, color: colors.oliveDark, fontSize: 14, lineHeight: 21 },
  exerciseList: {
    marginTop: 28,
    gap: 24,
  },
  exerciseCard: {
    overflow: 'hidden',
    padding: 18,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: colors.white,
  },
  compactCard: {
    padding: 16,
    borderRadius: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseIcon: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  durationBadge: {
    minHeight: 31,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.cream,
  },
  durationText: {
    color: colors.darkText,
    fontSize: 13,
    fontWeight: '600',
  },
  cardTitle: {
    marginTop: 18,
    color: colors.black,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 24,
  },
  cardDescription: {
    marginTop: 6,
    color: colors.darkText,
    fontSize: 15,
    lineHeight: 22,
  },
  artworkFrame: {
    width: '100%',
    aspectRatio: 1.75,
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  startButton: {
    minHeight: 50,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 10,
  },
  instructions: {
    marginTop: 12,
    color: colors.darkText,
    fontSize: 14,
    lineHeight: 22,
  },
  timerPanel: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  timerStatus: { color: colors.darkText, fontSize: 13, fontWeight: '600' },
  timer: { marginTop: 4, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  guidance: { marginTop: 6, color: colors.darkText, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  resetButton: { minHeight: 44, marginTop: 8, flexDirection: 'row', gap: 7, alignItems: 'center', paddingHorizontal: 12 },
  resetButtonText: { color: colors.darkText, fontWeight: '600' },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  feedbackTitle: {
    marginTop: 34,
    color: colors.black,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  feedbackRow: {
    gap: 10,
    paddingTop: 14,
    paddingRight: 20,
    paddingBottom: 4,
  },
  feedbackChip: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 17,
    borderWidth: 1.5,
    borderColor: colors.outline,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  selectedFeedbackChip: {
    borderColor: colors.olive,
    backgroundColor: colors.cream,
  },
  feedbackText: {
    color: colors.darkText,
    fontSize: 14,
    fontWeight: '600',
  },
  selectedFeedbackText: {
    color: colors.burgundy,
  },
  pressed: {
    opacity: 0.72,
  },
});
