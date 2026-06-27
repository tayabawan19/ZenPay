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
  Animated,
  Platform,
  FlatList
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
  const { contacts, fetchContacts, sendMoney } = useTransactions();

  // Search/recipient state
  const [searchQuery, setSearchQuery] = useState('');
  const [usersList, setUsersList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Keypad & transfer states
  const [amountStr, setAmountStr] = useState('0');
  const [note, setNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [confirmSheetVisible, setConfirmSheetVisible] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Success animations Animated Values
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const successTextOpacity = useRef(new Animated.Value(0)).current;

  // Load saved contacts on mount
  useEffect(() => {
    fetchContacts();
  }, []);

  // Check if a recipient was navigated to from another screen (like Quick Send)
  useEffect(() => {
    if (params.selectedUid) {
      loadDirectRecipient(params.selectedUid);
    }
  }, [params.selectedUid]);

  // Search users based on query (debounced 500ms)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length >= 1) {
        performSearch(searchQuery);
      } else {
        setUsersList([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const loadDirectRecipient = async (uid) => {
    setIsSearching(true);
    try {
      // Pass empty search to get standard user pool
      const results = await searchUsers('', profile?.uid);
      const recipient = results.find(u => u.uid === uid);
      if (recipient) {
        setSelectedUser(recipient);
      } else {
        // Fallback: search in saved contacts
        const savedRec = contacts.find(c => c.uid === uid);
        if (savedRec) {
          setSelectedUser(savedRec);
        }
      }
    } catch (err) {
      console.error("Direct recipient load error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const performSearch = async (queryStr) => {
    setIsSearching(true);
    try {
      const results = await searchUsers(queryStr, profile?.uid);
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

  // Local push notifications helper
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

    if (amountVal > (profile?.balance || 0)) {
      Alert.alert('Insufficient Balance', 'You do not have enough funds to complete this transfer.');
      return;
    }

    setIsSending(true);
    try {
      // Execute backend atomic P2P transfer and log in Firestore
      await sendMoney(selectedUser.uid, selectedUser.name, amountVal, note.trim());
      
      // Trigger local mock notification
      await sendMockLocalNotification(selectedUser.name, amountVal);

      // Open Success screen
      setShowSuccess(true);
      triggerSuccessAnimations();

      // Automatically close and return to home after 2.5 seconds
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

  const renderUserItem = ({ item }) => (
    <View style={[styles.userRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
        <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{item.email}</Text>
      </View>
      <TouchableOpacity
        style={[styles.sendBtnSmall, { backgroundColor: theme.primary }]}
        onPress={() => setSelectedUser(item)}
      >
        <Text style={[styles.sendBtnSmallText, { color: theme.background }]}>Send</Text>
      </TouchableOpacity>
    </View>
  );

  const amountNum = parseFloat(amountStr);
  const isInsufficient = amountNum > (profile?.balance || 0);

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
            <FlatList
              style={styles.resultsList}
              data={searchQuery.trim().length > 0 ? usersList : contacts}
              keyExtractor={(item) => item.uid}
              renderItem={renderUserItem}
              ListHeaderComponent={() => {
                if (searchQuery.trim().length > 0) return null;
                return (
                  <Text style={[styles.contactsSectionTitle, { color: theme.textSecondary }]}>
                    Saved Contacts
                  </Text>
                );
              }}
              ListEmptyComponent={() => {
                if (searchQuery.trim().length > 0) {
                  return (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="search-outline" size={40} color={theme.textSecondary} />
                      <Text style={[styles.emptyText, { color: theme.text }]}>
                        No users found.
                      </Text>
                      <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                        Ask them to join ZenPay!
                      </Text>
                    </View>
                  );
                } else {
                  return (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="people-outline" size={40} color={theme.primaryLight} />
                      <Text style={[styles.emptyText, { color: theme.text }]}>
                        No recent contacts.
                      </Text>
                      <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                        Search to send money.
                      </Text>
                    </View>
                  );
                }
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
            />
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

          {/* User profile card */}
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
            <Text style={[styles.amountSymbol, { color: theme.primary, fontWeight: '700' }]}>PKR</Text>
            <Text style={[styles.amountDisplayVal, { color: theme.primary }]} numberOfLines={1}>
              {parseFloat(amountStr).toLocaleString('en-US', {
                minimumFractionDigits: amountStr.includes('.') ? amountStr.split('.')[1].length : 0
              })}
            </Text>
          </View>

          {/* Optional Note input */}
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

          {/* Insufficient Balance warning display */}
          {isInsufficient && (
            <Text style={styles.insufficientText}>Insufficient balance</Text>
          )}

          {/* Send money full-width button */}
          <TouchableOpacity
            style={[
              styles.sendBtn, 
              { backgroundColor: theme.primary },
              (isSending || amountNum <= 0 || isInsufficient) && { opacity: 0.5 }
            ]}
            onPress={() => setConfirmSheetVisible(true)}
            disabled={isSending || amountNum <= 0 || isInsufficient}
          >
            {isSending ? (
              <ActivityIndicator color={theme.background} size="small" />
            ) : (
              <Text style={[styles.sendBtnText, { color: theme.background }]}>Send Money</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Confirmation Bottom Sheet */}
      <Modal
        visible={confirmSheetVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setConfirmSheetVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <TouchableOpacity 
            style={styles.confirmDismiss} 
            activeOpacity={1} 
            onPress={() => setConfirmSheetVisible(false)} 
          />
          <View style={[styles.confirmSheetContent, { backgroundColor: theme.backgroundCard, borderTopColor: theme.border }]}>
            <View style={styles.confirmHeader}>
              <Text style={[styles.confirmTitle, { color: theme.textPrimary }]}>Confirm Transfer</Text>
            </View>

            <Text style={[styles.confirmMessage, { color: theme.textSecondary }]}>
              Are you sure you want to send:
            </Text>
            
            <Text style={[styles.confirmAmountText, { color: theme.primary }]}>
              {formatPKR(amountNum)}
            </Text>

            <Text style={[styles.confirmToText, { color: theme.textPrimary }]}>
              to <Text style={{ fontWeight: '800' }}>{selectedUser?.name}</Text>?
            </Text>

            {note.trim() ? (
              <Text style={[styles.confirmNoteText, { color: theme.textSecondary }]}>
                Note: "{note}"
              </Text>
            ) : null}

            <View style={styles.confirmActionsRow}>
              <TouchableOpacity
                style={[styles.confirmCancelBtn, { borderColor: theme.border }]}
                onPress={() => setConfirmSheetVisible(false)}
              >
                <Text style={[styles.confirmCancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmSubmitBtn, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setConfirmSheetVisible(false);
                  handleSendMoney();
                }}
              >
                <Text style={[styles.confirmSubmitText, { color: theme.background }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              PKR {amountNum.toLocaleString()} sent to {selectedUser?.name} successfully!
            </Text>
            <Text style={[styles.successAmount, { color: theme.primary }]}>
              {formatPKR(amountNum)}
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
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  paymentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  recipientHeaderCard: {
    alignItems: 'center',
    marginTop: 16,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarLargeText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  recipientName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  recipientPhone: {
    fontSize: 13,
    marginBottom: 8,
  },
  availableBalance: {
    fontSize: 12,
    fontWeight: '600',
  },
  amountShowcase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    paddingHorizontal: 10,
  },
  amountSymbol: {
    fontSize: 20,
    marginRight: 8,
  },
  amountDisplayVal: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
  },
  noteWrapper: {
    borderWidth: 1.5,
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginBottom: 12,
  },
  noteInput: {
    fontSize: 14,
    fontWeight: '600',
  },
  keypadWrapper: {
    marginBottom: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  keypadKey: {
    flex: 1,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  keypadKeyText: {
    fontSize: 24,
    fontWeight: '700',
  },
  sendBtn: {
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  sendBtnText: {
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
    shadowRadius: 16,
    elevation: 8,
  },
  successTextContainer: {
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 10,
  },
  successSub: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  successAmount: {
    fontSize: 28,
    fontWeight: '800',
  },
  // New Styles
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  confirmDismiss: {
    flex: 1,
  },
  confirmSheetContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
  },
  confirmHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  confirmMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  confirmAmountText: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
  },
  confirmToText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmNoteText: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 24,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmCancelBtn: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  confirmCancelText: {
    fontSize: 16,
    fontWeight: '700',
  },
  confirmSubmitBtn: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  confirmSubmitText: {
    fontSize: 16,
    fontWeight: '700',
  },
  contactsSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 14,
    marginTop: 10,
  },
  insufficientText: {
    color: '#FF4A4A',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '700',
    fontSize: 13,
  },
  sendBtnSmall: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnSmallText: {
    fontSize: 13,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 12,
    marginTop: 2,
  }
});
