import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Alert,
  Animated,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions } from '../../hooks/useTransactions';
import VirtualCard from '../../components/VirtualCard';
import { colors } from '../../constants/colors';
import { formatPKR } from '../../utils/format';
import GlobalBackground from '../../components/GlobalBackground';

// Reusable Custom Toggle component with spring sliding thumb
const CustomToggle = ({ value, onValueChange, activeColor = '#00D4FF', trackActiveBg = 'rgba(0,212,255,0.2)' }) => {
  const toggleAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(toggleAnim, {
      toValue: value ? 1 : 0,
      friction: 8,
      tension: 100,
      useNativeDriver: true
    }).start();
  }, [value]);

  const translateX = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 18] // Track width 36 - thumb 16 - padding 2
  });

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => onValueChange(!value)}
      style={[
        styles.switchTrack,
        {
          backgroundColor: value ? trackActiveBg : 'rgba(255,255,255,0.1)',
          borderColor: value ? activeColor : 'rgba(255,255,255,0.15)',
        }
      ]}
    >
      <Animated.View style={[
        styles.switchThumb,
        { transform: [{ translateX }] }
      ]} />
    </TouchableOpacity>
  );
};

export default function CardsScreen() {
  const { profile, toggleCardFreeze, setCardLimit, toggleCardOnlinePayments } = useAuth();
  const { transactions } = useTransactions();

  const [showDetails, setShowDetails] = useState(false);
  const [customLimit, setCustomLimit] = useState('');
  const [isEditingLimit, setIsEditingLimit] = useState(false);

  // Spent amount: sum of P2P debits
  const cardSpent = transactions
    .filter(tx => tx.senderId === profile?.uid && tx.status === 'success' && tx.category !== 'topup')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const card = {
    number: profile?.virtualCard?.number || '4242 4242 4242 4242',
    expiry: profile?.virtualCard?.expiry || '12/28',
    cvv: profile?.virtualCard?.cvv || '123',
    limit: profile?.virtualCard?.limit || 50000,
    spent: cardSpent,
    isFrozen: profile?.virtualCard?.isFrozen || false,
    onlinePayments: profile?.virtualCard?.onlinePayments ?? true,
  };

  const cardTransactions = transactions.filter(
    tx => tx.senderId === profile?.uid && tx.status === 'success' && tx.category !== 'topup'
  );

  // Animated limit bar on mount
  const limitAnim = useRef(new Animated.Value(0)).current;
  const spentRatio = card.limit > 0 ? Math.min(card.spent / card.limit, 1.0) : 0;

  useEffect(() => {
    limitAnim.setValue(0);
    Animated.timing(limitAnim, {
      toValue: spentRatio,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [spentRatio]);

  const handleLimitChange = async (amount) => {
    if (card.isFrozen) return;
    try {
      await setCardLimit(amount);
      Alert.alert('Limit Updated', `Your daily spending limit is now ${formatPKR(amount)}.`);
    } catch (err) {
      Alert.alert('Error', 'Failed to update spending limit.');
    }
  };

  const handleCustomLimitSubmit = () => {
    if (card.isFrozen) return;
    const amt = parseFloat(customLimit);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number.');
      return;
    }
    handleLimitChange(amt);
    setIsEditingLimit(false);
    setCustomLimit('');
  };

  return (
    <GlobalBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Virtual Card</Text>

          {/* 3D Realistic flip card */}
          <VirtualCard
            cardDetails={card}
            cardholderName={profile?.name}
            isFrozen={card.isFrozen}
          />

          <Text style={styles.helperText}>
            {card.isFrozen ? "Card Frozen — Actions Disabled ❄️" : "Tap card to flip and view security details"}
          </Text>

          {/* Card Details Panel */}
          <View style={[
            styles.detailsCard, 
            card.isFrozen && { opacity: 0.5 }
          ]}>
            <View style={styles.topHighlight} />

            <TouchableOpacity 
              style={styles.detailsHeader} 
              onPress={() => {
                if (card.isFrozen) return;
                setShowDetails(!showDetails);
              }}
              disabled={card.isFrozen}
              activeOpacity={0.7}
            >
              <View style={styles.detailsHeaderLeft}>
                <Ionicons name="eye-outline" size={20} color="#7C6FFF" />
                <Text style={styles.detailsTitle}>View Card Details</Text>
              </View>
              <Ionicons 
                name={showDetails ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="rgba(255,255,255,0.4)" 
              />
            </TouchableOpacity>

            {showDetails && !card.isFrozen && (
              <View style={styles.detailsExpanded}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Card Number</Text>
                  <Text style={styles.detailValue}>
                    {card.number.replace(/(\d{4})/g, '$1 ').trim()}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Expiry Date</Text>
                  <Text style={styles.detailValue}>{card.expiry}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>CVV Code</Text>
                  <Text style={styles.detailValue}>{card.cvv}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Control rows stacked */}
          <View style={styles.controlsCard}>
            <View style={styles.topHighlight} />

            {/* Row 1: Freeze Card */}
            <View style={styles.controlRow}>
              <View style={styles.controlInfo}>
                <View style={[styles.controlIconBg, { backgroundColor: 'rgba(0, 212, 255, 0.15)' }]}>
                  <Ionicons name="snow-outline" size={20} color="#00D4FF" />
                </View>
                <View>
                  <Text style={styles.controlTitle}>Freeze Card</Text>
                  <Text style={styles.controlSub}>Temporarily disable this card</Text>
                </View>
              </View>
              
              <CustomToggle
                value={card.isFrozen}
                onValueChange={toggleCardFreeze}
                activeColor="#00D4FF"
                trackActiveBg="rgba(0, 212, 255, 0.3)"
              />
            </View>

            <View style={styles.controlDivider} />

            {/* Row 2: Online Payments */}
            <View style={[styles.controlRow, card.isFrozen && { opacity: 0.5 }]}>
              <View style={styles.controlInfo}>
                <View style={[styles.controlIconBg, { backgroundColor: 'rgba(124, 111, 255, 0.15)' }]}>
                  <Ionicons name="globe-outline" size={20} color="#7C6FFF" />
                </View>
                <View>
                  <Text style={styles.controlTitle}>Online Transactions</Text>
                  <Text style={styles.controlSub}>Allow e-commerce purchases</Text>
                </View>
              </View>
              <CustomToggle
                value={card.onlinePayments ?? true}
                onValueChange={toggleCardOnlinePayments}
                activeColor="#7C6FFF"
                trackActiveBg="rgba(124, 111, 255, 0.3)"
                disabled={card.isFrozen}
              />
            </View>
          </View>

          {/* Daily spending limits panel */}
          <View style={[
            styles.limitsCard,
            card.isFrozen && { opacity: 0.5 }
          ]}>
            <View style={styles.topHighlight} />

            <View style={styles.limitHeader}>
              <View>
                <Text style={styles.limitTitle}>Daily Spending Limit</Text>
                <Text style={styles.limitSub}>
                  Max budget: {formatPKR(card.limit)}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  if (card.isFrozen) return;
                  setIsEditingLimit(!isEditingLimit);
                }}
                style={styles.editLimitBtn}
                disabled={card.isFrozen}
                activeOpacity={0.7}
              >
                <Text style={styles.editLimitBtnText}>
                  {isEditingLimit ? 'Cancel' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>

            {isEditingLimit && !card.isFrozen ? (
              <View style={styles.customLimitRow}>
                <View style={styles.customLimitInputWrapper}>
                  <TextInput
                    style={styles.customLimitInput}
                    placeholder="Enter custom limit"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    keyboardType="numeric"
                    value={customLimit}
                    onChangeText={setCustomLimit}
                  />
                </View>
                <TouchableOpacity 
                  style={styles.customLimitSaveBtn}
                  onPress={handleCustomLimitSubmit}
                  activeOpacity={0.8}
                >
                  <Text style={styles.customLimitSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Chips */
              <View style={styles.limitChips}>
                {[10000, 25000, 50000, 100000].map((amt) => {
                  const isSelected = card.limit === amt;
                  return (
                    <TouchableOpacity
                      key={amt}
                      style={[
                        styles.limitChip,
                        isSelected && styles.limitChipActive
                      ]}
                      onPress={() => handleLimitChange(amt)}
                      disabled={card.isFrozen}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.limitChipText,
                        isSelected && { color: '#FFFFFF', fontWeight: '700' }
                      ]}>
                        {amt >= 1000 ? `${amt / 1000}K` : amt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Spent Limit progress bar */}
            <View style={styles.limitBarContainer}>
              <View style={styles.limitBarLabelRow}>
                <Text style={styles.limitBarLabel}>
                  Spent: {formatPKR(card.spent || 0)}
                </Text>
                <Text style={styles.limitBarLabel}>
                  Limit: {formatPKR(card.limit)}
                </Text>
              </View>
              
              <View style={styles.limitTrack}>
                <Animated.View style={[
                  styles.limitProgressWrapper,
                  {
                    width: limitAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    })
                  }
                ]}>
                  <LinearGradient
                    colors={['#7C6FFF', '#FF6BBA']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              </View>
            </View>
          </View>

          {/* Card Purchases */}
          <Text style={styles.sectionHeading}>
            Card Purchases
          </Text>
          <View style={styles.cardTxsList}>
            {cardTransactions.map(tx => (
              <View 
                key={tx.id} 
                style={styles.cardTxRow}
              >
                <View style={styles.topHighlight} />
                <View style={styles.cardTxLeft}>
                  <View style={[styles.cardTxIconCircle, { backgroundColor: 'rgba(124, 111, 255, 0.15)' }]}>
                    <Ionicons name="cart-outline" size={18} color="#7C6FFF" />
                  </View>
                  <View>
                    <Text style={styles.cardTxName} numberOfLines={1}>
                      {tx.senderId === profile?.uid ? tx.receiverName : tx.senderName}
                    </Text>
                    <Text style={styles.cardTxDate}>
                      Card payment • Online
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardTxAmount}>
                  -{formatPKR(tx.amount)}
                </Text>
              </View>
            ))}
            {cardTransactions.length === 0 && (
              <Text style={styles.emptyCardTxsText}>
                No card purchases recorded yet.
              </Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </GlobalBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 110, // tabBar padding
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  helperText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  detailsCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 2,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 10,
  },
  detailsExpanded: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: 14,
    paddingTop: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 1,
  },
  controlsCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  controlTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  controlSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  controlDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 12,
  },
  limitsCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  limitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  limitTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  limitSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  editLimitBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editLimitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C6FFF',
  },
  customLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  customLimitInputWrapper: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginRight: 10,
  },
  customLimitInput: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  customLimitSaveBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#7C6FFF',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customLimitSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  limitChips: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  limitChip: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  limitChipActive: {
    borderColor: '#7C6FFF',
    backgroundColor: 'rgba(124, 111, 255, 0.1)',
  },
  limitChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  limitBarContainer: {
    marginTop: 6,
  },
  limitBarLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  limitBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  limitTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    position: 'relative',
  },
  limitProgressWrapper: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: 'rgba(255, 255, 255, 0.3)',
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 12,
  },
  cardTxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginVertical: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  cardTxLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  cardTxIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTxName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  cardTxDate: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  cardTxAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyCardTxsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
  // Custom switch styles
  switchTrack: {
    width: 38,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    position: 'relative',
  },
  switchThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
});
