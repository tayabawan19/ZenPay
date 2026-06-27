import React from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, darkColors } from '../constants/colors';
import { formatPKR } from '../utils/format';

export const StatCard = ({ title, amount, percentage, color, iconName }) => {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.topRow}>
        <View style={styles.leftRow}>
          <View style={[styles.iconWrapper, { backgroundColor: `${color}15` }]}>
            <Ionicons name={iconName} size={18} color={color} />
          </View>
          <Text style={[styles.titleText, { color: theme.text }]}>{title}</Text>
        </View>
        <Text style={[styles.percentageText, { color: color }]}>{percentage}%</Text>
      </View>

      <Text style={[styles.amountText, { color: theme.text }]}>{formatPKR(amount)}</Text>

      {/* Progress Bar */}
      <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.progressBar, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  percentageText: {
    fontSize: 13,
    fontWeight: '800',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
});

export default StatCard;
