import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableWithoutFeedback, useColorScheme, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, darkColors } from '../constants/colors';

export const VirtualCard = ({ cardDetails, cardholderName, isFrozen }) => {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;

  const [flipped, setFlipped] = useState(false);
  const rotateValue = useRef(new Animated.Value(0)).current;

  const handleCardPress = () => {
    if (isFrozen) return;
    const toValue = flipped ? 0 : 180;
    setFlipped(!flipped);
    Animated.timing(rotateValue, {
      toValue,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  // Interpolate front rotateY
  const frontRotateY = rotateValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  // Interpolate back rotateY
  const backRotateY = rotateValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const cardNumber = cardDetails?.number || '4242 4242 4242 4242';
  const expiry = cardDetails?.expiry || '12/28';
  const cvv = cardDetails?.cvv || '123';

  // Format card number with spaces for realistic representation: **** **** **** 4242
  const formattedCardNumber = cardNumber.replace(/(\d{4})/g, '$1 ').trim();

  // If frozen, display a semi-transparent dark overlay with lock icon
  return (
    <View style={styles.cardWrapper}>
      <TouchableWithoutFeedback onPress={handleCardPress}>
        <View style={styles.cardContainer}>
          {/* Card Front */}
          <Animated.View style={[
            styles.cardSide, 
            styles.cardFront, 
            {
              transform: [
                { perspective: 1000 },
                { rotateY: frontRotateY }
              ]
            }
          ]}>
            <LinearGradient
              colors={isFrozen ? ['#4B5563', '#374151'] : [theme.primary, theme.accent]}
              style={styles.gradientCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.headerRow}>
                <Text style={styles.brandText}>ZenPay</Text>
                <Ionicons name="wifi" size={20} color="#FFFFFF" style={styles.nfcIcon} />
              </View>

              <View style={styles.chipRow}>
                <View style={styles.cardChip} />
              </View>

              <Text style={styles.cardNumberText}>{formattedCardNumber}</Text>

              <View style={styles.footerRow}>
                <View>
                  <Text style={styles.cardLabel}>CARDHOLDER</Text>
                  <Text style={styles.cardValueText}>{cardholderName?.toUpperCase() || 'CLIENT NAME'}</Text>
                </View>
                <View style={styles.rightAlign}>
                  <Text style={styles.cardLabel}>EXPIRES</Text>
                  <Text style={styles.cardValueText}>{expiry}</Text>
                </View>
                <Text style={styles.logoText}>VISA</Text>
              </View>
            </LinearGradient>
            
            {isFrozen && (
              <View style={styles.frozenOverlay}>
                <Ionicons name="lock-closed" size={32} color="#FFFFFF" />
                <Text style={styles.frozenText}>Frozen</Text>
              </View>
            )}
          </Animated.View>

          {/* Card Back */}
          <Animated.View style={[
            styles.cardSide, 
            styles.cardBack, 
            {
              transform: [
                { perspective: 1000 },
                { rotateY: backRotateY }
              ]
            }
          ]}>
            <LinearGradient
              colors={isFrozen ? ['#374151', '#1F2937'] : [theme.primaryDark, theme.primary]}
              style={styles.gradientCard}
              start={{ x: 1, y: 1 }}
              end={{ x: 0, y: 0 }}
            >
              <View style={styles.magneticStrip} />

              <View style={styles.backInfoContainer}>
                <Text style={styles.backHelpText}>Authorized Signature • Not Transferable</Text>
                <View style={styles.cvvStrip}>
                  <View style={styles.signaturePad} />
                  <View style={styles.cvvBox}>
                    <Text style={styles.cvvText}>{cvv}</Text>
                  </View>
                </View>
                
                <Text style={styles.backInstructions}>
                  This card is issued by ZenPay and is subject to the cardholder agreement.
                </Text>
              </View>
            </LinearGradient>
            
            {isFrozen && (
              <View style={styles.frozenOverlay}>
                <Ionicons name="lock-closed" size={32} color="#FFFFFF" />
                <Text style={styles.frozenText}>Frozen</Text>
              </View>
            )}
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    width: '100%',
    height: 220,
    alignItems: 'center',
    marginVertical: 16,
  },
  cardContainer: {
    width: '90%',
    height: '100%',
    position: 'relative',
  },
  cardSide: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    borderRadius: 20,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  cardFront: {
    zIndex: 1,
  },
  cardBack: {
    zIndex: 0,
  },
  gradientCard: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    padding: 20,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  nfcIcon: {
    transform: [{ rotate: '90deg' }],
  },
  chipRow: {
    marginVertical: 4,
  },
  cardChip: {
    width: 44,
    height: 32,
    backgroundColor: '#F59E0B',
    borderRadius: 6,
    opacity: 0.85,
    borderColor: '#D97706',
    borderWidth: 1,
  },
  cardNumberText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
    fontFamily: 'Courier',
    marginVertical: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontSize: 8,
    color: '#E0D4F2',
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  cardValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  rightAlign: {
    alignItems: 'center',
    marginHorizontal: 12,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  frozenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  frozenText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  magneticStrip: {
    height: 40,
    backgroundColor: '#111827',
    width: '120%',
    marginLeft: -30,
    marginTop: 10,
  },
  backInfoContainer: {
    flex: 1,
    justifyContent: 'space-between',
    marginTop: 15,
  },
  backHelpText: {
    fontSize: 8,
    color: '#E0D4F2',
    fontStyle: 'italic',
  },
  cvvStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  signaturePad: {
    flex: 1,
    height: 32,
    backgroundColor: '#FFFFFF',
    opacity: 0.85,
    borderRadius: 4,
  },
  cvvBox: {
    width: 48,
    height: 28,
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
  },
  cvvText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A2E',
    fontStyle: 'italic',
  },
  backInstructions: {
    fontSize: 7,
    color: '#D1D5DB',
    textAlign: 'center',
    lineHeight: 10,
  },
});

export default VirtualCard;
