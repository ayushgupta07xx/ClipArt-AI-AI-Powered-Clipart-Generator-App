import React, { useRef, useCallback } from 'react';
import {
  View, Image, StyleSheet, PanResponder,
  Animated, Dimensions, Text, Modal,
  TouchableOpacity, SafeAreaView,
} from 'react-native';
import { COLORS } from '../constants';

interface Props {
  beforeUri: string;
  afterUri: string;
  styleName: string;
  visible: boolean;
  onClose: () => void;
}

const { width } = Dimensions.get('window');
const SLIDER_SIZE = width - 48;
const INITIAL_X = SLIDER_SIZE / 2;

export function BeforeAfterSlider({ beforeUri, afterUri, styleName, visible, onClose }: Props) {
  const sliderAnim = useRef(new Animated.Value(INITIAL_X)).current;
  const currentX   = useRef(INITIAL_X);

  // Reset position each time modal opens
  const handleShow = useCallback(() => {
    currentX.current = INITIAL_X;
    sliderAnim.setValue(INITIAL_X);
  }, [sliderAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderMove: (_, { dx }) => {
        const next = Math.max(0, Math.min(SLIDER_SIZE, currentX.current + dx));
        sliderAnim.setValue(next);
      },
      onPanResponderRelease: (_, { dx }) => {
        currentX.current = Math.max(0, Math.min(SLIDER_SIZE, currentX.current + dx));
      },
    })
  ).current;

  const clipWidth = sliderAnim;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={handleShow}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>

          <View style={styles.header}>
            <Text style={styles.headerTitle}>⇄  Before / After — {styleName}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.75}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sliderContainer}>
            <View style={[styles.imageContainer, { width: SLIDER_SIZE, height: SLIDER_SIZE }]}>
              <Image
                source={{ uri: afterUri }}
                style={[styles.image, { width: SLIDER_SIZE, height: SLIDER_SIZE }]}
                resizeMode="cover"
              />
              <Animated.View style={[styles.beforeClip, { width: clipWidth }]}>
                <Image
                  source={{ uri: beforeUri }}
                  style={[styles.image, { width: SLIDER_SIZE, height: SLIDER_SIZE }]}
                  resizeMode="cover"
                />
              </Animated.View>
              <Animated.View style={[styles.divider, { left: sliderAnim }]} />
              <Animated.View
                style={[styles.handle, { left: sliderAnim }]}
                {...panResponder.panHandlers}
              >
                <Text style={styles.handleArrows}>◀ ▶</Text>
              </Animated.View>
              <View style={styles.beforeLabel}>
                <Text style={styles.labelText}>Original</Text>
              </View>
              <View style={styles.afterLabel}>
                <Text style={styles.labelText}>{styleName}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.hint}>Drag the handle to compare</Text>

        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  safeArea:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    width: SLIDER_SIZE, marginBottom: 20,
  },
  headerTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  closeText:       { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
  sliderContainer: { alignItems: 'center' },
  imageContainer:  { borderRadius: 16, overflow: 'hidden', backgroundColor: '#111', position: 'relative' },
  image:           { position: 'absolute', top: 0, left: 0 },
  beforeClip:      { position: 'absolute', top: 0, left: 0, height: '100%', overflow: 'hidden' },
  divider:         { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#FFFFFF' },
  handle: {
    position: 'absolute', top: '50%',
    marginTop: -24, marginLeft: -24,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', elevation: 8,
  },
  handleArrows: { fontSize: 11, color: '#374151', fontWeight: '700' },
  beforeLabel: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5,
  },
  afterLabel: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(124,58,237,0.7)',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5,
  },
  labelText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  hint:      { color: COLORS.textMuted, fontSize: 12, marginTop: 16 },
});
