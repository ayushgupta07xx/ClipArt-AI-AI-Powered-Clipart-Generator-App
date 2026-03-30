import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View, Text, Animated, Pressable, Image,
  StyleSheet, Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { StyleConfig, COLORS, STYLE_IMAGES } from '../constants';
import { router } from 'expo-router';
import { imageStore } from '../store/imageStore';
import { GenerationStatus } from '../hooks/useGeneration';
import { SkeletonCard } from './SkeletonCard';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { removeBg } from '../services/api';

interface Props {
  style: StyleConfig;
  status: GenerationStatus;
  outputUrl: string | null;
  error: string | null;
  onRetry: () => void;
  originalUri?: string;
  fromCache?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function useSpringPress() {
  const anim = useRef(new Animated.Value(1)).current;
  const onPressIn  = useCallback(() =>
    Animated.spring(anim, { toValue: 0.93, useNativeDriver: true }).start(), [anim]);
  const onPressOut = useCallback(() =>
    Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start(), [anim]);
  return { anim, onPressIn, onPressOut };
}

async function downloadToCache(outputUrl: string, styleId: string): Promise<string> {
  const fileName = `clipart_${styleId}_${Date.now()}.png`;
  const dest = `${FileSystem.cacheDirectory}${fileName}`;

  // If it's a base64 data URI (e.g. from remove.bg), write directly
  if (outputUrl.startsWith('data:')) {
    const base64 = outputUrl.split(',')[1];
    await FileSystem.writeAsStringAsync(dest, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return dest;
  }

  // Otherwise fetch from URL as normal
  const { uri } = await FileSystem.downloadAsync(outputUrl, dest);
  return uri;
}

// ────────────────────────────────────────────────────────────────────────────

export function StyleResultCard({ style, status, outputUrl, error, onRetry, originalUri, fromCache }: Props) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.97)).current;
  const breathAnim = useRef(new Animated.Value(1)).current;
  const [showSlider, setShowSlider] = useState(false);
  const [bgRemovedUrl, setBgRemovedUrl] = useState<string | null>(null);
  const [removingBg, setRemovingBg] = useState(false);
  const displayUrl = bgRemovedUrl ?? outputUrl;

  const savePress  = useSpringPress();
  const sharePress = useSpringPress();

  const isWaiting = status === 'idle' || status === 'waiting';
  const isLoading = status === 'starting' || status === 'processing';
  const isSuccess = status === 'succeeded';
  const isFailed  = status === 'failed' || status === 'canceled';

  // Breathing pulse while waiting
  useEffect(() => {
    if (!isWaiting) {
      breathAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1.18, duration: 900, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isWaiting, breathAnim]);

  const handleImageLoad = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 7, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const handleSave = useCallback(async () => {
    if (!displayUrl) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const uri = await downloadToCache(displayUrl, style.id);
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved! ✅', `${style.name} clipart saved to your gallery.`);
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    }
  }, [displayUrl, style.id, style.name]);

  const handleShare = useCallback(async () => {
    if (!displayUrl) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const uri = await downloadToCache(displayUrl, style.id);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Error', 'Sharing not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `Share your ${style.name} clipart`,
      });
    } catch {
      Alert.alert('Error', 'Failed to share. Please try again.');
    }
  }, [displayUrl, style.id, style.name]);

  const handleToggleSlider = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSlider(prev => !prev);
  }, []);

  const handleRemoveBg = useCallback(async () => {
    if (!outputUrl || removingBg) return;
    if (bgRemovedUrl) { setBgRemovedUrl(null); return; } // toggle off
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setRemovingBg(true);
      const url = await removeBg(outputUrl);
      setBgRemovedUrl(url);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('402')) {
        Alert.alert(
          '🪫 Free credits exhausted',
          'Your remove.bg free API credits have run out. Top up at remove.bg to continue using background removal.',
          [{ text: 'OK' }]
        );
      } else if (msg.includes('429') || msg.toLowerCase().includes('rate')) {
        Alert.alert('Too many requests', 'Background removal is busy. Wait a moment and try again.');
      } else {
        Alert.alert('Error', 'Background removal failed. Please try again.');
      }
    } finally {
      setRemovingBg(false);
    }
  }, [outputUrl, removingBg, bgRemovedUrl]);

  const handleCardTap = useCallback(() => {
    if (status !== 'succeeded' && status !== 'idle' && status !== 'waiting') return;
    const current = imageStore.get();
    if (!current) return;
    imageStore.set({ ...current, selectedStyleId: style.id });
    router.push('/single');
  }, [status, style.id]);

  return (
    <Pressable onPress={handleCardTap}>
    <View style={styles.card}>

      {/* Image zone */}
      <View style={styles.imageZone}>
        {isWaiting && (
          <View style={styles.waitingZone}>
            <Animated.Text style={[styles.waitingIcon, { transform: [{ scale: breathAnim }] }]}>
              ⏸️
            </Animated.Text>
            <Text style={styles.waitingText}>In queue…</Text>
          </View>
        )}

        {isLoading && (
          <SkeletonCard statusLabel={status === 'starting' ? '⏳ Starting…' : '🎨 Generating…'} />
        )}

        {isSuccess && displayUrl && (
          <View style={styles.imageWrapper}>
            {bgRemovedUrl && <View style={styles.checkerBg} />}
            <Animated.Image
              source={{ uri: displayUrl }}
              style={[styles.resultImage, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
              onLoad={handleImageLoad}
              resizeMode="cover"
            />
          </View>
        )}

        {isFailed && (
          <View style={styles.errorZone}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorMsg} numberOfLines={5}>{error ?? 'Generation failed'}</Text>
            <Pressable style={styles.retryBtn} onPress={onRetry}>
              <Text style={styles.retryText}>↺  Retry</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Label row */}
      <View style={styles.labelRow}>
        <Image
          source={STYLE_IMAGES[style.id]}
          style={styles.styleThumb}
          resizeMode="cover"
        />
        <View style={styles.nameCol}>
          <Text style={styles.styleName}>{style.name}</Text>
          <Text style={styles.styleDesc}>{style.description}</Text>
        </View>
        {isSuccess && (
          <View style={styles.checkBubble}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
        )}
        {isSuccess && fromCache && (
          <View style={styles.cacheBadge}>
            <Text style={styles.cacheBadgeText}>⚡ Cached</Text>
          </View>
        )}
        {isLoading && (
          <View style={styles.generatingBadge}>
            <Text style={styles.generatingText}>•••</Text>
          </View>
        )}
      </View>

      {/* Action buttons */}
      {isSuccess && (
        <>
          <View style={styles.actions}>
            <Pressable
              onPressIn={savePress.onPressIn}
              onPressOut={savePress.onPressOut}
              onPress={handleSave}
            >
              <Animated.View style={[styles.saveBtn, { transform: [{ scale: savePress.anim }] }]}>
                <Text style={styles.btnLabel}>⬇  Save</Text>
              </Animated.View>
            </Pressable>
            <Pressable
              onPressIn={sharePress.onPressIn}
              onPressOut={sharePress.onPressOut}
              onPress={handleShare}
            >
              <Animated.View style={[styles.shareBtn, { transform: [{ scale: sharePress.anim }] }]}>
                <Text style={styles.btnLabel}>↑  Share</Text>
              </Animated.View>
            </Pressable>
          </View>

          <Pressable
            style={[styles.removeBgBtn, bgRemovedUrl && styles.removeBgBtnActive]}
            onPress={handleRemoveBg}
            disabled={removingBg}
          >
            {removingBg ? (
              <Text style={styles.removeBgText}>⏳  Removing BG…</Text>
            ) : (
              <Text style={[styles.removeBgText, bgRemovedUrl && styles.removeBgTextActive]}>
                {bgRemovedUrl ? '✕  Restore Background' : '✂  Remove Background'}
              </Text>
            )}
          </Pressable>

          {originalUri && (
            <Pressable style={styles.sliderToggle} onPress={handleToggleSlider}>
              <Text style={styles.sliderToggleText}>
                {showSlider ? '✕  Hide comparison' : '⇄  Before / After'}
              </Text>
            </Pressable>
          )}
        </>
      )}

      {isSuccess && showSlider && outputUrl && originalUri && (
        <BeforeAfterSlider
          beforeUri={originalUri}
          afterUri={outputUrl}
          styleName={style.name}
          visible={showSlider}
          onClose={() => setShowSlider(false)}
        />
      )}
    </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#141414', borderRadius: 18,
    borderWidth: 1, borderColor: '#222222',
    padding: 10, overflow: 'hidden',
  },
  imageZone: {
    aspectRatio: 1, borderRadius: 11,
    overflow: 'hidden', backgroundColor: '#111111',
  },
  resultImage: { width: '100%', height: '100%' },
  waitingZone: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#0E0E0E',
  },
  waitingIcon: { fontSize: 26 },
  waitingText: { color: COLORS.textDisabled, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  errorZone:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  errorIcon:   { fontSize: 26, marginBottom: 6 },
  errorMsg:    { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', marginBottom: 12, lineHeight: 16 },
  retryBtn: {
    backgroundColor: COLORS.borderLight, borderRadius: 8,
    paddingHorizontal: 18, paddingVertical: 7,
    borderWidth: 1, borderColor: '#333',
  },
  retryText:    { color: '#D1D5DB', fontSize: 12, fontWeight: '600' },
  labelRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  styleThumb:   { width: 36, height: 36, borderRadius: 9, overflow: 'hidden' },
  nameCol:      { flex: 1 },
  styleName:    { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  styleDesc:    { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  checkBubble: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.successDim, alignItems: 'center', justifyContent: 'center',
  },
  checkMark:       { color: COLORS.success, fontSize: 12, fontWeight: '700' },
  generatingBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: '#1E1432', borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.accentBorder,
  },
  generatingText: { color: COLORS.accent, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  actions:        { flexDirection: 'row', gap: 7, marginTop: 9 },
  saveBtn: {
    flex: 1, backgroundColor: '#222222', borderRadius: 9,
    paddingVertical: 9, alignItems: 'center',
    borderWidth: 1, borderColor: '#2E2E2E',
  },
  shareBtn: {
    flex: 1, backgroundColor: COLORS.accentDim, borderRadius: 9,
    paddingVertical: 9, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.accentBorder,
  },
  btnLabel:     { color: '#E5E7EB', fontSize: 12, fontWeight: '600' },
  removeBgBtn: {
    marginTop: 7, backgroundColor: '#0E0E0E', borderRadius: 9,
    paddingVertical: 8, alignItems: 'center',
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  removeBgBtnActive: { borderColor: '#22C55E44', backgroundColor: '#16A34A11' },
  removeBgText:      { color: '#6B7280', fontSize: 12, fontWeight: '600' },
  removeBgTextActive:{ color: '#22C55E' },
  sliderToggle: {
    marginTop: 7, backgroundColor: '#0E0E0E', borderRadius: 9,
    paddingVertical: 8, alignItems: 'center',
    borderWidth: 1, borderColor: '#7C3AED33',
  },
  sliderToggleText: { color: COLORS.accent, fontSize: 12, fontWeight: '600' },
  cacheBadge: {
    backgroundColor: '#1C2A1C', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: '#22C55E44',
  },
  cacheBadgeText: { color: '#22C55E', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  imageWrapper: { width: '100%', height: '100%', position: 'relative' },
  checkerBg: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#2A2A2A',
    // Visual cue that bg is transparent — alternating slightly lighter squares
    opacity: 1,
  },
});
