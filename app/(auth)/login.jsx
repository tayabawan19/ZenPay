import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
  TextInput,
  Animated,
  Easing,
  Pressable,
  Dimensions,
  Keyboard
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { colors } from '../../constants/colors';
import GlobalBackground from '../../components/GlobalBackground';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ZenPayLogo from '../../components/ZenPayLogo';

const { height: screenHeight } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { login, resetPassword, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Check if we logged out due to inactivity
  useEffect(() => {
    const checkTimeoutLogout = async () => {
      try {
        const val = await AsyncStorage.getItem('zenpay_timeout_logout');
        if (val === 'true') {
          Alert.alert('Session Timeout', 'You were logged out due to inactivity');
          await AsyncStorage.removeItem('zenpay_timeout_logout');
        }
      } catch (err) {
        console.error(err);
      }
    };
    checkTimeoutLogout();
  }, []);

  // Input focus states for styling
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Forgot Password States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // Animation values
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1.0)).current;
  
  // Press scale animations
  const signInScale = useRef(new Animated.Value(1.0)).current;
  const createScale = useRef(new Animated.Value(1.0)).current;

  // Setup Logo animations
  useEffect(() => {
    // 8s infinite linear rotation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 2s infinite pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Error Shake Animation
  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  // Button Press Handlers
  const handlePressIn = (scaleVar) => {
    Animated.spring(scaleVar, {
      toValue: 0.97,
      speed: 300,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (scaleVar) => {
    Animated.spring(scaleVar, {
      toValue: 1.0,
      speed: 300,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  };

  // Validate inputs
  const validateForm = () => {
    setValidationError('');

    if (!email || !password) {
      setValidationError('Please fill in all fields.');
      triggerShake();
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setValidationError('Please enter a valid email address.');
      triggerShake();
      return false;
    }

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters.');
      triggerShake();
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!validateForm()) return;

    try {
      await login(email.trim(), password);
    } catch (err) {
      setValidationError(err.message || 'Invalid credentials. Please try again.');
      triggerShake();
    }
  };

  const handleResetPassword = async () => {
    setForgotError('');
    if (!forgotEmail) {
      setForgotError('Please enter your email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotEmail.trim())) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    setForgotLoading(true);
    try {
      await resetPassword(forgotEmail.trim());
      setForgotLoading(false);
      setShowForgotModal(false);
      setForgotEmail('');
      Alert.alert('Success', 'Password reset email sent! Check your inbox.');
    } catch (err) {
      setForgotLoading(false);
      setForgotError(err.message || 'Failed to send password reset email.');
    }
  };

  return (
    <GlobalBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Logo Section */}
          <View style={styles.logoSection}>
            <ZenPayLogo size={80} />
            <Text style={styles.logoText}>ZenPay</Text>
            <Text style={styles.subtitle}>Premium Wallet</Text>
          </View>

          {/* Bottom Glass Card (60% height approx) */}
          <Animated.View style={[styles.glassCard, { transform: [{ translateX: shakeAnim }] }]}>
            {/* Top glass highlight line */}
            <View style={styles.topHighlight} />

            <Text style={styles.labelWelcome}>WELCOME BACK</Text>

            {validationError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={18} color="#FF4D6A" />
                <Text style={styles.errorText}>{validationError}</Text>
              </View>
            ) : null}

            {/* Email Input */}
            <View style={[
              styles.inputWrapper,
              emailFocused && styles.inputWrapperFocused
            ]}>
              <Ionicons name="mail-outline" size={20} color="#7C6FFF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={email}
                onChangeText={(text) => { setEmail(text); setValidationError(''); }}
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            {/* Password Input */}
            <View style={[
              styles.inputWrapper,
              passwordFocused && styles.inputWrapperFocused
            ]}>
              <Ionicons name="lock-closed-outline" size={20} color="#7C6FFF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={password}
                onChangeText={(text) => { setPassword(text); setValidationError(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="rgba(255, 255, 255, 0.4)"
                />
              </TouchableOpacity>
            </View>

            {/* Forgot Password Link */}
            <TouchableOpacity
              onPress={() => setShowForgotModal(true)}
              style={styles.forgotPasswordContainer}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <Animated.View style={{ transform: [{ scale: signInScale }] }}>
              <Pressable
                onPress={handleLogin}
                onPressIn={() => handlePressIn(signInScale)}
                onPressOut={() => handlePressOut(signInScale)}
                style={styles.btnSignIn}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={['#7C6FFF', '#FF6BBA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientBtn}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.btnSignInText}>Sign In</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Create Account Button */}
            <Animated.View style={{ transform: [{ scale: createScale }] }}>
              <Pressable
                onPress={() => router.push('/(auth)/register')}
                onPressIn={() => handlePressIn(createScale)}
                onPressOut={() => handlePressOut(createScale)}
                style={styles.btnCreate}
              >
                <Text style={styles.btnCreateText}>Create Account</Text>
              </Pressable>
            </Animated.View>

            {/* Bottom Glow simulation inside the glass card */}
            <View style={styles.bottomGlow} pointerEvents="none" />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setShowForgotModal(false); setForgotError(''); setForgotEmail(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Top highlight for modal */}
            <View style={styles.topHighlight} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <TouchableOpacity onPress={() => { setShowForgotModal(false); setForgotError(''); setForgotEmail(''); }}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter your email address below and we'll send you a link to reset your password.
            </Text>

            {forgotError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={18} color="#FF4D6A" />
                <Text style={styles.errorText}>{forgotError}</Text>
              </View>
            ) : null}

            {/* Modal Email Input */}
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#7C6FFF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={forgotEmail}
                onChangeText={(text) => { setForgotEmail(text); setForgotError(''); }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Send Reset Link Button */}
            <TouchableOpacity
              style={styles.btnModalSubmit}
              onPress={handleResetPassword}
              disabled={forgotLoading}
              activeOpacity={0.8}
            >
              {forgotLoading ? (
                <ActivityIndicator color="#080810" size="small" />
              ) : (
                <Text style={styles.btnModalSubmitText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </GlobalBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  logoSection: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  logoMarkContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  outerRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: 'rgba(124, 111, 255, 0.5)',
  },
  innerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(124, 111, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124, 111, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoLetter: {
    fontSize: 28,
    fontWeight: '800',
    color: '#7C6FFF',
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 2,
    marginTop: 6,
  },
  glassCard: {
    backgroundColor: 'rgba(124, 111, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 111, 255, 0.25)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    flex: 1,
    minHeight: screenHeight * 0.62,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#7C6FFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'transparent',
    // We simulate gradients for glow by using very light purple transparent overlay
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  labelWelcome: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
    backgroundColor: 'rgba(255, 77, 106, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 106, 0.2)',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF4D6A',
    marginLeft: 8,
    flex: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 20,
    height: 56,
    marginBottom: 16,
  },
  inputWrapperFocused: {
    borderColor: 'rgba(124, 111, 255, 0.5)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    height: '100%',
  },
  eyeIcon: {
    padding: 4,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -4,
  },
  forgotPasswordText: {
    color: '#7C6FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  btnSignIn: {
    height: 58,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#7C6FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  gradientBtn: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSignInText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dividerText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  btnCreate: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 111, 255, 0.3)',
    backgroundColor: 'rgba(124, 111, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  btnCreateText: {
    color: '#7C6FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#0E0E1A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#7C6FFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 20,
    marginBottom: 20,
  },
  btnModalSubmit: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  btnModalSubmitText: {
    color: '#080810',
    fontSize: 16,
    fontWeight: '700',
  },
});