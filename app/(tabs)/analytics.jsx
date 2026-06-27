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

  // Mock data for periods in case transaction history is empty
  const chartData = {
    week: [
      { x: 'Mon', y: 1200 },
      { x: 'Tue', y: 2500 },
      { x: 'Wed', y: 800 },
      { x: 'Thu', y: 3500 },
      { x: 'Fri', y: 1900 },
      { x: 'Sat', y: 5000 },
      { x: 'Sun', y: 1500 }
    ],
    month: [
      { x: 'Week 1', y: 12000 },
      { x: 'Week 2', y: 8500 },
      { x: 'Week 3', y: 15000 },
      { x: 'Week 4', y: 6400 }
    ],
    year: [
      { x: 'Jan-Mar', y: 35000 },
      { x: 'Apr-Jun', y: 48000 },
      { x: 'Jul-Sep', y: 28000 },
      { x: 'Oct-Dec', y: 55000 }
    ]
  };

  const pieData = {
    week: [
      { x: 'Food', y: 35, color: theme.warning, icon: 'fast-food' },
      { x: 'Shopping', y: 25, color: theme.primary, icon: 'cart' },
      { x: 'Transport', y: 20, color: '#3B82F6', icon: 'bus' },
      { x: 'Bills', y: 15, color: theme.danger, icon: 'receipt' },
      { x: 'Other', y: 5, color: theme.success, icon: 'grid' }
    ],
    month: [
      { x: 'Food', y: 30, color: theme.warning, icon: 'fast-food' },
      { x: 'Shopping', y: 30, color: theme.primary, icon: 'cart' },
      { x: 'Transport', y: 15, color: '#3B82F6', icon: 'bus' },
      { x: 'Bills', y: 20, color: theme.danger, icon: 'receipt' },
      { x: 'Other', y: 5, color: theme.success, icon: 'grid' }
    ],
    year: [
      { x: 'Food', y: 25, color: theme.warning, icon: 'fast-food' },
      { x: 'Shopping', y: 35, color: theme.primary, icon: 'cart' },
      { x: 'Transport', y: 12, color: '#3B82F6', icon: 'bus' },
      { x: 'Bills', y: 22, color: theme.danger, icon: 'receipt' },
      { x: 'Other', y: 6, color: theme.success, icon: 'grid' }
    ]
  };

  const totalSpent = {
    week: 16400,
    month: 41900,
    year: 166000
  };

  const insights = {
    week: "You spent 12% less on transport this week compared to last week.",
    month: "Your shopping expense rose by 20% due to mid-season sales.",
    year: "Bills made up 22% of your annual expenses. Consider checking recurring subscriptions."
  };

  const currentPieData = pieData[period];
  const currentChartData = chartData[period];
  const currentTotalSpent = totalSpent[period];
  const currentInsight = insights[period];

  // Calculate actual user spends if transactions exist
  const getTopSpends = () => {
    // Return largest debit transactions
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
          <Text style={styles.spentAmount}>{formatPKR(currentTotalSpent)}</Text>
          <View style={styles.spentFooter}>
            <Ionicons name="trending-down" size={16} color={theme.success} />
            <Text style={styles.spentFooterText}>8% less than previous period</Text>
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
              data={currentChartData}
              interpolation="natural"
            />
          </VictoryChart>
        </View>

        {/* Donut Chart and Breakdown */}
        <View style={[styles.chartContainer, { backgroundColor: theme.backgroundCard, borderColor: theme.border, alignItems: 'center' }]}>
          <Text style={[styles.chartTitle, { color: theme.textPrimary, alignSelf: 'flex-start' }]}>Category Shares</Text>
          <VictoryPie
            data={currentPieData.map(item => ({ x: item.x, y: item.y }))}
            colorScale={currentPieData.map(item => item.color)}
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
        {currentPieData.map((item) => (
          <StatCard
            key={item.x}
            title={item.x}
            amount={(item.y / 100) * currentTotalSpent}
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
    color: theme.textPrimary,
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
    color: theme.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
  },
  spentAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.primary,
    marginBottom: 8,
  },
  spentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spentFooterText: {
    color: theme.textSecondary,
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
    color: theme.textPrimary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: theme.textPrimary,
  },
  insightCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 16,
    marginVertical: 16,
    backgroundColor: `${theme.primary}10`,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.primary,
    marginLeft: 8,
  },
  insightText: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.textPrimary,
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
    color: theme.textPrimary,
  },
  topSpendAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
  },
});