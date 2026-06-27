import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  useColorScheme 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions } from '../../hooks/useTransactions';
import TransactionItem from '../../components/TransactionItem';
import { colors, darkColors } from '../../constants/colors';

export default function HistoryScreen() {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;

  const { profile } = useAuth();
  const { transactions, isLoading, fetchTransactions } = useTransactions();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'sent' | 'received' | 'failed'
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(15); // Frontend pagination

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

    // Search query matches names or notes
    const query = searchQuery.toLowerCase().trim();
    const nameMatch = 
      tx.senderName?.toLowerCase().includes(query) || 
      tx.receiverName?.toLowerCase().includes(query) ||
      (tx.note && tx.note.toLowerCase().includes(query));

    if (query && !nameMatch) return false;

    // Chip filter matching
    if (activeFilter === 'sent') return isDebit && tx.category !== 'topup';
    if (activeFilter === 'received') return isCredit || tx.category === 'topup';
    if (activeFilter === 'failed') return tx.status === 'failed';
    
    return true; // 'all'
  });

  // Paginated subset
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

      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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

  // Convert grouped data back into a flat list format for FlatList with section headers
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
        <Text style={[styles.sectionHeaderTitle, { color: theme.textSecondary }]}>
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Search Header bar */}
      <View style={styles.searchHeader}>
        <Text style={[styles.title, { color: theme.text }]}>History</Text>
        <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={20} color={theme.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search transactions, notes..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={(text) => { setSearchQuery(text); setVisibleCount(15); }}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filters Chips row */}
      <View style={styles.chipsContainer}>
        {['all', 'sent', 'received', 'failed'].map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              style={[
                styles.chip,
                { backgroundColor: theme.card, borderColor: theme.border },
                isActive && { backgroundColor: theme.primary, borderColor: theme.primary }
              ]}
              onPress={() => { setActiveFilter(filter); setVisibleCount(15); }}
            >
              <Text style={[
                styles.chipText,
                { color: theme.textSecondary },
                isActive && { color: '#FFFFFF', fontWeight: '700' }
              ]}>
                {filter.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Main transactions list */}
      <FlatList
        data={flatListData}
        keyExtractor={(item, index) => item.isHeader ? `header-${item.title}-${index}` : `tx-${item.item.id}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.2}
        ListFooterComponent={() => (
          visibleCount < filteredTransactions.length ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 16 }} />
          ) : null
        )}
        ListEmptyComponent={() => (
          !isLoading && (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.text }]}>No transactions found</Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                Try adjusting your search query or filter chips
              </Text>
            </View>
          )
        )}
      />
    </SafeAreaView>
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
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  chipsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginVertical: 10,
    justifyContent: 'space-between',
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 3,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 64,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
