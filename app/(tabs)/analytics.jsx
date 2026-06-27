import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  useColorScheme
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VictoryPie, VictoryChart, VictoryLine, VictoryTheme } from 'victory-native';
import { colors, darkColors } from '../../constants/colors';
import { useTransactions } from '../../hooks/useTransactions';
import { useAuth } from '../../hooks/useAuth';
import StatCard from '../../components/StatCard';
import { formatPKR } from '../../utils/format';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;

  const { profile } = useAuth();
  const { transactions } = useTransactions();

  const [period, setPeriod] = useState('week'); // 'week' | 'month' | 'year'

  // Filter user's successful transactions
  const userTx = transactions.filter(tx => tx.status === 'success');
  const now = new Date();

  // 1. Calculate overall metrics requested
  const totalSpent = userTx
    .filter(tx => tx.senderId === profile?.uid && tx.category !== 'topup')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalReceived = userTx
    .filter(tx => tx.receiverId === profile?.uid || tx.category === 'topup')
    .reduce((sum, tx) => sum + tx.amount, 0);

  // spendingByCategory: group by category field (overall)
  const spendingByCategory = {};
  userTx
    .filter(tx => tx.senderId === profile?.uid && tx.category !== 'topup')
    .forEach(tx => {
      const cat = tx.category || 'other';
      spendingByCategory[cat] = (spendingByCategory[cat] || 0) + tx.amount;
    });

  // weeklyData: group by day for last 7 days
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    weeklyData.push({
      day: daysOfWeek[d.getDay()],
      dateStr: d.toDateString(),
      amount: 0
    });
  }
  userTx
    .filter(tx => tx.senderId === profile?.uid && tx.category !== 'topup')
    .forEach(tx => {
      const txDate = tx.timestamp?.toDate ? tx.timestamp.toDate() : (tx.timestamp?.seconds ? new Date(tx.timestamp.seconds * 1000) : new Date(tx.timestamp));
      const found = weeklyData.find(w => w.dateStr === txDate.toDateString());
      if (found) {
        found.amount += tx.amount;
      }
    });

  // monthlyData: group by month for last 6 months
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(now.getMonth() - i);
    monthlyData.push({
      month: months[d.getMonth()],
      year: d.getFullYear(),
      amount: 0
    });
  }
  userTx
    .filter(tx => tx.senderId === profile?.uid && tx.category !== 'topup')
    .forEach(tx => {
      const txDate = tx.timestamp?.toDate ? tx.timestamp.toDate() : (tx.timestamp?.seconds ? new Date(tx.timestamp.seconds * 1000) : new Date(tx.timestamp));
      const txMonth = months[txDate.getMonth()];
      const txYear = txDate.getFullYear();
      const found = monthlyData.find(m => m.month === txMonth && m.year === txYear);
      if (found) {
        found.amount += tx.amount;
      }
    });

  // 2. Filter transactions based on selected period
  const getPeriodFilteredTx = () => {
    return userTx.filter(tx => {
      const txDate = tx.timestamp?.toDate ? tx.timestamp.toDate() : (tx.timestamp?.seconds ? new Date(tx.timestamp.seconds * 1000) : new Date(tx.timestamp));
      if (period === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        return txDate >= oneWeekAgo;
      } else if (period === 'month') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setDate(now.getDate() - 30);
        return txDate >= oneMonthAgo;
      } else { // 'year'
        const oneYearAgo = new Date();
        oneYearAgo.setDate(now.getDate() - 365);
        return txDate >= oneYearAgo;
      }
    });
  };

  const periodTx = getPeriodFilteredTx();
  const periodDebits = periodTx.filter(tx => tx.senderId === profile?.uid && tx.category !== 'topup');

  // Total spent in this period
  const periodTotalSpent = periodDebits.reduce((sum, tx) => sum + tx.amount, 0);

  // Spending by Category in this period (Pie/Breakdown)
  const categoryTotals = {};
  periodDebits.forEach(tx => {
    const cat = tx.category || 'other';
    const formattedCat = cat.charAt(0).toUpperCase() + cat.slice(1);
    categoryTotals[formattedCat] = (categoryTotals[formattedCat] || 0) + tx.amount;
  });

  const categoryColors = {
    Food: theme.warning || '#F59E0B',
    Shopping: theme.primary || '#10B981',
    Transport: '#3B82F6',
    Bills: theme.danger || '#EF4444',
    Other: theme.success || '#10B981',
    Transfer: '#8B5CF6',
  };

  const categoryIcons = {
    Food: 'fast-food',
    Shopping: 'cart',
    Transport: 'bus',
    Bills: 'receipt',
    Other: 'grid',
    Transfer: 'paper-plane',
  };

  let periodPieData = Object.keys(categoryTotals).map(cat => {
    const val = categoryTotals[cat];
    const percentage = periodTotalSpent > 0 ? Math.round((val / periodTotalSpent) * 100) : 0;
    return {
      x: cat,
      y: percentage,
      color: categoryColors[cat] || '#6B7280',
      icon: categoryIcons[cat] || 'grid',
      amount: val
    };
  }).filter(item => item.y > 0);

  if (periodPieData.length === 0) {
    periodPieData = [
      { x: 'No Data', y: 100, color: '#6B7280', icon: 'alert-circle', amount: 0 }
    ];
  }

  // Line Chart spending trend
  const getLineChartData = () => {
    if (period === 'week') {
      return weeklyData.map(d => ({ x: d.day, y: d.amount }));
    } else if (period === 'month') {
      // Group into 4 weeks of the last 30 days
      const weeks = [
        { x: 'Week 1', y: 0, minDays: 0, maxDays: 7 },
        { x: 'Week 2', y: 0, minDays: 8, maxDays: 14 },
        { x: 'Week 3', y: 0, minDays: 15, maxDays: 21 },
        { x: 'Week 4', y: 0, minDays: 22, maxDays: 30 }
      ];

      periodDebits.forEach(tx => {
        const txDate = tx.timestamp?.toDate ? tx.timestamp.toDate() : (tx.timestamp?.seconds ? new Date(tx.timestamp.seconds * 1000) : new Date(tx.timestamp));
        const diffTime = Math.abs(now - txDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const week = weeks.find(w => diffDays >= w.minDays && diffDays <= w.maxDays);
        if (week) {
          week.y += tx.amount;
        }
      });

      return weeks.map(w => ({ x: w.x, y: w.y }));
    } else { // 'year'
      return monthlyData.map(m => ({ x: m.month, y: m.amount }));
    }
  };

  const periodChartData = getLineChartData();

  const insights = {
    week: periodTotalSpent > 0 ? "You spent mostly on " + (periodPieData[0]?.x || 'other') + " this week." : "No transactions recorded yet this week.",
    month: periodTotalSpent > 0 ? "Your largest spending category this month is " + (periodPieData[0]?.x || 'other') + "." : "No transactions recorded yet this month.",
    year: totalSpent > 0 ? "Your total yearly spending is " + formatPKR(totalSpent) + "." : "No annual spending data to report."
  };

  const currentInsight = insights[period];

  const getTopSpends = () => {
    return transactions
      .filter(tx => tx.senderId === profile?.uid && tx.status === 'success')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  };

  const topSpends = getTopSpends();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Analytics</Text>

        {/* Period Selector Tabs */}
        <View style={[styles.periodTabs, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
          {['week', 'month', 'year'].map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.tabBtn,
                period === p && { backgroundColor: theme.primary }
              ]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[
                styles.tabText,
                { color: period === p ? theme.background : theme.textSecondary }
              ]}>
                {p.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Total Spent Summary Card */}
        <View style={[styles.spentCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
          <Text style={styles.spentLabel}>Total Spending</Text>
          <Text style={styles.spentAmount}>{formatPKR(periodTotalSpent)}</Text>
          <View style={styles.spentFooter}>
            <Ionicons name="trending-down" size={16} color={theme.success} />
            <Text style={styles.spentFooterText}>Wired to real transaction data</Text>
          </View>
        </View>

        {/* Line Chart */}
        <View style={[styles.chartContainer, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
          <Text style={[styles.chartTitle, { color: theme.textPrimary }]}>Spending Trend</Text>
          <VictoryChart
            theme={VictoryTheme.material}
            width={width - 56}
            height={180}
            padding={{ top: 20, bottom: 40, left: 50, right: 20 }}
          >
            <VictoryLine
              style={{
                data: { stroke: theme.primary, strokeWidth: 3 },
                grid: { stroke: 'transparent' }
              }}
              data={periodChartData}
              interpolation="natural"
            />
          </VictoryChart>
        </View>

        {/* Donut Chart */}
        <View style={[styles.chartContainer, { backgroundColor: theme.backgroundCard, borderColor: theme.border, alignItems: 'center' }]}>
          <Text style={[styles.chartTitle, { color: theme.textPrimary, alignSelf: 'flex-start' }]}>Category Shares</Text>
          <VictoryPie
            data={periodPieData.map(item => ({ x: item.x, y: item.y }))}
            colorScale={periodPieData.map(item => item.color)}
            width={width - 100}
            height={200}
            innerRadius={60}
            padding={30}
            labels={({ datum }) => `${datum.y}%`}
            style={{
              labels: { fill: theme.textPrimary, fontSize: 10, fontWeight: 'bold' }
            }}
          />
        </View>

        {/* Category breakdown listing */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginVertical: 12 }]}>Categories Breakdown</Text>
        {periodPieData.map((item) => (
          <StatCard
            key={item.x}
            title={item.x}
            amount={item.amount || 0}
            percentage={item.y}
            color={item.color}
            iconName={item.icon}
          />
        ))}

        {/* Smart Insights Card */}
        <View style={[styles.insightCard, { backgroundColor: `${theme.primary}10`, borderColor: theme.primary }]}>
          <View style={styles.insightHeader}>
            <Ionicons name="bulb-outline" size={20} color={theme.primary} />
            <Text style={[styles.insightTitle, { color: theme.primary }]}>Smart Insights</Text>
          </View>
          <Text style={[styles.insightText, { color: theme.textPrimary }]}>{currentInsight}</Text>
        </View>

        {/* Top Spending Transactions */}
        {topSpends.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginBottom: 8 }]}>Largest Spends</Text>
            {topSpends.map(tx => (
              <View key={tx.id} style={[styles.topSpendRow, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
                <View style={styles.topSpendLeft}>
                  <View style={[styles.bulletCircle, { backgroundColor: theme.danger }]}>
                    <Ionicons name="arrow-up" size={14} color={theme.background} />
                  </View>
                  <Text style={[styles.topSpendName, { color: theme.textPrimary }]} numberOfLines={1}>{tx.receiverName}</Text>
                </View>
                <Text style={[styles.topSpendAmount, { color: theme.textPrimary }]}>{formatPKR(tx.amount)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: 0.5,
    color: colors.textPrimary,
  },
  periodTabs: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  spentCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  spentLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
  },
  spentAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 8,
  },
  spentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spentFooterText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  chartContainer: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: colors.textPrimary,
  },
  insightCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 16,
    marginVertical: 16,
    backgroundColor: `${colors.primary}10`,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 8,
  },
  insightText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  topSpendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 4,
  },
  topSpendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  bulletCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  topSpendName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  topSpendAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});