import React from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, darkColors } from '../constants/colors';
import { formatPKR, formatTxDate } from '../utils/format';

export const TransactionItem = ({ item, currentUserId }) => {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;

  // Determine if it's a debit or credit relative to current user
  const isDebit = item.senderId === currentUserId;
  const isTopUp = item.category === 'topup';
  
  // Choose displayed party name and initials
  let name = '';
  let initials = '';
  let note = item.note || '';

  if (isTopUp) {
    name = 'Top Up (Stripe)';
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

  // Define avatar color based on name string hash
  const getAvatarBgColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % 5;
    const colorsList = [
      '#7B5EA7', // primary purple
      '#A78BCA', // light purple
      '#C084FC', // accent
      '#3B82F6', // soft blue
      '#EC4899', // soft pink
    ];
    return colorsList[colorIndex];
  };

  const avatarBg = isTopUp ? theme.primary : getAvatarBgColor(name);

  // Status Styling Mappings
  const statusStyles = {
    success: {
      bg: systemTheme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#E6FBF3',
      text: theme.success
    },
    pending: {
      bg: systemTheme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
      text: theme.warning
    },
    failed: {
      bg: systemTheme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
      text: theme.danger
    }
  };

  const statusInfo = statusStyles[item.status] || statusStyles.success;

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
      <View style={styles.leftSection}>
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          {isTopUp ? (
            <Ionicons name="card" size={18} color="#FFFFFF" />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.nameText, { color: theme.text }]} numberOfLines={1}>
            {name}
          </Text>
          {note ? (
            <Text style={[styles.noteText, { color: theme.textSecondary }]} numberOfLines={1}>
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
          { color: isDebit ? theme.danger : theme.success }
        ]}>
          {isDebit ? '-' : '+'}{formatPKR(item.amount)}
        </Text>
        
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Text style={[styles.statusText, { color: statusInfo.text }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderRadius: 16,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  noteText: {
    fontSize: 12,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default TransactionItem;
