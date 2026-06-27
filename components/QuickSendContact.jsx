import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

export const QuickSendContact = ({ name, initials, isAddButton, onPress }) => {
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

  // Define unique background colors based on name string hash (cycling 4 accents)
  const getAvatarBgColor = (str) => {
    if (!str) return 'rgba(124, 111, 255, 0.3)';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % 4;
    const colorsList = [
      'rgba(124, 111, 255, 0.3)', // purple
      'rgba(255, 107, 186, 0.3)', // pink
      'rgba(0, 245, 160, 0.3)',   // green
      'rgba(0, 212, 255, 0.3)',   // cyan
    ];
    return colorsList[colorIndex];
  };

  const avatarBg = isAddButton ? 'rgba(124, 111, 255, 0.05)' : getAvatarBgColor(name);

  // Shorten name to fit under avatar
  const displayName = name 
    ? (name.split(' ')[0].length > 8 ? name.split(' ')[0].slice(0, 7) + '..' : name.split(' ')[0]) 
    : '';

  if (isAddButton) {
    return (
      <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
        <View style={[
          styles.avatar, 
          styles.addButton, 
          { borderColor: 'rgba(124, 111, 255, 0.4)', borderStyle: 'dashed' }
        ]}>
          <Ionicons name="add" size={24} color="#7C6FFF" />
        </View>
        <Text style={styles.nameTextMuted}>
          Add
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
        <Text style={styles.initialsText}>{displayedInitials}</Text>
      </View>
      <Text style={styles.nameText} numberOfLines={1}>
        {displayName}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginRight: 18,
    width: 56,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  addButton: {
    borderWidth: 1.5,
  },
  initialsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  nameText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: 6,
  },
  nameTextMuted: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.3)',
    textAlign: 'center',
    marginTop: 6,
  },
});

export default QuickSendContact;
