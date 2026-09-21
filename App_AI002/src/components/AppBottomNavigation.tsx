import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_TABS, type AppTab } from '../navigation/tabs';
import { colors } from '../theme/colors';

export const BOTTOM_NAV_HEIGHT = 68;

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
            <Ionicons
              color={selected ? colors.olive : '#332F21'}
              name={item.icon}
              size={24}
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
    borderTopWidth: 1,
    borderTopColor: colors.outline,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 3,
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
