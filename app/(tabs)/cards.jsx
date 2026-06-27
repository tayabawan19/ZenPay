import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Switch, 
  TextInput,
  Alert,
  useColorScheme 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions } from '../../hooks/useTransactions';
import VirtualCard from '../../components/VirtualCard';
import { colors, darkColors } from '../../constants/colors';
import { formatPKR } from '../../utils/format';

export default function CardsScreen() {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;

  const { profile, toggleCardFreeze, setCardLimit, toggleCardOnlinePayments } = useAuth();
  const { transactions } = useTransactions();

  const [showDetails, setShowDetails] = useState(false);
  const [customLimit, setCustomLimit] = useState('');
  const [isEditingLimit, setIsEditingLimit] = useState(false);

  const card = profile?.virtualCard || {
    number: '4242 4242 4242 4242',
    expiry: '12/28',
    cvv: '123',
    limit: 50000,
    spent: 0,
    isActive: true,
    onlinePayments: true,
  };

  // Filter transactions to simulate card-specific spends (e.g. transfers and topups)
  const cardTransactions = transactions.slice(0, 3);

  const handleLimitChange = async (amount) => {
    try {
      await setCardLimit(amount);
      Alert.alert('Limit Updated', `Your daily spending limit is now ${formatPKR(amount)}.`);
    } catch (err) {
      Alert.alert('Error', 'Failed to update spending limit.');
    }
  };

  const handleCustomLimitSubmit = () => {
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { color: theme.text }]}>Virtual Card</Text>

        {/* Realistic Card Element */}
        <VirtualCard
          cardDetails={card}
          cardholderName={profile?.name}
          isFrozen={!card.isActive}
        />

        <Text style={[styles.helperText, { color: theme.textSecondary }]}>
          Tap card to reveal CVV security code
        </Text>

        {/* Card Details Panel */}
        <View style={[styles.detailsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity 
            style={styles.detailsHeader} 
            onPress={() => setShowDetails(!showDetails)}
          >
            <View style={styles.detailsHeaderLeft}>
              <Ionicons name="eye-outline" size={20} color={theme.primary} />
              <Text style={[styles.detailsTitle, { color: theme.text }]}>View Card Details</Text>
            </View>
            <Ionicons 
              name={showDetails ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={theme.textSecondary} 
            />
          </TouchableOpacity>

          {showDetails && (
            <View style={[styles.detailsExpanded, { borderTopColor: theme.border }]}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Card Number</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {card.number.replace(/(\d{4})/g, '$1 ').trim()}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Expiry Date</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{card.expiry}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>CVV Code</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{card.cvv}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Toggle Switches Controls */}
        <View style={[styles.controlsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* 1. Freeze Card Control */}
          <View style={styles.controlRow}>
            <View style={styles.controlInfo}>
              <View style={[styles.controlIconBg, { backgroundColor: 'rgba(123, 94, 167, 0.1)' }]}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={[styles.controlTitle, { color: theme.text }]}>Freeze Card</Text>
                <Text style={[styles.controlSub, { color: theme.textSecondary }]}>Temporarily disable this card</Text>
              </View>
            </View>
            <Switch
              value={!card.isActive}
              onValueChange={toggleCardFreeze}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.controlDivider, { backgroundColor: theme.border }]} />

          {/* 2. Online Payments Permission */}
          <View style={styles.controlRow}>
            <View style={styles.controlInfo}>
              <View style={[styles.controlIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="globe-outline" size={20} color={theme.success} />
              </View>
              <View>
                <Text style={[styles.controlTitle, { color: theme.text }]}>Online Transactions</Text>
                <Text style={[styles.controlSub, { color: theme.textSecondary }]}>Allow e-commerce purchases</Text>
              </View>
            </View>
            <Switch
              value={card.onlinePayments ?? true}
              onValueChange={toggleCardOnlinePayments}
              trackColor={{ false: theme.border, true: theme.success }}
              thumbColor="#FFFFFF"
              disabled={!card.isActive}
            />
          </View>
        </View>

        {/* Limits Setting Slider Panel */}
        <View style={[styles.limitsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.limitHeader}>
            <View>
              <Text style={[styles.limitTitle, { color: theme.text }]}>Daily Spending Limit</Text>
              <Text style={[styles.limitSub, { color: theme.textSecondary }]}>
                Max budget: {formatPKR(card.limit)}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => setIsEditingLimit(!isEditingLimit)}
              style={styles.editLimitBtn}
            >
              <Text style={[styles.editLimitBtnText, { color: theme.primary }]}>
                {isEditingLimit ? 'Cancel' : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>

          {isEditingLimit ? (
            <View style={styles.customLimitRow}>
              <View style={[styles.customLimitInputWrapper, { borderColor: theme.border }]}>
                <TextInput
                  style={[styles.customLimitInput, { color: theme.text }]}
                  placeholder="Enter custom limit"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  value={customLimit}
                  onChangeText={setCustomLimit}
                />
              </View>
              <TouchableOpacity 
                style={[styles.customLimitSaveBtn, { backgroundColor: theme.primary }]}
                onPress={handleCustomLimitSubmit}
              >
                <Text style={styles.customLimitSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Fast Selector Option Chips */
            <View style={styles.limitChips}>
              {[10000, 25000, 50000, 100000].map((amt) => {
                const isSelected = card.limit === amt;
                return (
                  <TouchableOpacity
                    key={amt}
                    style={[
                      styles.limitChip,
                      { borderColor: theme.border },
                      isSelected && { backgroundColor: theme.primary, borderColor: theme.primary }
                    ]}
                    onPress={() => handleLimitChange(amt)}
                    disabled={!card.isActive}
                  >
                    <Text style={[
                      styles.limitChipText,
                      { color: theme.text },
                      isSelected && { color: '#FFFFFF', fontWeight: '700' }
                    ]}>
                      {amt >= 1000 ? `${amt / 1000}K` : amt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Progress Bar of Limit vs Spent */}
          <View style={styles.limitBarContainer}>
            <View style={styles.limitBarLabelRow}>
              <Text style={[styles.limitBarLabel, { color: theme.textSecondary }]}>
                Spent: {formatPKR(card.spent || 0)}
              </Text>
              <Text style={[styles.limitBarLabel, { color: theme.textSecondary }]}>
                Limit: {formatPKR(card.limit)}
              </Text>
            </View>
            <View style={[styles.limitTrack, { backgroundColor: theme.border }]}>
              <View style={[
                styles.limitProgress, 
                { 
                  width: `${Math.min(100, (((card.spent || 0) / card.limit) * 100))}%`,
                  backgroundColor: theme.accent 
                }
              ]} />
            </View>
          </View>
        </View>

        {/* Card Spends Transaction History */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 12, marginBottom: 8 }]}>
          Card Purchases
        </Text>
        <View style={styles.cardTxsList}>
          {cardTransactions.map(tx => (
            <View 
              key={tx.id} 
              style={[
                styles.cardTxRow, 
                { backgroundColor: theme.card, borderColor: theme.border }
              ]}
            >
              <View style={styles.cardTxLeft}>
                <View style={[styles.cardTxIconCircle, { backgroundColor: `${theme.primary}15` }]}>
                  <Ionicons name="cart-outline" size={18} color={theme.primary} />
                </View>
                <View>
                  <Text style={[styles.cardTxName, { color: theme.text }]} numberOfLines={1}>
                    {tx.senderId === profile?.uid ? tx.receiverName : tx.senderName}
                  </Text>
                  <Text style={[styles.cardTxDate, { color: theme.textSecondary }]}>
                    Card payment • Online
                  </Text>
                </View>
              </View>
              <Text style={[styles.cardTxAmount, { color: theme.text }]}>
                -{formatPKR(tx.amount)}
              </Text>
            </View>
          ))}
          {cardTransactions.length === 0 && (
            <Text style={[styles.emptyCardTxsText, { color: theme.textSecondary }]}>
              No card purchases recorded yet.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  helperText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  detailsCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
    marginLeft: 10,
  },
  detailsExpanded: {
    borderTopWidth: 1,
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
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Courier',
  },
  controlsCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  controlTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  controlSub: {
    fontSize: 11,
  },
  controlDivider: {
    height: 1,
    marginVertical: 14,
  },
  limitsCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  limitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  limitTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  limitSub: {
    fontSize: 11,
  },
  editLimitBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editLimitBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  limitChips: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  limitChip: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  limitChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  customLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  customLimitInputWrapper: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginRight: 10,
  },
  customLimitInput: {
    fontSize: 13,
    fontWeight: '600',
  },
  customLimitSaveBtn: {
    width: 64,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customLimitSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  limitBarContainer: {
    marginTop: 8,
  },
  limitBarLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  limitBarLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  limitTrack: {
    height: 6,
    borderRadius: 3,
    width: '100%',
  },
  limitProgress: {
    height: '100%',
    borderRadius: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardTxsList: {
    marginTop: 4,
  },
  cardTxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 4,
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
    marginBottom: 2,
  },
  cardTxDate: {
    fontSize: 11,
  },
  cardTxAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCardTxsText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
