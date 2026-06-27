import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, useColorScheme, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, darkColors } from '../constants/colors';

export const CustomTabBar = ({ state, descriptors, navigation }) => {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;
  const insets = useSafeAreaInsets();

  // Helper to map tab names to icons
  const getTabIcon = (routeName, focused) => {
    switch (routeName) {
      case 'index':
        return focused ? 'home' : 'home-outline';
      case 'transfer':
        return focused ? 'swap-horizontal' : 'swap-horizontal-outline';
      case 'analytics':
        return focused ? 'pie-chart' : 'pie-chart-outline';
      case 'cards':
        return focused ? 'card' : 'card-outline';
      case 'history':
        return focused ? 'receipt' : 'receipt-outline';
      case 'profile':
        return focused ? 'person' : 'person-outline';
      default:
        return 'ellipse-outline';
    }
  };

  // Helper to map tab names to user-friendly titles
  const getTabTitle = (routeName) => {
    switch (routeName) {
      case 'index':
        return 'Home';
      case 'transfer':
        return 'Pay';
      case 'analytics':
        return 'Insights';
      case 'cards':
        return 'Card';
      case 'history':
        return 'History';
      case 'profile':
        return 'Profile';
      default:
        return routeName;
    }
  };

  return (
    <View style={[
      styles.tabBarContainer, 
      { 
        backgroundColor: theme.card, 
        borderTopColor: theme.border,
        paddingBottom: Math.max(insets.bottom, 12),
      }
    ]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title !== undefined ? options.title : getTabTitle(route.name);
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate({ name: route.name, merge: true });
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabButton}
            activeOpacity={0.7}
          >
            <View style={[
              styles.iconWrapper,
              isFocused && { backgroundColor: `${theme.primary}10` } // Subtle active highlight background
            ]}>
              <Ionicons 
                name={getTabIcon(route.name, isFocused)} 
                size={22} 
                color={isFocused ? theme.primary : theme.textSecondary} 
              />
            </View>
            <Text style={[
              styles.tabLabel, 
              { 
                color: isFocused ? theme.primary : theme.textSecondary,
                fontWeight: isFocused ? '700' : '500'
              }
            ]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconWrapper: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
});

export default CustomTabBar;
