import React from 'react';
import { StyleSheet, View, ActivityIndicator, useColorScheme } from 'react-native';
import { colors, darkColors } from '../constants/colors';

export default function IndexSplash() {
  const systemTheme = useColorScheme();
  const theme = systemTheme === 'dark' ? darkColors : colors;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
