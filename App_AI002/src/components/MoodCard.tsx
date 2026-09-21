import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { MoodOption } from '../data/moodOptions';
import { colors } from '../theme/colors';

type MoodCardProps = {
  readonly mood: MoodOption;
  readonly selected: boolean;
  readonly onPress: () => void;
};

export function MoodCard({ mood, selected, onPress }: MoodCardProps) {
  const scale = useRef(new Animated.Value(selected ? 1 : 0.985)).current;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: selected ? 1 : 0.985,
      duration: 180,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [scale, selected]);

  return (
    <Animated.View
      style={[styles.wrapper, { transform: [{ scale }] }]}
    >
      <Pressable
        accessibilityLabel={mood.label}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          selected && styles.selectedCard,
          pressed && styles.pressedCard,
        ]}
        testID={`mood-${mood.id}`}
      >
        <View
          style={[styles.iconCircle, { backgroundColor: colors.cream }]}
        >
          <Ionicons color={colors.olive} name={mood.icon} size={32} />
        </View>
        <Text style={styles.label}>{mood.label}</Text>

        {selected ? (
          <View style={styles.checkBadge}>
            <Ionicons color="#FFFFFF" name="checkmark" size={22} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '47.6%',
    aspectRatio: 1.4,
    overflow: 'visible',
  },
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.white,
  },
  selectedCard: {
    borderColor: colors.olive,
    backgroundColor: colors.cream,
  },
  pressedCard: {
    opacity: 0.78,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 7,
    paddingHorizontal: 7,
    color: colors.black,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.olive,
  },
});
