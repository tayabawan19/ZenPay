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
  useColorScheme
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { colors, darkColors } from '../../constants/colors';
import { API_URL } from '../../constants/api';

export default function RegisterScreen() {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;

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

  // Mask email function
  const maskEmail = (email) => {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;
    const maskedLocal = localPart.charAt(0) + '*'.repeat(localPart.length - 1);
    return `${maskedLocal}@${domain}`;
  };

  // Validate Step 1 Registration Form
  const validateForm = () => {
    setValidationError('');

    if (!name.trim() || !email.trim() || !phone.trim() || !password || !confirmPassword) {
      setValidationError('Please fill in all fields.');
      return false;
    }

    if (name.trim().length < 3) {
      setValidationError('Name must be at least 3 characters.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setValidationError('Please enter a valid email address.');
      return false;
    }

    // Phone validation: starts with +92 (exactly 13 chars)
    const phoneVal = phone.trim();
    if (!phoneVal.startsWith('+92')) {
      setValidationError('Phone number must start with +92.');
      return false;
    }
    if (phoneVal.length !== 13) {
      setValidationError('Phone number must be exactly 13 characters.');
      return false;
    }
    const phoneDigits = phoneVal.substring(1);
    if (!/^\d+$/.test(phoneDigits)) {
      setValidationError('Phone number must contain only numbers after +.');
      return false;
    }

    // Password validation: min 8 chars with 1 number
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters.');
      return false;
    }
    if (!/\d/.test(password)) {
      setValidationError('Password must contain at least one number.');
      return false;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return false;
    }

    return true;
  };

  // Step 1: Send OTP code
  const handleSendOtp = async () => {
    if (!validateForm()) return;

    setIsSendingOtp(true);
    setValidationError('');

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
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setTimer(60);
        setStep(2);
        // Clear any previous OTP entries
        setOtp(['', '', '', '', '', '']);
      } else {
        const errorMsg = data.message || 'Failed to send verification code.';
        setValidationError(errorMsg);
        Alert.alert('Error', errorMsg);
      }
    } catch (err) {
      console.error(err);
      const networkError = 'Network error. Please make sure the backend is running and reachable.';
      setValidationError(networkError);
      Alert.alert('Connection Failed', networkError);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Resend OTP code
  const handleResendOtp = async () => {
    if (timer > 0) return;

    setIsSendingOtp(true);
    setValidationError('');
    setOtp(['', '', '', '', '', '']);

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
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setTimer(60);
        Alert.alert('Success', 'Verification code resent to ' + email.trim());
      } else {
        const errorMsg = data.message || 'Failed to resend verification code.';
        setValidationError(errorMsg);
        Alert.alert('Error', errorMsg);
      }
    } catch (err) {
      console.error(err);
      const networkError = 'Network error. Failed to resend verification code.';
      setValidationError(networkError);
      Alert.alert('Connection Failed', networkError);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 2: Verify OTP code and register
  const handleVerifyOtp = async (codeToVerify) => {
    const code = codeToVerify || otp.join('');
    if (code.length !== 6) {
      setValidationError('Please enter all 6 digits of the code.');
      return;
    }

    setIsVerifyingOtp(true);
    setValidationError('');

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
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // OTP verified successfully, proceed with Firebase account registration
        try {
          await register(name.trim(), email.trim(), phone.trim(), password);
          // On success, RootLayout will handle redirect to (tabs) automatically
        } catch (firebaseErr) {
          setValidationError(firebaseErr.message || 'Verification succeeded, but registration failed.');
          Alert.alert('Registration Failed', firebaseErr.message || 'Failed to initialize account.');
        }
      } else {
        const errorMsg = data.message || 'Invalid or expired code. Please try again.';
        setValidationError(errorMsg);
        Alert.alert('Verification Failed', errorMsg);
      }
    } catch (err) {
      console.error(err);
      const networkError = 'Network error during verification. Please try again.';
      setValidationError(networkError);
      Alert.alert('Connection Failed', networkError);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Handle individual OTP TextInput change
  const handleOtpChange = (value, index) => {
    const newOtp = [...otp];
    const val = value.slice(-1); // Take last character entered
    newOtp[index] = val;
    setOtp(newOtp);

    // Auto-focus next box if entering a digit
    if (val !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit OTP if 6 digits are filled
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                {
                  backgroundColor: i + 1 === step ? theme.primary : theme.backgroundCard,
                  borderWidth: i + 1 === step ? 0 : 1,
                  borderColor: theme.border,
                }
              ]}
            />
          ))}
        </View>

        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={[styles.backButton, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
            <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.logoText, { color: theme.primary }]}>
            Zen<Text style={{ color: theme.accent }}>Pay</Text>
          </Text>
          <Text style={[
            styles.subtitle,
            {
              color: theme.textSecondary,
              ...(step === 1 ? { marginTop: 8 } : {}),
            }
          ]}>
            {step === 1 ? 'Create Account' : 'Check your email'}
          </Text>
          {step === 2 && (
            <Text style={[
              styles.emailSubtitle,
              { color: theme.textSecondary }
            ]}>
              We sent a 6-digit code to <Text style={{ fontWeight: '600', color: theme.textPrimary }}>{maskEmail(email)}</Text>
            </Text>
          )}
        </View>

        {step === 1 ? (
          <View style={styles.formCard}>
            <Text style={[styles.formTitle, { color: theme.textPrimary }]}>Get Started</Text>
            <Text style={[styles.formSubtitle, { color: theme.textSecondary }]}>
              It only takes a few minutes to create an account
            </Text>

            {validationError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={theme.danger} />
                <Text style={styles.errorText}>{validationError}</Text>
              </View>
            ) : null}

            {/* Full Name */}
            <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Full Name</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={theme.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor={theme.textMuted}
                value={name}
                onChangeText={(text) => { setName(text); setValidationError(''); }}
                autoCapitalize="none"
              />
            </View>

            {/* Email Address */}
            <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={theme.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="john@example.com"
                placeholderTextColor={theme.textMuted}
                value={email}
                onChangeText={(text) => { setEmail(text); setValidationError(''); }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Phone Number */}
            <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Phone Number</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={20} color={theme.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="+92 300 1234567"
                placeholderTextColor={theme.textMuted}
                value={phone}
                onChangeText={(text) => { setPhone(text); setValidationError(''); }}
                keyboardType="phone-pad"
              />
            </View>

            {/* Password */}
            <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={theme.textMuted}
                value={password}
                onChangeText={(text) => { setPassword(text); setValidationError(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.primary}
                />
              </TouchableOpacity>
            </View>

            {/* Confirm Password */}
            <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Confirm Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={theme.textMuted}
                value={confirmPassword}
                onChangeText={(text) => { setConfirmPassword(text); setValidationError(''); }}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.primary}
                />
              </TouchableOpacity>
            </View>

            {/* Send Verification Code Button */}
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: theme.primary },
                isSendingOtp && { opacity: 0.8 }
              ]}
              onPress={handleSendOtp}
              disabled={isSendingOtp}
            >
              {isSendingOtp ? (
                <ActivityIndicator color={theme.background} size="small" />
              ) : (
                <Text style={styles.buttonText}>Send Verification Code</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formCard}>
            <Text style={[styles.formTitle, { color: theme.textPrimary }]}>Verify Email</Text>

            {validationError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={theme.danger} />
                <Text style={styles.errorText}>{validationError}</Text>
              </View>
            ) : null}

            {/* 6 individual OTP boxes */}
            <View style={styles.otpContainer}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  style={[
                    styles.otpInput,
                    {
                      borderColor: focusedIndex === i ? theme.primary : theme.borderGold,
                      // Add shadow for active box
                      ...(focusedIndex === i && {
                        shadowColor: theme.primary,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.3,
                        shadowRadius: 6,
                        elevation: 2,
                      })
                    }
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
              ))}
            </View>

            {/* Timer and Resend */}
            <View style={styles.resendContainer}>
              {timer > 0 ? (
                <Text style={[styles.timerText, { color: theme.primary }]}>
                  Resend in <Text style={{ fontWeight: '700' }}>0:{timer < 10 ? `0${timer}` : timer}</Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResendOtp} disabled={isSendingOtp}>
                  <Text style={styles.resendText}>Resend OTP</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Verify & Register Button */}
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: theme.primary },
                (isVerifyingOtp || otp.join('').length !== 6) && { opacity: 0.6 }
              ]}
              onPress={() => handleVerifyOtp()}
              disabled={isVerifyingOtp || otp.join('').length !== 6}
            >
              {isVerifyingOtp ? (
                <ActivityIndicator color={theme.background} size="small" />
              ) : (
                <Text style={styles.buttonText}>Verify & Continue</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.backToFormButton, { marginTop: 16 }]}
              onPress={() => {
                setStep(1);
                setValidationError('');
              }}
            >
              <Text style={styles.backToFormText}>Go back to edit details</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginLink}>Log In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 4,
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  emailSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  formCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'transparent',
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  formSubtitle: {
    fontSize: 13,
    marginBottom: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: 'rgba(255,77,106,0.1)', // danger with 10% opacity
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
    marginLeft: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: colors.backgroundElevated, // #1A1A27
    borderColor: colors.border, // rgba(255,255,255,0.06)
    paddingHorizontal: 18,
    height: 56,
    marginBottom: 20,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary, // #F0F0F0
    placeholderTextColor: colors.textMuted, // #4A4A5A
    height: '100%',
  },
  eyeIcon: {
    padding: 4,
  },
  button: {
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: colors.background, // #0A0A0F
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 24,
    width: '100%',
  },
  otpInput: {
    width: 48,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: colors.backgroundElevated, // #1A1A27
    borderColor: colors.borderGold, // rgba(201,168,76,0.3)
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary, // #C9A84C
  },
  resendContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  timerText: {
    fontSize: 12,
  },
  resendText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  backToFormButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  backToFormText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});