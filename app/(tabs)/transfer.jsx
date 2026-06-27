import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  Modal,
  Dimensions,
  Animated,
  Platform,
  FlatList,
  Easing,
  Pressable
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions } from '../../hooks/useTransactions';
import { fetchAllUsers, searchUsers } from '../../services/transactions';
import { colors } from '../../constants/colors';
import { formatPKR } from '../../utils/format';
import GlobalBackground from '../../components/GlobalBackground';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Animated SVG components for success checkmark draw
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Keypad single key component
const KeypadKey = ({ val, onPress }) => {
  const scale = useRef(new Animated.Value(1.0)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.93,
      useNativeDriver: true,
      friction: 3,
      tension: 180,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1.0,
      useNativeDriver: true,
      friction: 5,
      tension: 150,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], flex: 1, marginHorizontal: 4, marginBottom: 8 }}>
      <TouchableOpacity
        onPress={() => onPress(val)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={styles.keypadKey}
      >
        {val === 'delete' ? (
          <Ionicons name="backspace-outline" size={24} color="#FFFFFF" />
        ) : (
          <Text style={styles.keypadKeyText}>{val}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function TransferScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const { profile } = useAuth();
  const { sendMoney } = useTransactions();

  // Search/recipient state
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // Keypad & transfer states
  const [amountStr, setAmountStr] = useState('0');
  const [note, setNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [confirmSheetVisible, setConfirmSheetVisible] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Animated values for transitions
  const slideAnim = useRef(new Animated.Value(screenWidth)).current; // For slide-in Amount screen
  const confirmSheetY = useRef(new Animated.Value(400)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Success animations Animated Values
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const successTextOpacity = useRef(new Animated.Value(0)).current;
  const strokeOffsetCircle = useRef(new Animated.Value(252)).current;
  const strokeOffsetCheck = useRef(new Animated.Value(60)).current;

  // Load all users on mount
  useEffect(() => {
    const loadAllUsers = async () => {
      if (!profile?.uid) return;
      setIsLoadingUsers(true);
      try {
        const result = await fetchAllUsers(profile.uid);
        setUsers(result);
      } catch (err) {
        console.error("Load users error:", err);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    loadAllUsers();
  }, [profile?.uid]);

  // Check if a recipient was navigated to from another screen (like Quick Send)
  useEffect(() => {
    if (params.selectedUid && profile?.uid) {
      loadDirectRecipient(params.selectedUid);
    }
  }, [params.selectedUid, profile?.uid]);

  // Search users based on query (debounced 400ms)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearch(searchQuery);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, profile?.uid]);

  // Handle slide-in animation when selecting a contact
  useEffect(() => {
    if (selectedUser) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: false,
      }).start();
    } else {
      slideAnim.setValue(screenWidth);
    }
  }, [selectedUser]);

  const loadDirectRecipient = async (uid) => {
    if (!profile?.uid) return;
    setIsSearching(true);
    try {
      const results = await fetchAllUsers(profile.uid);
      const recipient = results.find(u => u.uid === uid);
      if (recipient) {
        setSelectedUser(recipient);
      }
    } catch (err) {
      console.error("Direct recipient load error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (queryStr) => {
    if (!profile?.uid) return;
    setIsSearching(true);
    try {
      if (!queryStr || queryStr.trim() === '') {
        const result = await fetchAllUsers(profile.uid);
        setUsers(result);
      } else {
        const result = await searchUsers(queryStr, profile.uid);
        setUsers(result);
      }
    } catch (err) {
      console.error("Search error:", err);
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

    if (amountStr.includes('.')) {
      const [_, decimals] = amountStr.split('.');
      if (decimals && decimals.length >= 2) return;
    }

    setAmountStr(prev => prev + val);
  };

  // SVG Drawing and Confetti micro-animations
  const triggerSuccessAnimations = () => {
    Animated.parallel([
      Animated.spring(checkmarkScale, {
        toValue: 1.0,
        tension: 60,
        friction: 8,
        useNativeDriver: false,
      }),
      Animated.timing(strokeOffsetCircle, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(strokeOffsetCheck, {
        toValue: 0,
        duration: 500,
        delay: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(successTextOpacity, {
        toValue: 1,
        duration: 600,
        delay: 500,
        useNativeDriver: false,
      })
    ]).start();

    // Fire Confetti squares
    confettiItems.forEach(c => {
      c.anim.setValue(0);
      Animated.timing(c.anim, {
        toValue: 1,
        duration: c.duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    });
  };

  const sendMockLocalNotification = async (recipientName, amount) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Money Sent successfully 💸",
          body: `You successfully transferred PKR ${amount.toLocaleString()} to ${recipientName}.`,
          sound: true,
        },
        trigger: null,
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
      const res = await sendMoney({
        senderId: profile.uid,
        receiverId: selectedUser.uid,
        senderName: profile.name,
        receiverName: selectedUser.name,
        amount: Number(amountVal),
        note: note.trim(),
      });

      if (res.success) {
        await sendMockLocalNotification(selectedUser.name, amountVal);

        setShowSuccess(true);
        triggerSuccessAnimations();

        setTimeout(() => {
          setShowSuccess(false);
          setSelectedUser(null);
          setAmountStr('0');
          setNote('');
          checkmarkScale.setValue(0);
          successTextOpacity.setValue(0);
          strokeOffsetCircle.setValue(252);
          strokeOffsetCheck.setValue(60);
          router.replace('/(tabs)');
        }, 2000);
      } else {
        Alert.alert('Transfer Failed', res.message || 'An error occurred during transfer.');
      }

    } catch (err) {
      Alert.alert('Transfer Failed', err.message || 'An error occurred during transfer.');
    } finally {
      setIsSending(false);
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'ZP';
  };

  // Confetti generator: 20 colored squares falling down
  const confettiItems = useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => {
      const size = Math.random() * 6 + 6;
      const colorsList = ['#7C6FFF', '#FF6BBA', '#00F5A0', '#00D4FF', '#FFB020'];
      const color = colorsList[Math.floor(Math.random() * colorsList.length)];
      const left = Math.random() * screenWidth;
      const anim = new Animated.Value(0);
      const duration = Math.random() * 1500 + 1000;
      const rotateInit = Math.random() * 360;
      return { id: i, size, color, left, anim, duration, rotateInit };
    });
  }, []);

  const renderSkeletonRow = (index) => (
    <View key={`skeleton-${index}`} style={styles.userRow}>
      <View style={styles.topHighlight} />
      <View style={[styles.avatar, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]} />
      <View style={[styles.userInfo, { gap: 6 }]}>
        <View style={{ height: 14, width: '60%', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 4 }} />
        <View style={{ height: 11, width: '45%', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 4 }} />
        <View style={{ height: 10, width: '35%', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 4 }} />
      </View>
      <View style={{ width: 64, height: 32, borderRadius: 10, backgroundColor: 'rgba(255, 255, 255, 0.05)' }} />
    </View>
  );

  const renderUserItem = ({ item }) => {
    const initial = item.name ? item.name.charAt(0).toUpperCase() : '';
    return (
      <View style={styles.userRow}>
        {/* Top glass highlight */}
        <View style={styles.topHighlight} />

        <View style={[styles.avatar, { backgroundColor: 'rgba(124, 111, 255, 0.15)' }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          {item.phone ? (
            <Text style={styles.userPhone}>{item.phone}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.sendBtnSmall}
          onPress={() => setSelectedUser(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.sendBtnSmallText}>Send</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const amountNum = parseFloat(amountStr);
  const isInsufficient = amountNum > (profile?.balance || 0);

  // Confirm sheet slide animation
  const showConfirmSheet = () => {
    setConfirmSheetVisible(true);
    Animated.spring(confirmSheetY, {
      toValue: 0,
      tension: 80,
      friction: 12,
      useNativeDriver: true
    }).start();
  };

  const closeConfirmSheet = () => {
    Animated.timing(confirmSheetY, {
      toValue: 400,
      duration: 200,
      useNativeDriver: true
    }).start(() => setConfirmSheetVisible(false));
  };

  return (
    <GlobalBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* 1. Contact Selection Mode */}
        {!selectedUser ? (
          <View style={{ flex: 1 }}>
            <View style={styles.searchHeader}>
              <Text style={styles.title}>Send Money</Text>
              
              {/* Premium Search bar */}
              <View style={[
                styles.searchBar,
                searchFocused && styles.searchBarFocused
              ]}>
                <Ionicons name="search-outline" size={20} color="#7C6FFF" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name, email or phone"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  autoFocus
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                    <Ionicons name="close-circle" size={18} color="rgba(255, 255, 255, 0.4)" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {isLoadingUsers ? (
              <View style={styles.resultsList}>
                {renderSkeletonRow(1)}
                {renderSkeletonRow(2)}
                {renderSkeletonRow(3)}
              </View>
            ) : isSearching ? (
              <ActivityIndicator size="small" color="#7C6FFF" style={{ marginTop: 24 }} />
            ) : (
              <FlatList
                style={styles.resultsList}
                data={users}
                keyExtractor={(item) => item.uid}
                renderItem={renderUserItem}
                ListEmptyComponent={() => (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="people-outline" size={40} color="rgba(255, 255, 255, 0.3)" />
                    <Text style={styles.emptyText}>No other users found</Text>
                    <Text style={styles.emptySubtext}>Ask friends to join ZenPay!</Text>
                  </View>
                )}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 110 }}
              />
            )}
          </View>
        ) : (
          /* 2. Slide-In Keypad Amount Mode */
          <Animated.View style={[
            styles.paymentContainer,
            { transform: [{ translateX: slideAnim }] }
          ]}>
            {/* Header */}
            <View style={styles.paymentHeader}>
              <TouchableOpacity 
                onPress={() => setSelectedUser(null)} 
                style={styles.backButton}
                disabled={isSending}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.paymentHeaderTitle}>Enter Amount</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Recipient card with change contact button */}
            <View style={styles.recipientHeaderCard}>
              {/* Glass highlight */}
              <View style={styles.topHighlight} />

              <View style={styles.avatarLarge}>
                <Text style={styles.avatarLargeText}>{getInitials(selectedUser.name)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={styles.sendingToLabel}>SENDING TO</Text>
                <Text style={styles.recipientName}>{selectedUser.name}</Text>
                <Text style={styles.recipientPhone}>{selectedUser.email || selectedUser.phone}</Text>
              </View>

              <TouchableOpacity 
                onPress={() => setSelectedUser(null)}
                style={styles.btnChangeContact}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.4)" />
              </TouchableOpacity>
            </View>

            {/* Big Showcase display */}
            <View style={styles.amountShowcase}>
              <Text style={styles.amountSymbol}>PKR</Text>
              <Text style={styles.amountDisplayVal} numberOfLines={1}>
                {parseFloat(amountStr).toLocaleString('en-US', {
                  minimumFractionDigits: amountStr.includes('.') ? amountStr.split('.')[1].length : 0
                })}
              </Text>
            </View>

            {/* Available Balance indicator */}
            <View style={styles.balanceIndicatorRow}>
              {isInsufficient ? (
                <Text style={styles.insufficientText}>Insufficient balance ⚠️</Text>
              ) : (
                <Text style={styles.availableBalance}>
                  Available: {formatPKR(profile?.balance)}
                </Text>
              )}
            </View>

            {/* Note field */}
            <View style={styles.noteWrapper}>
              <TextInput
                style={styles.noteInput}
                placeholder="Add a note (optional)"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                value={note}
                onChangeText={setNote}
                maxLength={40}
                editable={!isSending}
              />
            </View>

            {/* Custom Grid Numpad */}
            <View style={styles.keypadWrapper}>
              {[
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
                ['.', '0', 'delete']
              ].map((row, rowIndex) => (
                <View key={rowIndex} style={styles.keypadRow}>
                  {row.map((btn) => (
                    <KeypadKey
                      key={btn}
                      val={btn}
                      onPress={handleKeyPress}
                    />
                  ))}
                </View>
              ))}
            </View>

            {/* Send Money gradient CTA */}
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={showConfirmSheet}
              disabled={isSending || amountNum <= 0 || isInsufficient}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#7C6FFF', '#FF6BBA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.gradientBtn,
                  (isSending || amountNum <= 0 || isInsufficient) && { opacity: 0.4 }
                ]}
              >
                {isSending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.sendBtnText}>Send Money</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Confirmation Sheet */}
        {confirmSheetVisible && (
          <Modal
            visible={confirmSheetVisible}
            animationType="none"
            transparent={true}
            onRequestClose={closeConfirmSheet}
          >
            <View style={styles.confirmOverlay}>
              <TouchableOpacity 
                style={styles.confirmDismiss} 
                activeOpacity={1} 
                onPress={closeConfirmSheet} 
              />
              <Animated.View style={[
                styles.confirmSheetContainer,
                { transform: [{ translateY: confirmSheetY }] }
              ]}>
                <BlurView intensity={30} tint="dark" style={styles.confirmSheetContent}>
                  <View style={styles.topHighlight} />

                  <View style={styles.confirmHeader}>
                    <Text style={styles.confirmTitle}>Confirm Transfer</Text>
                  </View>

                  <Text style={styles.confirmMessage}>
                    Are you sure you want to send:
                  </Text>
                  
                  <Text style={styles.confirmAmountText}>
                    {formatPKR(amountNum)}
                  </Text>

                  <Text style={styles.confirmToText}>
                    to <Text style={{ fontWeight: '800' }}>{selectedUser?.name}</Text>
                  </Text>

                  {note.trim() ? (
                    <Text style={styles.confirmNoteText}>
                      Note: "{note}"
                    </Text>
                  ) : null}

                  <View style={styles.confirmActionsRow}>
                    <TouchableOpacity
                      style={styles.confirmCancelBtn}
                      onPress={closeConfirmSheet}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.confirmCancelText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.confirmSubmitBtn}
                      onPress={() => {
                        closeConfirmSheet();
                        handleSendMoney();
                      }}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#7C6FFF', '#FF6BBA']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gradientBtn}
                      >
                        <Text style={styles.confirmSubmitText}>Confirm</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </BlurView>
              </Animated.View>
            </View>
          </Modal>
        )}

        {/* 3. Confetti Success Animation fullscreen Overlay */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showSuccess}
        >
          <View style={styles.successOverlay}>
            {/* Confetti falling objects */}
            {confettiItems.map((c) => {
              const confettiY = c.anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-50, screenHeight],
              });
              const rotation = c.anim.interpolate({
                inputRange: [0, 1],
                outputRange: [`${c.rotateInit}deg`, `${c.rotateInit + 360}deg`],
              });

              return (
                <Animated.View
                  key={c.id}
                  style={[
                    styles.confettiSquare,
                    {
                      width: c.size,
                      height: c.size,
                      backgroundColor: c.color,
                      left: c.left,
                      transform: [
                        { translateY: confettiY },
                        { rotate: rotation }
                      ],
                    }
                  ]}
                />
              );
            })}

            {/* Checkmark SVG circle outline + path drawing */}
            <Animated.View style={{ transform: [{ scale: checkmarkScale }] }}>
              <Svg width="120" height="120" viewBox="0 0 100 100">
                {/* Drawn Circle */}
                <AnimatedCircle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#00F5A0"
                  strokeWidth="3.5"
                  strokeDasharray="252"
                  strokeDashoffset={strokeOffsetCircle}
                  strokeLinecap="round"
                />
                {/* Drawn Checkmark */}
                <AnimatedPath
                  d="M33,52 L45,64 L67,36"
                  fill="transparent"
                  stroke="#00F5A0"
                  strokeWidth="4"
                  strokeDasharray="60"
                  strokeDashoffset={strokeOffsetCheck}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Animated.View>
            
            <Animated.View style={[
              styles.successTextContainer, 
              { opacity: successTextOpacity }
            ]}>
              <Text style={styles.successTitle}>Transfer Successful!</Text>
              <Text style={styles.successSub}>
                PKR {amountNum.toLocaleString()} sent to {selectedUser?.name}
              </Text>
              <Text style={styles.successAmount}>
                {formatPKR(amountNum)}
              </Text>
            </Animated.View>
          </View>
        </Modal>
      </SafeAreaView>
    </GlobalBackground>
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
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 20,
    height: 56,
  },
  searchBarFocused: {
    borderColor: 'rgba(124, 111, 255, 0.4)',
    shadowColor: '#7C6FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 16,
    marginBottom: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#7C6FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  userPhone: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 2,
  },
  sendBtnSmall: {
    backgroundColor: 'rgba(124, 111, 255, 0.15)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 111, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnSmallText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C6FFF',
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
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  recipientHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 16,
    marginTop: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  avatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(124, 111, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124, 111, 255, 0.3)',
  },
  avatarLargeText: {
    color: '#7C6FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sendingToLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 1,
    marginBottom: 2,
  },
  recipientName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recipientPhone: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  btnChangeContact: {
    padding: 8,
  },
  amountShowcase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  amountSymbol: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
    marginRight: 6,
  },
  amountDisplayVal: {
    fontSize: 56,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  balanceIndicatorRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  availableBalance: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
  },
  insufficientText: {
    color: '#FF4D6A',
    fontWeight: '700',
    fontSize: 13,
  },
  noteWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderRadius: 14,
    height: 46,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginBottom: 12,
  },
  noteInput: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  keypadWrapper: {
    marginBottom: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  keypadKey: {
    height: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadKeyText: {
    fontSize: 24,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  sendBtn: {
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
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  confirmDismiss: {
    flex: 1,
  },
  confirmSheetContainer: {
    width: '100%',
  },
  confirmSheetContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(8, 8, 16, 0.85)',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    overflow: 'hidden',
    position: 'relative',
  },
  confirmHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  confirmMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 10,
  },
  confirmAmountText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#7C6FFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -1,
  },
  confirmToText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmNoteText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  confirmCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  confirmSubmitBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    marginLeft: 10,
  },
  confirmSubmitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contactsSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.3)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 14,
    marginTop: 10,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    zIndex: 1000,
  },
  successTextContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  successSub: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 16,
  },
  successAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#00F5A0',
  },
  confettiSquare: {
    position: 'absolute',
    borderRadius: 1,
  },
});
