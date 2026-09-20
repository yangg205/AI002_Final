import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_TABS, type AppTab } from '../navigation/tabs';
import { colors } from '../theme/colors';

export const BOTTOM_NAV_HEIGHT = 89;

type AppBottomNavigationProps = {
  readonly activeTab: AppTab;
  readonly onTabPress: (tab: AppTab) => void;
};

export function AppBottomNavigation({
  activeTab,
  onTabPress,
}: AppBottomNavigationProps) {
  return (
    <View accessibilityRole="tablist" style={styles.container}>
      {APP_TABS.map((item) => {
        const selected = item.id === activeTab;

        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={item.id}
            onPress={() => onTabPress(item.id)}
            style={({ pressed }) => [
              styles.item,
              pressed && styles.pressed,
            ]}
          >
            {selected ? <View style={[styles.halo, { pointerEvents: 'none' }]} /> : null}
            <Ionicons
              color={selected ? colors.olive : '#332F21'}
              name={item.icon}
              size={30}
            />
            <Text style={[styles.label, selected && styles.selectedLabel]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: BOTTOM_NAV_HEIGHT,
    flexDirection: 'row',
    backgroundColor: colors.navigationBackground,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 10,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.yellow,
    shadowColor: '#E4B900',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 3,
  },
  label: {
    marginTop: 5,
    color: '#332F21',
    fontSize: 13,
  },
  selectedLabel: {
    color: colors.olive,
  },
  pressed: {
    opacity: 0.6,
  },
});
