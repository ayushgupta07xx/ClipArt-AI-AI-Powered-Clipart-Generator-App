import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Text, Easing } from 'react-native';

interface Props {
  statusLabel?: string;
}

const SHIMMER_DURATION = 1400;
const SHIMMER_WIDTH    = 80;

export function SkeletonCard({ statusLabel }: Props) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: SHIMMER_DURATION,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [-160, 320],
  });

  const translateXNarrow = shimmerAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [-80, 200],
  });

  return (
    <View style={styles.root}>
      <View style={styles.imagePlaceholder}>
        <Animated.View style={[styles.shimmerStripe, { transform: [{ translateX }] }]} />
      </View>
      <View style={styles.textBlock}>
        <View style={styles.lineWide}>
          <Animated.View style={[styles.shimmerStripe, { transform: [{ translateX }] }]} />
        </View>
        <View style={styles.lineNarrow}>
          <Animated.View style={[styles.shimmerStripe, { transform: [{ translateX: translateXNarrow }] }]} />
        </View>
      </View>
      {statusLabel && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:             { flex: 1 },
  imagePlaceholder: { width: '100%', aspectRatio: 1, backgroundColor: '#1E1E1E', borderRadius: 10, overflow: 'hidden' },
  shimmerStripe: {
    position: 'absolute', top: 0, bottom: 0,
    width: SHIMMER_WIDTH,
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ skewX: '-15deg' }],
  },
  textBlock:   { paddingTop: 10, gap: 6 },
  lineWide:    { height: 12, width: '68%', backgroundColor: '#1E1E1E', borderRadius: 4, overflow: 'hidden' },
  lineNarrow:  { height: 10, width: '44%', backgroundColor: '#1E1E1E', borderRadius: 4, overflow: 'hidden' },
  statusBadge: {
    position: 'absolute', bottom: 42, left: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 8,
    paddingVertical: 5, paddingHorizontal: 8, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)',
  },
  statusText: { color: '#A78BFA', fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
});
