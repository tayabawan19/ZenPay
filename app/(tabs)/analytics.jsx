import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { VictoryPie, VictoryChart, VictoryLine, VictoryArea, VictoryScatter, VictoryAxis } from 'victory-native';
import { colors } from '../../constants/colors';
import { useTransactions } from '../../hooks/useTransactions';
import { useAuth } from '../../hooks/useAuth';
import StatCard from '../../components/StatCard';
import GlobalBackground from '../../components/GlobalBackground';
import { formatPKR } from '../../utils/format';

const { width: screenWidth } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const { profile } = useAuth();
  const { transactions } = useTransactions();

  const [period, setPeriod] = useState('week'); // 'week' | 'month' | 'year'

  // Animated sliding tab indicator
  const selectX = useRef(new Animated.Value(0)).current;
  const tabWidth = (screenWidth - 48) / 3;

  useEffect(() => {
    let index = 0;
    if (period === 'week') index = 0;
    else if (period === 'month') index = 1;
    else if (period === 'year') index = 2;

    Animated.spring(selectX, {
      toValue: index * tabWidth,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [period]);

  // Filter user's successful transactions
  const userTx = transactions.filter(tx => tx.status === 'success');
  const now = new Date();

  // 1. Weekly baseline (last 7 days)
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
      if (found) found.amount += tx.amount;
    });

  // 2. Monthly baseline (last 6 months)
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
      if (found) found.amount += tx.amount;
    });

  // Filter based on active selection tab
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
  const periodCredits = periodTx.filter(tx => (tx.receiverId === profile?.uid || tx.category === 'topup'));

  // Aggregated totals
  const periodTotalSpent = periodDebits.reduce((sum, tx) => sum + tx.amount, 0);
  const periodTotalReceived = periodCredits.reduce((sum, tx) => sum + tx.amount, 0);
  const periodNet = periodTotalReceived - periodTotalSpent;

  // Breakdown by Category
  const categoryTotals = {};
  periodDebits.forEach(tx => {
    const cat = tx.category || 'other';
    const formattedCat = cat.charAt(0).toUpperCase() + cat.slice(1);
    categoryTotals[formattedCat] = (categoryTotals[formattedCat] || 0) + tx.amount;
  });

  const categoryColors = {
    Food: '#FFB020',
    Shopping: '#FF6BBA',
    Transport: '#00D4FF',
    Bills: '#FF4D6A',
    Other: '#7C6FFF',
    Transfer: '#9D93FF',
  };

  const categoryIcons = {
    Food: 'fast-food-outline',
    Shopping: 'cart-outline',
    Transport: 'car-outline',
    Bills: 'receipt-outline',
    Other: 'grid-outline',
    Transfer: 'swap-horizontal-outline',
  };

  let periodPieData = Object.keys(categoryTotals).map(cat => {
    const val = categoryTotals[cat];
    const percentage = periodTotalSpent > 0 ? Math.round((val / periodTotalSpent) * 100) : 0;
    return {
      x: cat,
      y: percentage,
      color: categoryColors[cat] || '#8A8A9A',
      icon: categoryIcons[cat] || 'grid-outline',
      amount: val
    };
  }).filter(item => item.y > 0);

  if (periodPieData.length === 0) {
    periodPieData = [
      { x: 'No Spends', y: 100, color: 'rgba(255,255,255,0.06)', icon: 'alert-circle-outline', amount: 0 }
    ];
  }

  // Get coordinates data for Line graph
  const getLineChartData = () => {
    if (period === 'week') {
      return weeklyData.map(d => ({ x: d.day, y: d.amount }));
    } else if (period === 'month') {
      const weeks = [
        { x: 'W1', y: 0, minDays: 0, maxDays: 7 },
        { x: 'W2', y: 0, minDays: 8, maxDays: 14 },
        { x: 'W3', y: 0, minDays: 15, maxDays: 21 },
        { x: 'W4', y: 0, minDays: 22, maxDays: 30 }
      ];

      periodDebits.forEach(tx => {
        const txDate = tx.timestamp?.toDate ? tx.timestamp.toDate() : (tx.timestamp?.seconds ? new Date(tx.timestamp.seconds * 1000) : new Date(tx.timestamp));
        const diffTime = Math.abs(now - txDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const week = weeks.find(w => diffDays >= w.minDays && diffDays <= w.maxDays);
        if (week) week.y += tx.amount;
      });

      return weeks.map(w => ({ x: w.x, y: w.y }));
    } else {
      return monthlyData.map(m => ({ x: m.month, y: m.amount }));
    }
  };

  const periodChartData = getLineChartData();

  const insights = {
    week: periodTotalSpent > 0 ? "You spent mostly on " + (periodPieData[0]?.x || 'other') + " this week." : "No debit transactions recorded yet this week.",
    month: periodTotalSpent > 0 ? "Your largest spending category this month is " + (periodPieData[0]?.x || 'other') + "." : "No debit transactions recorded yet this month.",
    year: periodTotalSpent > 0 ? "Your total yearly spending is " + formatPKR(periodTotalSpent) + "." : "No annual spending data to report."
  };

  const currentInsight = insights[period];

  const getTopSpends = () => {
    return transactions
      .filter(tx => tx.senderId === profile?.uid && tx.status === 'success' && tx.category !== 'topup')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  };

  const topSpends = getTopSpends();

  return (
    <GlobalBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Analytics</Text>

          {/* Period Selector Tabs */}
          <View style={styles.periodTabs}>
            {/* Sliding glass block */}
            <Animated.View style={[
              styles.activeIndicator,
              {
                width: tabWidth,
                transform: [{ translateX: selectX }]
              }
            ]} />

            {['week', 'month', 'year'].map((p) => (
              <TouchableOpacity
                key={p}
                style={styles.tabBtn}
                onPress={() => setPeriod(p)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.tabText,
                  period === p ? styles.tabTextActive : styles.tabTextInactive
                ]}>
                  {p.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 3 Summary Glass Cards Row */}
          <View style={styles.summaryRow}>
            {/* Card 1: Spent */}
            <View style={styles.summaryCard}>
              <View style={styles.topHighlight} />
              <Text style={styles.summaryLabel}>SPENT</Text>
              <Text style={[styles.summaryNum, { color: '#FF4D6A' }]} numberOfLines={1}>
                {formatPKR(periodTotalSpent)}
              </Text>
            </View>

            {/* Card 2: Received */}
            <View style={styles.summaryCard}>
              <View style={styles.topHighlight} />
              <Text style={styles.summaryLabel}>RECEIVED</Text>
              <Text style={[styles.summaryNum, { color: '#00F5A0' }]} numberOfLines={1}>
                {formatPKR(periodTotalReceived)}
              </Text>
            </View>

            {/* Card 3: Net */}
            <View style={styles.summaryCard}>
              <View style={styles.topHighlight} />
              <Text style={styles.summaryLabel}>NET</Text>
              <Text style={[styles.summaryNum, { color: '#7C6FFF' }]} numberOfLines={1}>
                {formatPKR(periodNet)}
              </Text>
            </View>
          </View>

          {/* Svg LinearGradient Defs for Area Chart Fill */}
          <Svg style={{ height: 0, width: 0 }}>
            <Defs>
              <SvgGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#7C6FFF" stopOpacity="0.3" />
                <Stop offset="100%" stopColor="#7C6FFF" stopOpacity="0.0" />
              </SvgGradient>
            </Defs>
          </Svg>

          {/* Line Chart */}
          <View style={styles.chartCard}>
            <View style={styles.topHighlight} />
            <Text style={styles.chartTitle}>Spending Trend</Text>
            <VictoryChart
              width={screenWidth - 48 - 40}
              height={180}
              padding={{ top: 20, bottom: 30, left: 45, right: 10 }}
            >
              {/* Custom Grid Axis */}
              <VictoryAxis
                style={{
                  axis: { stroke: 'rgba(255, 255, 255, 0.1)' },
                  tickLabels: { fill: 'rgba(255, 255, 255, 0.4)', fontSize: 10, fontWeight: '600' },
                  grid: { stroke: 'transparent' }
                }}
              />
              <VictoryAxis
                dependentAxis
                style={{
                  axis: { stroke: 'rgba(255, 255, 255, 0.1)' },
                  tickLabels: { fill: 'rgba(255, 255, 255, 0.4)', fontSize: 10, fontWeight: '600' },
                  grid: { stroke: 'rgba(255, 255, 255, 0.05)' }
                }}
              />

              {/* Gradient Area Fill */}
              <VictoryArea
                data={periodChartData}
                interpolation="natural"
                style={{
                  data: { fill: 'url(#purpleGradient)' }
                }}
                animate={{ duration: 1000, easing: 'cubicInOut' }}
              />

              {/* Main Trend Line */}
              <VictoryLine
                data={periodChartData}
                interpolation="natural"
                style={{
                  data: { stroke: '#7C6FFF', strokeWidth: 2.5, strokeLinecap: 'round' }
                }}
                animate={{ duration: 1000, easing: 'cubicInOut' }}
              />

              {/* Circular Data Nodes */}
              <VictoryScatter
                data={periodChartData}
                size={4}
                style={{
                  data: { fill: '#7C6FFF', stroke: '#FFFFFF', strokeWidth: 1.5 }
                }}
              />
            </VictoryChart>
          </View>

          {/* Donut Chart */}
          <View style={[styles.chartCard, { alignItems: 'center' }]}>
            <View style={styles.topHighlight} />
            <Text style={[styles.chartTitle, { alignSelf: 'flex-start' }]}>Category Shares</Text>
            
            <View style={styles.donutWrapper}>
              <VictoryPie
                data={periodPieData.map(item => ({ x: item.x, y: item.y }))}
                colorScale={periodPieData.map(item => item.color)}
                width={screenWidth - 80}
                height={200}
                innerRadius={80}
                padding={20}
                style={{ labels: { display: 'none' } }}
                animate={{ duration: 800 }}
              />
              
              {/* Inner labels placement */}
              <View style={styles.donutCenter}>
                <Text style={styles.donutCenterAmount}>
                  {formatPKR(periodTotalSpent)}
                </Text>
                <Text style={styles.donutCenterLabel}>Total Spent</Text>
              </View>
            </View>
          </View>

          {/* Category List */}
          <Text style={styles.listHeading}>Categories Breakdown</Text>
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
          <View style={styles.insightCard}>
            <View style={styles.topHighlight} />
            <View style={styles.insightHeader}>
              <Ionicons name="bulb-outline" size={20} color="#7C6FFF" />
              <Text style={styles.insightTitle}>Smart Insights</Text>
            </View>
            <Text style={styles.insightText}>{currentInsight}</Text>
          </View>

          {/* Largest Spends */}
          {topSpends.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.listHeading}>Largest Spends</Text>
              {topSpends.map(tx => (
                <View key={tx.id} style={styles.topSpendRow}>
                  <View style={styles.topHighlight} />
                  <View style={styles.topSpendLeft}>
                    <View style={styles.bulletCircle}>
                      <Ionicons name="arrow-up" size={14} color="#FF4D6A" />
                    </View>
                    <Text style={styles.topSpendName} numberOfLines={1}>{tx.receiverName}</Text>
                  </View>
                  <Text style={styles.topSpendAmount}>{formatPKR(tx.amount)}</Text>
                </View>
              ))}
            </View>
          )}
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
    paddingBottom: 110, // tab height spacing
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(124, 111, 255, 0.25)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 111, 255, 0.4)',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 10,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabTextInactive: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 16,
    marginHorizontal: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 1,
    marginBottom: 6,
  },
  summaryNum: {
    fontSize: 14,
    fontWeight: '800',
  },
  chartCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  donutWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: screenWidth - 80,
    height: 200,
  },
  donutCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutCenterAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  donutCenterLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 2,
  },
  listHeading: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: 'rgba(255, 255, 255, 0.3)',
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 12,
  },
  insightCard: {
    borderWidth: 1,
    borderColor: 'rgba(124, 111, 255, 0.25)',
    backgroundColor: 'rgba(124, 111, 255, 0.08)',
    borderRadius: 20,
    padding: 16,
    marginVertical: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C6FFF',
    marginLeft: 8,
  },
  insightText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#FFFFFF',
  },
  topSpendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginVertical: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  topSpendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  bulletCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 77, 106, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  topSpendName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  topSpendAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});