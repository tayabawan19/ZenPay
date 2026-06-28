import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Share, 
  ActivityIndicator, 
  Dimensions, 
  ScrollView,
  Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { colors } from '../constants/colors';
import { formatPKR, formatTxDate } from '../utils/format';
import GlobalBackground from '../components/GlobalBackground';

const { width: screenWidth } = Dimensions.get('window');

export default function ReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [txn, setTxn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadTxn = async () => {
      if (!params.txnId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        // Query Firestore directly for the transaction
        const txnDocRef = doc(db, 'transactions', params.txnId);
        const txnSnap = await getDoc(txnDocRef);
        if (txnSnap.exists()) {
          setTxn({ id: txnSnap.id, ...txnSnap.data() });
        } else {
          // If transaction details are passed as serialized parameter fallback
          if (params.amount) {
            setTxn({
              id: params.txnId,
              amount: parseFloat(params.amount),
              type: params.type,
              category: params.category,
              senderName: params.senderName,
              receiverName: params.receiverName,
              status: params.status || 'success',
              note: params.note,
              timestamp: params.timestamp ? { seconds: parseInt(params.timestamp) / 1000 } : null
            });
          }
        }
      } catch (err) {
        console.error("Failed to load transaction receipt: ", err);
      } finally {
        setLoading(false);
      }
    };
    loadTxn();
  }, [params.txnId]);

  if (loading) {
    return (
      <GlobalBackground>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C6FFF" />
          <Text style={styles.loadingText}>Fetching Receipt...</Text>
        </SafeAreaView>
      </GlobalBackground>
    );
  }

  if (!txn) {
    return (
      <GlobalBackground>
        <SafeAreaView style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#FF4D6A" />
          <Text style={styles.errorText}>Receipt Not Found</Text>
          <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.backHomeBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </GlobalBackground>
    );
  }

  const isDebit = txn.type === 'debit';
  const isTopUp = txn.category === 'topup';
  
  // Format dates/times
  let dateFormatted = '';
  let timeFormatted = '';
  if (txn.timestamp) {
    const dateObj = txn.timestamp.toDate ? txn.timestamp.toDate() : (txn.timestamp.seconds ? new Date(txn.timestamp.seconds * 1000) : new Date(txn.timestamp));
    dateFormatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    timeFormatted = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else {
    const dateObj = new Date();
    dateFormatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    timeFormatted = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  // Set colors / icons based on status
  let statusIcon = 'checkmark-outline';
  let statusBg = '#00F5A0';
  let statusLabel = 'Transfer Successful';
  let amountColor = '#00F5A0';

  if (txn.status === 'failed') {
    statusIcon = 'close-outline';
    statusBg = '#FF4D6A';
    statusLabel = 'Transfer Failed';
    amountColor = '#FF4D6A';
  } else if (txn.status === 'pending') {
    statusIcon = 'time-outline';
    statusBg = '#FFB020';
    statusLabel = 'Transfer Pending';
    amountColor = '#FFB020';
  }

  const handleCopyTxnId = async () => {
    try {
      await Clipboard.setStringAsync(txn.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("Clipboard write failed: ", e);
    }
  };

  const handleShare = async () => {
    try {
      const recipientStr = isTopUp ? 'Stripe Account' : (isDebit ? txn.receiverName : txn.senderName);
      await Share.share({
        message: `ZenPay Receipt\nAmount: PKR ${txn.amount.toLocaleString()}\nTo/From: ${recipientStr}\nDate: ${dateFormatted}\nStatus: ${txn.status.toUpperCase()}\nTransaction ID: ${txn.id}\n\nSent via ZenPay`
      });
    } catch (err) {
      console.warn("Share failed:", err);
    }
  };

  return (
    <GlobalBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Receipt</Text>
          <TouchableOpacity onPress={handleShare} style={styles.iconButton}>
            <Ionicons name="share-outline" size={24} color="#7C6FFF" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Hero Glass Section */}
          <View style={styles.heroCard}>
            <View style={styles.topHighlight} />
            <View style={[styles.statusIconCircle, { backgroundColor: statusBg }]}>
              <Ionicons name={statusIcon} size={36} color="#080810" />
            </View>
            <Text style={styles.statusLabelText}>{statusLabel}</Text>
            <Text style={[styles.amountText, { color: amountColor }]}>
              {isDebit && !isTopUp ? '-' : '+'}{formatPKR(txn.amount)}
            </Text>
            <Text style={styles.dateTimeText}>{dateFormatted} • {timeFormatted}</Text>
          </View>

          {/* Details Section */}
          <View style={styles.detailsCard}>
            <View style={styles.topHighlight} />
            <Text style={styles.sectionHeading}>TRANSACTION DETAILS</Text>
            
            {/* Rows */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Transaction ID</Text>
              <TouchableOpacity style={styles.copyIdRow} onPress={handleCopyTxnId}>
                <Text style={styles.detailValue} numberOfLines={1}>
                  #{txn.id}
                </Text>
                <Ionicons 
                  name={copied ? "checkmark-circle-outline" : "copy-outline"} 
                  size={14} 
                  color={copied ? "#00F5A0" : "rgba(255,255,255,0.4)"} 
                  style={{ marginLeft: 6 }} 
                />
              </TouchableOpacity>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>
                {isTopUp ? 'Top Up' : 'Transfer'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>From</Text>
              <Text style={styles.detailValue}>
                {isTopUp ? 'Stripe Test Card' : (txn.senderName || 'ZenPay User')}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>To</Text>
              <Text style={styles.detailValue}>
                {isTopUp ? (txn.senderName || 'ZenPay User') : (txn.receiverName || 'ZenPay User')}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={styles.detailValue}>
                PKR {txn.amount.toLocaleString()}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={[styles.detailValue, { color: amountColor, fontWeight: '700' }]}>
                {txn.status === 'success' ? '✅ Successful' : txn.status.toUpperCase()}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{dateFormatted}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>{timeFormatted}</Text>
            </View>

            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>Note</Text>
              <Text style={styles.detailValue}>
                {txn.note ? `"${txn.note}"` : 'None'}
              </Text>
            </View>
          </View>

          {/* Bottom Buttons */}
          <View style={styles.buttonsWrapper}>
            <TouchableOpacity onPress={handleShare} activeOpacity={0.8} style={styles.shareBtn}>
              <LinearGradient
                colors={['#7C6FFF', '#FF6BBA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.shareBtnGradient}
              >
                <Ionicons name="share-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.shareBtnText}>Share Receipt</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.replace('/(tabs)')} 
              activeOpacity={0.7} 
              style={styles.backHomeBtn}
            >
              <Text style={styles.backHomeBtnText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </GlobalBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  heroCard: {
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
  statusIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabelText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  amountText: {
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  dateTimeText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  detailsCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  detailLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    maxWidth: screenWidth * 0.55,
    textAlign: 'right',
  },
  copyIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonsWrapper: {
    gap: 12,
  },
  shareBtn: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
  },
  shareBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  backHomeBtn: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backHomeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 20,
  },
});
