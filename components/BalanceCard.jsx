import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Dimensions, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTransactionStore } from '../store/transactionStore';
import { formatPKR } from '../utils/format';

const { width: screenWidth } = Dimensions.get('window');

export const BalanceCard = ({ profile, isLoading, onTopUp, onSend, onReceive }) => {
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [displayBalance, setDisplayBalance] = useState(0);

  // Zustand Store subscription to pull transactions and compute totals dynamically
  const transactions = useTransactionStore((state) => state.transactions);

  // Animation values
  const countAnim = useRef(new Animated.Value(0)).current;
  const shimmerX = useRef(new Animated.Value(-screenWidth)).current;
  
  // Parallax tilt values
  const tiltX = useRef(new Animated.Value(0)).current; // rotation around X axis (Y gesture move)
  const tiltY = useRef(new Animated.Value(0)).current; // rotation around Y axis (X gesture move)

  // 1. Shimmer loop: 3s sweep, 5s delay
  useEffect(() => {
    const startShimmer = () => {
      shimmerX.setValue(-screenWidth);
      Animated.sequence([
        Animated.timing(shimmerX, {
          toValue: screenWidth,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.delay(5000),
      ]).start(() => startShimmer());
    };
    startShimmer();
  }, []);

  // 2. Count-up animation
  useEffect(() => {
    if (!isLoading && profile?.balance !== undefined) {
      countAnim.setValue(0);
      Animated.timing(countAnim, {
        toValue: profile.balance,
        duration: 1500,
        useNativeDriver: false,
      }).start();
    }
  }, [profile?.balance, isLoading]);

  useEffect(() => {
    const id = countAnim.addListener(({ value }) => {
      setDisplayBalance(value);
    });
    return () => countAnim.removeListener(id);
  }, []);

  // 3. PanResponder for 3D Parallax tilt
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        // dy controls rotateX, dx controls rotateY
        const rotateXVal = -gestureState.dy / 8;
        const rotateYVal = gestureState.dx / 8;

        // Clamping angles between ±8 degrees
        const clampedX = Math.min(Math.max(rotateXVal, -8), 8);
        const clampedY = Math.min(Math.max(rotateYVal, -8), 8);

        tiltX.setValue(clampedX);
        tiltY.setValue(clampedY);
      },
      onPanResponderRelease: () => {
        Animated.parallel([
          Animated.spring(tiltX, {
            toValue: 0,
            friction: 6,
            tension: 40,
            useNativeDriver: false,
          }),
          Animated.spring(tiltY, {
            toValue: 0,
            friction: 6,
            tension: 40,
            useNativeDriver: false,
          })
        ]).start();
      }
    })
  ).current;

  const rotateX = tiltX.interpolate({
    inputRange: [-8, 8],
    outputRange: ['-8deg', '8deg'],
  });

  const rotateY = tiltY.interpolate({
    inputRange: [-8, 8],
    outputRange: ['-8deg', '8deg'],
  });

  // Calculate dynamic income and expenses from store
  const uid = profile?.uid;
  const incomeTotal = transactions
    .filter((tx) => tx.receiverId === uid && tx.status === 'success')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const expensesTotal = transactions
    .filter((tx) => tx.senderId === uid && tx.status === 'success' && tx.category !== 'topup')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const toggleBalanceVisibility = () => {
    setIsBalanceVisible(prev => !prev);
  };

  // Render loading skeleton
  if (isLoading || !profile) {
    return (
      <View style={styles.skeletonContainer}>
        <View style={styles.topHighlight} />
        <View style={styles.headerRow}>
          <View style={styles.shimmerTitle} />
        </View>
        <View style={styles.shimmerBalance} />
        <View style={styles.divider} />
        <View style={styles.skeletonFooter}>
          <View style={styles.shimmerBox} />
          <View style={styles.shimmerBox} />
        </View>
      </View>
    );
  }

  return (
    <Animated.View 
      {...panResponder.panHandlers}
      style={[
        styles.cardContainer,
        {
          transform: [
            { perspective: 1000 },
            { rotateX },
            { rotateY }
          ]
        }
      ]}
    >
      {/* Stacked Background Layers */}
      <View style={styles.cardBase} />
      
      {/* Gradient Overlay */}
      <LinearGradient
        colors={['rgba(124, 111, 255, 0.2)', 'rgba(255, 107, 186, 0.1)', 'rgba(0, 212, 255, 0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Shimmer sweep effect */}
      <Animated.View 
        style={[
          styles.shimmerSweepContainer,
          { transform: [{ translateX: shimmerX }] }
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255, 255, 255, 0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerSweepLine}
        />
      </Animated.View>

      {/* Top glass highlight line */}
      <View style={styles.topHighlight} />

      {/* Content Layout */}
      <View style={styles.cardContent}>
        {/* Top Row */}
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>TOTAL BALANCE</Text>
          <TouchableOpacity onPress={toggleBalanceVisibility} style={styles.eyeButton} activeOpacity={0.7}>
            <Ionicons 
              name={isBalanceVisible ? 'eye-outline' : 'eye-off-outline'} 
              size={20} 
              color="rgba(255,255,255,0.6)" 
            />
          </TouchableOpacity>
        </View>

        {/* Balance Display */}
        <Text style={styles.balanceText}>
          {isBalanceVisible ? formatPKR(displayBalance) : 'PKR ••••••'}
        </Text>

        <View style={styles.divider} />

        {/* Bottom Income / Expenses Row */}
        <View style={styles.bottomRow}>
          {/* Income box */}
          <View style={styles.statBox}>
            <View style={styles.statHeader}>
              <Ionicons name="arrow-up" size={12} color="#00F5A0" />
              <Text style={styles.statLabel}>Income</Text>
            </View>
            <Text style={styles.incomeAmount} numberOfLines={1}>
              {isBalanceVisible ? formatPKR(incomeTotal) : 'PKR •••'}
            </Text>
          </View>

          {/* Thin divider */}
          <View style={styles.verticalDivider} />

          {/* Expenses box */}
          <View style={styles.statBox}>
            <View style={styles.statHeader}>
              <Ionicons name="arrow-down" size={12} color="#FF4D6A" />
              <Text style={styles.statLabel}>Expenses</Text>
            </View>
            <Text style={styles.expensesAmount} numberOfLines={1}>
              {isBalanceVisible ? formatPKR(expensesTotal) : 'PKR •••'}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom Glow */}
      <View style={styles.bottomGlow} pointerEvents="none" />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    height: 200,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(124, 111, 255, 0.35)',
    marginTop: 20,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#7C6FFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 8,
  },
  cardBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(124, 111, 255, 0.12)',
  },
  shimmerSweepContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: screenWidth,
    zIndex: 1,
  },
  shimmerSweepLine: {
    height: '100%',
    width: 120,
    transform: [{ rotate: '20deg' }, { scaleY: 1.5 }],
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 2,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(124, 111, 255, 0.05)',
  },
  cardContent: {
    padding: 24,
    justifyContent: 'space-between',
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  eyeButton: {
    padding: 4,
    zIndex: 10,
  },
  balanceText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 4,
  },
  incomeAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#00F5A0',
  },
  expensesAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF4D6A',
  },
  verticalDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 16,
  },
  // Skeleton / Loading styles
  skeletonContainer: {
    width: '100%',
    height: 200,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 20,
    padding: 24,
    justifyContent: 'space-between',
  },
  shimmerTitle: {
    height: 14,
    width: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
  },
  shimmerBalance: {
    height: 38,
    width: 180,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
  },
  skeletonFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shimmerBox: {
    height: 28,
    width: '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
  },
});

export default BalanceCard;
