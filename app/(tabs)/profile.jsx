import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions } from '../../hooks/useTransactions';
import { colors } from '../../constants/colors';
import GlobalBackground from '../../components/GlobalBackground';

// Reusable Custom Toggle component (same as cards.jsx)
const CustomToggle = ({ value, onValueChange, activeColor = '#7C6FFF', trackActiveBg = 'rgba(124, 111, 255, 0.3)' }) => {
  const toggleAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(toggleAnim, {
      toValue: value ? 1 : 0,
      friction: 8,
      tension: 100,
      useNativeDriver: true
    }).start();
  }, [value]);

  const translateX = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 18]
  });

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => onValueChange(!value)}
      style={[
        styles.switchTrack,
        {
          backgroundColor: value ? trackActiveBg : 'rgba(255,255,255,0.1)',
          borderColor: value ? activeColor : 'rgba(255,255,255,0.15)',
        }
      ]}
    >
      <Animated.View style={[
        styles.switchThumb,
        { transform: [{ translateX }] }
      ]} />
    </TouchableOpacity>
  );
};

export default function ProfileScreen() {
  const router = useRouter();
  const { 
    profile, 
    logout, 
    isBiometricsEnabled, 
    isNotificationsEnabled, 
    toggleBiometrics, 
    toggleNotifications,
    fetchProfile
  } = useAuth();

  const { transactions } = useTransactions();

  // Animations
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const logoutScale = useRef(new Animated.Value(1.0)).current;
  const logoutFlash = useRef(new Animated.Value(0)).current;

  const [refreshing, setRefreshing] = useState(false);
  const [pinSet, setPinSet] = useState(false);

  const checkPinSet = async () => {
    try {
      const pin = await AsyncStorage.getItem('zenpay_pin');
      setPinSet(!!pin);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkPinSet();
  }, [refreshing, profile]);

  useEffect(() => {
    // 20s slowly rotating ring
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Calculate dynamic profile statistics
  const txCount = transactions.length;
  const sentCount = transactions.filter(t => t.senderId === profile?.uid && t.category !== 'topup').length;
  const receivedCount = transactions.filter(t => t.receiverId === profile?.uid || t.category === 'topup').length;

  const handleBiometricToggleChange = async (value) => {
    if (value) {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware) {
          Alert.alert('Not Supported', 'Biometric hardware was not detected on this device.');
          return;
        }

        if (!isEnrolled) {
          Alert.alert('Not Enrolled', 'Please register a fingerprint or Face ID in your device settings first.');
          return;
        }

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify your identity to enable Biometric Login',
          fallbackLabel: 'Use passcode',
        });

        if (result.success) {
          toggleBiometrics(true);
          Alert.alert('Success', 'Biometric login has been enabled.');
        } else {
          toggleBiometrics(false);
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to authenticate.');
        toggleBiometrics(false);
      }
    } else {
      toggleBiometrics(false);
      Alert.alert('Disabled', 'Biometric login has been disabled.');
    }
  };

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (profile?.uid) {
        await fetchProfile(profile.uid);
      }
    } catch (e) {
      console.warn("Profile refresh failed:", e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAppPinPress = () => {
    if (!pinSet) {
      router.push('/pin');
    } else {
      Alert.alert(
        'App PIN Options',
        'Manage your local security PIN.',
        [
          {
            text: 'Change PIN',
            onPress: () => router.push('/pin?action=change')
          },
          {
            text: 'Remove PIN',
            style: 'destructive',
            onPress: async () => {
              await AsyncStorage.removeItem('zenpay_pin');
              setPinSet(false);
              Alert.alert('PIN Removed', 'Your App PIN security has been disabled.');
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of ZenPay?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/(auth)/login');
            } catch (err) {
              Alert.alert('Logout Error', err.message || 'An error occurred during logout.');
            }
          }
        }
      ]
    );
  };

  const handleLogoutPressIn = () => {
    Animated.parallel([
      Animated.spring(logoutScale, { toValue: 0.97, useNativeDriver: true }),
      Animated.timing(logoutFlash, { toValue: 1, duration: 100, useNativeDriver: false })
    ]).start();
  };

  const handleLogoutPressOut = () => {
    Animated.parallel([
      Animated.spring(logoutScale, { toValue: 1.0, useNativeDriver: true }),
      Animated.timing(logoutFlash, { toValue: 0, duration: 200, useNativeDriver: false })
    ]).start();
  };

  const logoutBgColor = logoutFlash.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 77, 106, 0.08)', 'rgba(255, 77, 106, 0.25)']
  });

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'ZP';
  };

  // Helper settings row element
  const SettingsRow = ({ iconName, iconColor, label, subtitle, rightElement, onPress, isLast }) => (
    <TouchableOpacity 
      style={[styles.row, isLast && { borderBottomWidth: 0 }]} 
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.rowIconCircle, { backgroundColor: `${iconColor}15` }]}>
          <Ionicons name={iconName} size={18} color={iconColor} />
        </View>
        <View style={styles.rowTextWrapper}>
          <Text style={styles.rowLabel}>{label}</Text>
          {subtitle ? (
            <Text style={styles.rowSubtitle}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        {rightElement || (
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <GlobalBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7C6FFF"
              colors={['#7C6FFF']}
              progressBackgroundColor="rgba(255,255,255,0.05)"
            />
          }
        >
          <Text style={styles.title}>Profile</Text>

          {/* Profile Hero Glass Card */}
          <View style={styles.profileCard}>
            <View style={styles.topHighlight} />

            {/* Rotating Avatar container */}
            <View style={styles.avatarContainer}>
              <Animated.View style={[styles.avatarOuterRing, { transform: [{ rotate: spin }] }]} />
              <View style={styles.avatarInner}>
                <Text style={styles.avatarText}>{getInitials(profile?.name)}</Text>
              </View>
              
              {/* Edit Icon Overlay */}
              <TouchableOpacity 
                style={styles.btnEditAvatar} 
                onPress={() => Alert.alert('Edit Avatar', 'Avatar edits are automatically fetched via linked database profiles.')}
                activeOpacity={0.7}
              >
                <Ionicons name="pencil" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.nameText}>{profile?.name || 'Tayyab'}</Text>
            <Text style={styles.emailText}>{profile?.email || 'tayyab@zenpay.app'}</Text>

            {/* Badges tags */}
            <View style={styles.tagsRow}>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>Verified ✓</Text>
              </View>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {/* Card 1: Transactions */}
            <View style={styles.statCard}>
              <View style={styles.topHighlight} />
              <Text style={styles.statNum}>{txCount}</Text>
              <Text style={styles.statLabel}>Transactions</Text>
            </View>

            {/* Card 2: Sent */}
            <View style={styles.statCard}>
              <View style={styles.topHighlight} />
              <Text style={styles.statNum}>{sentCount}</Text>
              <Text style={styles.statLabel}>Sent</Text>
            </View>

            {/* Card 3: Received */}
            <View style={styles.statCard}>
              <View style={styles.topHighlight} />
              <Text style={styles.statNum}>{receivedCount}</Text>
              <Text style={styles.statLabel}>Received</Text>
            </View>
          </View>

          {/* ACCOUNT GROUP */}
          <Text style={styles.sectionHeading}>ACCOUNT</Text>
          <View style={styles.groupCard}>
            <View style={styles.topHighlight} />
            <SettingsRow 
              iconName="person-outline" 
              iconColor="#7C6FFF" 
              label="Edit Profile" 
              subtitle="Update details & personal settings"
              onPress={() => Alert.alert('Information', 'Profile settings are automatically managed by Firestore database syncing.')}
            />
            <SettingsRow 
              iconName="key-outline" 
              iconColor="#00D4FF" 
              label="Change Password" 
              subtitle="Request credential reset link"
              onPress={() => Alert.alert('Change Password', 'A reset verification link has been sent to your registered email.')}
            />
            <SettingsRow 
              iconName="shield-checkmark-outline" 
              iconColor="#00F5A0" 
              label="KYC Status" 
              subtitle="Identity verification complete"
              isLast={true}
              rightElement={
                <View style={styles.tagBadgeGreen}>
                  <Text style={styles.tagBadgeGreenText}>Verified</Text>
                </View>
              }
              onPress={() => Alert.alert('KYC Verified', 'Your identity documentation is verified and fully updated.')}
            />
          </View>

          {/* PREFERENCES GROUP */}
          <Text style={styles.sectionHeading}>PREFERENCES</Text>
          <View style={styles.groupCard}>
            <View style={styles.topHighlight} />
            <SettingsRow 
              iconName="notifications-outline" 
              iconColor="#FFB020" 
              label="Notifications" 
              rightElement={
                <CustomToggle
                  value={isNotificationsEnabled}
                  onValueChange={toggleNotifications}
                  activeColor="#FFB020"
                  trackActiveBg="rgba(255, 176, 32, 0.3)"
                />
              }
            />
            <SettingsRow 
              iconName="finger-print-outline" 
              iconColor="#00D4FF" 
              label="Biometric Login" 
              rightElement={
                <CustomToggle
                  value={isBiometricsEnabled}
                  onValueChange={handleBiometricToggleChange}
                  activeColor="#00D4FF"
                  trackActiveBg="rgba(0, 212, 255, 0.3)"
                />
              }
            />
            <SettingsRow 
              iconName="cash-outline" 
              iconColor="#FF6BBA" 
              label="Currency" 
              isLast={true}
              rightElement={
                <Text style={styles.currencyRightLabel}>PKR</Text>
              }
              onPress={() => Alert.alert('Default Currency', 'Your P2P regions default to PKR (Rs.) transactions.')}
            />
          </View>

          {/* SECURITY GROUP */}
          <Text style={styles.sectionHeading}>SECURITY</Text>
          <View style={styles.groupCard}>
            <View style={styles.topHighlight} />
            <SettingsRow 
              iconName="lock-closed-outline" 
              iconColor="#FF4D6A" 
              label="App PIN" 
              rightElement={
                !pinSet ? (
                  <View style={styles.tagBadgeGreen}>
                    <Text style={styles.tagBadgeGreenText}>Set Up</Text>
                  </View>
                ) : (
                  <Text style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: 13, marginRight: 4 }}>Active</Text>
                )
              }
              onPress={handleAppPinPress}
            />
            <SettingsRow 
              iconName="shield-outline" 
              iconColor="#7C6FFF" 
              label="Two-Factor Auth" 
              isLast={true}
              onPress={() => Alert.alert('Two-Factor Authentication', 'Manage your Multi-Factor configurations.')}
            />
          </View>

          {/* SUPPORT GROUP */}
          <Text style={styles.sectionHeading}>SUPPORT</Text>
          <View style={styles.groupCard}>
            <View style={styles.topHighlight} />
            <SettingsRow 
              iconName="help-circle-outline" 
              iconColor="#8A8A9A" 
              label="Help Center" 
              onPress={() => Alert.alert('Help Center', 'Support resources are available via email at contact@zenpay.app')}
            />
            <SettingsRow 
              iconName="chatbubble-ellipses-outline" 
              iconColor="#8A8A9A" 
              label="Contact Us" 
              onPress={() => Alert.alert('Contact support', 'Live support channels are open 24/7 inside help lines.')}
            />
            <SettingsRow 
              iconName="star-outline" 
              iconColor="#FFB020" 
              label="Rate ZenPay" 
              isLast={true}
              onPress={() => Alert.alert('Rate Us', 'Thanks for reviewing ZenPay on Google Play Store!')}
            />
          </View>

          {/* LOGOUT BUTTON */}
          <Animated.View style={{ transform: [{ scale: logoutScale }], marginTop: 24, marginBottom: 16 }}>
            <Pressable
              onPress={handleLogout}
              onPressIn={handleLogoutPressIn}
              onPressOut={handleLogoutPressOut}
            >
              <Animated.View style={[styles.logoutBtn, { backgroundColor: logoutBgColor }]}>
                <Ionicons name="log-out-outline" size={20} color="#FF4D6A" />
                <Text style={styles.logoutBtnText}>Sign Out</Text>
              </Animated.View>
            </Pressable>
          </Animated.View>

          <Text style={styles.versionText}>
            ZenPay Version 1.0.0 (Production)
          </Text>
        </ScrollView>
      </SafeAreaView>
    </GlobalBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 110, // tabBar offset
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  profileCard: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 2,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  avatarOuterRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(124, 111, 255, 0.4)',
  },
  avatarInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(124, 111, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#7C6FFF',
    fontSize: 32,
    fontWeight: '800',
  },
  btnEditAvatar: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7C6FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#080810',
  },
  nameText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  emailText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(0, 245, 160, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
  },
  verifiedBadgeText: {
    color: '#00F5A0',
    fontSize: 11,
    fontWeight: '600',
  },
  semesterBadge: {
    backgroundColor: 'rgba(124, 111, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124, 111, 255, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 6,
  },
  semesterBadgeText: {
    color: '#7C6FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  statNum: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.3)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginLeft: 6,
    marginBottom: 8,
  },
  groupCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    paddingHorizontal: 20,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowTextWrapper: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  rowSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 2,
  },
  rowRight: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  tagBadgeGreen: {
    backgroundColor: 'rgba(0, 245, 160, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.2)',
  },
  tagBadgeGreenText: {
    color: '#00F5A0',
    fontSize: 11,
    fontWeight: '600',
  },
  currencyRightLabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 106, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  logoutBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF4D6A',
    marginLeft: 10,
  },
  versionText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.3)',
    textAlign: 'center',
    marginVertical: 10,
  },
  // Custom switch styles
  switchTrack: {
    width: 38,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    position: 'relative',
  },
  switchThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
});
