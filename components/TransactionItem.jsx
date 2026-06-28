import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { formatPKR, formatTxDate } from '../utils/format';

export const TransactionItem = ({ item, currentUserId, onPress }) => {
  // Determine if it's a debit or credit relative to current user
  const isDebit = item.senderId === currentUserId;
  const isTopUp = item.category === 'topup';
  
  // Choose displayed party name and initials
  let name = '';
  let initials = '';
  let note = item.note || '';

  if (isTopUp) {
    name = 'Stripe Top-Up';
    initials = 'ST';
  } else {
    name = isDebit ? item.receiverName : item.senderName;
    if (name) {
      initials = name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    } else {
      name = 'ZenPay User';
      initials = 'ZP';
    }
  }

  // Animation values for fade-in + slide-up on layout
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Icon container styles & icon choice based on type
  let iconName = 'swap-horizontal';
  let iconColor = '#7C6FFF';
  let iconBgColor = 'rgba(124, 111, 255, 0.15)';

  if (isTopUp) {
    iconName = 'card';
    iconColor = '#7C6FFF';
    iconBgColor = 'rgba(124, 111, 255, 0.15)';
  } else if (isDebit) {
    iconName = 'arrow-up';
    iconColor = '#FF4D6A';
    iconBgColor = 'rgba(255, 77, 106, 0.15)';
  } else {
    iconName = 'arrow-down';
    iconColor = '#00F5A0';
    iconBgColor = 'rgba(0, 245, 160, 0.15)';
  }

  // Status badge styling
  let statusDotColor = '#00F5A0';
  if (item.status === 'pending') {
    statusDotColor = '#FFB020';
  } else if (item.status === 'failed') {
    statusDotColor = '#FF4D6A';
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={[
        styles.container, 
        { 
          opacity,
          transform: [{ translateY }]
        }
      ]}>
        {/* Top highlight simulated glass border */}
        <View style={styles.topHighlight} />

      <View style={styles.leftSection}>
        <View style={[styles.avatar, { backgroundColor: iconBgColor }]}>
          <Ionicons name={iconName} size={18} color={iconColor} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.nameText} numberOfLines={1}>
            {name}
          </Text>
          {note ? (
            <Text style={styles.noteText} numberOfLines={1}>
              {note}
            </Text>
          ) : null}
          <Text style={styles.dateText}>
            {formatTxDate(item.timestamp)}
          </Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        <Text style={[
          styles.amountText, 
          { color: isDebit && !isTopUp ? '#FF4D6A' : '#00F5A0' }
        ]}>
          {isDebit && !isTopUp ? '-' : '+'}{formatPKR(item.amount)}
        </Text>
        
        {/* Premium status row with tiny dot */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
          <Text style={styles.statusText}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
    </Animated.View>
  </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 16,
    marginBottom: 8,
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
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  nameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  noteText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.3)',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 0.5,
  },
});

export default TransactionItem;
