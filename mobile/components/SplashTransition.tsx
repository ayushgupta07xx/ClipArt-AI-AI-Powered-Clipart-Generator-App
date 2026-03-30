import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, Image } from 'react-native';

let hasShownSplash = false;

interface Props {
  children: React.ReactNode;
}

export function SplashTransition({ children }: Props) {
  const [splashDone, setSplashDone] = useState(hasShownSplash);
  const contentOpacity = useRef(new Animated.Value(hasShownSplash ? 1 : 0)).current;
  const iconScale      = useRef(new Animated.Value(1)).current;
  const iconOpacity    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (hasShownSplash) return;

    const pause = setTimeout(() => {
      Animated.sequence([
        Animated.delay(350),
        Animated.parallel([
          Animated.timing(iconScale, {
            toValue: 18,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(iconOpacity, {
            toValue: 0,
            duration: 380,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        hasShownSplash = true;
        setSplashDone(true);
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
      });
    }, 80);

    return () => clearTimeout(pause);
  }, []);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
        {children}
      </Animated.View>

      {!splashDone && (
        <View style={styles.splash}>
          <Animated.View
            style={{
              transform: [{ scale: iconScale }],
              opacity: iconOpacity,
            }}
          >
            {/* Use the exact same icon.png as the launcher — pixel-perfect match */}
            <Image
              source={require('../assets/icon.png')}
              style={styles.icon}
              resizeMode="contain"
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0A0A0A' },
  content: { flex: 1 },
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 160,
    height: 160,
    borderRadius: 34,
    overflow: 'hidden',
  },
});
