import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, darkColors } from '../constants/colors';

export const QuickSendContact = ({ name, initials, isAddButton, onPress }) => {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;

  // Generate initials if initials prop is not provided
  let displayedInitials = initials;
  if (!isAddButton && !displayedInitials && name) {
    displayedInitials = name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  // Define avatar color based on name string hash
  const getAvatarBgColor = (str) => {
    if (!str) return theme.primary;
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

  const avatarBg = isAddButton ? 'transparent' : getAvatarBgColor(name);

  // Shorten name to fit under avatar
  const displayName = name 
    ? (name.split(' ')[0].length > 8 ? name.split(' ')[0].slice(0, 7) + '..' : name.split(' ')[0]) 
    : '';

  if (isAddButton) {
    return (
      <TouchableOpacity style={styles.container} onPress={onPress}>
        <View style={[
          styles.avatar, 
          styles.addButton, 
          { borderColor: theme.primary, borderStyle: 'dashed' }
        ]}>
          <Ionicons name="add" size={24} color={theme.primary} />
        </View>
        <Text style={[styles.nameText, { color: theme.textSecondary }]}>
          Add
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
        <Text style={styles.initialsText}>{displayedInitials}</Text>
      </View>
      <Text style={[styles.nameText, { color: theme.text }]} numberOfLines={1}>
        {displayName}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginRight: 18,
    width: 60,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  addButton: {
    borderWidth: 1.5,
    backgroundColor: 'rgba(123, 94, 167, 0.05)',
  },
  initialsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  nameText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default QuickSendContact;
