import React, { useState } from 'react';
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
  useColorScheme,
  TextInput
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { colors, darkColors } from '../../constants/colors';

export default function LoginScreen() {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;

  const router = useRouter();
  const { login, resetPassword, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Forgot Password States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // Validate inputs
  const validateForm = () => {
    setValidationError('');

    if (!email || !password) {
      setValidationError('Please fill in all fields.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setValidationError('Please enter a valid email address.');
      return false;
    }

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters.');
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    try {
      await login(email.trim(), password);
      // On success, RootLayout will handle redirect to (tabs) automatically
    } catch (err) {
      // Show native alert for failed login
      Alert.alert('Login Failed', err.message || 'Invalid credentials. Please try again.');
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          {/* Logo Title Icon */}
          <View style={styles.logoIconBg}>
            {/* Z letter icon */}
            <Text style={styles.logoIconText}>Z</Text>
          </View>
          <Text style={styles.logoText}>
            Zen<Text style={{ color: theme.primary }}>Pay</Text>
          </Text>
          <Text style={styles.subtitle}>
            Premium Finance
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Welcome Back</Text>
          <Text style={styles.formSubtitle}>
            Enter your details below to log into your account
          </Text>

          {validationError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={theme.danger} />
              <Text style={styles.errorText}>{validationError}</Text>
            </View>
          ) : null}

          {/* Email Input */}
          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color={theme.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="name@email.com"
              placeholderTextColor={theme.textMuted}
              value={email}
              onChangeText={(text) => { setEmail(text); setValidationError(''); }}
              autoCapital="none"
              keyboardType="email-address"
            />
          </View>

          {/* Password Input */}
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={theme.textMuted}
              value={password}
              onChangeText={(text) => { setPassword(text); setValidationError(); }}
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

          {/* Forgot Password Link */}
          <TouchableOpacity
            onPress={() => setShowForgotModal(true)}
            style={styles.forgotPasswordContainer}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: theme.primary }
            ]}
            onPress={handleLogin}
          >
            {isLoading ? (
              <ActivityIndicator color={theme.background} size="small" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Divider with "or" text */}
          <View style={styles.dividerWithOr}>
            <View style={styles.dividerLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Create Account Button */}
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.outlineButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setShowForgotModal(false); setForgotError(''); setForgotEmail(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundCard }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <TouchableOpacity onPress={() => { setShowForgotModal(false); setForgotError(''); setForgotEmail(''); }}>
                <Ionicons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter your email address below and we'll send you a link to reset your password.
            </Text>

            {forgotError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={theme.danger} />
                <Text style={styles.errorText}>{forgotError}</Text>
              </View>
            ) : null}

            {/* Modal Email Input */}
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={theme.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="name@email.com"
                placeholderTextColor={theme.textMuted}
                value={forgotEmail}
                onChangeText={(text) => { setForgotEmail(text); setForgotError(''); }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Send Reset Link Button */}
            <TouchableOpacity
              style={styles.button}
              onPress={handleResetPassword}
            >
              {forgotLoading ? (
                <ActivityIndicator color={theme.background} size="small" />
              ) : (
                <Text style={styles.buttonText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.backgroundElevated, // #1A1A27
    borderWidth: 1,
    borderColor: colors.borderGold, // rgba(201,168,76,0.3)
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoIconText: {
    fontSize: 28,
    color: colors.primary, // #C9A84C
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary, // #F0F0F0
    letterSpacing: 0,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary, // #8A8A9A
    letterSpacing: 2,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'transparent',
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary, // #F0F0F0
    marginBottom: 12,
  },
  formSubtitle: {
    fontSize: 13,
    color: colors.textSecondary, // #8A8A9A
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
    color: colors.danger, // #FF4D6A
    marginLeft: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary, // #F0F0F0
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
  dividerWithOr: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border, // rgba(255,255,255,0.06)
  },
  orText: {
    color: colors.textSecondary, // #8A8A9A
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.borderGold, // rgba(201,168,76,0.4)
    borderRadius: 14,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  outlineButtonText: {
    color: colors.primary, // #C9A84C
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -8,
  },
  forgotPasswordText: {
    color: colors.primary, // #C9A84C
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: colors.backgroundCard, // #12121A
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
    color: colors.textPrimary, // #F0F0F0
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary, // #8A8A9A
    lineHeight: 20,
    marginBottom: 20,
  },
});