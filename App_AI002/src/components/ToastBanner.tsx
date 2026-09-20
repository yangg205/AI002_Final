import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

export type ToastMessage = {
  readonly id: number;
  readonly text: string;
};

type ToastBannerProps = {
  readonly toast: ToastMessage | null;
  readonly bottomOffset: number;
  readonly onDismiss: () => void;
};

export function ToastBanner({
  toast,
  bottomOffset,
  onDismiss,
}: ToastBannerProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!toast) {
      return;
    }

    opacity.stopAnimation();
    translateY.stopAnimation();
    opacity.setValue(0);
    translateY.setValue(12);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(translateY, {
          toValue: 8,
          duration: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(({ finished }) => {
        if (finished) {
          onDismiss();
        }
      });
    }, 2600);

    return () => clearTimeout(timeout);
  }, [onDismiss, opacity, toast, translateY]);

  if (!toast) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { bottom: bottomOffset, opacity, transform: [{ translateY }], pointerEvents: 'none' },
      ]}
    >
      <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.banner}>
        <Text style={styles.text}>{toast.text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 20,
    left: 20,
    zIndex: 20,
    alignItems: 'center',
  },
  banner: {
    maxWidth: 520,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#312F2B',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
});
