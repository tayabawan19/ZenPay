import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Text } from 'react-native';
import ZenPayLogo from '../components/ZenPayLogo';

export default function IndexSplash() {
  const pulseAnim = useRef(new Animated.Value(1.0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 750,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrapper, { transform: [{ scale: pulseAnim }] }]}>
        <ZenPayLogo size={120} />
      </Animated.View>
      <Text style={styles.title}>ZenPay</Text>
      <Text style={styles.subtitle}>Premium Wallet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060612',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrapper: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
});
