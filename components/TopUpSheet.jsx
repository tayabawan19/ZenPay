import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  useColorScheme,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Animated,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { colors, darkColors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../constants/api';
import { formatPKR } from '../utils/format';

export default function TopUpSheet({ visible, onClose }) {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;

  const { user, profile } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // Input state
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Animation values
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  // Reset states when visible is changed
  useEffect(() => {
    if (visible) {
      setAmount('');
      setIsProcessing(false);
      setShowSuccess(false);
      successScale.setValue(0);
      successOpacity.setValue(0);
    }
  }, [visible]);

  // Run success animation when payment succeeds
  useEffect(() => {
    if (showSuccess) {
      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 1,
          tension: 50,
          friction: 6,
          useNativeDriver: true
        }),
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [showSuccess]);

  const presetAmounts = [500, 1000, 2000, 5000];

  const handlePresetSelect = (value) => {
    setAmount(value.toString());
  };

  const handlePaymentSubmit = async () => {
    const amountNum = parseFloat(amount);

    if (isNaN(amountNum) || amountNum < 100 || amountNum > 100000) {
      Alert.alert('Invalid Amount', 'Please enter a top-up amount between PKR 100 and PKR 100,000.');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Session Error', 'User session not found. Please log in again.');
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Request PaymentIntent creation from backend
      const response = await fetch(`${API_URL}/api/payment/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amountNum,
          userId: user.uid
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to create Stripe payment intent.');
      }

      const { clientSecret, paymentIntentId } = data;

      // Handle Mock Stripe fallback if backend returned mock intent
      if (paymentIntentId && paymentIntentId.startsWith('pi_mock_')) {
        // Confirm backend mock transaction directly without native Stripe sheet
        const confirmRes = await fetch(`${API_URL}/api/payment/confirm-topup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.uid,
            amount: amountNum,
            paymentIntentId: paymentIntentId
          })
        });

        const confirmData = await confirmRes.json();
        if (!confirmData.success) {
          throw new Error(confirmData.message || 'Failed to verify mock payment.');
        }

        setIsProcessing(false);
        setShowSuccess(true);
        return;
      }

      // Step 2: Initialize native Stripe payment sheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'ZenPay Inc.',
        defaultBillingDetails: {
          name: profile?.name || 'ZenPay User',
          email: user.email || undefined
        },
        style: 'alwaysDark'
      });

      if (initError) {
        throw new Error(initError.message || 'Failed to initialize payment sheet.');
      }

      // Step 3: Present Payment Sheet to user
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        // Payment sheet was closed or failed
        setIsProcessing(false);
        if (presentError.code !== 'Canceled') {
          Alert.alert('Payment Error', presentError.message);
        }
        return;
      }

      // Step 4: Call backend confirm-topup endpoint to verify status and log Firestore balance increase
      const confirmRes = await fetch(`${API_URL}/api/payment/confirm-topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.uid,
          amount: amountNum,
          paymentIntentId: paymentIntentId
        })
      });

      const confirmData = await confirmRes.json();

      if (!confirmData.success) {
        throw new Error(confirmData.message || 'Payment confirmed but database update failed.');
      }

      // Step 5: Show success visual animation
      setIsProcessing(false);
      setShowSuccess(true);

    } catch (error) {
      console.error('Stripe Top-Up flow error:', error);
      Alert.alert('Top Up Failed', error.message || 'An error occurred during Stripe transaction.');
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => { if (!isProcessing) onClose(); }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={() => { if (!isProcessing) onClose(); }}
        />

        <View style={[styles.sheetContent, { backgroundColor: theme.backgroundCard, borderTopColor: theme.border }]}>
          {showSuccess ? (
            /* Success Screen View */
            <Animated.View style={[styles.successContainer, { opacity: successOpacity }]}>
              <Animated.View style={[styles.successIconCircle, { backgroundColor: theme.success, transform: [{ scale: successScale }] }]}>
                <Ionicons name="checkmark" size={64} color={theme.background} />
              </Animated.View>

              <Text style={[styles.successTitle, { color: theme.textPrimary }]}>
                Top Up Successful!
              </Text>
              
              <Text style={[styles.successSubtitle, { color: theme.textSecondary }]}>
                {formatPKR(parseFloat(amount))} has been added to your balance.
              </Text>

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.primary, marginTop: 32 }]}
                onPress={onClose}
              >
                <Text style={[styles.buttonText, { color: theme.background }]}>Done</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            /* Form Input View */
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Top Up Wallet</Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.closeButton, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}
                  disabled={isProcessing}
                >
                  <Ionicons name="close" size={20} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Enter Amount (PKR)</Text>
              
              <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
                <Text style={[styles.currencySymbol, { color: theme.textSecondary }]}>PKR</Text>
                <TextInput
                  style={[styles.textInput, { color: theme.textPrimary }]}
                  placeholder="1,000"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
                  editable={!isProcessing}
                  autoFocus
                />
              </View>

              {/* Preset Buttons */}
              <View style={styles.presetsGrid}>
                {presetAmounts.map((val) => (
                  <TouchableOpacity
                    key={val}
                    style={[
                      styles.presetItem,
                      {
                        backgroundColor: theme.backgroundElevated,
                        borderColor: amount === val.toString() ? theme.primary : theme.border
                      }
                    ]}
                    onPress={() => handlePresetSelect(val)}
                    disabled={isProcessing}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        {
                          color: amount === val.toString() ? theme.primary : theme.textSecondary,
                          fontWeight: amount === val.toString() ? '700' : '600'
                        }
                      ]}
                    >
                      +{val}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sandbox Card Details Info */}
              <View style={[styles.infoCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
                <View style={styles.infoTitleRow}>
                  <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
                  <Text style={[styles.infoTitle, { color: theme.primary }]}>Stripe Test Mode Credentials</Text>
                </View>
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                  Card: <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>4242 4242 4242 4242</Text>
                </Text>
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                  Expiry: <Text style={{ color: theme.textPrimary }}>Any future date</Text> (e.g. 12/28)
                </Text>
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                  CVV: <Text style={{ color: theme.textPrimary }}>Any 3 digits</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: theme.primary,
                    opacity: isProcessing || !amount ? 0.6 : 1
                  }
                ]}
                onPress={handlePaymentSubmit}
                disabled={isProcessing || !amount}
              >
                {isProcessing ? (
                  <ActivityIndicator color={theme.background} size="small" />
                ) : (
                  <Text style={[styles.buttonText, { color: theme.background }]}>Pay with Card</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end'
  },
  dismissArea: {
    flex: 1
  },
  sheetContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    maxHeight: '85%'
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 18,
    marginBottom: 16
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 12
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    height: '100%'
  },
  presetsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  presetItem: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4
  },
  presetText: {
    fontSize: 13
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8
  },
  infoText: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16
  },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%'
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  successContainer: {
    alignItems: 'center',
    padding: 32,
    paddingBottom: 8
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center'
  },
  successSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16
  }
});
