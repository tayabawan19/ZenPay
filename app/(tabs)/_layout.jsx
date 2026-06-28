import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { CustomTabBar } from '../../components/CustomTabBar';
import useSessionTimeout from '../../hooks/useSessionTimeout';

export default function TabsLayout() {
  const { warningVisible, panHandlers } = useSessionTimeout();

  return (
    <View style={{ flex: 1 }} {...panHandlers}>
      <Tabs 
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="transfer" options={{ title: 'Pay' }} />
        <Tabs.Screen name="analytics" options={{ title: 'Insights' }} />
        <Tabs.Screen name="cards" options={{ title: 'Card' }} />
        <Tabs.Screen name="history" options={{ title: 'History' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>

      {/* Inactivity Warning Toast overlay */}
      {warningVisible && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>
            You'll be logged out in 1 minute due to inactivity
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: '#FFB020',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 9999,
  },
  toastText: {
    color: '#080810',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
});
