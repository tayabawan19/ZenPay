import React, { useEffect, useRef, useMemo } from 'react';
import { StyleSheet, View, Animated, Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const GlobalBackground = ({ children }) => {
  // Blob 1: Purple
  const blob1X = useRef(new Animated.Value(0)).current;
  const blob1Y = useRef(new Animated.Value(0)).current;
  const blob1Scale = useRef(new Animated.Value(1.0)).current;

  // Blob 2: Pink
  const blob2X = useRef(new Animated.Value(0)).current;
  const blob2Y = useRef(new Animated.Value(0)).current;
  const blob2Scale = useRef(new Animated.Value(1.0)).current;

  // Blob 3: Cyan
  const blob3X = useRef(new Animated.Value(0)).current;
  const blob3Y = useRef(new Animated.Value(0)).current;
  const blob3Scale = useRef(new Animated.Value(1.0)).current;

  // Function to create smooth oscillation loop
  const startOscillation = (val, limit, duration) => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(val, {
          toValue: limit,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(val, {
          toValue: -limit,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.timing(val, {
          toValue: 0,
          duration: duration / 2,
          useNativeDriver: true,
        })
      ])
    ).start();
  };

  const startScaleOscillation = (val, fromVal, toVal, duration) => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(val, {
          toValue: toVal,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(val, {
          toValue: fromVal,
          duration: duration / 2,
          useNativeDriver: true,
        })
      ])
    ).start();
  };

  // Particles generator
  const particles = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => {
      const size = Math.random() * 2 + 2; // 2px to 4px
      const colors = [
        'rgba(124, 111, 255, 0.6)', // purple
        'rgba(255, 107, 186, 0.4)', // pink
        'rgba(0, 212, 255, 0.4)',   // cyan
      ];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const anim = new Animated.Value(0);
      const duration = Math.random() * 15000 + 15000; // 15s to 30s
      const delay = Math.random() * 20000; // random staggered delay
      const left = Math.random() * screenWidth;
      
      return {
        id: i,
        size,
        color,
        anim,
        duration,
        delay,
        left,
      };
    });
  }, []);

  useEffect(() => {
    // Start Blob Animations
    startOscillation(blob1X, 30, 8000);
    startOscillation(blob1Y, 40, 10000);
    startScaleOscillation(blob1Scale, 1.0, 1.3, 12000);

    startOscillation(blob2X, 40, 9000);
    startOscillation(blob2Y, 30, 11000);
    startScaleOscillation(blob2Scale, 1.0, 1.2, 10000);

    startOscillation(blob3X, 20, 7000);
    startOscillation(blob3Y, 25, 9000);
    startScaleOscillation(blob3Scale, 1.0, 1.4, 14000);

    // Start Particle Animations
    particles.forEach((p) => {
      let initialDelay = p.delay;
      const runParticle = () => {
        p.anim.setValue(0);
        Animated.sequence([
          Animated.delay(initialDelay),
          Animated.timing(p.anim, {
            toValue: 1,
            duration: p.duration,
            useNativeDriver: false,
          })
        ]).start(({ finished }) => {
          if (finished) {
            initialDelay = 0; // No delay for subsequent loops
            runParticle();
          }
        });
      };
      runParticle();
    });
  }, []);

  // Generate repeating dot pattern (subtle mesh grid overlay)
  const gridDots = useMemo(() => {
    const dots = [];
    const cols = 12;
    const rows = 22;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dots.push(
          <View
            key={`dot-${r}-${c}`}
            style={{
              position: 'absolute',
              left: (screenWidth / cols) * c + (screenWidth / cols) / 2,
              top: (screenHeight / rows) * r + (screenHeight / rows) / 2,
              width: 2.5,
              height: 2.5,
              borderRadius: 1.25,
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
            }}
          />
        );
      }
    }
    return dots;
  }, []);

  return (
    <View style={styles.container}>
      {/* Layer 1: Base Background */}
      <View style={styles.baseBg} />

      {/* Layer 2: Liquid Blobs */}
      <Animated.View
        style={[
          styles.blob,
          styles.blobPurple,
          {
            transform: [
              { translateX: blob1X },
              { translateY: blob1Y },
              { scale: blob1Scale },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.blob,
          styles.blobPink,
          {
            transform: [
              { translateX: blob2X },
              { translateY: blob2Y },
              { scale: blob2Scale },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.blob,
          styles.blobCyan,
          {
            transform: [
              { translateX: blob3X },
              { translateY: blob3Y },
              { scale: blob3Scale },
            ],
          },
        ]}
      />

      {/* Layer 3: Particle Field */}
      {particles.map((p) => {
        const translateY = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [screenHeight + 10, -20],
        });
        const opacity = p.anim.interpolate({
          inputRange: [0, 0.15, 0.85, 1],
          outputRange: [0, 0.8, 0.8, 0],
        });

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.particle,
              {
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: p.color,
                left: p.left,
                transform: [{ translateY }],
                opacity,
              },
            ]}
          />
        );
      })}

      {/* Layer 4: Mesh Grid Overlay */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {gridDots}
      </View>

      {/* Main Content Overlay */}
      <View style={styles.contentContainer}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  baseBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#080810',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  blob: {
    position: 'absolute',
    opacity: 1,
  },
  blobPurple: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(124, 111, 255, 0.12)',
    top: -50,
    left: -80,
  },
  blobPink: {
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255, 107, 186, 0.08)',
    top: 200,
    right: -60,
  },
  blobCyan: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0, 212, 255, 0.06)',
    bottom: 100,
    left: 50,
  },
  particle: {
    position: 'absolute',
  },
});

export default GlobalBackground;
