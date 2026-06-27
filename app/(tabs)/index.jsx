import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  useColorScheme
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions } from '../../hooks/useTransactions';
import { colors, darkColors } from '../../constants/colors';
import BalanceCard from '../../components/BalanceCard';
import QuickSendContact from '../../components/QuickSendContact';
import TransactionItem from '../../components/TransactionItem';
import { presentMockPaymentSheet } from '../../services/stripe';

export default function HomeScreen() {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;

  const router = useRouter();
  const { profile, isLoading: isAuthLoading } = useAuth();
  const {
    transactions,
    contacts,
    isLoading: isTxLoading,
    fetchTransactions,
    fetchContacts,
    topUp
  } = useTransactions();

  const [refreshing, setRefreshing] = useState(false);

  // Modals visibility states
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);

  // Top up input states
  const [topUpAmount, setTopUpAmount] = useState('');
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);

  // Load transactions and contacts on mount
  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchTransactions(),
      fetchContacts()
    ]);
    setRefreshing(false);
  };

  // Get greeting phrase based on local time
  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'Good morning';
    if (hrs < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Handle mock Stripe top-up execution
  const handleTopUpSubmit = async () => {
    const amountNum = parseFloat(topUpAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to load.');
      return;
    }

    setIsProcessingTopUp(true);
    try {
      // Simulate Stripe loading/test cards sequence
      const stripeRes = await presentMockPaymentSheet(amountNum);
      if (stripeRes.success) {
        // Execute atomic Firestore balance addition and tx document log
        await topUp(amountNum);
        setTopUpModalVisible(false);
        setTopUpAmount('');
        Alert.alert('Top Up Successful', `PKR ${amountNum.toLocaleString('en-US', { minimumFractionDigits: 2 })} has been added to your balance.`);
      } else {
        Alert.alert('Payment Cancelled', stripeRes.error || 'Payment sheet was closed.');
      }
    } catch (err) {
      Alert.alert('Payment Error', err.message || 'An error occurred during Stripe transaction.');
    } finally {
      setIsProcessingTopUp(false);
    }
  };

  const recentTransactions = transactions.slice(0, 5);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshData}
            tintColor={theme.primary}
          />
        }
      >
        {/* Header Greeting */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greetingText, { color: theme.textSecondary }]}>
              {getGreeting()},
            </Text>
            <Text style={[styles.nameText, { color: theme.textPrimary }]}>
              {profile?.name || 'ZenPay User'} 👋
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.bellButton, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Ionicons name="notifications-outline" size={22} color={theme.textPrimary} />
            <View style={[styles.dotBadge, { backgroundColor: theme.danger }]} />
          </TouchableOpacity>
        </View>

        {/* Balance Card Component */}
        <BalanceCard
          profile={profile}
          isLoading={isAuthLoading}
          onSend={() => router.push('/(tabs)/transfer')}
          onReceive={() => setReceiveModalVisible(true)}
          onTopUp={() => setTopUpModalVisible(true)}
        />

        {/* Quick Action Buttons Row of 4 */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.gridItem} onPress={() => router.push('/(tabs)/transfer')}>
            <View style={[styles.gridIconBg, { backgroundColor: theme.backgroundCard, borderColor: theme.border, width: 72, height: 72, borderRadius: 16 }]}>
              <Ionicons name="send" size={24} color={theme.primary} />
            </View>
            <Text style={[styles.gridLabel, { color: theme.textSecondary, fontSize: 11 }]}>Send</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} onPress={() => setReceiveModalVisible(true)}>
            <View style={[styles.gridIconBg, { backgroundColor: theme.backgroundCard, borderColor: theme.border, width: 72, height: 72, borderRadius: 16 }]}>
              <Ionicons name="qr-code" size={24} color={theme.primary} />
            </View>
            <Text style={[styles.gridLabel, { color: theme.textSecondary, fontSize: 11 }]}>Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} onPress={() => setTopUpModalVisible(true)}>
            <View style={[styles.gridIconBg, { backgroundColor: theme.backgroundCard, borderColor: theme.border, width: 72, height: 72, borderRadius: 16 }]}>
              <Ionicons name="card" size={24} color={theme.primary} />
            </View>
            <Text style={[styles.gridLabel, { color: theme.textSecondary, fontSize: 11 }]}>Top Up</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} onPress={() => router.push('/(tabs)/analytics')}>
            <View style={[styles.gridIconBg, { backgroundColor: theme.backgroundCard, borderColor: theme.border, width: 72, height: 72, borderRadius: 16 }]}>
              <Ionicons name="stats-chart" size={24} color={theme.primary} />
            </View>
            <Text style={[styles.gridLabel, { color: theme.textSecondary, fontSize: 11 }]}>Analytics</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Send Contacts List */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary, fontSize: 13, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' }]}>Quick Send</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.contactsScroll}
        >
          {/* Add Contact Button */}
          <QuickSendContact
            isAddButton
            onPress={() => router.push('/(tabs)/transfer')}
          />
          {contacts.map((contact) => (
            <QuickSendContact
              key={contact.uid}
              name={contact.name}
              onPress={() => router.push({ pathname: '/(tabs)/transfer', params: { selectedUid: contact.uid } })}
            />
          ))}
          {contacts.length === 0 && (
            <View style={styles.emptyContactsWrapper}>
              <Text style={[styles.emptyContactsText, { color: theme.textSecondary }]}>
                No saved contacts. Send money to add them.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Recent Transactions List */}
        <View style={[styles.sectionHeader, { marginTop: 12 }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary, fontSize: 13, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' }]}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
            <Text style={[styles.viewAllText, { color: theme.primary, fontSize: 14, fontWeight: 700 }]}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.txListContainer}>
          {recentTransactions.map((tx) => (
            <TransactionItem
              key={tx.id}
              item={tx}
              currentUserId={profile?.uid}
            />
          ))}
          {recentTransactions.length === 0 && !isTxLoading && (
            <View style={[styles.emptyTxCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border, borderRadius: 20 }]}>
              <Ionicons name="receipt-outline" size={40} color={theme.textSecondary} style={{ marginBottom: 8 }} />
              <Text style={[styles.emptyTxTitle, { color: theme.textPrimary, fontSize: 16, fontWeight: 700 }]}>No transactions yet</Text>
              <Text style={[styles.emptyTxSubtitle, { color: theme.textSecondary, fontSize: 12 }]}>
                Your transaction history will show up here
              </Text>
            </View>
          )}
          {isTxLoading && recentTransactions.length === 0 && (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 20 }} />
          )}
        </View>
      </ScrollView>

      {/* QR Code Receive Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={receiveModalVisible}
        onRequestClose={() => setReceiveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.qrModalContent, { backgroundColor: theme.backgroundCard, borderRadius: 24, padding: 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary, fontSize: 18, fontWeight: 700 }]}>Receive Money</Text>
              <TouchableOpacity onPress={() => setReceiveModalVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.qrCodeWrapper}>
              {/* Simulated QR Code representation */}
              <View style={[styles.qrMockSquare, { borderColor: theme.primary, borderWidth: 2, borderRadius: 20, padding: 16, backgroundColor: theme.backgroundCard }]}>
                <Ionicons name="qr-code-outline" size={180} color={theme.primary} />
              </View>
              <Text style={[styles.qrUserText, { color: theme.textPrimary, fontSize: 18, fontWeight: 700 }]}>{profile?.name}</Text>
              <Text style={[styles.qrPhoneText, { color: theme.textSecondary, fontSize: 14 }]}>{profile?.phone}</Text>
            </View>

            <Text style={[styles.qrInstructions, { color: theme.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 12 }]}>
              Show this QR code to another ZenPay user to receive funds directly into your account.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Stripe Top Up Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={topUpModalVisible}
        onRequestClose={() => { if (!isProcessingTopUp) setTopUpModalVisible(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.topUpModalContent, { backgroundColor: theme.backgroundCard, borderRadius: 24, padding: 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary, fontSize: 18, fontWeight: 700 }]}>Top Up Balance</Text>
              <TouchableOpacity
                onPress={() => setTopUpModalVisible(false)}
                style={styles.closeButton}
                disabled={isProcessingTopUp}
              >
                <Ionicons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textPrimary, fontSize: 14, fontWeight: 600, marginTop: 12 }]}>
              Enter Amount (PKR)
            </Text>
            <View style={[styles.amountInputWrapper, { borderColor: theme.border, borderWidth: 1.5, borderRadius: 14, height: 56, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }]}>
              <Text style={[styles.currencyPrefix, { color: theme.textPrimary, fontSize: 16, fontWeight: 700, marginRight: 10 }]}>PKR</Text>
              <TextInput
                style={[styles.amountInput, { flex: 1, fontSize: 16, fontWeight: 600, height: '100%', color: theme.textPrimary }]}
                placeholder="1,000"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                value={topUpAmount}
                onChangeText={setTopUpAmount}
                editable={!isProcessingTopUp}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.topUpSubmitBtn, { height: 56, borderRadius: 14, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' }]}
              onPress={handleTopUpSubmit}
              disabled={isProcessingTopUp || !topUpAmount}
            >
              {isProcessingTopUp ? (
                <ActivityIndicator color={theme.background} size="small" />
              ) : (
                <Text style={[styles.topUpSubmitText, { color: theme.background, fontSize: 16, fontWeight: 700 }]}>Proceed with Stripe</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greetingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  nameText: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  bellButton: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dotBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    right: 12,
    top: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  gridItem: {
    alignItems: 'center',
    flex: 1,
  },
  gridIconBg: {
    width: 72,
    height: 72,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: 700,
  },
  contactsScroll: {
    paddingVertical: 4,
    alignItems: 'center',
    flexDirection: 'row',
  },
  emptyContactsWrapper: {
    height: 54,
    justifyContent: 'center',
    paddingLeft: 4,
  },
  emptyContactsText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  txListContainer: {
    marginTop: 6,
  },
  emptyTxCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  emptyTxTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyTxSubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  qrModalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  topUpModalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  closeButton: {
    padding: 4,
  },
  qrCodeWrapper: {
    alignItems: 'center',
    marginVertical: 20,
  },
  qrMockSquare: {
    borderWidth: 2,
    borderRadius: 20,
    padding: 16,
    backgroundColor: colors.backgroundCard,
  },
  qrUserText: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  qrPhoneText: {
    fontSize: 14,
  },
  qrInstructions: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 8,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 10,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    height: '100%',
  },
  topUpSubmitBtn: {
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topUpSubmitText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
});