import { Image, StyleSheet, View } from 'react-native';

export function HeroIllustration() {
  return (
    <View
      accessibilityLabel="Minh họa Joy cùng bạn đo mức độ stress"
      accessible
      style={styles.container}
    >
      <Image
        resizeMode="cover"
        source={require('../../assets/illustrations/stress-hero.png')}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 196,
    aspectRatio: 16 / 9,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: '#EAF7F9',
    shadowColor: '#7F7560',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
