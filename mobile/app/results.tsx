import React, { useEffect, useRef } from 'react';
import {
  View, Text, Image, StyleSheet, SafeAreaView,
  ScrollView, Dimensions, TouchableOpacity, Animated,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { imageStore } from '../store/imageStore';
import { STYLES } from '../constants';
import { useGeneration } from '../hooks/useGeneration';
import { StyleResultCard } from '../components/StyleResultCard';

const { width } = Dimensions.get('window');
const GUTTER = 12;
const CARD_W = (width - 40 - GUTTER) / 2;

function isDone(status: string) {
  return status === 'succeeded' || status === 'failed' || status === 'canceled';
}

export default function ResultsScreen() {
  const stored = imageStore.get();

  // Pass promptSuffix and strengthRatio through to every generation
  const options = {
    promptSuffix:  stored?.promptSuffix  ?? '',
    strengthRatio: stored?.strengthRatio ?? 20,
  };

  const cartoonGen = useGeneration(stored?.base64 ?? null, STYLES[0].id, stored?.mimeType ?? 'image/jpeg', true, options);
  const flatGen    = useGeneration(stored?.base64 ?? null, STYLES[1].id, stored?.mimeType ?? 'image/jpeg', isDone(cartoonGen.status), options);
  const animeGen   = useGeneration(stored?.base64 ?? null, STYLES[2].id, stored?.mimeType ?? 'image/jpeg', isDone(flatGen.status), options);
  const pixelGen   = useGeneration(stored?.base64 ?? null, STYLES[3].id, stored?.mimeType ?? 'image/jpeg', isDone(animeGen.status), options);
  const sketchGen  = useGeneration(stored?.base64 ?? null, STYLES[4].id, stored?.mimeType ?? 'image/jpeg', isDone(pixelGen.status), options);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const glowAnim     = useRef(new Animated.Value(0.5)).current;
  const cardAnims    = useRef(STYLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!stored) router.replace('/');
    Animated.stagger(70, cardAnims.map(anim =>
      Animated.spring(anim, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true })
    )).start();
  }, []);

  const generations    = [cartoonGen, flatGen, animeGen, pixelGen, sketchGen];
  const completedCount = generations.filter(g => g.status === 'succeeded').length;
  const allDone        = completedCount === STYLES.length;
  const progressPercent = (completedCount / STYLES.length) * 100;
  const noFaceDetected = generations.some(g => g.noFace);

  const prevCompleted = useRef(0);
  useEffect(() => {
    if (completedCount > prevCompleted.current) {
      Haptics.notificationAsync(
        allDone ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
      );
      prevCompleted.current = completedCount;
    }
  }, [completedCount]);

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progressPercent, duration: 700, useNativeDriver: false }).start();
  }, [progressPercent]);

  useEffect(() => {
    if (allDone) { glowAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 900, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.5, duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [allDone]);

  if (!stored) return null;

  // No face detected — show a friendly full-screen prompt
  if (noFaceDetected) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.noFaceContainer}>
          <Text style={styles.noFaceEmoji}>🙅</Text>
          <Text style={styles.noFaceTitle}>No face detected</Text>
          <Text style={styles.noFaceSub}>
            This photo doesn't have a clearly visible face.{'\n'}
            Please try a well-lit, front-facing photo.
          </Text>
          <TouchableOpacity
            style={styles.noFaceBtn}
            onPress={() => { imageStore.clear(); router.replace('/'); }}
            activeOpacity={0.8}
          >
            <Text style={styles.noFaceBtnText}>← Try another photo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const cardEntrance = (i: number) => ({
    opacity: cardAnims[i],
    transform: [{
      translateY: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [28, 0] }),
    }],
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Progress card ───────────────────────────── */}
        <View style={styles.progressCard}>
          <Image source={{ uri: stored.uri }} style={styles.thumb} />
          <View style={styles.progressRight}>
            <Text style={styles.progressTitle} numberOfLines={1}>
              {allDone ? '🎉 All styles ready!' : `Generating… ${completedCount} / ${STYLES.length}`}
            </Text>
            <Text style={styles.progressSub}>
              {allDone ? 'Tap any card to save or share' : stored.promptSuffix ? `"${stored.promptSuffix}"` : ''}
            </Text>
            <View style={styles.barBg}>
              <Animated.View
                style={[styles.barFill, {
                  width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
                  shadowOpacity: glowAnim,
                }]}
              />
            </View>
            <View style={styles.dotsRow}>
              {STYLES.map((s, i) => {
                const g = generations[i];
                return (
                  <View key={s.id} style={[
                    styles.dot,
                    g.status === 'succeeded' && styles.dotDone,
                    (g.status === 'starting' || g.status === 'processing') && styles.dotActive,
                  ]} />
                );
              })}
            </View>
          </View>
        </View>

        {/* ── 2-col grid ──────────────────────────────── */}
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            {([0, 1] as const).map(i => (
              <Animated.View key={STYLES[i].id} style={[styles.gridItem, cardEntrance(i)]}>
                <StyleResultCard
                  style={STYLES[i]} status={generations[i].status}
                  outputUrl={generations[i].outputUrl} error={generations[i].error}
                  onRetry={generations[i].retry} originalUri={stored.uri} fromCache={generations[i].fromCache}
                />
              </Animated.View>
            ))}
          </View>
          <View style={styles.gridRow}>
            {([2, 3] as const).map(i => (
              <Animated.View key={STYLES[i].id} style={[styles.gridItem, cardEntrance(i)]}>
                <StyleResultCard
                  style={STYLES[i]} status={generations[i].status}
                  outputUrl={generations[i].outputUrl} error={generations[i].error}
                  onRetry={generations[i].retry} originalUri={stored.uri} fromCache={generations[i].fromCache}
                />
              </Animated.View>
            ))}
          </View>
          <Animated.View style={cardEntrance(4)}>
            <StyleResultCard
              style={STYLES[4]} status={sketchGen.status}
              outputUrl={sketchGen.outputUrl} error={sketchGen.error}
              onRetry={sketchGen.retry} originalUri={stored.uri} fromCache={sketchGen.fromCache}
            />
          </Animated.View>
        </View>

        {allDone && (
          <TouchableOpacity
            style={styles.startOverBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              imageStore.clear();
              router.back();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.startOverText}>↩  Generate Another Photo</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#0A0A0A' },
  scroll: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 48 },

  progressCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111111', borderRadius: 18, padding: 14,
    marginBottom: 18, borderWidth: 1, borderColor: '#1E1E1E', gap: 14,
  },
  thumb:         { width: 64, height: 64, borderRadius: 14, backgroundColor: '#242424' },
  progressRight: { flex: 1 },
  progressTitle: { color: '#F9FAFB', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  progressSub:   { color: '#4B5563', fontSize: 12, marginBottom: 10 },
  barBg: { height: 5, backgroundColor: '#1E1E1E', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  barFill: {
    height: '100%', backgroundColor: '#7C3AED', borderRadius: 3,
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 0 }, shadowRadius: 6,
  },
  dotsRow:   { flexDirection: 'row', gap: 5 },
  dot:       { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#2A2A2A' },
  dotDone:   { backgroundColor: '#7C3AED' },
  dotActive: { backgroundColor: '#A78BFA' },

  grid:        { gap: GUTTER },
  gridRow:     { flexDirection: 'row', gap: GUTTER },
  gridItem:    { width: CARD_W },

  startOverBtn: {
    marginTop: 8, backgroundColor: '#111111', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
    borderWidth: 1, borderColor: '#1E1E1E',
  },
  startOverText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },

  noFaceContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 16,
  },
  noFaceEmoji: { fontSize: 56 },
  noFaceTitle: { color: '#F9FAFB', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  noFaceSub:   { color: '#4B5563', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  noFaceBtn: {
    marginTop: 8, backgroundColor: '#7C3AED', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32,
  },
  noFaceBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
