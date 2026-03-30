import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Image, TouchableOpacity, Animated, Alert, ActivityIndicator, } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { imageStore } from '../store/imageStore';
import { STYLES, COLORS, StyleConfig, STYLE_IMAGES } from '../constants';
import { useGeneration } from '../hooks/useGeneration';
import { SkeletonCard } from '../components/SkeletonCard';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';
import { removeBg } from '../services/api';
import { getCached, setCached, makeCacheKey } from '../services/cache';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function downloadToCache(url: string, styleId: string): Promise<string> {
  const fileName = `clipart_${styleId}_${Date.now()}.png`;
  const dest = `${FileSystem.cacheDirectory}${fileName}`;
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1];
    await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
    return dest;
  }
  const { uri } = await FileSystem.downloadAsync(url, dest);
  return uri;
}

// ────────────────────────────────────────────────────────────────────────────

export default function SingleScreen() {
  const stored = imageStore.get();
  const styleId = stored?.selectedStyleId;
  const style: StyleConfig | undefined = STYLES.find(s => s.id === styleId);

  const [removedBgUrl, setRemovedBgUrl] = useState<string | null>(null);
  const [removingBg, setRemovingBg] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [cachedUrl, setCachedUrlState] = useState<string | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  const options = {
    promptSuffix: stored?.promptSuffix ?? '',
    strengthRatio: stored?.strengthRatio ?? 20,
  };

  const gen = useGeneration(
    stored?.base64 ?? null,
    styleId ?? 'cartoon',
    stored?.mimeType ?? 'image/jpeg',
    true,
    options,
  );

  useEffect(() => {
    if (!stored || !style) { router.replace('/'); return; }

    // Check cache on mount
    if (stored.base64) {
      const key = makeCacheKey(
        stored.base64,
        styleId ?? '',
        stored.strengthRatio ?? 20,
        stored.promptSuffix ?? '',
      );
      getCached(key).then(url => {
        if (url) { setCachedUrlState(url); setFromCache(true); }
      });
    }
  }, []);

  // Save to cache when generation succeeds
  useEffect(() => {
    if (gen.status === 'succeeded' && gen.outputUrl && stored?.base64) {
      const key = makeCacheKey(
        stored.base64,
        styleId ?? '',
        stored.strengthRatio ?? 20,
        stored.promptSuffix ?? '',
      );
      setCached(key, gen.outputUrl);
    }
  }, [gen.status, gen.outputUrl]);

  // Image reveal animation
  useEffect(() => {
    if (gen.status === 'succeeded' || cachedUrl) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [gen.status, cachedUrl]);

  // Progress bar animation while generating
  useEffect(() => {
    if (gen.status === 'starting') {
      Animated.timing(progressAnim, { toValue: 15, duration: 800, useNativeDriver: false }).start();
    } else if (gen.status === 'processing') {
      Animated.timing(progressAnim, { toValue: 70, duration: 30000, useNativeDriver: false }).start();
    } else if (gen.status === 'succeeded') {
      Animated.timing(progressAnim, { toValue: 100, duration: 400, useNativeDriver: false }).start();
    }
  }, [gen.status]);

  const activeUrl = removedBgUrl ?? cachedUrl ?? gen.outputUrl;
  const isLoading = !cachedUrl && (gen.status === 'starting' || gen.status === 'processing');
  const isSuccess = gen.status === 'succeeded' || !!cachedUrl;
  const isFailed = !gen.noFace && (gen.status === 'failed' || gen.status === 'canceled');

  const handleRemoveBg = useCallback(async () => {
    if (!gen.outputUrl && !cachedUrl) return;
    if (removedBgUrl) { setRemovedBgUrl(null); return; }
    try {
      setRemovingBg(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const url = await removeBg((cachedUrl ?? gen.outputUrl)!);
      setRemovedBgUrl(url);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('402')) {
        Alert.alert(
          '🪫 Free credits exhausted',
          'Your remove.bg free API credits have run out. Top up at remove.bg to continue using background removal.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Background removal failed. Please try again.');
      }
    } finally {
      setRemovingBg(false);
    }
  }, [gen.outputUrl, cachedUrl, removedBgUrl]);

  const handleSave = useCallback(async () => {
    if (!activeUrl) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const uri = await downloadToCache(activeUrl, styleId ?? 'clipart');
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved! ✅', `${style?.name} clipart saved to your gallery.`);
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    }
  }, [activeUrl, styleId, style]);

  const handleShare = useCallback(async () => {
    if (!activeUrl) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const uri = await downloadToCache(activeUrl, styleId ?? 'clipart');
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) { Alert.alert('Error', 'Sharing not available.'); return; }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `Share your ${style?.name} clipart`,
      });
    } catch {
      Alert.alert('Error', 'Failed to share. Please try again.');
    }
  }, [activeUrl, styleId, style]);

  if (!stored || !style) return null;

  if (gen.noFace) {
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Style header ──────────────────────────────── */}
        <View style={styles.styleHeader}>
          <Image
            source={STYLE_IMAGES[style.id]}
            style={styles.styleThumb}
            resizeMode="cover"
          />
          <View>
            <Text style={styles.styleName}>{style.name}</Text>
            <Text style={styles.styleDesc}>{style.description}</Text>
          </View>
          {fromCache && (
            <View style={styles.cacheBadge}>
              <Text style={styles.cacheBadgeText}>⚡ Cached</Text>
            </View>
          )}
        </View>

        {/* ── Prompt + settings display ─────────────────── */}
        {(stored.promptSuffix || stored.strengthRatio !== 20) && (
          <View style={styles.settingsCard}>
            {stored.promptSuffix ? (
              <View style={styles.settingsRow}>
                <Text style={styles.settingsLabel}>Prompt</Text>
                <Text style={styles.settingsValue} numberOfLines={2}>"{stored.promptSuffix}"</Text>
              </View>
            ) : null}
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Intensity</Text>
              <View style={styles.intensityBar}>
                <View style={[styles.intensityFill, {
                  width: `${((stored.strengthRatio - 10) / 70) * 100}%`,
                }]} />
              </View>
              <Text style={styles.intensityValue}>{stored.strengthRatio}</Text>
            </View>
          </View>
        )}

        {/* ── Progress bar while generating ────────────── */}
        {isLoading && (
          <View style={styles.progressWrap}>
            <View style={styles.progressBg}>
              <Animated.View style={[styles.progressFill, {
                width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
              }]} />
            </View>
            <Text style={styles.progressLabel}>
              {gen.status === 'starting' ? '⏳ Starting generation…' : '🎨 Generating your clipart…'}
            </Text>
          </View>
        )}

        {/* ── Main image area ───────────────────────────── */}
        <View style={styles.imageContainer}>
          {isLoading && <SkeletonCard statusLabel={gen.status === 'starting' ? '⏳ Starting…' : '🎨 Generating…'} />}

          {isSuccess && activeUrl && (
            <Animated.Image
              source={{ uri: activeUrl }}
              style={[styles.resultImage, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
              resizeMode="cover"
            />
          )}

          {isFailed && (
            <View style={styles.errorZone}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorMsg} numberOfLines={6}>{gen.error ?? 'Generation failed'}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={gen.retry} activeOpacity={0.8}>
                <Text style={styles.retryText}>↺  Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Action buttons ────────────────────────────── */}
        {isSuccess && (
          <>
            {/* Remove BG */}
            <TouchableOpacity
              style={[styles.removeBgBtn, removedBgUrl && styles.removeBgBtnActive]}
              onPress={removedBgUrl ? () => setRemovedBgUrl(null) : handleRemoveBg}
              disabled={removingBg}
              activeOpacity={0.8}
            >
              {removingBg ? (
                <ActivityIndicator color={COLORS.accent} size="small" />
              ) : (
                <Text style={styles.removeBgText}>
                  {removedBgUrl ? '↩  Restore background' : '✂️  Remove background'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Save + Share */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                <Text style={styles.btnLabel}>⬇  Save to Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
                <Text style={styles.btnLabel}>↑  Share</Text>
              </TouchableOpacity>
            </View>

            {/* Before / After */}
            {stored.uri && (
              <TouchableOpacity
                style={styles.sliderToggle}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowSlider(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.sliderToggleText}>⇄  Before / After comparison</Text>
              </TouchableOpacity>
            )}

            {/* Generate another style */}
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.back(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.backBtnText}>← Try another style</Text>
            </TouchableOpacity>
          </>
        )}

      </ScrollView>

      {/* Before/After modal */}
      {isSuccess && activeUrl && stored.uri && (
        <BeforeAfterSlider
          beforeUri={stored.uri}
          afterUri={activeUrl}
          styleName={style.name}
          visible={showSlider}
          onClose={() => setShowSlider(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 80, paddingBottom: 40 },

  styleHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  styleThumb: { width: 52, height: 52, borderRadius: 14, overflow: 'hidden' },
  styleName: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  styleDesc: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  cacheBadge: {
    marginLeft: 'auto', backgroundColor: '#1A2E1A',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#22C55E44',
  },
  cacheBadgeText: { color: COLORS.success, fontSize: 11, fontWeight: '700' },

  settingsCard: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 14, gap: 10,
  },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingsLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600', width: 60 },
  settingsValue: { color: COLORS.textSecondary, fontSize: 12, flex: 1, fontStyle: 'italic' },
  intensityBar: { flex: 1, height: 5, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  intensityFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 3 },
  intensityValue: { color: COLORS.accent, fontSize: 13, fontWeight: '800', minWidth: 28, textAlign: 'right' },

  progressWrap: { marginBottom: 14 },
  progressBg: { height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 2 },
  progressLabel: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center' },

  imageContainer: {
    width: '100%', aspectRatio: 1,
    borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#111', marginBottom: 16,
  },
  resultImage: { width: '100%', height: '100%' },
  errorZone: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorIcon: { fontSize: 32, marginBottom: 12 },
  errorMsg: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  retryBtn: {
    backgroundColor: COLORS.borderLight, borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  retryText: { color: '#D1D5DB', fontSize: 14, fontWeight: '600' },

  removeBgBtn: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 10, minHeight: 48, justifyContent: 'center',
  },
  removeBgBtnActive: { borderColor: COLORS.accent + '55', backgroundColor: '#1A0F2E' },
  removeBgText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },

  actions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  saveBtn: {
    flex: 1, backgroundColor: '#222', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#2E2E2E',
  },
  shareBtn: {
    flex: 1, backgroundColor: COLORS.accentDim, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.accentBorder,
  },
  btnLabel: { color: '#E5E7EB', fontSize: 14, fontWeight: '600' },

  sliderToggle: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.accentBorder,
    marginBottom: 10,
  },
  sliderToggleText: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },

  backBtn: {
    paddingVertical: 13, alignItems: 'center',
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  backBtnText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },

  noFaceContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 16,
  },
  noFaceEmoji: { fontSize: 56 },
  noFaceTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  noFaceSub: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  noFaceBtn: {
    marginTop: 8, backgroundColor: COLORS.accent, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32,
  },
  noFaceBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
