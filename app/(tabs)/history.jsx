import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions } from '../../hooks/useTransactions';
import TransactionItem from '../../components/TransactionItem';
import { colors } from '../../constants/colors';
import GlobalBackground from '../../components/GlobalBackground';

// Reusable Filter Chip component with tap bounciness
const FilterChip = ({ label, isActive, onPress }) => {
  const scale = useRef(new Animated.Value(1.0)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.92, friction: 3, tension: 150, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1.0, friction: 5, tension: 120, useNativeDriver: true }),
    ]).start(() => onPress());
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={1}
        style={[
          styles.chip,
          isActive ? styles.chipActive : styles.chipInactive
        ]}
      >
        <Text style={[
          styles.chipText,
          isActive ? styles.chipTextActive : styles.chipTextInactive
        ]}>
          {label.toUpperCase()}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function HistoryScreen() {
  const { profile } = useAuth();
  const { transactions, fetchTransactions } = useTransactions();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'sent' | 'received' | 'failed'
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(15); 
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (visibleCount < filteredTransactions.length) {
      setVisibleCount(prev => prev + 15);
    }
  };

  // Filter transactions based on search and active chip
  const filteredTransactions = transactions.filter(tx => {
    const isDebit = tx.senderId === profile?.uid;
    const isCredit = tx.receiverId === profile?.uid;

    const query = searchQuery.toLowerCase().trim();
    const nameMatch = 
      tx.senderName?.toLowerCase().includes(query) || 
      tx.receiverName?.toLowerCase().includes(query) ||
      (tx.note && tx.note.toLowerCase().includes(query));

    if (query && !nameMatch) return false;

    if (activeFilter === 'sent') return isDebit && tx.category !== 'topup';
    if (activeFilter === 'received') return isCredit || tx.category === 'topup';
    if (activeFilter === 'failed') return tx.status === 'failed';
    
    return true; 
  });

  const paginatedTransactions = filteredTransactions.slice(0, visibleCount);

  // Group transaction items by date headings
  const getGroupedTransactions = () => {
    const groups = [];
    
    const getDateHeading = (timestamp) => {
      if (!timestamp) return 'Earlier';
      let date;
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else {
        date = new Date(timestamp);
      }

      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);

      if (date.toDateString() === now.toDateString()) return 'Today';
      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

      const oneWeekAgo = new Date(now);
      oneWeekAgo.setDate(now.getDate() - 7);
      if (date > oneWeekAgo) return 'This Week';

      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    };

    paginatedTransactions.forEach(tx => {
      const heading = getDateHeading(tx.timestamp);
      const existingGroup = groups.find(g => g.title === heading);
      
      if (existingGroup) {
        existingGroup.data.push(tx);
      } else {
        groups.push({ title: heading, data: [tx] });
      }
    });

    return groups;
  };

  const groupedData = getGroupedTransactions();

  const flatListData = [];
  groupedData.forEach(group => {
    flatListData.push({ isHeader: true, title: group.title });
    group.data.forEach(item => {
      flatListData.push({ isHeader: false, item });
    });
  });

  const renderItem = ({ item }) => {
    if (item.isHeader) {
      return (
        <Text style={styles.sectionHeaderTitle}>
          {item.title}
        </Text>
      );
    }
    return (
      <TransactionItem
        item={item.item}
        currentUserId={profile?.uid}
      />
    );
  };

  return (
    <GlobalBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Search Header bar */}
        <View style={styles.searchHeader}>
          <Text style={styles.title}>History</Text>
          
          <View style={[
            styles.searchBar,
            searchFocused && styles.searchBarFocused
          ]}>
            <Ionicons name="search-outline" size={20} color="#7C6FFF" style={{ marginRight: 10 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search transactions, notes..."
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              value={searchQuery}
              onChangeText={(text) => { setSearchQuery(text); setVisibleCount(15); }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={18} color="rgba(255, 255, 255, 0.4)" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Filters Chips row */}
        <View style={styles.chipsContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={['all', 'sent', 'received', 'failed']}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <FilterChip
                label={item}
                isActive={activeFilter === item}
                onPress={() => { setActiveFilter(item); setVisibleCount(15); }}
              />
            )}
            contentContainerStyle={styles.chipsListContent}
          />
        </View>

        {/* Main transactions list */}
        <FlatList
          data={flatListData}
          keyExtractor={(item, index) => item.isHeader ? `header-${item.title}-${index}` : `tx-${item.item.id}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#7C6FFF"
              title="Refreshing..."
              titleColor="rgba(255,255,255,0.4)"
            />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color="rgba(255,255,255,0.2)" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No transactions found</Text>
              <Text style={styles.emptySub}>Try searching for another keyword or change your filter.</Text>
            </View>
          )}
        />
      </SafeAreaView>
    </GlobalBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 20,
    height: 56,
  },
  searchBarFocused: {
    borderColor: 'rgba(124, 111, 255, 0.4)',
    shadowColor: '#7C6FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    height: '100%',
  },
  chipsContainer: {
    height: 54,
    marginVertical: 4,
  },
  chipsListContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  chip: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipActive: {
    backgroundColor: 'rgba(124, 111, 255, 0.2)',
    borderColor: 'rgba(124, 111, 255, 0.4)',
  },
  chipText: {
    fontSize: 12,
  },
  chipTextInactive: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110, // Avoid overlapping TabBar
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.3)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    marginTop: 80,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 18,
  },
});
