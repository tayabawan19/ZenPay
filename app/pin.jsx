import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Animated, 
  Dimensions, 
  Alert 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuthStore } from '../store/authStore';
import GlobalBackground from '../components/GlobalBackground';

const { width: screenWidth } = Dimensions.get('window');

// Hash function as specified
const hashPin = (pin) => {
  return pin.split('').reduce((acc, char) =>
    acc + char.charCodeAt(0), 0
  ).toString() + pin.length;
};

// Animated Keypad Key component (same style as keypad key on Transfer)
const KeypadKey = ({ val, onPress, disabled }) => {
  const scale = useRef(new Animated.Value(1.0)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 0.9,
      useNativeDriver: true,
      friction: 3,
      tension: 180,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1.0,
      useNativeDriver: true,
      friction: 5,
      tension: 150,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], flex: 1, margin: 8 }}>
      <TouchableOpacity
        onPress={() => onPress(val)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
        disabled={disabled}
        style={[styles.keypadKey, disabled && styles.keypadKeyDisabled]}
      >
        {val === 'delete' ? (
          <Ionicons name="backspace-outline" size={24} color="#FFFFFF" />
        ) : (
          <Text style={styles.keypadKeyText}>{val}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function PinScreen() {
  const router = useRouter();
  const { action } = useLocalSearchParams();
  const { logout, setPinVerified } = useAuthStore();

  const [mode, setMode] = useState('loading'); // 'create' | 'confirm' | 'verify' | 'lockout' | 'loading'
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [hasBiometrics, setHasBiometrics] = useState(false);

  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const dotAnimations = useRef(Array.from({ length: 6 }).map(() => new Animated.Value(1))).current;

  // Check state on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const storedPin = await AsyncStorage.getItem('zenpay_pin');
        
        // Check biometric capabilities
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const bioSupport = hasHardware && isEnrolled;
        setHasBiometrics(bioSupport);

        // Check lockouts
        const storedLockout = await AsyncStorage.getItem('zenpay_pin_lockout_until');
        if (storedLockout) {
          const timeLeft = Math.ceil((parseInt(storedLockout) - Date.now()) / 1000);
          if (timeLeft > 0) {
            setMode('lockout');
            setLockoutTime(timeLeft);
            return;
          } else {
            await AsyncStorage.removeItem('zenpay_pin_lockout_until');
          }
        }

        if (storedPin) {
          setMode('verify');
          if (bioSupport) {
            // Trigger biometrics automatically
            setTimeout(() => {
              tryBiometric();
            }, 500);
          }
        } else {
          setMode('create');
        }
      } catch (err) {
        console.error(err);
        setMode('create');
      }
    };

    initialize();
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (mode !== 'lockout' || lockoutTime <= 0) return;
    const interval = setInterval(async () => {
      setLockoutTime((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          AsyncStorage.removeItem('zenpay_pin_lockout_until').then(() => {
            setMode('verify');
            setAttempts(0);
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [mode, lockoutTime]);

  // Animate dots when pins are typed
  useEffect(() => {
    pin.split('').forEach((_, index) => {
      Animated.spring(dotAnimations[index], {
        toValue: 1.3,
        useNativeDriver: true,
        friction: 3,
        tension: 140,
      }).start(() => {
        Animated.spring(dotAnimations[index], {
          toValue: 1.0,
          useNativeDriver: true,
        }).start();
      });
    });
  }, [pin]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  };

  const handleKeyPress = async (val) => {
    if (mode === 'lockout') return;

    setErrorMsg('');

    if (val === 'delete') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }

    if (pin.length >= 6) return;

    const newPin = pin + val;
    setPin(newPin);

    if (newPin.length === 6) {
      // Small timeout to allow the dot UI to update
      setTimeout(() => {
        processPin(newPin);
      }, 100);
    }
  };

  const processPin = async (completedPin) => {
    setPin('');

    if (mode === 'create') {
      setFirstPin(completedPin);
      setMode('confirm');
    } else if (mode === 'confirm') {
      if (completedPin === firstPin) {
        // Match! Save to storage
        const hashed = hashPin(completedPin);
        await AsyncStorage.setItem('zenpay_pin', hashed);
        setPinVerified(true);
        router.replace('/(tabs)');
      } else {
        triggerShake();
        setErrorMsg('PINs do not match. Try again.');
        setMode('create');
        setFirstPin('');
      }
    } else if (mode === 'verify') {
      const storedHashed = await AsyncStorage.getItem('zenpay_pin');
      const hashedEntered = hashPin(completedPin);

      if (storedHashed === hashedEntered) {
        if (action === 'change') {
          // If changing PIN, verify success transitions to creating a new PIN
          setMode('create');
          setErrorMsg('');
        } else {
          setPinVerified(true);
          router.replace('/(tabs)');
        }
      } else {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        triggerShake();

        if (nextAttempts >= 3) {
          const lockTime = Date.now() + 30 * 1000;
          await AsyncStorage.setItem('zenpay_pin_lockout_until', lockTime.toString());
          setMode('lockout');
          setLockoutTime(30);
          setErrorMsg('Too many attempts. Try again in 30 seconds.');
        } else {
          setErrorMsg('Incorrect PIN');
        }
      }
    }
  };

  const tryBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity',
        fallbackLabel: 'Use PIN',
      });
      if (result.success) {
        setPinVerified(true);
        router.replace('/(tabs)');
      }
    } catch (err) {
      console.warn("Biometrics error: ", err);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? This will require logging back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/(auth)/login');
            } catch (e) {
              console.error(e);
            }
          }
        }
      ]
    );
  };

  // Helper title based on mode
  const getScreenTitle = () => {
    if (mode === 'create') return 'Create PIN';
    if (mode === 'confirm') return 'Confirm PIN';
    if (mode === 'verify') return 'Enter PIN';
    if (mode === 'lockout') return 'Blocked';
    return 'Loading...';
  };

  const getScreenSub = () => {
    if (mode === 'create') return 'Set up a secure 6-digit PIN';
    if (mode === 'confirm') return 'Re-enter your 6-digit PIN';
    if (mode === 'verify') return 'Verify your identity to continue';
    if (mode === 'lockout') return `Try again in ${lockoutTime}s`;
    return '';
  };

  return (
    <GlobalBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <Text style={styles.splashText}>
              Zen<Text style={{ color: '#7C6FFF' }}>Pay</Text>
            </Text>
          </View>

          {/* Heading */}
          <View style={styles.header}>
            <Text style={styles.title}>{getScreenTitle()}</Text>
            <Text style={styles.subtitle}>{getScreenSub()}</Text>
          </View>

          {/* 6 Dots indicators */}
          {mode !== 'lockout' && mode !== 'loading' && (
            <Animated.View style={[
              styles.dotsContainer, 
              { transform: [{ translateX: shakeAnim }] }
            ]}>
              {Array.from({ length: 6 }).map((_, i) => {
                const isFilled = pin.length > i;
                return (
                  <Animated.View 
                    key={i}
                    style={[
                      styles.dot,
                      isFilled ? styles.dotFilled : styles.dotEmpty,
                      { transform: [{ scale: dotAnimations[i] }] }
                    ]}
                  />
                );
              })}
            </Animated.View>
          )}

          {/* Error / Instruction indicator */}
          <View style={styles.errorContainer}>
            {errorMsg ? (
              <Text style={styles.errorText}>{errorMsg}</Text>
            ) : null}
          </View>

          {/* Custom Numpad */}
          {mode !== 'loading' && (
            <View style={styles.keypadWrapper}>
              {[
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
                ['*', '0', 'delete']
              ].map((row, rowIndex) => (
                <View key={rowIndex} style={styles.keypadRow}>
                  {row.map((btn) => {
                    const isBioKey = btn === '*';
                    if (isBioKey) {
                      return (
                        <View key={btn} style={{ flex: 1, margin: 8 }}>
                          {hasBiometrics && mode === 'verify' ? (
                            <TouchableOpacity
                              onPress={tryBiometric}
                              activeOpacity={0.8}
                              style={styles.bioButtonKey}
                            >
                              <Ionicons name="finger-print-outline" size={24} color="#7C6FFF" />
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.emptyKeyPlaceholder} />
                          )}
                        </View>
                      );
                    }
                    return (
                      <KeypadKey
                        key={btn}
                        val={btn}
                        onPress={handleKeyPress}
                        disabled={mode === 'lockout'}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          )}

          {/* Biometrics text fallback button */}
          {hasBiometrics && mode === 'verify' && (
            <TouchableOpacity 
              style={styles.biometricsTextButton} 
              onPress={tryBiometric}
              activeOpacity={0.7}
            >
              <Text style={styles.biometricsText}>Use Biometrics</Text>
            </TouchableOpacity>
          )}

          {/* Forgot PIN / Sign Out */}
          <TouchableOpacity 
            style={styles.signOutButton} 
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Text style={styles.signOutText}>Forgot PIN? Sign Out</Text>
          </TouchableOpacity>

        </View>
      </SafeAreaView>
    </GlobalBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  splashText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.0,
  },
  header: {
    alignItems: 'center',
    marginTop: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginHorizontal: 12,
  },
  dotEmpty: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  dotFilled: {
    backgroundColor: '#7C6FFF',
  },
  errorContainer: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FF4D6A',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  keypadWrapper: {
    width: screenWidth - 48,
    maxHeight: 340,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keypadKey: {
    height: 62,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  keypadKeyDisabled: {
    opacity: 0.3,
  },
  keypadKeyText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bioButtonKey: {
    height: 62,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 111, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 111, 255, 0.15)',
  },
  emptyKeyPlaceholder: {
    height: 62,
  },
  biometricsTextButton: {
    paddingVertical: 10,
  },
  biometricsText: {
    color: '#7C6FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  signOutButton: {
    paddingVertical: 10,
    marginTop: 10,
  },
  signOutText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 12,
    fontWeight: '500',
  },
});
