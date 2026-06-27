import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { formatPKR } from '../utils/format';

export const StatCard = ({ title, amount, percentage, color, iconName }) => {
  return (
    <View style={styles.container}>
      {/* Top glass highlight line */}
      <View style={styles.topHighlight} />

      <View style={styles.topRow}>
        <View style={styles.leftRow}>
          <View style={[styles.iconWrapper, { backgroundColor: `${color}15` }]}>
            <Ionicons name={iconName} size={18} color={color} />
          </View>
          <Text style={styles.titleText}>{title}</Text>
        </View>
        <Text style={[styles.percentageText, { color: color }]}>{percentage}%</Text>
      </View>

      <Text style={styles.amountText}>{formatPKR(amount)}</Text>

      {/* Glassy Progress Bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressBar, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginVertical: 6,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#7C6FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    fontWeight: '600',
    color: '#FFFFFF',
  },
  percentageText: {
    fontSize: 13,
    fontWeight: '800',
  },
  amountText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
});

export default StatCard;
