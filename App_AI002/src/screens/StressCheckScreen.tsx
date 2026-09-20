import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HeroIllustration } from '../components/HeroIllustration';
import { MoodCard } from '../components/MoodCard';
import { PssAssessment } from '../components/PssAssessment';
import { SaveResultButton } from '../components/SaveResultButton';
import { StressLevelCard } from '../components/StressLevelCard';
import { moodOptions } from '../data/moodOptions';
import type { AppTab } from '../navigation/tabs';
import { colors } from '../theme/colors';
import { getStressLevelLabel } from '../utils/stressLevel';

const DEFAULT_STRESS_LEVEL = 0.3;
const DEFAULT_MOOD_ID = 'gloomy';

type StressCheckScreenProps = {
  readonly onNotify: (text: string) => void;
  readonly onNavigate?: (tab: AppTab) => void;
  readonly assessmentRequest?: number;
};

type MoodEntry = {
  readonly id: number;
  readonly mood: string;
  readonly stressLabel: string;
  readonly savedAt: string;
};

export function StressCheckScreen({ onNotify, onNavigate, assessmentRequest = 0 }: StressCheckScreenProps) {
  const [stressLevel, setStressLevel] = useState(DEFAULT_STRESS_LEVEL);
  const [selectedMoodId, setSelectedMoodId] = useState(DEFAULT_MOOD_ID);
  const [moodHistory, setMoodHistory] = useState<MoodEntry[]>([]);
  const [assessmentOpen, setAssessmentOpen] = useState(assessmentRequest > 0);
  const nextEntryId = useRef(0);

  useEffect(() => {
    if (assessmentRequest > 0) setAssessmentOpen(true);
  }, [assessmentRequest]);

  const stressLabel = useMemo(
    () => getStressLevelLabel(stressLevel),
    [stressLevel],
  );
  const selectedMood = moodOptions.find(
    (mood) => mood.id === selectedMoodId,
  );

  const handleSave = useCallback(() => {
    if (selectedMood) {
      const entry: MoodEntry = {
        id: ++nextEntryId.current,
        mood: selectedMood.label,
        stressLabel,
        savedAt: new Date().toLocaleString('vi-VN', {
          hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
        }),
      };
      setMoodHistory((history) => [entry, ...history].slice(0, 20));
      onNotify(`Đã lưu trong phiên: ${selectedMood.label} • ${stressLabel}`);
    }
  }, [onNotify, selectedMood, stressLabel]);

  return (
    <>
    <ScrollView
      bounces
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <View style={styles.content}>
        <HeroIllustration />

        <Text accessibilityRole="header" style={styles.pageTitle}>
          Đo Stress
        </Text>
        <Text style={styles.description}>
          Cùng kiểm tra xem hôm nay bạn cảm thấy thế nào nhé!
        </Text>

        <View style={styles.assessmentCard}>
          <Text accessibilityRole="header" style={styles.cardTitle}>Hiểu thêm về căng thẳng</Text>
          <Text style={styles.cardDescription}>10 câu hỏi PSS-10 để nhìn lại tháng vừa qua, kèm gợi ý chăm sóc bản thân.</Text>
          <Pressable accessibilityRole="button" onPress={() => setAssessmentOpen(true)} style={({ pressed }) => [styles.assessmentButton, pressed && styles.pressed]}>
            <Text style={styles.assessmentButtonText}>Làm bài đánh giá PSS-10</Text>
          </Pressable>
        </View>

        <View style={styles.stressCardSpacing}>
          <Text style={styles.sessionNote}>Ghi nhận hôm nay · Mức tự cảm nhận, không phải điểm PSS-10</Text>
          <StressLevelCard
            label={stressLabel}
            onChange={setStressLevel}
            value={stressLevel}
          />
        </View>

        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Hôm nay bạn thấy thế nào?
        </Text>

        <View accessibilityRole="radiogroup" style={styles.moodGrid}>
          {moodOptions.map((mood) => (
            <MoodCard
              key={mood.id}
              mood={mood}
              onPress={() => setSelectedMoodId(mood.id)}
              selected={selectedMoodId === mood.id}
            />
          ))}
        </View>

        <View style={styles.saveButtonSpacing}>
          <SaveResultButton onPress={handleSave} />
          <Text style={styles.sessionNote}>Chỉ giữ 20 lần ghi nhận gần nhất trong phiên này. Đóng hoặc tải lại ứng dụng sẽ xóa lịch sử.</Text>
        </View>

        {moodHistory.length > 0 && (
          <View style={styles.historyCard}>
            <Text accessibilityRole="header" style={styles.cardTitle}>Nhật ký trong phiên</Text>
            {moodHistory.map((entry) => (
              <View key={entry.id} style={styles.historyEntry} testID="mood-history-entry">
                <Text style={styles.historyTime}>{entry.savedAt}</Text>
                <Text style={styles.historyMood}>{entry.mood}</Text>
                <Text style={styles.cardDescription}>{entry.stressLabel}</Text>
              </View>
            ))}
            <Pressable accessibilityRole="button" onPress={() => { setMoodHistory([]); onNotify('Đã xóa nhật ký trong phiên'); }} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Xóa nhật ký trong phiên</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
    {assessmentOpen && <PssAssessment onClose={() => setAssessmentOpen(false)} onNavigate={onNavigate} />}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 28,
    paddingRight: 22,
    paddingBottom: 40,
    paddingLeft: 22,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  pageTitle: {
    marginTop: 24,
    color: colors.black,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.5,
    lineHeight: 45,
    textAlign: 'center',
  },
  description: {
    maxWidth: 390,
    marginTop: 14,
    alignSelf: 'center',
    color: colors.darkText,
    fontSize: 19,
    lineHeight: 29,
    textAlign: 'center',
  },
  stressCardSpacing: {
    marginTop: 32,
    gap: 12,
  },
  sectionTitle: {
    marginTop: 38,
    color: colors.black,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  moodGrid: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  saveButtonSpacing: {
    marginTop: 34,
    gap: 12,
  },
  assessmentCard: { marginTop: 28, borderRadius: 24, backgroundColor: colors.cream, padding: 22, gap: 12 },
  cardTitle: { color: colors.black, fontSize: 22, lineHeight: 29, fontWeight: '700' },
  cardDescription: { color: colors.darkText, fontSize: 16, lineHeight: 24 },
  assessmentButton: { backgroundColor: colors.yellow, minHeight: 52, padding: 15, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  assessmentButtonText: { color: colors.darkText, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.72 },
  sessionNote: { color: colors.darkText, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  historyCard: { marginTop: 30, padding: 22, borderRadius: 24, backgroundColor: colors.cream, gap: 18 },
  historyEntry: { borderBottomWidth: 1, borderBottomColor: colors.outline, paddingBottom: 14, gap: 3 },
  historyTime: { color: colors.oliveDark, fontSize: 13, lineHeight: 20 },
  historyMood: { color: colors.black, fontWeight: '700', fontSize: 17, lineHeight: 25 },
  clearButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  clearButtonText: { color: colors.burgundy, fontSize: 15, fontWeight: '600' },
});
