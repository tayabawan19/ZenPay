import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableWithoutFeedback, Animated, Easing, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

export const VirtualCard = ({ cardDetails, cardholderName, isFrozen }) => {
  const [flipped, setFlipped] = useState(false);
  const rotateValue = useRef(new Animated.Value(0)).current;

  // Shimmer animation for card front
  const shimmerX = useRef(new Animated.Value(-300)).current;

  useEffect(() => {
    const startShimmer = () => {
      shimmerX.setValue(-300);
      Animated.sequence([
        Animated.timing(shimmerX, {
          toValue: 300,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.delay(4000),
      ]).start(() => startShimmer());
    };
    startShimmer();
  }, []);

  const handleCardPress = () => {
    if (isFrozen) return;
    const toValue = flipped ? 0 : 180;
    
    Animated.timing(rotateValue, {
      toValue,
      duration: 600,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start(() => {
      setFlipped(!flipped);
    });
  };

  // Interpolations for 3D card rotation
  const frontRotateY = rotateValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backRotateY = rotateValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const cardNumber = cardDetails?.number || '4242 4242 4242 4242';
  const expiry = cardDetails?.expiry || '12/28';
  const cvv = cardDetails?.cvv || '123';

  // Format card number with spaces: •••• •••• •••• 4242
  const last4 = cardNumber.slice(-4);
  const maskedCardNumber = `•••• •••• •••• ${last4}`;

  return (
    <View style={styles.cardWrapper}>
      <TouchableWithoutFeedback onPress={handleCardPress}>
        <View style={styles.cardContainer}>
          {/* FRONT FACE */}
          <Animated.View style={[
            styles.cardSide,
            styles.cardFront,
            {
              transform: [
                { perspective: 1200 },
                { rotateY: frontRotateY }
              ],
              // Hide front when flipped to back on iOS
              opacity: rotateValue.interpolate({
                inputRange: [89, 90],
                outputRange: [1, 0]
              })
            }
          ]}>
            <LinearGradient
              colors={['#1A0533', '#2D1B69', '#1A0A40']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            {/* Shimmer overlay */}
            <Animated.View style={[
              styles.shimmerContainer,
              { transform: [{ translateX: shimmerX }] }
            ]}>
              <LinearGradient
                colors={['transparent', 'rgba(255, 255, 255, 0.08)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.shimmerLine}
              />
            </Animated.View>

            {/* Subtle top highlight */}
            <View style={styles.topHighlight} />

            {/* Top row */}
            <View style={styles.headerRow}>
              <Text style={styles.brandText}>ZenPay</Text>
              
              {/* Gold Chip & NFC group */}
              <View style={styles.rightGroup}>
                <View style={styles.cardChip}>
                  <View style={styles.chipLineH1} />
                  <View style={styles.chipLineH2} />
                  <View style={styles.chipLineV} />
                </View>
                
                <Ionicons 
                  name="wifi-outline" 
                  size={18} 
                  color="rgba(255, 255, 255, 0.4)" 
                  style={styles.nfcIcon} 
                />
              </View>
            </View>

            {/* Card number */}
            <Text style={styles.cardNumberText}>{maskedCardNumber}</Text>

            {/* Bottom row */}
            <View style={styles.footerRow}>
              <View>
                <Text style={styles.cardLabel}>CARD HOLDER</Text>
                <Text style={styles.cardValueText}>
                  {cardholderName?.toUpperCase() || 'MUHAMMAD TAYYAB'}
                </Text>
              </View>
              <View style={styles.expiryBox}>
                <Text style={styles.cardLabel}>EXPIRES</Text>
                <Text style={styles.cardValueText}>{expiry}</Text>
              </View>
              <Text style={styles.visaText}>VISA</Text>
            </View>

            {/* Frozen Overlay */}
            {isFrozen && (
              <View style={styles.frozenOverlay}>
                <Ionicons name="snow-outline" size={32} color="#00D4FF" />
                <Text style={styles.frozenText}>Card Frozen</Text>
              </View>
            )}
          </Animated.View>

          {/* BACK FACE */}
          <Animated.View style={[
            styles.cardSide,
            styles.cardBack,
            {
              transform: [
                { perspective: 1200 },
                { rotateY: backRotateY }
              ],
              // Hide back when facing front
              opacity: rotateValue.interpolate({
                inputRange: [90, 91],
                outputRange: [0, 1]
              })
            }
          ]}>
            <LinearGradient
              colors={['#1A0533', '#2D1B69', '#1A0A40']}
              style={StyleSheet.absoluteFill}
              start={{ x: 1, y: 1 }}
              end={{ x: 0, y: 0 }}
            />

            {/* Subtle top highlight */}
            <View style={styles.topHighlight} />

            {/* Magnetic strip */}
            <View style={styles.magneticStrip} />

            {/* Signature strip */}
            <View style={styles.signatureRow}>
              <View style={styles.signatureStrip} />
              
              <View style={styles.cvvBox}>
                <Text style={styles.cvvText}>{cvv}</Text>
              </View>
            </View>

            {/* Watermark */}
            <Text style={styles.watermarkText} pointerEvents="none">
              ZenPay
            </Text>

            <Text style={styles.backInstructions}>
              This card is issued by ZenPay and is subject to the cardholder agreement.
            </Text>

            {/* Frozen Overlay */}
            {isFrozen && (
              <View style={styles.frozenOverlay}>
                <Ionicons name="snow-outline" size={32} color="#00D4FF" />
                <Text style={styles.frozenText}>Card Frozen</Text>
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
    width: '92%',
    height: '100%',
    position: 'relative',
  },
  cardSide: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#7C6FFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  cardFront: {
    zIndex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  cardBack: {
    zIndex: 0,
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  shimmerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 300,
  },
  shimmerLine: {
    height: '100%',
    width: 60,
    transform: [{ rotate: '45deg' }, { scaleY: 1.5 }],
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardChip: {
    width: 32,
    height: 24,
    borderRadius: 4,
    backgroundColor: 'rgba(247, 201, 72, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(247, 201, 72, 0.5)',
    position: 'relative',
    marginRight: 12,
  },
  chipLineH1: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 8,
    height: 0.5,
    backgroundColor: 'rgba(247, 201, 72, 0.6)',
  },
  chipLineH2: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 15,
    height: 0.5,
    backgroundColor: 'rgba(247, 201, 72, 0.6)',
  },
  chipLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 15,
    width: 0.5,
    backgroundColor: 'rgba(247, 201, 72, 0.6)',
  },
  nfcIcon: {
    transform: [{ rotate: '90deg' }],
  },
  cardNumberText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    marginVertical: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  expiryBox: {
    alignItems: 'center',
    marginHorizontal: 12,
  },
  visaText: {
    fontSize: 20,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.8)',
    fontStyle: 'italic',
  },
  frozenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    zIndex: 10,
  },
  frozenText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  magneticStrip: {
    height: 50,
    backgroundColor: '#0A0A0A',
    width: '100%',
    marginTop: 30,
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
  },
  signatureStrip: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  cvvBox: {
    width: 60,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cvvText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  watermarkText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    opacity: 0.04,
    transform: [{ rotate: '-15deg' }],
    alignSelf: 'center',
    marginVertical: 4,
  },
  backInstructions: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.3)',
    textAlign: 'center',
    lineHeight: 12,
    paddingHorizontal: 24,
  },
});

export default VirtualCard;
