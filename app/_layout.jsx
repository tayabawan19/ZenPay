import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StripeProvider } from '@stripe/stripe-react-native';
import { ActivityIndicator, View, StyleSheet, useColorScheme, Text, StatusBar } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { initializeStripe, STRIPE_PUBLISHABLE_KEY } from '../services/stripe';
import { colors, darkColors } from '../constants/colors';

export default function RootLayout() {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;

  const { user, isLoading, initAuth } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // Initialize Stripe and listen to Firebase auth state shifts on mount
  useEffect(() => {
    initializeStripe();
    const unsubscribe = initAuth();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Protect routes based on user session state
  useEffect(() => {
    if (isLoading) return;

    // Check if the current route is within the (auth) directory
    const inAuthGroup = segments[0] === '(auth)';

    if (!user) {
      // If not logged in, force route them to login
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      // If logged in and on the login/register screens, route them to home
      if (inAuthGroup || segments.length === 0 || segments[0] === 'index') {
        router.replace('/(tabs)');
      }
    }
  }, [user, isLoading, segments]);

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
    <>
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
    </>
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