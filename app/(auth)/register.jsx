import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Pressable,
  Dimensions,
  Keyboard
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../services/firebase';
import { colors } from '../../constants/colors';
import { API_URL } from '../../constants/api';
import GlobalBackground from '../../components/GlobalBackground';
import ZenPayLogo from '../../components/ZenPayLogo';

const { width: screenWidth } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  // Step state: 1 = Registration form, 2 = OTP verification
  const [step, setStep] = useState(1);

  // Registration Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Focus states
  const [focusedField, setFocusedField] = useState('');

  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationError, setValidationError] = useState('');

  // OTP States
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [timer, setTimer] = useState(60);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const inputRefs = useRef([]);

  // Animation values
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const progressScaleX = useRef(new Animated.Value(0.2)).current;
  const envScale = useRef(new Animated.Value(0)).current;
  const boxScales = useRef(Array.from({ length: 6 }).map(() => new Animated.Value(1.0))).current;

  // Press scales
  const registerBtnScale = useRef(new Animated.Value(1.0)).current;
  const verifyBtnScale = useRef(new Animated.Value(1.0)).current;

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // Stepper Indicator animation
  useEffect(() => {
    let target = 0.2;
    if (step === 1) target = 0.2;
    else if (step === 2) target = 0.6;
    
    Animated.spring(progressScaleX, {
      toValue: target,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [step]);
  // Envelope Bounce on Step 2 active
  useEffect(() => {
    if (step === 2) {
      envScale.setValue(0);
      Animated.spring(envScale, {
        toValue: 1.0,
        tension: 80,
        friction: 8,
        useNativeDriver: false,
      }).start();
    }
  }, [step]);

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

  // Button interactive animations
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

  // Mask email function
  const maskEmail = (email) => {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;
    const maskedLocal = localPart.charAt(0) + '*'.repeat(Math.max(3, localPart.length - 1));
    return `${maskedLocal}@${domain}`;
  };

  // Validate Step 1 Registration Form
  const validateForm = () => {
    setValidationError('');

    if (!name.trim() || !email.trim() || !phone.trim() || !password || !confirmPassword) {
      setValidationError('Please fill in all fields.');
      triggerShake();
      return false;
    }

    if (name.trim().length < 3) {
      setValidationError('Name must be at least 3 characters.');
      triggerShake();
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setValidationError('Please enter a valid email address.');
      triggerShake();
      return false;
    }

    // Phone validation: starts with +92 (exactly 13 chars)
    const phoneVal = phone.trim();
    if (!phoneVal.startsWith('+92')) {
      setValidationError('Phone number must start with +92.');
      triggerShake();
      return false;
    }
    if (phoneVal.length !== 13) {
      setValidationError('Phone number must be exactly 13 characters.');
      triggerShake();
      return false;
    }
    const phoneDigits = phoneVal.substring(1);
    if (!/^\d+$/.test(phoneDigits)) {
      setValidationError('Phone number must contain only numbers after +.');
      triggerShake();
      return false;
    }

    // Password validation: min 8 chars with 1 number
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters.');
      triggerShake();
      return false;
    }
    if (!/\d/.test(password)) {
      setValidationError('Password must contain at least one number.');
      triggerShake();
      return false;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      triggerShake();
      return false;
    }

    return true;
  };

  // Step 1: Send OTP code
  const handleSendOtp = async () => {
    Keyboard.dismiss();
    if (!validateForm()) return;

    setIsSendingOtp(true);
    setValidationError('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.ok && data.success) {
        setTimer(60);
        setStep(2);
        setOtp(['', '', '', '', '', '']);
      } else {
        const errorMsg = data.message || 'Failed to send verification code.';
        setValidationError(errorMsg);
        triggerShake();
        Alert.alert('Error', errorMsg);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(err);
      
      const isMockAuth = auth.config?.apiKey?.includes('Placeholder') || !auth.config?.apiKey || auth._isMock;
      if (isMockAuth) {
        setTimer(60);
        setStep(2);
        setOtp(['', '', '', '', '', '']);
        Alert.alert(
          'Backend Offline (Mock Mode)',
          'The backend service is offline, but since the app is running in mock mode, you can proceed. Use verification code 123456.'
        );
        return;
      }

      const networkError = 'Network error. Please make sure the backend is running and reachable.';
      setValidationError(networkError);
      triggerShake();
      Alert.alert('Connection Failed', networkError);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Resend OTP code
  const handleResendOtp = async () => {
    Keyboard.dismiss();
    if (timer > 0) return;

    setIsSendingOtp(true);
    setValidationError('');
    setOtp(['', '', '', '', '', '']);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.ok && data.success) {
        setTimer(60);
        Alert.alert('Success', 'Verification code resent to ' + email.trim());
      } else {
        const errorMsg = data.message || 'Failed to resend verification code.';
        setValidationError(errorMsg);
        triggerShake();
        Alert.alert('Error', errorMsg);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(err);
      
      const isMockAuth = auth.config?.apiKey?.includes('Placeholder') || !auth.config?.apiKey || auth._isMock;
      if (isMockAuth) {
        setTimer(60);
        Alert.alert('Resent Mock Code', 'Backend offline. Please use verification code 123456.');
        return;
      }

      const networkError = 'Network error. Failed to resend verification code.';
      setValidationError(networkError);
      triggerShake();
      Alert.alert('Connection Failed', networkError);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 2: Verify OTP code and register
  const handleVerifyOtp = async (codeToVerify) => {
    Keyboard.dismiss();
    const code = codeToVerify || otp.join('');
    if (code.length !== 6) {
      setValidationError('Please enter all 6 digits of the code.');
      triggerShake();
      return;
    }

    setIsVerifyingOtp(true);
    setValidationError('');

    try {
      const isMockAuth = auth.config?.apiKey?.includes('Placeholder') || !auth.config?.apiKey || auth._isMock;
      let success = false;

      if (isMockAuth && code === '123456') {
        success = true;
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        try {
          const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: email.trim().toLowerCase(),
              otp: code,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          const data = await response.json();

          if (response.ok && data.success) {
            success = true;
          } else {
            const errorMsg = data.message || 'Invalid or expired code. Please try again.';
            setValidationError(errorMsg);
            triggerShake();
            Alert.alert('Verification Failed', errorMsg);
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          if (isMockAuth) {
            if (code === '123456') {
              success = true;
            } else {
              setValidationError('Invalid code. Please use 123456.');
              triggerShake();
              Alert.alert('Verification Failed', 'Invalid code. Please use 123456.');
            }
          } else {
            throw fetchErr;
          }
        }
      }

      if (success) {
        // Set stepper to complete (1.0)
        Animated.spring(progressScaleX, {
          toValue: 1.0,
          useNativeDriver: true,
        }).start();

        try {
          await register(name.trim(), email.trim(), phone.trim(), password);
          router.replace('/(tabs)/index');
        } catch (firebaseErr) {
          setValidationError(firebaseErr.message || 'Verification succeeded, but registration failed.');
          triggerShake();
          Alert.alert('Registration Failed', firebaseErr.message || 'Failed to initialize account.');
        }
      }
    } catch (err) {
      console.error(err);
      const networkError = 'Network error during verification. Please try again.';
      setValidationError(networkError);
      triggerShake();
      Alert.alert('Connection Failed', networkError);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // OTP Change with scale pop animation
  const handleOtpChange = (value, index) => {
    const newOtp = [...otp];
    const val = value.slice(-1);
    newOtp[index] = val;
    setOtp(newOtp);

    // Trigger scale pop animation on fill
    if (val !== '') {
      Animated.sequence([
        Animated.spring(boxScales[index], {
          toValue: 1.15,
          friction: 3,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.spring(boxScales[index], {
          toValue: 1.0,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        })
      ]).start();

      // Focus next box
      if (index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }

    const completedOtp = newOtp.join('');
    if (completedOtp.length === 6) {
      handleVerifyOtp(completedOtp);
    }
  };

  // Handle Backspace navigation on OTP text input
  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (otp[index] === '' && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  // Header Back Button Behavior
  const handleBackPress = () => {
    if (step === 2) {
      setStep(1);
      setValidationError('');
    } else {
      router.back();
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
          {/* Progress Indicator */}
          <View style={styles.stepperContainer}>
            {/* Background connecting line */}
            <View style={styles.connectingLineBg} />
            
            {/* Animated filling line */}
            <Animated.View 
              style={[
                styles.connectingLineActive, 
                { transform: [{ scaleX: progressScaleX }, { translateX: 0 }] }
              ]} 
            />

            {/* Step 1 Circle */}
            <View style={[
              styles.stepCircle,
              step >= 1 ? styles.stepCircleActive : styles.stepCircleInactive
            ]}>
              {step > 1 ? (
                <Ionicons name="checkmark" size={14} color="#080810" />
              ) : (
                <View style={styles.stepInnerDot} />
              )}
            </View>

            {/* Step 2 Circle */}
            <View style={[
              styles.stepCircle,
              step >= 2 ? styles.stepCircleActive : styles.stepCircleInactive
            ]}>
              {step > 2 ? (
                <Ionicons name="checkmark" size={14} color="#080810" />
              ) : (
                step === 2 ? <View style={styles.stepInnerDot} /> : null
              )}
            </View>

            {/* Step 3 Circle */}
            <View style={[
              styles.stepCircle,
              styles.stepCircleInactive
            ]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={handleBackPress} 
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <ZenPayLogo size={64} />
            <Text style={styles.logoText}>ZenPay</Text>
            <Text style={styles.subtitle}>
              {step === 1 ? 'Create Account' : 'Check Your Email'}
            </Text>
          </View>

          {/* Form Card (Glass container) */}
          <Animated.View style={[styles.glassCard, { transform: [{ translateX: shakeAnim }] }]}>
            {/* Top glass highlight line */}
            <View style={styles.topHighlight} />

            {validationError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={18} color="#FF4D6A" />
                <Text style={styles.errorText}>{validationError}</Text>
              </View>
            ) : null}

            {step === 1 ? (
              // Step 1: Registration form
              <View style={styles.formContent}>
                <Text style={styles.formTitle}>Get Started</Text>
                <Text style={styles.formSubtitle}>
                  It only takes a few minutes to create an account
                </Text>

                {/* Full Name */}
                <View style={[
                  styles.inputWrapper,
                  focusedField === 'name' && styles.inputWrapperFocused
                ]}>
                  <Ionicons name="person-outline" size={20} color="#7C6FFF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={name}
                    onChangeText={(text) => { setName(text); setValidationError(''); }}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField('')}
                  />
                </View>

                {/* Email Address */}
                <View style={[
                  styles.inputWrapper,
                  focusedField === 'email' && styles.inputWrapperFocused
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
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField('')}
                  />
                </View>

                {/* Phone Number */}
                <View style={[
                  styles.inputWrapper,
                  focusedField === 'phone' && styles.inputWrapperFocused
                ]}>
                  <Ionicons name="call-outline" size={20} color="#7C6FFF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Phone (+92 300 1234567)"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={phone}
                    onChangeText={(text) => { setPhone(text); setValidationError(''); }}
                    keyboardType="phone-pad"
                    onFocus={() => setFocusedField('phone')}
                    onBlur={() => setFocusedField('')}
                  />
                </View>

                {/* Password */}
                <View style={[
                  styles.inputWrapper,
                  focusedField === 'password' && styles.inputWrapperFocused
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
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField('')}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="rgba(255, 255, 255, 0.4)"
                    />
                  </TouchableOpacity>
                </View>

                {/* Confirm Password */}
                <View style={[
                  styles.inputWrapper,
                  focusedField === 'confirmPassword' && styles.inputWrapperFocused
                ]}>
                  <Ionicons name="lock-closed-outline" size={20} color="#7C6FFF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={confirmPassword}
                    onChangeText={(text) => { setConfirmPassword(text); setValidationError(''); }}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    onFocus={() => setFocusedField('confirmPassword')}
                    onBlur={() => setFocusedField('')}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="rgba(255, 255, 255, 0.4)"
                    />
                  </TouchableOpacity>
                </View>

                {/* Submit button */}
                <Animated.View style={{ transform: [{ scale: registerBtnScale }], marginTop: 12 }}>
                  <Pressable
                    style={styles.button}
                    onPress={handleSendOtp}
                    onPressIn={() => handlePressIn(registerBtnScale)}
                    onPressOut={() => handlePressOut(registerBtnScale)}
                    disabled={isSendingOtp}
                  >
                    <LinearGradient
                      colors={['#7C6FFF', '#FF6BBA']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.gradientBtn}
                    >
                      {isSendingOtp ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.buttonText}>Send Verification Code</Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
              </View>
            ) : (
              // Step 2: OTP screen
              <View style={styles.formContent}>
                {/* Envelope Bouncing graphic */}
                <View style={styles.envIconWrapper}>
                  <Animated.View style={{ transform: [{ scale: envScale }] }}>
                    <Ionicons name="mail-open-outline" size={64} color="#7C6FFF" />
                  </Animated.View>
                </View>

                <Text style={[styles.formTitle, { textAlign: 'center' }]}>Check Your Email</Text>
                <Text style={[styles.formSubtitle, { textAlign: 'center', marginBottom: 12 }]}>
                  Sent to <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{maskEmail(email)}</Text>
                </Text>

                {/* 6 individual OTP inputs */}
                <View style={styles.otpRow}>
                  {otp.map((digit, i) => {
                    const isFocused = focusedIndex === i;
                    const isFilled = digit !== '';
                    let boxBorderColor = 'rgba(255, 255, 255, 0.1)';
                    let boxBgColor = 'rgba(255, 255, 255, 0.06)';

                    if (isFocused) {
                      boxBorderColor = '#7C6FFF';
                      boxBgColor = 'rgba(124, 111, 255, 0.1)';
                    } else if (isFilled) {
                      boxBorderColor = 'rgba(0, 245, 160, 0.4)';
                      boxBgColor = 'rgba(0, 245, 160, 0.05)';
                    }

                    return (
                      <Animated.View 
                        key={i} 
                        style={{ 
                          transform: [{ scale: boxScales[i] }],
                          flex: 1,
                          marginHorizontal: 4,
                        }}
                      >
                        <TextInput
                          ref={(el) => (inputRefs.current[i] = el)}
                          style={[
                            styles.otpInput,
                            {
                              borderColor: boxBorderColor,
                              backgroundColor: boxBgColor,
                            },
                            isFocused && styles.otpInputFocused
                          ]}
                          keyboardType="number-pad"
                          maxLength={1}
                          value={digit}
                          onChangeText={(val) => handleOtpChange(val, i)}
                          onKeyPress={(e) => handleKeyPress(e, i)}
                          onFocus={() => setFocusedIndex(i)}
                          onBlur={() => setFocusedIndex(-1)}
                          selectTextOnFocus
                        />
                      </Animated.View>
                    );
                  })}
                </View>

                {/* Resend and timer countdown */}
                <View style={styles.timerRow}>
                  {timer > 0 ? (
                    <Text style={styles.timerText}>
                      Resend in <Text style={styles.timerHighlight}>0:{timer < 10 ? `0${timer}` : timer}</Text>
                    </Text>
                  ) : (
                    <TouchableOpacity 
                      onPress={handleResendOtp} 
                      disabled={isSendingOtp}
                      style={styles.resendBtn}
                    >
                      <Text style={styles.resendBtnText}>Resend OTP</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Verify Submit Button */}
                <Animated.View style={{ transform: [{ scale: verifyBtnScale }], marginTop: 12 }}>
                  <Pressable
                    style={styles.button}
                    onPress={() => handleVerifyOtp()}
                    onPressIn={() => handlePressIn(verifyBtnScale)}
                    onPressOut={() => handlePressOut(verifyBtnScale)}
                    disabled={isVerifyingOtp || otp.join('').length !== 6}
                  >
                    <LinearGradient
                      colors={['#7C6FFF', '#FF6BBA']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.gradientBtn,
                        otp.join('').length !== 6 && { opacity: 0.5 }
                      ]}
                    >
                      {isVerifyingOtp ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.buttonText}>Verify & Continue</Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </Animated.View>

                <TouchableOpacity
                  style={styles.backToDetailsBtn}
                  onPress={() => {
                    setStep(1);
                    setValidationError('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.backToDetailsText}>Go back to edit details</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Bottom Glow */}
            <View style={styles.bottomGlow} pointerEvents="none" />
          </Animated.View>

          {/* Footer links */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginLink}>Log In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 60,
    marginTop: Platform.OS === 'ios' ? 60 : 40,
    height: 30,
    position: 'relative',
  },
  connectingLineBg: {
    position: 'absolute',
    left: 70,
    right: 70,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 1,
  },
  connectingLineActive: {
    position: 'absolute',
    left: 70,
    width: screenWidth - 140,
    height: 2,
    backgroundColor: '#7C6FFF',
    zIndex: 2,
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleInactive: {
    backgroundColor: '#080810',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  stepCircleActive: {
    backgroundColor: '#7C6FFF',
    borderColor: '#7C6FFF',
  },
  stepInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#080810',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    position: 'relative',
    paddingVertical: 12,
  },
  backButton: {
    position: 'absolute',
    left: 24,
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  formContent: {
    width: '100%',
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 24,
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
  button: {
    height: 58,
    borderRadius: 16,
    overflow: 'hidden',
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
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 24,
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C6FFF',
  },
  envIconWrapper: {
    alignItems: 'center',
    marginVertical: 20,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
  },
  otpInput: {
    height: 60,
    borderRadius: 16,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '800',
    color: '#7C6FFF',
  },
  otpInputFocused: {
    shadowColor: '#7C6FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  timerRow: {
    alignItems: 'center',
    marginBottom: 24,
  },
  timerText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  timerHighlight: {
    color: '#7C6FFF',
    fontWeight: '700',
  },
  resendBtn: {
    paddingVertical: 4,
  },
  resendBtnText: {
    fontSize: 14,
    color: '#7C6FFF',
    fontWeight: '700',
  },
  backToDetailsBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  backToDetailsText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '600',
  },
});