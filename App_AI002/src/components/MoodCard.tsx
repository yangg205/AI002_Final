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
          style={[styles.iconCircle, { backgroundColor: mood.color }]}
        >
          <Ionicons color={mood.iconColor} name={mood.icon} size={43} />
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
    aspectRatio: 1.18,
    overflow: 'visible',
  },
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    borderRadius: 43,
    borderWidth: 2.5,
    borderColor: 'transparent',
    backgroundColor: colors.cream,
    shadowColor: '#7B6500',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  selectedCard: {
    borderColor: colors.burgundy,
    backgroundColor: '#FFE5EB',
  },
  pressedCard: {
    opacity: 0.78,
  },
  iconCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 11,
    paddingHorizontal: 7,
    color: '#17140F',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: -10,
    right: -8,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.burgundy,
  },
});
