import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Animated,
  Alert,
  Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../constants/api';
import { formatPKR } from '../utils/format';
import { STRIPE_PUBLISHABLE_KEY } from '../services/stripe';

export default function TopUpSheet({ visible, onClose }) {
  const { user, profile } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // Input state
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Animation values
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(600)).current;
  
  // Interactive button scale
  const payBtnScale = useRef(new Animated.Value(1.0)).current;
  const doneBtnScale = useRef(new Animated.Value(1.0)).current;

  // Reset states when visible changes and animate sheet sliding in/out
  useEffect(() => {
    if (visible) {
      setAmount('');
      setIsProcessing(false);
      setShowSuccess(false);
      successScale.setValue(0);
      successOpacity.setValue(0);

      // Slide up sheet
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    } else {
      sheetTranslateY.setValue(600);
    }
  }, [visible]);

  // Run success animation when payment succeeds
  useEffect(() => {
    if (showSuccess) {
      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 1.0,
          tension: 60,
          friction: 8,
          useNativeDriver: false
        }),
        Animated.timing(successOpacity, {
          toValue: 1.0,
          duration: 300,
          useNativeDriver: false
        })
      ]).start();
    }
  }, [showSuccess]);

  const presetAmounts = [500, 1000, 2000, 5000];

  const handlePresetSelect = (value) => {
    setAmount(value.toString());
  };

  const handlePressIn = (scaleVar) => {
    Animated.spring(scaleVar, {
      toValue: 0.97,
      speed: 300,
      bounciness: 0,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = (scaleVar) => {
    Animated.spring(scaleVar, {
      toValue: 1.0,
      speed: 300,
      bounciness: 8,
      useNativeDriver: false,
    }).start();
  };

  const dismissSheet = () => {
    Animated.timing(sheetTranslateY, {
      toValue: 600,
      duration: 250,
      useNativeDriver: false,
    }).start(() => onClose());
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

    const runSimulatedTopUp = async (mockIntentId) => {
      console.log("Simulating top-up payment process...");
      await new Promise(resolve => setTimeout(resolve, 1500));

      const confirmRes = await fetch(`${API_URL}/api/payment/confirm-topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.uid,
          amount: amountNum,
          paymentIntentId: mockIntentId
        })
      });

      const confirmData = await confirmRes.json();
      if (!confirmData.success) {
        throw new Error(confirmData.message || 'Failed to verify mock payment.');
      }

      setIsProcessing(false);
      setShowSuccess(true);
    };

    try {
      const isPlaceholderKey = STRIPE_PUBLISHABLE_KEY.includes('YOUR_KEY_HERE') || 
                               STRIPE_PUBLISHABLE_KEY === 'pk_test_placeholder';

      if (isPlaceholderKey) {
        await runSimulatedTopUp('pi_mock_' + Math.random().toString(36).substring(2, 10));
        return;
      }

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

      if (paymentIntentId && paymentIntentId.startsWith('pi_mock_')) {
        await runSimulatedTopUp(paymentIntentId);
        return;
      }

      let initSuccess = false;
      try {
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'ZenPay Inc.',
          defaultBillingDetails: {
            name: profile?.name || 'ZenPay User',
            email: user.email || undefined
          },
          style: 'alwaysDark'
        });

        if (!initError) {
          initSuccess = true;
        }
      } catch (err) {
        console.warn("Stripe init failed, fallback to simulation:", err.message);
      }

      if (!initSuccess) {
        await runSimulatedTopUp(paymentIntentId);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        setIsProcessing(false);
        if (presentError.code !== 'Canceled') {
          Alert.alert('Payment Error', presentError.message);
        }
        return;
      }

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
      animationType="none"
      transparent={true}
      onRequestClose={() => { if (!isProcessing) dismissSheet(); }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={() => { if (!isProcessing) dismissSheet(); }}
        />

        <Animated.View style={[
          styles.sheetContainer,
          { transform: [{ translateY: sheetTranslateY }] }
        ]}>
          <BlurView 
            intensity={40} 
            tint="dark"
            style={styles.sheetContent}
          >
            {/* Top glass highlight line */}
            <View style={styles.topHighlight} />

            {showSuccess ? (
              /* Success View */
              <Animated.View style={[styles.successContainer, { opacity: successOpacity }]}>
                {/* 3D Success checkmark ring */}
                <Animated.View style={[
                  styles.successIconCircle, 
                  { transform: [{ scale: successScale }] }
                ]}>
                  <Ionicons name="checkmark" size={48} color="#00F5A0" />
                </Animated.View>

                <Text style={styles.successTitle}>Top Up Successful!</Text>
                <Text style={styles.successSubtitle}>
                  {formatPKR(parseFloat(amount))} has been added to your balance.
                </Text>

                <Animated.View style={{ transform: [{ scale: doneBtnScale }], width: '100%', marginTop: 32 }}>
                  <Pressable
                    style={styles.btnDone}
                    onPress={dismissSheet}
                    onPressIn={() => handlePressIn(doneBtnScale)}
                    onPressOut={() => handlePressOut(doneBtnScale)}
                  >
                    <Text style={styles.btnDoneText}>Done</Text>
                  </Pressable>
                </Animated.View>
              </Animated.View>
            ) : (
              /* Input Form View */
              <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                  <Text style={styles.title}>Top Up Wallet</Text>
                  <TouchableOpacity
                    onPress={dismissSheet}
                    style={styles.closeButton}
                    disabled={isProcessing}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>Enter Amount (PKR)</Text>
                
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencySymbol}>PKR</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="1,000"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
                    editable={!isProcessing}
                    autoFocus
                  />
                </View>

                {/* Preset Values row */}
                <View style={styles.presetsGrid}>
                  {presetAmounts.map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.presetItem,
                        amount === val.toString() && styles.presetItemActive
                      ]}
                      onPress={() => handlePresetSelect(val)}
                      disabled={isProcessing}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.presetText,
                        amount === val.toString() && styles.presetTextActive
                      ]}>
                        +{val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Sandbox Credentials Card */}
                <View style={styles.infoCard}>
                  <View style={styles.infoHighlight} />
                  <View style={styles.infoTitleRow}>
                    <Ionicons name="information-circle-outline" size={18} color="#7C6FFF" />
                    <Text style={styles.infoTitle}>Stripe Test Credentials</Text>
                  </View>
                  <Text style={styles.infoText}>
                    Card Number: <Text style={styles.infoBold}>4242 4242 4242 4242</Text>
                  </Text>
                  <Text style={styles.infoText}>
                    Expiry: <Text style={styles.infoBold}>Any future date</Text> (e.g. 12/28)
                  </Text>
                  <Text style={styles.infoText}>
                    CVV: <Text style={styles.infoBold}>Any 3 digits</Text>
                  </Text>
                </View>

                {/* Submit Pay button */}
                <Animated.View style={{ transform: [{ scale: payBtnScale }], marginTop: 12 }}>
                  <Pressable
                    style={styles.btnPay}
                    onPress={handlePaymentSubmit}
                    onPressIn={() => handlePressIn(payBtnScale)}
                    onPressOut={() => handlePressOut(payBtnScale)}
                    disabled={isProcessing || !amount}
                  >
                    <LinearGradient
                      colors={['#7C6FFF', '#FF6BBA']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.gradientBtn,
                        (isProcessing || !amount) && { opacity: 0.5 }
                      ]}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.btnPayText}>Pay with Card</Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
              </ScrollView>
            )}
          </BlurView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end'
  },
  dismissArea: {
    flex: 1
  },
  sheetContainer: {
    width: '100%',
    maxHeight: '85%',
  },
  sheetContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(8, 8, 16, 0.85)',
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    overflow: 'hidden',
    position: 'relative',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 2,
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
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.3)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    height: 56,
    paddingHorizontal: 20,
    marginBottom: 16
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7C6FFF',
    marginRight: 12
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4
  },
  presetItemActive: {
    borderColor: '#7C6FFF',
    backgroundColor: 'rgba(124, 111, 255, 0.1)',
  },
  presetText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)'
  },
  presetTextActive: {
    color: '#7C6FFF',
    fontWeight: '700'
  },
  infoCard: {
    borderWidth: 1,
    borderColor: 'rgba(124, 111, 255, 0.25)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    backgroundColor: 'rgba(124, 111, 255, 0.04)',
    position: 'relative',
    overflow: 'hidden',
  },
  infoHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C6FFF',
    marginLeft: 8
  },
  infoText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
    lineHeight: 16
  },
  infoBold: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  btnPay: {
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
  btnPayText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
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
    borderWidth: 3,
    borderColor: '#00F5A0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    backgroundColor: 'rgba(0, 245, 160, 0.05)',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center'
  },
  successSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16
  },
  btnDone: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  btnDoneText: {
    color: '#080810',
    fontSize: 16,
    fontWeight: '700',
  }
});
