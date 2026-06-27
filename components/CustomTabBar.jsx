import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { colors } from '../constants/colors';

const { width: screenWidth } = Dimensions.get('window');

const getTabIcon = (routeName, focused) => {
  switch (routeName) {
    case 'index':
      return focused ? 'home' : 'home-outline';
    case 'transfer':
      return focused ? 'arrow-up-circle' : 'arrow-up-circle-outline';
    case 'analytics':
      return focused ? 'bar-chart' : 'bar-chart-outline';
    case 'cards':
      return focused ? 'card' : 'card-outline';
    case 'history':
      return focused ? 'time' : 'time-outline';
    case 'profile':
      return focused ? 'person' : 'person-outline';
    default:
      return 'ellipse-outline';
  }
};

const getTabTitle = (routeName) => {
  switch (routeName) {
    case 'index':
      return 'Home';
    case 'transfer':
      return 'Send';
    case 'analytics':
      return 'Analytics';
    case 'cards':
      return 'Cards';
    case 'history':
      return 'History';
    case 'profile':
      return 'Profile';
    default:
      return routeName;
  }
};
const TabItem = ({ route, label, isFocused, onPress, onLongPress }) => {
  const scale = useRef(new Animated.Value(isFocused ? 1.0 : 0.8)).current;

  useEffect(() => {
    if (isFocused) {
      scale.setValue(0.8);
      Animated.spring(scale, {
        toValue: 1.0,
        friction: 8,
        tension: 80,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: false,
      }).start();
    }
  }, [isFocused]);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabButton}
      activeOpacity={0.7}
    >
      <Animated.View style={[
        isFocused ? styles.iconWrapperActive : styles.iconWrapperInactive,
        { transform: [{ scale }] }
      ]}>
        <Ionicons 
          name={getTabIcon(route.name, isFocused)} 
          size={22} 
          color={isFocused ? '#7C6FFF' : 'rgba(255,255,255,0.3)'} 
        />
      </Animated.View>
      {isFocused && (
        <Text style={styles.tabLabel}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};

export const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();

  const totalWidth = screenWidth - 16; // 8px horizontal padding on each side
  const tabWidth = totalWidth / state.routes.length;
  const indicatorX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: state.index * tabWidth + (tabWidth - 4) / 2, // Centered relative to the active tab
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [state.index]);

  return (
    <BlurView 
      intensity={30} 
      tint="dark"
      style={[
        styles.tabBarContainer, 
        { 
          paddingBottom: Math.max(insets.bottom, 12),
        }
      ]}
    >
      {/* Active sliding indicator pill */}
      <Animated.View 
        style={[
          styles.indicator,
          {
            transform: [{ translateX: indicatorX }],
          }
        ]}
      />

      <View style={styles.buttonsContainer}>
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
            <TabItem
              key={route.key}
              route={route}
              label={label}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </BlurView>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(8, 8, 16, 0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
    paddingHorizontal: 8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  iconWrapperActive: {
    backgroundColor: 'rgba(124, 111, 255, 0.15)',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(124, 111, 255, 0.3)',
    marginBottom: 2,
  },
  iconWrapperInactive: {
    padding: 8,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7C6FFF',
    marginTop: 4,
  },
  indicator: {
    position: 'absolute',
    top: 6,
    left: 8,
    width: 4,
    height: 2,
    backgroundColor: '#7C6FFF',
    borderRadius: 1,
  },
});

export default CustomTabBar;
