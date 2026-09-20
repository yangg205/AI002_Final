import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../theme/colors';
import { clampStressLevel } from '../utils/stressLevel';

const THUMB_SIZE = 38;
const ACCESSIBILITY_STEP = 0.05;

type StressLevelCardProps = {
  readonly value: number;
  readonly label: string;
  readonly onChange: (value: number) => void;
};

export function StressLevelCard({
  value,
  label,
  onChange,
}: StressLevelCardProps) {
  const trackRef = useRef<View>(null);
  const trackMetrics = useRef({ pageX: 0, width: 0 });
  const [trackWidth, setTrackWidth] = useState(0);

  const updateFromPageX = useCallback(
    (pageX: number) => {
      const { pageX: trackPageX, width } = trackMetrics.current;

      if (width <= 0) {
        return;
      }

      onChange(clampStressLevel((pageX - trackPageX) / width));
    },
    [onChange],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 3 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 3 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: (event) =>
          updateFromPageX(event.nativeEvent.pageX),
        onPanResponderMove: (event) =>
          updateFromPageX(event.nativeEvent.pageX),
        onPanResponderTerminationRequest: () => false,
      }),
    [updateFromPageX],
  );

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setTrackWidth(width);

    requestAnimationFrame(() => {
      trackRef.current?.measureInWindow((pageX) => {
        trackMetrics.current = { pageX, width };
      });
    });
  }, []);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      updateFromPageX(event.nativeEvent.pageX);
    },
    [updateFromPageX],
  );

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'increment') {
        onChange(clampStressLevel(value + ACCESSIBILITY_STEP));
      }

      if (event.nativeEvent.actionName === 'decrement') {
        onChange(clampStressLevel(value - ACCESSIBILITY_STEP));
      }
    },
    [onChange, value],
  );

  const thumbLeft = Math.max(0, trackWidth - THUMB_SIZE) * value;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Mức độ hiện tại</Text>
        <View style={styles.levelBadge}>
          <Text numberOfLines={2} style={styles.levelLabel}>
            {label}
          </Text>
        </View>
      </View>

      <View
        {...panResponder.panHandlers}
        collapsable={false}
        onLayout={handleTrackLayout}
        ref={trackRef}
        style={styles.trackTouchArea}
      >
        <Pressable
          accessibilityActions={[
            { name: 'increment', label: 'Tăng mức stress' },
            { name: 'decrement', label: 'Giảm mức stress' },
          ]}
          accessibilityLabel="Mức độ stress hiện tại"
          accessibilityRole="adjustable"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(value * 100),
            text: label,
          }}
          onAccessibilityAction={handleAccessibilityAction}
          onPress={handlePress}
          style={styles.trackPressable}
          testID="stress-slider"
        >
          <LinearGradient
            colors={['#75E98C', '#F6E733', '#FF8E93', '#C85B89']}
            end={{ x: 1, y: 0 }}
            start={{ x: 0, y: 0 }}
            style={[styles.gradientTrack, { pointerEvents: 'none' }]}
          />

          <View
            style={[styles.thumb, { left: thumbLeft, pointerEvents: 'none' }]}
          >
            <Ionicons
              color={colors.burgundy}
              name="reorder-two-outline"
              size={19}
            />
          </View>
        </Pressable>
      </View>

      <View style={styles.emojiRow} accessible={false}>
        <Text style={styles.emoji}>😊</Text>
        <Text style={styles.emoji}>😐</Text>
        <Text style={styles.emoji}>😵</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingTop: 25,
    paddingRight: 25,
    paddingBottom: 22,
    paddingLeft: 25,
    borderRadius: 50,
    backgroundColor: colors.cream,
    shadowColor: '#7B6500',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    flex: 1,
    color: '#17140F',
    fontSize: 23,
    fontWeight: '800',
  },
  levelBadge: {
    minHeight: 36,
    maxWidth: 132,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#FFD921',
  },
  levelLabel: {
    color: '#695B1D',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  trackTouchArea: {
    height: 38,
    marginTop: 38,
  },
  trackPressable: {
    flex: 1,
    justifyContent: 'center',
  },
  gradientTrack: {
    position: 'absolute',
    right: 0,
    left: 0,
    height: 28,
    borderRadius: 30,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: colors.burgundy,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
  },
  emojiRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emoji: {
    fontSize: 24,
  },
});
