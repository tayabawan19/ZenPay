import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, useColorScheme, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, darkColors } from '../constants/colors';
import { formatPKR } from '../utils/format';

export const BalanceCard = ({ profile, isLoading, onTopUp, onSend, onReceive }) => {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;
  
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);

  // Animated Shimmer Value
  const shimmerOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Pulsing shimmer animation loop
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerOpacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        })
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const toggleBalanceVisibility = () => {
    setIsBalanceVisible(prev => !prev);
  };

  if (isLoading || !profile) {
    return (
      <View style={styles.cardContainer}>
        <LinearGradient
          colors={[theme.primary, theme.primaryDark]}
          style={styles.gradientCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Total Balance</Text>
          </View>
          {/* Shimmer box for balance */}
          <Animated.View style={[styles.shimmerBalance, { opacity: shimmerOpacity }]} />
          <View style={styles.cardFooter}>
            <View style={styles.shimmerAction} />
            <View style={styles.shimmerAction} />
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.cardContainer}>
      <LinearGradient
        colors={[theme.primary, theme.primaryDark]}
        style={styles.gradientCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Total Balance</Text>
          <TouchableOpacity onPress={toggleBalanceVisibility} style={styles.eyeButton}>
            <Ionicons 
              name={isBalanceVisible ? 'eye-outline' : 'eye-off-outline'} 
              size={20} 
              color={theme.white} 
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.balanceText}>
          {isBalanceVisible ? formatPKR(profile.balance) : 'PKR ••••••••'}
        </Text>

        <View style={styles.divider} />

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={onSend}>
            <View style={styles.iconCircle}>
              <Ionicons name="arrow-up" size={18} color={theme.primary} />
            </View>
            <Text style={styles.actionText}>Send</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={onReceive}>
            <View style={styles.iconCircle}>
              <Ionicons name="qr-code-outline" size={18} color={theme.primary} />
            </View>
            <Text style={styles.actionText}>Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={onTopUp}>
            <View style={styles.iconCircle}>
              <Ionicons name="add" size={18} color={theme.primary} />
            </View>
            <Text style={styles.actionText}>Top Up</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#7B5EA7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    marginVertical: 12,
  },
  gradientCard: {
    padding: 24,
    borderRadius: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    color: '#E0D4F2',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  eyeButton: {
    padding: 4,
  },
  balanceText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginVertical: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  actionBtn: {
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 95,
    justifyContent: 'center',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  shimmerBalance: {
    height: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    width: '70%',
    marginVertical: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  shimmerAction: {
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
    width: '45%',
  },
});

export default BalanceCard;
