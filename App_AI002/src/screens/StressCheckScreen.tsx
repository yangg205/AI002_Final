import { useCallback, useEffect, useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MoodCard } from '../components/MoodCard';
import { SaveResultButton } from '../components/SaveResultButton';
import { StressLevelCard } from '../components/StressLevelCard';
import { moodOptions } from '../data/moodOptions';
import { colors } from '../theme/colors';
import { getStressLevelLabel } from '../utils/stressLevel';
import {
  clearMoodCheckins,
  loadMoodCheckins,
  recommendExercise,
  saveMoodCheckin,
  type ExerciseRecommendationId,
  type MoodCheckin,
} from '../services/moodCheckins';

const DEFAULT_STRESS_LEVEL = 0.3;
const DEFAULT_MOOD_ID = 'gloomy';

type StressCheckScreenProps = {
  readonly onNotify: (text: string) => void;
  readonly accountKey?: string;
  readonly onOpenExercise: (exerciseId: ExerciseRecommendationId) => void;
  readonly onShareWithJoy: (message: string) => void;
};

const exerciseDetails: Record<ExerciseRecommendationId, { title: string; duration: string; reason: string }> = {
  breathing: { title: 'Hít thở sâu', duration: '3 phút', reason: 'mức căng thẳng tự nhận thấy đang cao hoặc bạn thấy quá tải' },
  music: { title: 'Nghe nhạc vui', duration: '5 phút', reason: 'một khoảng nghỉ nhẹ nhàng có thể phù hợp với cảm nhận hiện tại' },
  dance: { title: 'Nhảy theo nhạc', duration: '10 phút', reason: 'bạn đang thấy khá ổn và có thể muốn duy trì cảm giác đó bằng chuyển động nhẹ' },
};

export function StressCheckScreen({ onNotify, accountKey, onOpenExercise, onShareWithJoy }: StressCheckScreenProps) {
  const [stressLevel, setStressLevel] = useState(DEFAULT_STRESS_LEVEL);
  const [selectedMoodId, setSelectedMoodId] = useState(DEFAULT_MOOD_ID);
  const [moodHistory, setMoodHistory] = useState<MoodCheckin[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    setMoodHistory([]);
    setSelectedMoodId(DEFAULT_MOOD_ID);
    setStressLevel(DEFAULT_STRESS_LEVEL);
    void loadMoodCheckins(accountKey).then((entries) => {
      if (!active) return;
      setMoodHistory(entries);
      if (entries[0]) {
        setSelectedMoodId(entries[0].moodId);
        setStressLevel(entries[0].stressValue / 100);
      }
    }).catch(() => {
      if (active) onNotify('Chưa tải được nhật ký đo stress trên thiết bị.');
    }).finally(() => {
      if (active) setHistoryLoading(false);
    });
    return () => { active = false; };
  }, [accountKey, onNotify]);

  const stressLabel = useMemo(
    () => getStressLevelLabel(stressLevel),
    [stressLevel],
  );
  const selectedMood = moodOptions.find(
    (mood) => mood.id === selectedMoodId,
  );

  const handleSave = useCallback(async () => {
    if (!selectedMood || saving) return;
    setSaving(true);
    const recordedAt = new Date().toISOString();
    const stressValue = Math.round(stressLevel * 100);
    const entry: MoodCheckin = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      moodId: selectedMood.id,
      moodLabel: selectedMood.label,
      stressValue,
      recordedAt,
      recommendedExerciseId: recommendExercise(selectedMood.id, stressValue),
    };
    try {
      const updated = await saveMoodCheckin(accountKey, entry);
      setMoodHistory(updated);
      onNotify(`Đã lưu trên thiết bị: ${selectedMood.label} • ${stressLabel}`);
    } catch {
      onNotify('Chưa lưu được kết quả đo stress. Bạn thử lại nhé.');
    } finally {
      setSaving(false);
    }
  }, [accountKey, onNotify, saving, selectedMood, stressLabel, stressLevel]);

  const handleClearHistory = useCallback(async () => {
    try {
      await clearMoodCheckins(accountKey);
      setMoodHistory([]);
      onNotify('Đã xóa nhật ký đo stress trên thiết bị.');
    } catch {
      onNotify('Chưa xóa được nhật ký. Bạn thử lại nhé.');
    }
  }, [accountKey, onNotify]);

  const recentEntries = moodHistory.slice(0, 7);
  const recentAverage = recentEntries.length
    ? Math.round(recentEntries.reduce((sum, entry) => sum + entry.stressValue, 0) / recentEntries.length)
    : null;
  const trend = recentEntries.length > 1
    ? recentEntries[0]!.stressValue - recentEntries[recentEntries.length - 1]!.stressValue
    : 0;
  const trendLabel = trend >= 10
    ? 'cao hơn lần ghi nhận đầu trong nhóm này'
    : trend <= -10
      ? 'thấp hơn lần ghi nhận đầu trong nhóm này'
      : 'gần như ổn định trong nhóm này';
  const latestEntry = moodHistory[0];
  const latestExercise = latestEntry
    ? exerciseDetails[latestEntry.recommendedExerciseId]
    : null;

  const handleShareLatestWithJoy = useCallback(() => {
    if (!latestEntry) return;
    const date = new Date(latestEntry.recordedAt).toLocaleDateString('vi-VN');
    const level = getStressLevelLabel(latestEntry.stressValue / 100);
    onShareWithJoy(
      `Mình đã ghi nhận ngày ${date}: tâm trạng là “${latestEntry.moodLabel}”, mức căng thẳng tự cảm nhận là “${level}”. Đây không phải kết quả PSS-10. Bạn có thể hỏi mình điều gì đang ảnh hưởng đến cảm giác này, rồi cùng mình nghĩ một bước nhỏ phù hợp không?`,
    );
  }, [latestEntry, onShareWithJoy]);

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
        <Text accessibilityRole="header" style={styles.pageTitle}>
          Đo Stress
        </Text>
        <Text style={styles.description}>
          Ghi lại cảm nhận mỗi ngày để nhận ra thay đổi. Dựa trên lựa chọn của bạn, ứng dụng cũng gợi ý một hoạt động phù hợp.
        </Text>

        <View style={styles.stressCardSpacing}>
          <Text style={styles.sessionNote}>Lần ghi nhận này · Mức tự cảm nhận, không phải điểm PSS-10</Text>
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
          <SaveResultButton disabled={historyLoading || saving} onPress={() => void handleSave()} />
          <Text style={styles.sessionNote}>Tối đa 20 lần đo được lưu riêng trên thiết bị. Chỉ dữ liệu bạn chủ động gửi qua chat mới được chuyển tới AI.</Text>
        </View>

        {moodHistory.length > 0 && (
          <View style={styles.historyCard}>
            <Text accessibilityRole="header" style={styles.cardTitle}>Nhật ký đo stress</Text>
            {recentAverage !== null && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Xu hướng gần đây · {recentEntries.length} lần đo</Text>
                <Text style={styles.summaryText}>
                  Mức tự cảm nhận trung bình: {getStressLevelLabel(recentAverage / 100)}.
                </Text>
                {recentEntries.length > 1 && <Text style={styles.summaryText}>{trendLabel}.</Text>}
                <Text style={styles.sessionNote}>Chỉ để bạn tự theo dõi, không phải đánh giá lâm sàng.</Text>
              </View>
            )}
            {latestEntry && latestExercise && (
              <View style={styles.recommendationCard}>
                <Text style={styles.summaryTitle}>Gợi ý từ lần đo mới nhất</Text>
                <Text style={styles.summaryText}>
                  Vì {latestExercise.reason}, bạn có thể thử {latestExercise.title} trong {latestExercise.duration}.
                </Text>
                <Pressable accessibilityRole="button" onPress={() => onOpenExercise(latestEntry.recommendedExerciseId)} style={styles.recommendButton}>
                  <Ionicons name="play" color="#FFFFFF" size={17} />
                  <Text style={styles.recommendButtonText}>Mở bài tập gợi ý</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={handleShareLatestWithJoy} style={styles.shareButton}>
                  <Ionicons name="chatbubble-ellipses-outline" color={colors.olive} size={18} />
                  <Text style={styles.shareButtonText}>Trao đổi lần đo này với Joy</Text>
                </Pressable>
              </View>
            )}
            {moodHistory.map((entry) => (
              <View key={entry.id} style={styles.historyEntry} testID="mood-history-entry">
                <Text style={styles.historyTime}>{new Date(entry.recordedAt).toLocaleString('vi-VN', {
                  hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
                })}</Text>
                <Text style={styles.historyMood}>{entry.moodLabel}</Text>
                <Text style={styles.cardDescription}>
                  {getStressLevelLabel(entry.stressValue / 100)}
                </Text>
              </View>
            ))}
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => void handleClearHistory()} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Xóa nhật ký trên thiết bị</Text>
            </Pressable>
          </View>
        )}
        {historyLoading && <Text style={styles.sessionNote}>Đang tải nhật ký trên thiết bị…</Text>}
      </View>
    </ScrollView>
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
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 39,
    textAlign: 'center',
  },
  description: {
    maxWidth: 390,
    marginTop: 14,
    alignSelf: 'center',
    color: colors.darkText,
    fontSize: 16,
    lineHeight: 25,
    textAlign: 'center',
  },
  stressCardSpacing: {
    marginTop: 32,
    gap: 12,
  },
  sectionTitle: {
    marginTop: 38,
    color: colors.black,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
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
  cardTitle: { color: colors.black, fontSize: 22, lineHeight: 29, fontWeight: '700' },
  cardDescription: { color: colors.darkText, fontSize: 16, lineHeight: 24 },
  pressed: { opacity: 0.72 },
  sessionNote: { color: colors.darkText, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  historyCard: { marginTop: 30, padding: 18, borderRadius: 14, backgroundColor: colors.cream, gap: 18 },
  summaryCard: { padding: 14, borderRadius: 12, backgroundColor: colors.creamMuted, gap: 6 },
  recommendationCard: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.olive, backgroundColor: '#F8FAF7', gap: 10 },
  summaryTitle: { color: colors.oliveDark, fontSize: 14, fontWeight: '700' },
  summaryText: { color: colors.darkText, fontSize: 15, lineHeight: 22 },
  historyEntry: { borderBottomWidth: 1, borderBottomColor: colors.outline, paddingBottom: 14, gap: 3 },
  historyTime: { color: colors.oliveDark, fontSize: 13, lineHeight: 20 },
  historyMood: { color: colors.black, fontWeight: '700', fontSize: 17, lineHeight: 25 },
  recommendButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 24, backgroundColor: colors.olive },
  recommendButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  shareButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareButtonText: { color: colors.oliveDark, fontSize: 14, fontWeight: '700' },
  clearButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  clearButtonText: { color: colors.burgundy, fontSize: 15, fontWeight: '600' },
});
