import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert, 
  Modal,
  Dimensions,
  useColorScheme,
  Animated
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions } from '../../hooks/useTransactions';
import { searchUsers } from '../../services/transactions';
import { colors, darkColors } from '../../constants/colors';
import { formatPKR } from '../../utils/format';

const { width } = Dimensions.get('window');

export default function TransferScreen() {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;
  const router = useRouter();
  const params = useLocalSearchParams();

  const { profile } = useAuth();
  const { sendMoney } = useTransactions();

  // Search/recipient state
  const [searchQuery, setSearchQuery] = useState('');
  const [usersList, setUsersList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Keypad & transfer states
  const [amountStr, setAmountStr] = useState('0');
  const [note, setNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Success animations Animated Values
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const successTextOpacity = useRef(new Animated.Value(0)).current;

  // Check if a recipient was navigated to from another screen (like Quick Send)
  useEffect(() => {
    if (params.selectedUid) {
      loadDirectRecipient(params.selectedUid);
    }
  }, [params.selectedUid]);

  // Search users based on query
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length >= 1) {
        performSearch(searchQuery);
      } else {
        setUsersList([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const loadDirectRecipient = async (uid) => {
    setIsSearching(true);
    try {
      const results = await searchUsers('');
      const recipient = results.find(u => u.uid === uid);
      if (recipient) {
        setSelectedUser(recipient);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const performSearch = async (queryStr) => {
    setIsSearching(true);
    try {
      const results = await searchUsers(queryStr);
      setUsersList(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  // Keyboard press handler
  const handleKeyPress = (val) => {
    if (amountStr === '0' && val !== '.') {
      if (val === 'delete') return;
      setAmountStr(val);
      return;
    }

    if (val === 'delete') {
      const nextVal = amountStr.slice(0, -1);
      setAmountStr(nextVal.length === 0 ? '0' : nextVal);
      return;
    }

    if (val === '.') {
      if (amountStr.includes('.')) return;
      setAmountStr(prev => prev + '.');
      return;
    }

    // Cap decimals at 2
    if (amountStr.includes('.')) {
      const [_, decimals] = amountStr.split('.');
      if (decimals && decimals.length >= 2) return;
    }

    setAmountStr(prev => prev + val);
  };

  // Run transaction success micro-animations
  const triggerSuccessAnimations = () => {
    Animated.sequence([
      Animated.spring(checkmarkScale, {
        toValue: 1,
        tension: 90,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(successTextOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();
  };

  // Local FCM notifications helper
  const sendMockLocalNotification = async (recipientName, amount) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Money Sent successfully 💸",
          body: `You successfully transferred PKR ${amount.toLocaleString()} to ${recipientName}.`,
          sound: true,
        },
        trigger: null, // immediate
      });
    } catch (err) {
      console.warn("Could not trigger notification: ", err);
    }
  };

  const handleSendMoney = async () => {
    const amountVal = parseFloat(amountStr);
    if (isNaN(amountVal) || amountVal <= 0) {
      Alert.alert('Invalid Amount', 'Please enter an amount to transfer.');
      return;
    }

    if (amountVal > profile.balance) {
      Alert.alert(
        'Insufficient Funds', 
        `You need PKR ${(amountVal - profile.balance).toLocaleString()} more to execute this transfer.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Top Up Now', onPress: () => router.push('/(tabs)') }
        ]
      );
      return;
    }

    setIsSending(true);
    try {
      // Execute firestore atomic transfer and contacts creation
      await sendMoney(selectedUser.uid, selectedUser.name, amountVal, note.trim());
      
      // Trigger local mock notification
      await sendMockLocalNotification(selectedUser.name, amountVal);

      // Open Success screen
      setShowSuccess(true);
      triggerSuccessAnimations();

      // Automatically close and return to home after 2 seconds
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedUser(null);
        setAmountStr('0');
        setNote('');
        checkmarkScale.setValue(0);
        successTextOpacity.setValue(0);
        router.replace('/(tabs)');
      }, 2500);

    } catch (err) {
      Alert.alert('Transfer Failed', err.message || 'An error occurred during transfer.');
    } finally {
      setIsSending(false);
    }
  };

  // Helper to fetch initials
  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'ZP';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* 1. Contact Selection Mode */}
      {!selectedUser ? (
        <View style={{ flex: 1 }}>
          <View style={styles.searchHeader}>
            <Text style={[styles.title, { color: theme.text }]}>Send Money</Text>
            <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="search-outline" size={20} color={theme.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search by name or phone..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {isSearching ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 24 }} />
          ) : (
            <ScrollView 
              style={styles.resultsList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {usersList.map((user) => (
                <TouchableOpacity 
                  key={user.uid}
                  style={[styles.userRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => setSelectedUser(user)}
                >
                  <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
                    <Text style={styles.avatarText}>{getInitials(user.name)}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: theme.text }]}>{user.name}</Text>
                    <Text style={[styles.userPhone, { color: theme.textSecondary }]}>{user.phone}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              ))}

              {searchQuery.trim().length > 0 && usersList.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={40} color={theme.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.text }]}>No contacts found</Text>
                  <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>Try entering another name or phone number</Text>
                </View>
              )}

              {searchQuery.trim().length === 0 && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={40} color={theme.primaryLight} />
                  <Text style={[styles.emptyText, { color: theme.text }]}>Who are we sending to?</Text>
                  <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>Type their name or phone number above to select</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      ) : (
        /* 2. Keypad & Note Payment Sheet Mode */
        <View style={styles.paymentContainer}>
          {/* Back button */}
          <View style={styles.paymentHeader}>
            <TouchableOpacity 
              onPress={() => setSelectedUser(null)} 
              style={[styles.backButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              disabled={isSending}
            >
              <Ionicons name="arrow-back" size={20} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.paymentHeaderTitle, { color: theme.text }]}>Enter Amount</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* User profile row */}
          <View style={styles.recipientHeaderCard}>
            <View style={[styles.avatarLarge, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarLargeText}>{getInitials(selectedUser.name)}</Text>
            </View>
            <Text style={[styles.recipientName, { color: theme.text }]}>{selectedUser.name}</Text>
            <Text style={[styles.recipientPhone, { color: theme.textSecondary }]}>{selectedUser.phone}</Text>
            <Text style={[styles.availableBalance, { color: theme.textSecondary }]}>
              Available: {formatPKR(profile?.balance)}
            </Text>
          </View>

          {/* Big Amount Text Screen */}
          <View style={styles.amountShowcase}>
            <Text style={[styles.amountSymbol, { color: theme.text }]}>PKR</Text>
            <Text style={[styles.amountDisplayVal, { color: theme.text }]} numberOfLines={1}>
              {parseFloat(amountStr).toLocaleString('en-US', {
                minimumFractionDigits: amountStr.includes('.') ? amountStr.split('.')[1].length : 0
              })}
            </Text>
          </View>

          {/* Optional Inline Note input */}
          <View style={[styles.noteWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TextInput
              style={[styles.noteInput, { color: theme.text }]}
              placeholder="Add a brief note..."
              placeholderTextColor={theme.textSecondary}
              value={note}
              onChangeText={setNote}
              maxLength={40}
              editable={!isSending}
            />
          </View>

          {/* Custom Grid Keypad */}
          <View style={styles.keypadWrapper}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['.', '0', 'delete']
            ].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.keypadRow}>
                {row.map((btn) => (
                  <TouchableOpacity
                    key={btn}
                    style={styles.keypadKey}
                    onPress={() => handleKeyPress(btn)}
                    disabled={isSending}
                  >
                    {btn === 'delete' ? (
                      <Ionicons name="backspace" size={24} color={theme.text} />
                    ) : (
                      <Text style={[styles.keypadKeyText, { color: theme.text }]}>{btn}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          {/* Send money full-width button */}
          <TouchableOpacity
            style={[
              styles.sendBtn, 
              { backgroundColor: theme.primary },
              isSending && { opacity: 0.8 }
            ]}
            onPress={handleSendMoney}
            disabled={isSending || parseFloat(amountStr) <= 0}
          >
            {isSending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.sendBtnText}>Send Money</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* 3. Success Modal overlay using Animated API */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSuccess}
      >
        <View style={[styles.successOverlay, { backgroundColor: theme.background }]}>
          <Animated.View style={[
            styles.successCircle, 
            { 
              backgroundColor: theme.success,
              transform: [{ scale: checkmarkScale }]
            }
          ]}>
            <Ionicons name="checkmark" size={60} color="#FFFFFF" />
          </Animated.View>
          
          <Animated.View style={[
            styles.successTextContainer, 
            { opacity: successTextOpacity }
          ]}>
            <Text style={[styles.successTitle, { color: theme.text }]}>Transfer Successful!</Text>
            <Text style={[styles.successSub, { color: theme.textSecondary }]}>
              Sent to {selectedUser?.name}
            </Text>
            <Text style={[styles.successAmount, { color: theme.primary }]}>
              {formatPKR(parseFloat(amountStr))}
            </Text>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  resultsList: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.01,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 64,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  paymentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  recipientHeaderCard: {
    alignItems: 'center',
    marginTop: 12,
  },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  avatarLargeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  recipientPhone: {
    fontSize: 12,
    marginBottom: 4,
  },
  availableBalance: {
    fontSize: 11,
    fontWeight: '600',
  },
  amountShowcase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
    paddingHorizontal: 20,
  },
  amountSymbol: {
    fontSize: 20,
    fontWeight: '700',
    marginRight: 6,
  },
  amountDisplayVal: {
    fontSize: 48,
    fontWeight: '800',
  },
  noteWrapper: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
    justifyContent: 'center',
    marginBottom: 12,
  },
  noteInput: {
    fontSize: 14,
  },
  keypadWrapper: {
    flex: 1,
    justifyContent: 'center',
    maxHeight: 280,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 8,
  },
  keypadKey: {
    width: width / 4,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 26,
  },
  keypadKeyText: {
    fontSize: 24,
    fontWeight: '600',
    marginRight: 0,
  },
  sendBtn: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7B5EA7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  successTextContainer: {
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  successSub: {
    fontSize: 15,
    marginBottom: 16,
  },
  successAmount: {
    fontSize: 32,
    fontWeight: '800',
  },
});
