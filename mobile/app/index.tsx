import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  SafeAreaView, Alert, Dimensions, ScrollView,
  ActivityIndicator, Animated, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { imageStore } from '../store/imageStore';
import { STYLES, STYLE_IMAGES } from '../constants';
import { SplashTransition } from '../components/SplashTransition';

const { width } = Dimensions.get('window');
const PREVIEW_SIZE = width - 48;
const MIN_STRENGTH = 10;
const MAX_STRENGTH = 80;
const STRENGTH_STEP = 5;
const DEFAULT_STRENGTH = 20;

export default function HomeScreen() {
  const [pickedImage, setPickedImage] = useState<{
    uri: string; base64: string; mimeType: string;
  } | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [promptSuffix, setPromptSuffix] = useState('');
  const [strengthRatio, setStrengthRatio] = useState(DEFAULT_STRENGTH);

  const advancedOpacity = useRef(new Animated.Value(0)).current;
  const btnPulse = useRef(new Animated.Value(1)).current;
  const btnPulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const headerY = useRef(new Animated.Value(-12)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  // Header entrance
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(headerY, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (pickedImage) {
      btnPulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(btnPulse, { toValue: 1.025, duration: 700, useNativeDriver: true }),
          Animated.timing(btnPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      btnPulseLoop.current.start();
    } else {
      btnPulseLoop.current?.stop();
      btnPulse.setValue(1);
      setShowAdvanced(false);
      advancedOpacity.setValue(0);
    }
    return () => btnPulseLoop.current?.stop();
  }, [!!pickedImage]);

  const toggleAdvanced = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAdvanced(prev => {
      const next = !prev;
      Animated.timing(advancedOpacity, { toValue: next ? 1 : 0, duration: 220, useNativeDriver: true }).start();
      return next;
    });
  }, []);

  const adjustStrength = useCallback((delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStrengthRatio(prev => Math.min(MAX_STRENGTH, Math.max(MIN_STRENGTH, prev + delta)));
  }, []);

  const processAndStore = useCallback(async (uri: string) => {
    setCompressing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 512, height: 512 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!result.base64) throw new Error('base64 encoding failed');
      setPickedImage({ uri: result.uri, base64: result.base64, mimeType: 'image/jpeg' });
    } catch {
      Alert.alert('Error', 'Could not process the image. Please try a different photo.');
    } finally {
      setCompressing(false);
    }
  }, []);

  const pickFromGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Gallery access is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      allowsEditing: true, aspect: [1, 1], quality: 1,
    });
    if (!result.canceled && result.assets[0]) await processAndStore(result.assets[0].uri);
  }, [processAndStore]);

  const pickFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access is required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (!result.canceled && result.assets[0]) await processAndStore(result.assets[0].uri);
  }, [processAndStore]);

  const handleGenerateSingle = useCallback((styleId: string) => {
    if (!pickedImage) { Alert.alert("Select a photo first", "Pick a photo above before generating."); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    imageStore.set({
      base64: pickedImage.base64, mimeType: pickedImage.mimeType, uri: pickedImage.uri,
      promptSuffix: promptSuffix.trim(), strengthRatio,
      selectedStyleId: styleId as any,
    });
    router.push("/single");
  }, [pickedImage, promptSuffix, strengthRatio]);

  const handleGenerate = useCallback(() => {
    if (!pickedImage) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    imageStore.set({
      base64: pickedImage.base64, mimeType: pickedImage.mimeType, uri: pickedImage.uri,
      promptSuffix: promptSuffix.trim(), strengthRatio,
    });
    router.push('/results');
  }, [pickedImage, promptSuffix, strengthRatio]);

  const strengthFill = (strengthRatio - MIN_STRENGTH) / (MAX_STRENGTH - MIN_STRENGTH);
  const mappedStrength = Math.round(15 + ((strengthRatio - MIN_STRENGTH) / (MAX_STRENGTH - MIN_STRENGTH)) * 35);

  return (
    <SplashTransition>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Hero Header ─────────────────────────────── */}
          <Animated.View style={[styles.hero, { opacity: headerOpacity, transform: [{ translateY: headerY }] }]}>
            {/* Decorative glow blob */}
            <View style={styles.glowBlob} />
            <View style={styles.heroContent}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>AI POWERED · 5 STYLES</Text>
              </View>
              <View style={styles.heroTitleRow}>
                <Text style={styles.heroTitleWhite}>ClipArt</Text>
                <View style={styles.heroTitleSpacer} />
                <View style={styles.heroAIBadge}>
                  <Text style={styles.heroAIText}>AI</Text>
                </View>
              </View>
              <Text style={styles.heroSub}>
                Drop a face photo.{'\n'}Get 5 art styles in seconds.
              </Text>
            </View>
          </Animated.View>

          {/* ── Upload / Preview ────────────────────────── */}
          {compressing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#7C3AED" size="large" />
              <Text style={styles.loadingLabel}>Processing image…</Text>
            </View>
          ) : pickedImage ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: pickedImage.uri }} style={styles.preview} />
              {/* Corner badge */}
              <View style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}>Ready</Text>
              </View>
              <TouchableOpacity style={styles.changeBtn} onPress={() => setPickedImage(null)} activeOpacity={0.8}>
                <Text style={styles.changeBtnText}>✕  Change photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.uploadZone}>
              {/* Dotted corner accents */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <View style={styles.uploadInner}>
                <View style={styles.uploadIconWrap}>
                  <Text style={styles.uploadEmoji}>🖼️</Text>
                </View>
                <Text style={styles.uploadTitle}>Select your photo</Text>
                <Text style={styles.uploadHint}>Works best with clear, well-lit face photos</Text>
                <View style={styles.uploadRow}>
                  <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery} activeOpacity={0.8}>
                    <Text style={styles.galleryBtnText}>📁  Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cameraBtn} onPress={pickFromCamera} activeOpacity={0.8}>
                    <Text style={styles.cameraBtnText}>📷  Camera</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ── Styles Grid ─────────────────────────────── */}
          <View style={styles.stylesSection}>
            <View style={styles.stylesSectionHeader}>
              <View style={styles.sectionLabelLine} />
              <Text style={styles.stylesSectionTitle}>STYLES</Text>
              <View style={styles.sectionLabelLine} />
            </View>
            <View style={styles.stylesGrid}>
              {STYLES.map((s, i) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.styleChip,
                    i === STYLES.length - 1 && STYLES.length % 2 !== 0 && styles.styleChipLast,
                  ]}
                  onPress={() => handleGenerateSingle(s.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.styleChipAccent, { backgroundColor: s.color }]} />
                  <Image
                    source={STYLE_IMAGES[s.id]}
                    style={styles.styleChipImage}
                    resizeMode="cover"
                  />
                  <View style={styles.styleChipText}>
                    <Text style={styles.styleChipName}>{s.name}</Text>
                    <Text style={styles.styleChipDesc}>{s.description}</Text>
                  </View>
                  <View style={styles.styleChipArrow}>
                    <Text style={styles.styleChipArrowText}>›</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Advanced options ────────────────────────── */}
          {pickedImage && (
            <View style={styles.advancedSection}>
              <TouchableOpacity style={styles.advancedToggle} onPress={toggleAdvanced} activeOpacity={0.75}>
                <Text style={styles.advancedToggleLabel}>⚙️  Advanced options</Text>
                <Text style={styles.advancedChevron}>{showAdvanced ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showAdvanced && (
                <Animated.View style={[styles.advancedPanel, { opacity: advancedOpacity }]}>
                  <View style={styles.advancedRow}>
                    <View style={styles.advancedLabelCol}>
                      <Text style={styles.advancedLabel}>Style intensity</Text>
                      <Text style={styles.advancedHint}>Model value: {mappedStrength} / 50</Text>
                    </View>
                    <Text style={styles.strengthValue}>{strengthRatio}</Text>
                  </View>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={[styles.stepBtn, strengthRatio <= MIN_STRENGTH && styles.stepBtnDisabled]}
                      onPress={() => adjustStrength(-STRENGTH_STEP)}
                      disabled={strengthRatio <= MIN_STRENGTH} activeOpacity={0.7}
                    >
                      <Text style={styles.stepBtnText}>−</Text>
                    </TouchableOpacity>
                    <View style={styles.strengthTrack}>
                      <View style={[styles.strengthFill, { width: `${strengthFill * 100}%` }]} />
                    </View>
                    <TouchableOpacity
                      style={[styles.stepBtn, strengthRatio >= MAX_STRENGTH && styles.stepBtnDisabled]}
                      onPress={() => adjustStrength(STRENGTH_STEP)}
                      disabled={strengthRatio >= MAX_STRENGTH} activeOpacity={0.7}
                    >
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.divider} />
                  <Text style={styles.advancedLabel}>Style detail</Text>
                  <Text style={styles.advancedHint}>Influences lighting, mood & texture — not accessories or expressions</Text>
                  <TextInput
                    style={styles.promptInput}
                    value={promptSuffix}
                    onChangeText={setPromptSuffix}
                    placeholder="e.g. soft lighting, dark background, watercolor wash"
                    placeholderTextColor="#3D4451"
                    maxLength={120}
                    returnKeyType="done"
                    autoCorrect={false}
                  />
                  <Text style={styles.charCount}>{promptSuffix.length} / 120</Text>
                </Animated.View>
              )}
            </View>
          )}
        </ScrollView>

        {/* ── Generate button ──────────────────────────── */}
        <View style={styles.footer}>
          <Animated.View style={{ transform: [{ scale: btnPulse }] }}>
            <TouchableOpacity
              style={[styles.generateBtn, !pickedImage && styles.generateBtnDisabled]}
              onPress={handleGenerate}
              disabled={!pickedImage || compressing}
              activeOpacity={0.85}
            >
              {pickedImage ? (
                <View style={styles.generateBtnInner}>
                  <Text style={styles.generateBtnText}>✨  Generate All 5 Styles</Text>
                  <View style={styles.generateArrow}>
                    <Text style={styles.generateArrowText}>→</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.generateBtnTextMuted}>Select a photo to continue</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    </SplashTransition>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0A' },
  scroll: { paddingHorizontal: 20, paddingBottom: 130 },

  // ── Hero ────────────────────────────────────────────
  hero: { paddingTop: 52, paddingBottom: 32, position: 'relative' },
  glowBlob: {
    position: 'absolute', top: 30, left: '20%',
    width: 220, height: 120,
    backgroundColor: '#7C3AED',
    borderRadius: 110,
    opacity: 0.08,
    transform: [{ scaleX: 2 }],
  },
  heroContent: { gap: 10 },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#7C3AED18',
    borderWidth: 1, borderColor: '#7C3AED44',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  heroBadgeText: { color: '#A78BFA', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  heroTitleWhite: { fontSize: 46, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1.5 },
  heroTitleAccent: { fontSize: 46, fontWeight: '900', color: '#7C3AED', letterSpacing: -1.5 },
  heroTitleSpacer: { width: 6 },
  heroAIBadge: {
    backgroundColor: '#7C3AED',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
    marginTop: 4,
  },
  heroAIText: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  heroSub: { fontSize: 15, color: '#4B5563', lineHeight: 22, marginTop: 2 },

  // ── Upload ──────────────────────────────────────────
  uploadZone: {
    borderRadius: 24, borderWidth: 1, borderColor: '#222',
    borderStyle: 'dashed', backgroundColor: '#0D0D0D',
    overflow: 'hidden', position: 'relative',
  },
  corner: {
    position: 'absolute', width: 16, height: 16,
    borderColor: '#7C3AED66',
  },
  cornerTL: { top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
  cornerTR: { top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 },
  cornerBL: { bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 },
  uploadInner: { paddingVertical: 44, paddingHorizontal: 24, alignItems: 'center' },
  uploadIconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: '#161616', borderWidth: 1, borderColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  uploadEmoji: { fontSize: 34 },
  uploadTitle: { fontSize: 18, fontWeight: '700', color: '#F3F4F6', marginBottom: 6 },
  uploadHint: { fontSize: 13, color: '#4B5563', marginBottom: 28, textAlign: 'center' },
  uploadRow: { flexDirection: 'row', gap: 12 },
  galleryBtn: {
    backgroundColor: '#161E2E', borderWidth: 1, borderColor: '#2E3A4E',
    borderRadius: 14, paddingHorizontal: 22, paddingVertical: 14,
  },
  galleryBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  cameraBtn: {
    backgroundColor: '#7C3AED', borderRadius: 14,
    paddingHorizontal: 22, paddingVertical: 14,
  },
  cameraBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

  loadingBox: { height: 260, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingLabel: { color: '#6B7280', fontSize: 14 },

  // ── Preview ─────────────────────────────────────────
  previewWrap: { alignItems: 'center', gap: 14 },
  preview: { width: PREVIEW_SIZE, height: PREVIEW_SIZE, borderRadius: 24, backgroundColor: '#141414' },
  previewBadge: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: '#16A34A', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  previewBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  changeBtn: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10,
    backgroundColor: '#181818', borderWidth: 1, borderColor: '#2A2A2A',
  },
  changeBtnText: { color: '#9CA3AF', fontWeight: '600', fontSize: 13 },

  // ── Styles Grid ─────────────────────────────────────
  stylesSection: { marginTop: 32 },
  stylesSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
  },
  sectionLabelLine: { flex: 1, height: 1, backgroundColor: '#1E1E1E' },
  stylesSectionTitle: { fontSize: 11, color: '#3D4451', letterSpacing: 2, fontWeight: '700' },
  stylesGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  styleChip: {
    width: (width - 50) / 2,
    backgroundColor: '#111111',
    borderRadius: 16, borderWidth: 1, borderColor: '#1E1E1E',
    padding: 14, flexDirection: 'row', alignItems: 'center',
    gap: 12, overflow: 'hidden', position: 'relative',
  },
  styleChipLast: { alignSelf: 'center' },
  styleChipAccent: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2,
  },
  styleChipImage: {
    width: 44, height: 44, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
  },
  styleChipText: { flex: 1 },
  styleChipName: { color: '#F3F4F6', fontSize: 13, fontWeight: '700' },
  styleChipDesc: { color: '#4B5563', fontSize: 11, marginTop: 2 },
  styleChipArrow: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center',
    marginLeft: 'auto',
  },
  styleChipArrowText: { color: '#4B5563', fontSize: 16, fontWeight: '700' },
  styleChipDot: {
    width: 6, height: 6, borderRadius: 3, position: 'absolute', top: 10, right: 10,
  },

  // ── Advanced ────────────────────────────────────────
  advancedSection: { marginTop: 20 },
  advancedToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#111111', borderRadius: 14, borderWidth: 1, borderColor: '#1E1E1E',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  advancedToggleLabel: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
  advancedChevron: { color: '#4B5563', fontSize: 11 },
  advancedPanel: {
    backgroundColor: '#0F0F0F', borderRadius: 14, borderWidth: 1, borderColor: '#1E1E1E',
    padding: 16, marginTop: 6, gap: 6,
  },
  advancedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  advancedLabelCol: { flex: 1, marginRight: 12 },
  advancedLabel: { color: '#D1D5DB', fontSize: 13, fontWeight: '600' },
  advancedHint: { color: '#4B5563', fontSize: 11, marginTop: 2 },
  strengthValue: { color: '#7C3AED', fontSize: 18, fontWeight: '800', minWidth: 32, textAlign: 'right' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  stepBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2E2E2E',
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.3 },
  stepBtnText: { color: '#E5E7EB', fontSize: 18, fontWeight: '600', lineHeight: 22 },
  strengthTrack: { flex: 1, height: 6, backgroundColor: '#1E1E1E', borderRadius: 3, overflow: 'hidden' },
  strengthFill: { height: '100%', backgroundColor: '#7C3AED', borderRadius: 3 },
  divider: { height: 1, backgroundColor: '#1A1A1A', marginVertical: 8 },
  promptInput: {
    backgroundColor: '#141414', borderRadius: 10, borderWidth: 1, borderColor: '#242424',
    color: '#F3F4F6', fontSize: 13, paddingHorizontal: 14, paddingVertical: 10, marginTop: 6,
  },
  charCount: { color: '#2E2E2E', fontSize: 10, textAlign: 'right', marginTop: 4 },

  // ── Footer ──────────────────────────────────────────
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 20, paddingBottom: 34, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#141414',
  },
  generateBtn: {
    backgroundColor: '#7C3AED', borderRadius: 18,
    paddingVertical: 16, paddingHorizontal: 20,
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  generateBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  generateBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  generateArrow: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10, width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  generateArrowText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  generateBtnDisabled: { backgroundColor: '#161616', shadowOpacity: 0, elevation: 0 },
  generateBtnTextMuted: { color: '#374151', textAlign: 'center', fontSize: 15 },
});
