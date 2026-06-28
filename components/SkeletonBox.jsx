import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export default function SkeletonBox({
  width, height, borderRadius = 8, style
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[{
        width,
        height,
        borderRadius,
        backgroundColor: 'rgba(255,255,255,0.08)',
        opacity,
      }, style]}
    />
  );
}
