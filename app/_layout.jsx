import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments, useGlobalSearchParams } from 'expo-router';
import { StripeProvider } from '@stripe/stripe-react-native';
import { ActivityIndicator, View, StyleSheet, useColorScheme, Text, StatusBar } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { initializeStripe, STRIPE_PUBLISHABLE_KEY } from '../services/stripe';
import { colors, darkColors } from '../constants/colors';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootLayout() {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;

  const { user, isLoading, initAuth, isPinVerified } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { action } = useGlobalSearchParams();

  // Initialize Stripe, listen to Firebase auth shifts and request notification permissions on mount
  useEffect(() => {
    initializeStripe();
    const unsubscribe = initAuth();

    const requestPermissions = async () => {
      try {
        await Notifications.requestPermissionsAsync();
      } catch (err) {
        console.warn("Could not request notification permissions:", err);
      }
    };
    requestPermissions();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Protect routes based on user session state and PIN verification
  useEffect(() => {
    if (isLoading) return;

    // Check if the current route is within the (auth) directory or is PIN screen
    const inAuthGroup = segments[0] === '(auth)';
    const isPinScreen = segments[0] === 'pin';

    if (!user) {
      // If not logged in, force route them to login
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      // Check if a PIN is set
      AsyncStorage.getItem('zenpay_pin').then((pin) => {
        if (pin) {
          if (!isPinVerified) {
            if (!isPinScreen) {
              router.replace('/pin');
            }
          } else {
            // If PIN is verified, only redirect to tabs if they are NOT trying to change it
            if (inAuthGroup || (isPinScreen && action !== 'change') || segments.length === 0 || segments[0] === 'index') {
              router.replace('/(tabs)');
            }
          }
        } else {
          // If no PIN is set, allow them to stay on the PIN screen to create one.
          if (inAuthGroup || segments.length === 0 || segments[0] === 'index') {
            router.replace('/(tabs)');
          }
        }
      }).catch((err) => {
        console.error("AsyncStorage error checking PIN:", err);
        if (inAuthGroup || isPinScreen || segments.length === 0 || segments[0] === 'index') {
          router.replace('/(tabs)');
        }
      });
    }
  }, [user, isLoading, segments, isPinVerified, action]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={styles.splashText}>
          Zen<Text style={{ color: theme.primary }}>Pay</Text>
        </Text>
        <ActivityIndicator size="large" color={theme.textPrimary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <StripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="com.zenpay.app"
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashText: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1.5,
  },
});