import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
  useColorScheme,
  Animated,
  Easing,
  Dimensions,
  Pressable
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions } from '../../hooks/useTransactions';
import { colors } from '../../constants/colors';
import BalanceCard from '../../components/BalanceCard';
import QuickSendContact from '../../components/QuickSendContact';
import TransactionItem from '../../components/TransactionItem';
import TopUpSheet from '../../components/TopUpSheet';
import GlobalBackground from '../../components/GlobalBackground';
import { formatPKR } from '../../utils/format';
import SkeletonBox from '../../components/SkeletonBox';

const { width: screenWidth } = Dimensions.get('window');

// Local interactive quick action button component
const QuickActionButton = ({ iconName, label, color, initialBg, flashBg, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.9, useNativeDriver: false, friction: 4, tension: 200 }),
      Animated.timing(flash, { toValue: 1, duration: 100, useNativeDriver: false })
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: false, friction: 6, tension: 150 }),
      Animated.timing(flash, { toValue: 0, duration: 200, useNativeDriver: false })
    ]).start();
  };

  const backgroundColor = flash.interpolate({
    inputRange: [0, 1],
    outputRange: [initialBg, flashBg]
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={styles.gridItem}
    >
      <Animated.View style={[
        styles.gridIconBg,
        { 
          backgroundColor,
          transform: [{ scale }]
        }
      ]}>
        <Ionicons name={iconName} size={24} color={color} />
      </Animated.View>
      <Text style={styles.gridLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

const HomeScreenSkeleton = () => {
  return (
    <GlobalBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.scrollContent}>
          {/* Header Row */}
          <View style={[styles.header, { marginBottom: 20 }]}>
            <SkeletonBox width={46} height={46} borderRadius={23} />
            <SkeletonBox width={100} height={24} borderRadius={6} />
            <SkeletonBox width={40} height={40} borderRadius={12} />
          </View>

          {/* Greeting Section */}
          <View style={[styles.greetingSection, { gap: 6, marginBottom: 20 }]}>
            <SkeletonBox width={120} height={14} borderRadius={4} />
            <SkeletonBox width={80} height={20} borderRadius={4} />
          </View>

          {/* Balance card skeleton */}
          <SkeletonBox width="100%" height={180} borderRadius={24} style={{ marginBottom: 24 }} />

          {/* Quick Actions Title */}
          <View style={{ marginBottom: 12 }}>
            <SkeletonBox width={100} height={12} borderRadius={3} />
          </View>

          {/* Quick Actions Row */}
          <View style={[styles.actionsRow, { marginBottom: 24 }]}>
            <SkeletonBox width={62} height={62} borderRadius={18} />
            <SkeletonBox width={62} height={62} borderRadius={18} />
            <SkeletonBox width={62} height={62} borderRadius={18} />
            <SkeletonBox width={62} height={62} borderRadius={18} />
          </View>

          {/* Quick Send Header */}
          <View style={[styles.sectionHeaderRow, { marginBottom: 12 }]}>
            <SkeletonBox width={80} height={12} borderRadius={3} />
            <SkeletonBox width={50} height={12} borderRadius={3} />
          </View>

          {/* Quick Send list skeleton */}
          <View style={[styles.actionsRow, { justifyContent: 'flex-start', gap: 14, marginBottom: 24 }]}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBox key={i} width={56} height={56} borderRadius={18} />
            ))}
          </View>

          {/* Recent Transactions Header */}
          <View style={[styles.sectionHeaderRow, { marginBottom: 12 }]}>
            <SkeletonBox width={140} height={12} borderRadius={3} />
            <SkeletonBox width={50} height={12} borderRadius={3} />
          </View>

          {/* Transaction items skeleton */}
          <View style={{ gap: 8 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <SkeletonBox width={46} height={46} borderRadius={14} style={{ marginRight: 12 }} />
                  <View style={{ gap: 6 }}>
                    <SkeletonBox width={120} height={12} borderRadius={3} />
                    <SkeletonBox width={80} height={10} borderRadius={3} />
                  </View>
                </View>
                <SkeletonBox width={60} height={12} borderRadius={3} />
              </View>
            ))}
          </View>

        </View>
      </SafeAreaView>
    </GlobalBackground>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const { profile, isLoading: isAuthLoading, fetchProfile } = useAuth();
  const {
    transactions,
    contacts,
    isLoading: isTxLoading,
    fetchTransactions,
    fetchContacts
  } = useTransactions();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const toggleBalance = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    setBalanceVisible(prev => !prev);
  };

  // Animations
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(1.0)).current;

  useEffect(() => {
    // Only set loading to false after both initial auth and transactions/contacts are fetched
    if (!isAuthLoading && !isTxLoading && profile?.uid) {
      setLoading(false);
    }
  }, [isAuthLoading, isTxLoading, profile?.uid]);

  useEffect(() => {
    refreshData();

    // 20s slow rotate for header avatar ring
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 2s pulsing for notification badge
    Animated.loop(
      Animated.sequence([
        Animated.timing(badgeScale, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(badgeScale, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const refreshData = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        profile?.uid ? fetchProfile(profile.uid) : Promise.resolve(),
        fetchTransactions(),
        fetchContacts()
      ]);
    } catch (e) {
      console.warn("Home screen refresh failed: ", e);
    } finally {
      setRefreshing(false);
    }
  };

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'Good morning ☀️';
    if (hrs < 17) return 'Good afternoon 🌤️';
    return 'Good evening 🌙';
  };

  const recentTransactions = transactions.slice(0, 5);

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'ZP';
  };

  // Compute dynamic stats for Card 1 & Card 2
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const uid = profile?.uid;

  const thisMonthSpent = transactions
    .filter(tx => {
      const txDate = tx.timestamp?.toDate ? tx.timestamp.toDate() : (tx.timestamp?.seconds ? new Date(tx.timestamp.seconds * 1000) : new Date(tx.timestamp));
      return tx.senderId === uid && 
             tx.status === 'success' && 
             tx.category !== 'topup' &&
             txDate.getMonth() === currentMonth && 
             txDate.getFullYear() === currentYear;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalReceived = transactions
    .filter(tx => (tx.receiverId === uid || tx.category === 'topup') && tx.status === 'success')
    .reduce((sum, tx) => sum + tx.amount, 0);

  if (loading) {
    return <HomeScreenSkeleton />;
  }

  return (
    <GlobalBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshData}
              tintColor="#7C6FFF"
              colors={['#7C6FFF']}
              progressBackgroundColor="rgba(255,255,255,0.05)"
            />
          }
        >
          {/* Header Row */}
          <View style={styles.header}>
            {/* Avatar block with rotating outer ring */}
            <View style={styles.avatarWrapper}>
              <Animated.View style={[styles.avatarOuterRing, { transform: [{ rotate: spin }] }]} />
              <View style={styles.avatarInner}>
                <Text style={styles.avatarInitials}>{getInitials(profile?.name)}</Text>
              </View>
            </View>

            {/* Wordmark */}
            <Text style={styles.wordmark}>ZenPay</Text>

            {/* Notification Bell with Pulsing Dot */}
            <TouchableOpacity
              style={styles.bellButton}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
              <Animated.View style={[styles.dotBadge, { transform: [{ scale: badgeScale }] }]} />
            </TouchableOpacity>
          </View>

          {/* Greeting Section */}
          <View style={styles.greetingSection}>
            <Text style={styles.greetingText}>{getGreeting()}</Text>
            <Text style={styles.nameText}>{profile?.name || 'Tayyab'}</Text>
          </View>

          {/* 3D Parallax Balance Card */}
          <BalanceCard
            profile={profile}
            isLoading={isAuthLoading}
            onSend={() => router.push('/(tabs)/transfer')}
            onReceive={() => setReceiveModalVisible(true)}
            onTopUp={() => setTopUpModalVisible(true)}
            balanceVisible={balanceVisible}
            toggleBalance={toggleBalance}
            fadeAnim={fadeAnim}
          />

          {/* Quick Actions Title */}
          <Text style={styles.sectionHeading}>QUICK ACTIONS</Text>

          {/* 4 Interactive Buttons Row */}
          <View style={styles.actionsRow}>
            <QuickActionButton
              iconName="arrow-up-circle"
              label="Send"
              color="#7C6FFF"
              initialBg="rgba(124, 111, 255, 0.15)"
              flashBg="rgba(124, 111, 255, 0.3)"
              onPress={() => router.push('/(tabs)/transfer')}
            />
            <QuickActionButton
              iconName="arrow-down-circle"
              label="Receive"
              color="#00F5A0"
              initialBg="rgba(0, 245, 160, 0.1)"
              flashBg="rgba(0, 245, 160, 0.25)"
              onPress={() => setReceiveModalVisible(true)}
            />
            <QuickActionButton
              iconName="add-circle"
              label="Top Up"
              color="#FF6BBA"
              initialBg="rgba(255, 107, 186, 0.1)"
              flashBg="rgba(255, 107, 186, 0.25)"
              onPress={() => setTopUpModalVisible(true)}
            />
            <QuickActionButton
              iconName="grid"
              label="More"
              color="#00D4FF"
              initialBg="rgba(0, 212, 255, 0.1)"
              flashBg="rgba(0, 212, 255, 0.25)"
              onPress={() => router.push('/(tabs)/analytics')}
            />
          </View>

          {/* Quick Send Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>QUICK SEND</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/transfer')} activeOpacity={0.7}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.contactsScroll}
          >
            <QuickSendContact
              isAddButton
              onPress={() => router.push('/(tabs)/transfer')}
            />
            {contacts.map((contact) => (
              <QuickSendContact
                key={contact.uid}
                name={contact.name}
                onPress={() => router.push(`/(tabs)/transfer?selectedUid=${contact.uid}`)}
              />
            ))}
            {contacts.length === 0 && (
              <View style={styles.emptyContactsWrapper}>
                <Text style={styles.emptyText}>
                  No saved contacts. Send money to add them.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Recent Transactions Section */}
          <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
            <Text style={styles.sectionHeading}>RECENT TRANSACTIONS</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/history')} activeOpacity={0.7}>
              <Text style={styles.seeAllText}>View all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.txListContainer}>
            {recentTransactions.map((tx) => (
              <TransactionItem
                key={tx.id}
                item={tx}
                currentUserId={profile?.uid}
                onPress={() => router.push(`/receipt?txnId=${tx.id}`)}
              />
            ))}
            {recentTransactions.length === 0 && !isTxLoading && (
              <View style={styles.emptyTxCard}>
                <View style={styles.topHighlight} />
                <Ionicons name="receipt-outline" size={40} color="rgba(255,255,255,0.3)" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTxTitle}>No transactions yet</Text>
                <Text style={styles.emptyTxSubtitle}>
                  Your P2P transactions will show up here
                </Text>
              </View>
            )}
            {isTxLoading && recentTransactions.length === 0 && (
              <ActivityIndicator size="small" color="#7C6FFF" style={{ marginVertical: 20 }} />
            )}
          </View>

          {/* Stats Cards Row */}
          <View style={styles.statsCardsRow}>
            {/* Card 1: Spent */}
            <View style={[styles.miniStatCard, styles.spentStatCard]}>
              <View style={styles.topHighlight} />
              <View style={styles.miniStatRow}>
                <View style={styles.miniIconWrapperRed}>
                  <Ionicons name="arrow-down" size={16} color="#FF4D6A" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.miniStatLabel}>THIS MONTH</Text>
                  <Text style={styles.spentTextAmount}>{balanceVisible ? formatPKR(thisMonthSpent) : 'PKR •••'}</Text>
                </View>
              </View>
            </View>

            {/* Card 2: Received */}
            <View style={[styles.miniStatCard, styles.receivedStatCard]}>
              <View style={styles.topHighlight} />
              <View style={styles.miniStatRow}>
                <View style={styles.miniIconWrapperGreen}>
                  <Ionicons name="arrow-up" size={16} color="#00F5A0" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.miniStatLabel}>TOTAL RECEIVED</Text>
                  <Text style={styles.receivedTextAmount}>{balanceVisible ? formatPKR(totalReceived) : 'PKR •••'}</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* QR Code Receive Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={receiveModalVisible}
        onRequestClose={() => setReceiveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContent}>
            {/* Glass highlight */}
            <View style={styles.topHighlight} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Receive Money</Text>
              <TouchableOpacity onPress={() => setReceiveModalVisible(false)} style={styles.closeButton} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.qrCodeWrapper}>
              <View style={styles.qrMockSquare}>
                <View style={styles.topHighlight} />
                <Ionicons name="qr-code-outline" size={180} color="#7C6FFF" />
              </View>
              <Text style={styles.qrUserText}>{profile?.name}</Text>
              <Text style={styles.qrPhoneText}>{profile?.phone}</Text>
            </View>

            <Text style={styles.qrInstructions}>
              Show this QR code to another ZenPay user to receive funds directly into your account.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Stripe Top Up Bottom Sheet */}
      <TopUpSheet
        visible={topUpModalVisible}
        onClose={() => setTopUpModalVisible(false)}
      />
    </GlobalBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 110, // Avoid overlapping CustomTabBar
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    height: 48,
  },
  avatarWrapper: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarOuterRing: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: 'rgba(124, 111, 255, 0.5)',
  },
  avatarInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(124, 111, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124, 111, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C6FFF',
  },
  wordmark: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dotBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4D6A',
    position: 'absolute',
    right: 12,
    top: 12,
  },
  greetingSection: {
    marginVertical: 12,
  },
  greetingText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
  },
  nameText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: -0.3,
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
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  gridItem: {
    alignItems: 'center',
    flex: 1,
  },
  gridIconBg: {
    width: 62,
    height: 62,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C6FFF',
    marginTop: 12,
  },
  contactsScroll: {
    paddingVertical: 4,
    alignItems: 'center',
    flexDirection: 'row',
  },
  emptyContactsWrapper: {
    height: 56,
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    fontStyle: 'italic',
  },
  txListContainer: {
    marginTop: 4,
  },
  emptyTxCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
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
  emptyTxTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  emptyTxSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  statsCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  miniStatCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  spentStatCard: {
    backgroundColor: 'rgba(255, 77, 106, 0.08)',
    borderColor: 'rgba(255, 77, 106, 0.15)',
    marginRight: 8,
  },
  receivedStatCard: {
    backgroundColor: 'rgba(0, 245, 160, 0.08)',
    borderColor: 'rgba(0, 245, 160, 0.15)',
    marginLeft: 8,
  },
  miniStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniIconWrapperRed: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 77, 106, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniIconWrapperGreen: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 245, 160, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniStatLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
  },
  spentTextAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF4D6A',
    marginTop: 2,
  },
  receivedTextAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00F5A0',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  qrModalContent: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(8, 8, 16, 0.85)',
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
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
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  qrCodeWrapper: {
    alignItems: 'center',
    marginVertical: 12,
  },
  qrMockSquare: {
    borderWidth: 1,
    borderColor: 'rgba(124, 111, 255, 0.3)',
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  qrUserText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  qrPhoneText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  qrInstructions: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 12,
    paddingHorizontal: 20,
  },
});